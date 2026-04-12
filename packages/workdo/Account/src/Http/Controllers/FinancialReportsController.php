<?php

namespace Workdo\Account\Http\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Workdo\Account\Models\JournalEntry;
use Workdo\Account\Models\JournalEntryItem;
use Workdo\Account\Models\ChartOfAccount;
use Workdo\Account\Models\BankTransaction;
use Workdo\Account\Models\FiscalYear;

class FinancialReportsController extends Controller
{
    // =========================================================================
    // IPSAS 1 — Statement of Financial Position (Balance Sheet)
    // =========================================================================

    public function statementOfPosition(Request $request)
    {
        if (!Auth::user()->can('view-statement-of-position')) {
            return back()->with('error', __('Permission denied'));
        }

        $asOfDate = $request->get('as_of_date', now()->toDateString());
        $createdBy = creatorId();

        // Pull all posted journal entry items up to the as_of_date
        $balances = JournalEntryItem::join('journal_entries', 'journal_entry_items.journal_id', '=', 'journal_entries.id')
            ->join('chart_of_accounts', 'journal_entry_items.account_id', '=', 'chart_of_accounts.id')
            ->join('account_categories', 'chart_of_accounts.account_category_id', '=', 'account_categories.id')
            ->where('journal_entries.created_by', $createdBy)
            ->where('journal_entries.status', 'posted')
            ->whereDate('journal_entries.entry_date', '<=', $asOfDate)
            ->select(
                'chart_of_accounts.id as account_id',
                'chart_of_accounts.account_code',
                'chart_of_accounts.account_name',
                'account_categories.type as category_type',
                DB::raw('SUM(journal_entry_items.debit_amount) as total_debit'),
                DB::raw('SUM(journal_entry_items.credit_amount) as total_credit'),
                DB::raw('SUM(journal_entry_items.debit_amount) - SUM(journal_entry_items.credit_amount) as net_balance')
            )
            ->groupBy(
                'chart_of_accounts.id',
                'chart_of_accounts.account_code',
                'chart_of_accounts.account_name',
                'account_categories.type'
            )
            ->get();

        // Group into Assets, Liabilities, Equity
        $assets      = $balances->whereIn('category_type', ['asset', 'Asset'])->values();
        $liabilities = $balances->whereIn('category_type', ['liability', 'Liability'])->values();
        $equity      = $balances->whereIn('category_type', ['equity', 'Equity'])->values();

        $totalAssets      = $assets->sum('net_balance');
        $totalLiabilities = $liabilities->sum(fn ($l) => abs($l->net_balance));
        $totalEquity      = $equity->sum(fn ($e) => abs($e->net_balance));

        return response()->json([
            'as_of_date'       => $asOfDate,
            'assets'           => $assets,
            'liabilities'      => $liabilities,
            'equity'           => $equity,
            'total_assets'     => $totalAssets,
            'total_liabilities'=> $totalLiabilities,
            'total_equity'     => $totalEquity,
            'net_position'     => $totalAssets - $totalLiabilities - $totalEquity,
        ]);
    }

    // =========================================================================
    // IPSAS 1 — Statement of Financial Performance (Income Statement)
    // =========================================================================

    public function statementOfPerformance(Request $request)
    {
        if (!Auth::user()->can('view-statement-of-performance')) {
            return back()->with('error', __('Permission denied'));
        }

        $currentYear = date('Y');
        $fromDate = $request->get('from_date', "$currentYear-01-01");
        $toDate   = $request->get('to_date',   "$currentYear-12-31");
        $createdBy = creatorId();

        $items = JournalEntryItem::join('journal_entries', 'journal_entry_items.journal_id', '=', 'journal_entries.id')
            ->join('chart_of_accounts', 'journal_entry_items.account_id', '=', 'chart_of_accounts.id')
            ->join('account_categories', 'chart_of_accounts.account_category_id', '=', 'account_categories.id')
            ->where('journal_entries.created_by', $createdBy)
            ->where('journal_entries.status', 'posted')
            ->whereDate('journal_entries.entry_date', '>=', $fromDate)
            ->whereDate('journal_entries.entry_date', '<=', $toDate)
            ->whereIn('account_categories.type', ['revenue', 'Revenue', 'expense', 'Expense', 'Income', 'income'])
            ->select(
                'chart_of_accounts.account_code',
                'chart_of_accounts.account_name',
                'account_categories.type as category_type',
                DB::raw('SUM(journal_entry_items.credit_amount) - SUM(journal_entry_items.debit_amount) as net_amount')
            )
            ->groupBy(
                'chart_of_accounts.account_code',
                'chart_of_accounts.account_name',
                'account_categories.type'
            )
            ->get();

        $revenues  = $items->filter(fn ($i) => in_array(strtolower($i->category_type), ['revenue', 'income']))->values();
        $expenses  = $items->filter(fn ($i) => strtolower($i->category_type) === 'expense')->values();

        $totalRevenue  = $revenues->sum('net_amount');
        $totalExpenses = $expenses->sum(fn ($e) => abs($e->net_amount));
        $surplus       = $totalRevenue - $totalExpenses;

        return response()->json([
            'from_date'      => $fromDate,
            'to_date'        => $toDate,
            'revenues'       => $revenues,
            'expenses'       => $expenses,
            'total_revenue'  => $totalRevenue,
            'total_expenses' => $totalExpenses,
            'surplus_deficit'=> $surplus,
        ]);
    }

    // =========================================================================
    // Cash Flow Statement (simplified direct method)
    // =========================================================================

    public function cashFlowStatement(Request $request)
    {
        if (!Auth::user()->can('view-cash-flow')) {
            return back()->with('error', __('Permission denied'));
        }

        $currentYear = date('Y');
        $fromDate = $request->get('from_date', "$currentYear-01-01");
        $toDate   = $request->get('to_date',   "$currentYear-12-31");
        $createdBy = creatorId();

        $transactions = BankTransaction::join('bank_accounts', 'bank_transactions.bank_account_id', '=', 'bank_accounts.id')
            ->where('bank_accounts.created_by', $createdBy)
            ->whereDate('bank_transactions.transaction_date', '>=', $fromDate)
            ->whereDate('bank_transactions.transaction_date', '<=', $toDate)
            ->select(
                'bank_transactions.transaction_type',
                'bank_transactions.amount',
                'bank_transactions.description',
                'bank_transactions.transaction_date',
                'bank_transactions.reference_type',
                'bank_accounts.account_name'
            )
            ->orderBy('bank_transactions.transaction_date')
            ->get();

        $inflows   = $transactions->where('transaction_type', 'credit')->values();
        $outflows  = $transactions->where('transaction_type', 'debit')->values();
        $netCash   = $inflows->sum('amount') - $outflows->sum('amount');

        return response()->json([
            'from_date'     => $fromDate,
            'to_date'       => $toDate,
            'inflows'       => $inflows,
            'outflows'      => $outflows,
            'total_inflows' => $inflows->sum('amount'),
            'total_outflows'=> $outflows->sum('amount'),
            'net_cash_flow' => $netCash,
        ]);
    }

    // =========================================================================
    // Budget vs Actual Report
    // =========================================================================

    public function budgetVsActual(Request $request)
    {
        if (!Auth::user()->can('view-budget-vs-actual')) {
            return back()->with('error', __('Permission denied'));
        }

        $currentYear = date('Y');
        $fromDate  = $request->get('from_date', "$currentYear-01-01");
        $toDate    = $request->get('to_date',   "$currentYear-12-31");
        $createdBy = creatorId();

        // Budget allocations from BudgetPlanner module
        $budgets = DB::table('budget_allocations')
            ->join('budgets', 'budget_allocations.budget_id', '=', 'budgets.id')
            ->join('budget_periods', 'budgets.period_id', '=', 'budget_periods.id')
            ->join('chart_of_accounts', 'budget_allocations.account_id', '=', 'chart_of_accounts.id')
            ->where('budgets.created_by', $createdBy)
            ->whereYear('budget_periods.start_date', date('Y', strtotime($fromDate)))
            ->select(
                'chart_of_accounts.account_name as category',
                'budget_allocations.allocated_amount',
                DB::raw("'' as description"),
                'budgets.budget_name as budget_name'
            )
            ->get();

        // Actual expenses from journal entries
        $actuals = JournalEntryItem::join('journal_entries', 'journal_entry_items.journal_id', '=', 'journal_entries.id')
            ->join('chart_of_accounts', 'journal_entry_items.account_id', '=', 'chart_of_accounts.id')
            ->join('account_categories', 'chart_of_accounts.account_category_id', '=', 'account_categories.id')
            ->where('journal_entries.created_by', $createdBy)
            ->where('journal_entries.status', 'posted')
            ->whereIn('account_categories.type', ['expense', 'Expense'])
            ->whereDate('journal_entries.entry_date', '>=', $fromDate)
            ->whereDate('journal_entries.entry_date', '<=', $toDate)
            ->select(
                'chart_of_accounts.account_name as category',
                DB::raw('SUM(journal_entry_items.debit_amount) as actual_amount')
            )
            ->groupBy('chart_of_accounts.account_name')
            ->get()
            ->keyBy('category');

        // Merge and compute variance
        $report = $budgets->map(function ($budget) use ($actuals) {
            $actual   = $actuals->get($budget->category);
            $actualAmt = $actual ? (float) $actual->actual_amount : 0;
            $variance  = (float) $budget->allocated_amount - $actualAmt;
            $variancePct = $budget->allocated_amount > 0
                ? round(($variance / $budget->allocated_amount) * 100, 2)
                : null;

            return [
                'category'       => $budget->category,
                'budget_name'    => $budget->budget_name,
                'description'    => $budget->description,
                'budget_amount'  => (float) $budget->allocated_amount,
                'actual_amount'  => $actualAmt,
                'variance'       => $variance,
                'variance_pct'   => $variancePct,
                'rag'            => $variancePct === null ? 'grey'
                                    : ($variancePct >= 0 ? 'green'
                                    : ($variancePct >= -10 ? 'amber' : 'red')),
            ];
        });

        return response()->json([
            'from_date'      => $fromDate,
            'to_date'        => $toDate,
            'report'         => $report,
            'total_budget'   => $budgets->sum('allocated_amount'),
            'total_actual'   => $actuals->sum('actual_amount'),
            'total_variance' => $budgets->sum('allocated_amount') - $actuals->sum('actual_amount'),
        ]);
    }

    // =========================================================================
    // Print versions — render Inertia pages
    // =========================================================================

    public function printStatementOfPosition(Request $request)
    {
        if (!Auth::user()->can('print-statement-of-position')) {
            return back()->with('error', __('Permission denied'));
        }
        $data = json_decode($this->statementOfPosition($request)->content(), true);
        return Inertia::render('Account/Reports/Print/StatementOfPosition', ['data' => $data]);
    }

    public function printStatementOfPerformance(Request $request)
    {
        if (!Auth::user()->can('print-statement-of-performance')) {
            return back()->with('error', __('Permission denied'));
        }
        $data = json_decode($this->statementOfPerformance($request)->content(), true);
        return Inertia::render('Account/Reports/Print/StatementOfPerformance', ['data' => $data]);
    }

    public function printCashFlow(Request $request)
    {
        if (!Auth::user()->can('print-cash-flow')) {
            return back()->with('error', __('Permission denied'));
        }
        $data = json_decode($this->cashFlowStatement($request)->content(), true);
        return Inertia::render('Account/Reports/Print/CashFlow', ['data' => $data]);
    }

    public function printBudgetVsActual(Request $request)
    {
        if (!Auth::user()->can('print-budget-vs-actual')) {
            return back()->with('error', __('Permission denied'));
        }
        $data = json_decode($this->budgetVsActual($request)->content(), true);
        return Inertia::render('Account/Reports/Print/BudgetVsActual', ['data' => $data]);
    }
}
