<?php

namespace Workdo\DoubleEntry\Services;

use Workdo\Account\Models\ChartOfAccount;
use Workdo\Account\Models\OpeningBalance;
use Workdo\Account\Models\JournalEntry;
use Workdo\Account\Models\JournalEntryItem;
use Illuminate\Support\Facades\DB;

class ReportService
{
    public function getGeneralLedger($filters = [])
    {
        $accountId = $filters['account_id'] ?? null;
        $fromDate = $filters['from_date'] ?? null;
        $toDate = $filters['to_date'] ?? null;

        $query = JournalEntryItem::select(
                'journal_entry_items.id',
                'journal_entries.journal_date',
                'journal_entries.reference_type',
                'journal_entries.reference_id',
                'journal_entry_items.description',
                'journal_entry_items.debit_amount',
                'journal_entry_items.credit_amount',
                'chart_of_accounts.account_code',
                'chart_of_accounts.account_name'
            )
            ->join('journal_entries', 'journal_entry_items.journal_entry_id', '=', 'journal_entries.id')
            ->join('chart_of_accounts', 'journal_entry_items.account_id', '=', 'chart_of_accounts.id')
            ->where('journal_entries.status', 'posted')
            ->where('journal_entries.created_by', creatorId())
            ->when($accountId, fn($q) => $q->where('journal_entry_items.account_id', $accountId))
            ->when($fromDate, fn($q) => $q->where('journal_entries.journal_date', '>=', $fromDate))
            ->when($toDate, fn($q) => $q->where('journal_entries.journal_date', '<=', $toDate))
            ->orderBy('journal_entries.journal_date', 'asc')
            ->orderBy('journal_entry_items.id', 'asc');

        $entries = $query->get();

        $openingBalance = 0;
        if ($accountId && $fromDate) {
            $openingBalance = $this->getOpeningBalance($accountId, $fromDate);
        }

        $runningBalance = $openingBalance;
        $transactions = $entries->map(function ($entry) use (&$runningBalance) {
            $runningBalance += $entry->debit_amount - $entry->credit_amount;
            return [
                'id' => $entry->id,
                'date' => $entry->journal_date,
                'account_code' => $entry->account_code,
                'account_name' => $entry->account_name,
                'description' => $entry->description,
                'reference_type' => $entry->reference_type,
                'reference_id' => $entry->reference_id,
                'debit' => $entry->debit_amount,
                'credit' => $entry->credit_amount,
                'balance' => $runningBalance,
            ];
        });

        return [
            'opening_balance' => $openingBalance,
            'transactions' => $transactions,
            'closing_balance' => $runningBalance,
        ];
    }

    public function getOpeningBalance($accountId, $date)
    {
        $openingBalance = OpeningBalance::where('account_id', $accountId)
            ->where('created_by', creatorId())
            ->first();

        $balance = $openingBalance ? ($openingBalance->debit_amount - $openingBalance->credit_amount) : 0;

        $priorTransactions = JournalEntryItem::join('journal_entries', 'journal_entry_items.journal_entry_id', '=', 'journal_entries.id')
            ->where('journal_entry_items.account_id', $accountId)
            ->where('journal_entries.status', 'posted')
            ->where('journal_entries.created_by', creatorId())
            ->where('journal_entries.journal_date', '<', $date)
            ->select(
                DB::raw('SUM(journal_entry_items.debit_amount) as total_debit'),
                DB::raw('SUM(journal_entry_items.credit_amount) as total_credit')
            )
            ->first();

        if ($priorTransactions) {
            $balance += ($priorTransactions->total_debit ?? 0) - ($priorTransactions->total_credit ?? 0);
        }

        return $balance;
    }

    public function getJournalEntries($filters = [])
    {
        $query = JournalEntry::with(['items.account'])
            ->where('created_by', creatorId())
            ->when($filters['from_date'] ?? null, fn($q, $date) => $q->where('journal_date', '>=', $date))
            ->when($filters['to_date'] ?? null, fn($q, $date) => $q->where('journal_date', '<=', $date))
            ->when($filters['status'] ?? null, fn($q, $status) => $q->where('status', $status))
            ->orderBy('journal_date', 'desc')
            ->orderBy('id', 'desc')
            ->get();

        return $query->map(function ($entry) {
            $totalDebit = $entry->items->sum('debit_amount');
            $totalCredit = $entry->items->sum('credit_amount');

            return [
                'id' => $entry->id,
                'journal_number' => $entry->journal_number ?? 'JE-' . $entry->id,
                'date' => $entry->journal_date,
                'reference_type' => $entry->reference_type,
                'description' => $entry->description,
                'total_debit' => $totalDebit,
                'total_credit' => $totalCredit,
                'status' => $entry->status,
                'is_balanced' => abs($totalDebit - $totalCredit) < 0.01,
                'items' => $entry->items->map(fn($item) => [
                    'account_code' => $item->account->account_code ?? '',
                    'account_name' => $item->account->account_name ?? '',
                    'description' => $item->description,
                    'debit' => $item->debit_amount,
                    'credit' => $item->credit_amount,
                ]),
            ];
        });
    }

    public function getAccountBalances($filters = [])
    {
        $asOfDate = $filters['as_of_date'] ?? date('Y-m-d');
        $accountType = $filters['account_type'] ?? null;
        $showZeroBalances = $filters['show_zero_balances'] ?? false;

        $accounts = ChartOfAccount::where('created_by', creatorId())
            ->orderBy('account_code')
            ->get();

        if ($accountType && trim($accountType)) {
            $accounts = $accounts->filter(function($account) use ($accountType) {
                return $this->getAccountTypeLabel($account->account_code) === $accountType;
            });
        }

        $grouped = [];
        $totals = ['debit' => 0, 'credit' => 0, 'net' => 0];

        foreach ($accounts as $account) {
            $balance = $this->calculateAccountBalance($account->id, $asOfDate);
            
            if (!$showZeroBalances && abs($balance) < 0.01) {
                continue;
            }

            $debit = $balance > 0 ? $balance : 0;
            $credit = $balance < 0 ? abs($balance) : 0;

            $type = $this->getAccountTypeLabel($account->account_code);

            if (!isset($grouped[$type])) {
                $grouped[$type] = ['accounts' => [], 'subtotal_debit' => 0, 'subtotal_credit' => 0, 'subtotal_net' => 0];
            }

            $grouped[$type]['accounts'][] = [
                'account_code' => $account->account_code,
                'account_name' => $account->account_name,
                'account_type' => $type,
                'debit' => $debit,
                'credit' => $credit,
                'net_balance' => $balance,
            ];

            $grouped[$type]['subtotal_debit'] += $debit;
            $grouped[$type]['subtotal_credit'] += $credit;
            $grouped[$type]['subtotal_net'] += $balance;

            $totals['debit'] += $debit;
            $totals['credit'] += $credit;
            $totals['net'] += $balance;
        }

        return [
            'grouped' => $grouped,
            'totals' => $totals,
            'as_of_date' => $asOfDate,
        ];
    }

    private function calculateAccountBalance($accountId, $asOfDate)
    {
        $openingBalance = OpeningBalance::where('account_id', $accountId)
            ->where('created_by', creatorId())
            ->first();

        $balance = $openingBalance ? ($openingBalance->debit_amount - $openingBalance->credit_amount) : 0;

        $transactions = JournalEntryItem::join('journal_entries', 'journal_entry_items.journal_entry_id', '=', 'journal_entries.id')
            ->where('journal_entry_items.account_id', $accountId)
            ->where('journal_entries.status', 'posted')
            ->where('journal_entries.created_by', creatorId())
            ->where('journal_entries.journal_date', '<=', $asOfDate)
            ->select(
                DB::raw('SUM(journal_entry_items.debit_amount) as total_debit'),
                DB::raw('SUM(journal_entry_items.credit_amount) as total_credit')
            )
            ->first();

        if ($transactions) {
            $balance += ($transactions->total_debit ?? 0) - ($transactions->total_credit ?? 0);
        }

        return $balance;
    }

    private function getAccountTypeLabel($accountCode)
    {
        $code = (int) $accountCode;
        if ($code >= 1000 && $code < 2000) return 'Assets';
        if ($code >= 2000 && $code < 3000) return 'Liabilities';
        if ($code >= 3000 && $code < 4000) return 'Equity';
        if ($code >= 4000 && $code < 5000) return 'Revenue';
        if ($code >= 5000 && $code < 6000) return 'Expenses';
        return 'Other';
    }

    public function getIncomeStatement($filters = [])
    {
        $fromDate = $filters['from_date'] ?? date('Y') . '-01-01';
        $toDate = $filters['to_date'] ?? date('Y') . '-12-31';
        $showZeroBalances = $filters['show_zero_balances'] ?? false;

        $accounts = ChartOfAccount::where('created_by', creatorId())
            ->where(function($q) {
                $q->whereBetween('account_code', [4000, 5999]);
            })
            ->orderBy('account_code')
            ->get();

        $revenue = [];
        $cogs = [];
        $expenses = [];
        $totalRevenue = 0;
        $totalCogs = 0;
        $totalExpenses = 0;

        foreach ($accounts as $account) {
            $balance = $this->getAccountBalanceForPeriod($account->id, $fromDate, $toDate);
            
            if (!$showZeroBalances && abs($balance) < 0.01) {
                continue;
            }

            $code = (int) $account->account_code;
            $item = [
                'account_code' => $account->account_code,
                'account_name' => $account->account_name,
                'amount' => abs($balance),
            ];

            if ($code >= 4000 && $code < 5000) {
                $revenue[] = $item;
                $totalRevenue += abs($balance);
            } elseif ($code >= 5000 && $code < 5100) {
                $cogs[] = $item;
                $totalCogs += abs($balance);
            } elseif ($code >= 5100 && $code < 6000) {
                $expenses[] = $item;
                $totalExpenses += abs($balance);
            }
        }

        $grossProfit = $totalRevenue - $totalCogs;
        $operatingIncome = $grossProfit - $totalExpenses;
        $netIncome = $operatingIncome;

        return [
            'revenue' => $revenue,
            'cogs' => $cogs,
            'expenses' => $expenses,
            'total_revenue' => $totalRevenue,
            'total_cogs' => $totalCogs,
            'total_expenses' => $totalExpenses,
            'gross_profit' => $grossProfit,
            'operating_income' => $operatingIncome,
            'net_income' => $netIncome,
            'from_date' => $fromDate,
            'to_date' => $toDate,
        ];
    }

    private function getAccountBalanceForPeriod($accountId, $fromDate, $toDate)
    {
        $transactions = JournalEntryItem::join('journal_entries', 'journal_entry_items.journal_entry_id', '=', 'journal_entries.id')
            ->where('journal_entry_items.account_id', $accountId)
            ->where('journal_entries.status', 'posted')
            ->where('journal_entries.created_by', creatorId())
            ->whereBetween('journal_entries.journal_date', [$fromDate, $toDate])
            ->select(
                DB::raw('SUM(journal_entry_items.credit_amount) as total_credit'),
                DB::raw('SUM(journal_entry_items.debit_amount) as total_debit')
            )
            ->first();

        return ($transactions->total_credit ?? 0) - ($transactions->total_debit ?? 0);
    }

    // =========================================================================
    // IPSAS 2 — Cash Flow Statement (Direct Method)
    //
    // Strategy:
    //   1. Identify all cash & bank GL accounts (codes 1000–1099).
    //   2. Compute opening cash balance at period start.
    //   3. Pull every posted JE line that touches a cash account in the period.
    //   4. For each such line, look at the *other* side of the journal entry
    //      and classify:
    //        • reference_type 'customer_payment', 'revenue'        → Operating receipt
    //        • reference_type 'vendor_payment', 'expense'          → Operating payment
    //        • reference_type 'bank_transfer', 'year_end_close'    → skip (internal)
    //        • Opposing account in 1100–1999 (non-cash assets)     → Investing
    //        • Opposing account in 2500–3999 (long-term L + NA)    → Financing
    //        • Everything else                                      → Operating
    //   5. Aggregate line amounts into the three activity categories.
    // =========================================================================

    public function getCashFlow(array $filters = []): array
    {
        $fromDate = $filters['from_date'] ?? date('Y') . '-01-01';
        $toDate   = $filters['to_date']   ?? date('Y') . '-12-31';
        $creator  = creatorId();

        // ------------------------------------------------------------------
        // 1. Cash & bank account IDs (1000–1099)
        // ------------------------------------------------------------------
        $cashAccountIds = ChartOfAccount::where('created_by', $creator)
            ->whereBetween('account_code', ['1000', '1099'])
            ->pluck('id')
            ->toArray();

        // ------------------------------------------------------------------
        // 2. Opening cash balance (all cash accounts at start of period)
        // ------------------------------------------------------------------
        $openingCash = 0;
        foreach ($cashAccountIds as $aid) {
            $openingCash += $this->calculateAccountBalance($aid, $fromDate);
        }

        // ------------------------------------------------------------------
        // 3. All posted JE lines that hit a cash account during the period
        // ------------------------------------------------------------------
        if (empty($cashAccountIds)) {
            return $this->emptyCashFlowResult($fromDate, $toDate, $openingCash);
        }

        $placeholders = implode(',', array_fill(0, count($cashAccountIds), '?'));

        $cashLines = DB::select("
            SELECT
                jei.id,
                jei.journal_entry_id,
                jei.account_id,
                jei.debit_amount,
                jei.credit_amount,
                je.reference_type,
                je.journal_date
            FROM journal_entry_items jei
            JOIN journal_entries je ON jei.journal_entry_id = je.id
            WHERE je.status       = 'posted'
              AND je.created_by   = ?
              AND je.journal_date >= ?
              AND je.journal_date <= ?
              AND jei.account_id  IN ({$placeholders})
        ", array_merge([$creator, $fromDate, $toDate], $cashAccountIds));

        // ------------------------------------------------------------------
        // 4. Classify each cash movement
        // ------------------------------------------------------------------
        // reference_type → activity
        $refTypeMap = [
            'customer_payment' => 'operating',
            'revenue'          => 'operating',
            'vendor_payment'   => 'operating',
            'expense'          => 'operating',
            'bank_transfer'    => 'skip',
            'year_end_close'   => 'skip',
        ];

        // Buckets: operating_receipts, operating_payments, investing, financing
        $operatingReceipts  = 0;
        $operatingPayments  = 0;
        $investingInflows   = 0;
        $investingOutflows  = 0;
        $financingInflows   = 0;
        $financingOutflows  = 0;

        // Cache of all lines per journal entry to find opposing accounts
        $jeLineCache = [];

        foreach ($cashLines as $line) {
            $refType = $line->reference_type ?? 'manual';

            // Skip internal transfers and year-end closing entries
            if (($refTypeMap[$refType] ?? '') === 'skip') {
                continue;
            }

            // Net cash movement: debit to cash = inflow, credit to cash = outflow
            $netMovement = $line->debit_amount - $line->credit_amount;
            if (abs($netMovement) < 0.01) {
                continue;
            }

            // Determine activity from reference_type first
            $activity = $refTypeMap[$refType] ?? null;

            if ($activity === null) {
                // Manual journal or unknown: inspect the opposing account code
                $activity = $this->classifyByOpposingAccount(
                    $line->journal_entry_id,
                    $cashAccountIds,
                    $jeLineCache,
                    $creator
                );
            }

            switch ($activity) {
                case 'investing':
                    if ($netMovement >= 0) {
                        $investingInflows  += $netMovement;
                    } else {
                        $investingOutflows += abs($netMovement);
                    }
                    break;
                case 'financing':
                    if ($netMovement >= 0) {
                        $financingInflows  += $netMovement;
                    } else {
                        $financingOutflows += abs($netMovement);
                    }
                    break;
                default: // operating
                    if ($netMovement >= 0) {
                        $operatingReceipts  += $netMovement;
                    } else {
                        $operatingPayments  += abs($netMovement);
                    }
            }
        }

        $netOperating  = $operatingReceipts  - $operatingPayments;
        $netInvesting  = $investingInflows   - $investingOutflows;
        $netFinancing  = $financingInflows   - $financingOutflows;
        $netMovement   = $netOperating + $netInvesting + $netFinancing;
        $closingCash   = $openingCash + $netMovement;

        return [
            'from_date'           => $fromDate,
            'to_date'             => $toDate,
            'opening_cash'        => $openingCash,

            'operating_receipts'  => $operatingReceipts,
            'operating_payments'  => $operatingPayments,
            'net_operating'       => $netOperating,

            'investing_inflows'   => $investingInflows,
            'investing_outflows'  => $investingOutflows,
            'net_investing'       => $netInvesting,

            'financing_inflows'   => $financingInflows,
            'financing_outflows'  => $financingOutflows,
            'net_financing'       => $netFinancing,

            'net_movement'        => $netMovement,
            'closing_cash'        => $closingCash,

            // Kept for backward compat with any existing consumers
            'beginning_cash'      => $openingCash,
            'operating'           => $netOperating,
            'investing'           => $netInvesting,
            'financing'           => $netFinancing,
            'net_cash_flow'       => $netMovement,
            'ending_cash'         => $closingCash,
        ];
    }

    /**
     * Inspect the opposing (non-cash) account codes in a JE to determine activity.
     * Caches the full JE line set to avoid repeated queries.
     */
    private function classifyByOpposingAccount(
        int   $journalEntryId,
        array $cashAccountIds,
        array &$cache,
        int   $creator
    ): string {
        if (!isset($cache[$journalEntryId])) {
            $cache[$journalEntryId] = DB::select("
                SELECT jei.account_id, coa.account_code
                FROM journal_entry_items jei
                JOIN chart_of_accounts coa ON jei.account_id = coa.id
                WHERE jei.journal_entry_id = ?
                  AND jei.created_by = ?
            ", [$journalEntryId, $creator]);
        }

        foreach ($cache[$journalEntryId] as $line) {
            if (in_array($line->account_id, $cashAccountIds, true)) {
                continue; // skip the cash line itself
            }
            $code = intval($line->account_code);
            // Non-cash assets (PPE, investments, intangibles): 1100–1999
            if ($code >= 1100 && $code <= 1999) {
                return 'investing';
            }
            // Long-term liabilities, provisions, net assets: 2500–3999
            if ($code >= 2500 && $code <= 3999) {
                return 'financing';
            }
        }

        return 'operating';
    }

    private function emptyCashFlowResult(string $fromDate, string $toDate, float $openingCash): array
    {
        return [
            'from_date'          => $fromDate,
            'to_date'            => $toDate,
            'opening_cash'       => $openingCash,
            'operating_receipts' => 0,
            'operating_payments' => 0,
            'net_operating'      => 0,
            'investing_inflows'  => 0,
            'investing_outflows' => 0,
            'net_investing'      => 0,
            'financing_inflows'  => 0,
            'financing_outflows' => 0,
            'net_financing'      => 0,
            'net_movement'       => 0,
            'closing_cash'       => $openingCash,
            'beginning_cash'     => $openingCash,
            'operating'          => 0,
            'investing'          => 0,
            'financing'          => 0,
            'net_cash_flow'      => 0,
            'ending_cash'        => $openingCash,
        ];
    }

    public function getExpenseReport($filters = [])
    {
        $fromDate = $filters['from_date'] ?? date('Y') . '-01-01';
        $toDate = $filters['to_date'] ?? date('Y') . '-12-31';

        $accounts = ChartOfAccount::where('created_by', creatorId())
            ->whereBetween('account_code', [5000, 5999])
            ->orderBy('account_code')
            ->get();

        $expenses = [];
        $totalExpenses = 0;

        foreach ($accounts as $account) {
            $balance = $this->getAccountBalanceForPeriod($account->id, $fromDate, $toDate);
            
            if (abs($balance) < 0.01) {
                continue;
            }

            $expenses[] = [
                'account_code' => $account->account_code,
                'account_name' => $account->account_name,
                'amount' => abs($balance),
            ];

            $totalExpenses += abs($balance);
        }

        usort($expenses, fn($a, $b) => $b['amount'] <=> $a['amount']);

        return [
            'expenses' => $expenses,
            'total_expenses' => $totalExpenses,
            'from_date' => $fromDate,
            'to_date' => $toDate,
        ];
    }
}
