<?php

namespace Workdo\DoubleEntry\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Workdo\Account\Models\ChartOfAccount;
use Workdo\Account\Models\JournalEntry;
use Workdo\Account\Models\JournalEntryItem;
use Workdo\DoubleEntry\Models\BalanceSheet;
use Workdo\DoubleEntry\Services\BalanceSheetService;

class DiagnosticsController extends Controller
{
    protected BalanceSheetService $balanceSheetService;

    public function __construct(BalanceSheetService $balanceSheetService)
    {
        $this->balanceSheetService = $balanceSheetService;
    }

    public function index()
    {
        if (!Auth::user()->can('manage-balance-sheets')) {
            return back()->with('error', __('Permission denied'));
        }

        $creatorId = creatorId();

        // 1. Overall trial balance
        $trialBalance = DB::selectOne("
            SELECT
                COALESCE(SUM(jei.debit_amount), 0)  AS total_debits,
                COALESCE(SUM(jei.credit_amount), 0) AS total_credits,
                COALESCE(SUM(jei.debit_amount), 0) - COALESCE(SUM(jei.credit_amount), 0) AS gap
            FROM journal_entry_items jei
            JOIN journal_entries je ON jei.journal_entry_id = je.id
            WHERE je.status = 'posted'
              AND je.created_by = ?
        ", [$creatorId]);

        // 2. Unbalanced journal entries
        $unbalancedEntries = DB::select("
            SELECT
                je.id, je.journal_number, je.journal_date, je.description,
                je.entry_type, je.reference_type, je.status,
                COALESCE(SUM(jei.debit_amount), 0)  AS total_debits,
                COALESCE(SUM(jei.credit_amount), 0) AS total_credits,
                COALESCE(SUM(jei.debit_amount), 0) - COALESCE(SUM(jei.credit_amount), 0) AS imbalance
            FROM journal_entries je
            LEFT JOIN journal_entry_items jei ON je.id = jei.journal_entry_id
            WHERE je.status = 'posted'
              AND je.created_by = ?
            GROUP BY je.id, je.journal_number, je.journal_date, je.description,
                     je.entry_type, je.reference_type, je.status
            HAVING ABS(COALESCE(SUM(jei.debit_amount), 0) - COALESCE(SUM(jei.credit_amount), 0)) > 0.01
            ORDER BY je.journal_date DESC
        ", [$creatorId]);

        // 3. For each unbalanced entry, get its line items
        $unbalancedWithItems = collect($unbalancedEntries)->map(function ($entry) use ($creatorId) {
            $items = DB::select("
                SELECT jei.id, jei.debit_amount, jei.credit_amount, jei.description AS line_description,
                       coa.account_code, coa.account_name, coa.normal_balance
                FROM journal_entry_items jei
                JOIN chart_of_accounts coa ON jei.account_id = coa.id
                WHERE jei.journal_entry_id = ?
                ORDER BY jei.id
            ", [$entry->id]);

            return array_merge((array) $entry, ['items' => $items]);
        });

        // 4. Opening balance issues: net assets accounts with opening balances
        $openingBalanceIssues = DB::select("
            SELECT account_code, account_name, normal_balance,
                   COALESCE(opening_balance, 0) AS opening_balance,
                   COALESCE(current_balance, 0) AS current_balance
            FROM chart_of_accounts
            WHERE account_code BETWEEN '3000' AND '3999'
              AND is_active = 1
              AND created_by = ?
              AND ABS(COALESCE(opening_balance, 0)) > 0.01
            ORDER BY account_code
        ", [$creatorId]);

        // 5. Balance sheet status
        $balanceSheets = BalanceSheet::where('created_by', $creatorId)
            ->select('id', 'balance_sheet_date', 'financial_year', 'total_assets',
                     'total_liabilities', 'total_equity', 'is_balanced', 'status')
            ->orderBy('balance_sheet_date', 'desc')
            ->get();

        // 6. Account list for the correcting-entry form
        $accounts = ChartOfAccount::where('created_by', $creatorId)
            ->where('is_active', 1)
            ->select('id', 'account_code', 'account_name', 'normal_balance')
            ->orderBy('account_code')
            ->get();

        return Inertia::render('DoubleEntry/Diagnostics/Index', [
            'trialBalance'         => $trialBalance,
            'unbalancedEntries'    => $unbalancedWithItems,
            'openingBalanceIssues' => $openingBalanceIssues,
            'balanceSheets'        => $balanceSheets,
            'accounts'             => $accounts,
        ]);
    }

    /**
     * Create a correcting journal entry line item for an unbalanced entry.
     * The admin specifies which account to post the missing side to.
     */
    public function createCorrectingEntry(Request $request, int $journalEntryId)
    {
        if (!Auth::user()->can('manage-balance-sheets')) {
            return back()->with('error', __('Permission denied'));
        }

        $request->validate([
            'account_id'  => 'required|integer|exists:chart_of_accounts,id',
            'description' => 'required|string|max:500',
        ]);

        $entry = JournalEntry::where('id', $journalEntryId)
            ->where('created_by', creatorId())
            ->where('status', 'posted')
            ->firstOrFail();

        $currentDebits  = $entry->items()->sum('debit_amount');
        $currentCredits = $entry->items()->sum('credit_amount');
        $gap            = round($currentDebits - $currentCredits, 2); // positive = need more credits

        if (abs($gap) < 0.01) {
            return back()->with('info', __('This journal entry is already balanced.'));
        }

        // Add the correcting line
        JournalEntryItem::create([
            'journal_entry_id' => $entry->id,
            'account_id'       => $request->account_id,
            'description'      => $request->description,
            'debit_amount'     => $gap < 0 ? abs($gap) : 0,   // gap<0 means missing debits
            'credit_amount'    => $gap > 0 ? $gap        : 0,  // gap>0 means missing credits
            'creator_id'       => Auth::id(),
            'created_by'       => creatorId(),
        ]);

        // Sync the header totals
        $entry->update([
            'total_debit'  => $entry->items()->sum('debit_amount'),
            'total_credit' => $entry->items()->sum('credit_amount'),
        ]);

        return back()->with('success', __('Correcting line added. Journal entry is now balanced.'));
    }

    /**
     * Rebuild (recalculate) a stored balance sheet from live journal data.
     */
    public function rebuildBalanceSheet(int $balanceSheetId)
    {
        if (!Auth::user()->can('manage-balance-sheets')) {
            return back()->with('error', __('Permission denied'));
        }

        $bs = BalanceSheet::where('id', $balanceSheetId)
            ->where('created_by', creatorId())
            ->firstOrFail();

        // Wipe old items and regenerate
        $bs->items()->delete();
        $bs->delete();

        try {
            $newId = $this->balanceSheetService->generateBalanceSheet(
                $bs->balance_sheet_date->format('Y-m-d'),
                $bs->financial_year
            );
            return redirect()->route('double-entry.balance-sheets.show', $newId)
                ->with('success', __('Balance sheet rebuilt successfully.'));
        } catch (\Exception $e) {
            return back()->with('error', $e->getMessage());
        }
    }
}
