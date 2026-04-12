<?php

namespace Workdo\BudgetPlanner\Services;

use Illuminate\Support\Facades\Auth;
use Workdo\Account\Models\ChartOfAccount;
use Workdo\Account\Models\JournalEntryItem;
use Workdo\BudgetPlanner\Models\Budget;
use Workdo\BudgetPlanner\Models\BudgetAllocation;
use Workdo\BudgetPlanner\Models\BudgetMonitoring;
use Workdo\BudgetPlanner\Models\BudgetPeriod;
use Workdo\BudgetPlanner\Models\BudgetVariance;

class BudgetService
{
    // ──────────────────────────────────────────────────────────────────────────
    // Spending update — triggered by UpdateBudgetSpending event
    // ──────────────────────────────────────────────────────────────────────────

    public function updateBudgetSpendingForAccounts($journalEntry): void
    {
        $affectedAccounts = $journalEntry->items->pluck('account_id')->unique();

        foreach ($affectedAccounts as $accountId) {
            $activeBudgets = Budget::where('status', 'active')
                ->whereHas('allocations', function ($q) use ($accountId) {
                    $q->where('account_id', $accountId);
                })->get();

            if ($activeBudgets->isEmpty()) {
                continue;
            }

            foreach ($activeBudgets as $budget) {
                $this->updateBudgetSpending($budget->id);
            }
        }
    }

    public function updateBudgetSpending(int $budgetId): bool
    {
        $budget = Budget::with('budgetPeriod')->find($budgetId);
        $period = $budget->budgetPeriod;

        $allocations = BudgetAllocation::where('budget_id', $budgetId)->get();

        foreach ($allocations as $allocation) {
            $actualSpent = $this->calculateActualSpending(
                $allocation->account_id,
                $period->start_date,
                $period->end_date
            );

            // remaining_amount = allocated − spent (without commitment deduction,
            // as remaining is the "unspent" figure used in IPSAS variance reporting).
            // available_amount (on the model) = allocated − committed − spent.
            $allocation->spent_amount     = $actualSpent;
            $allocation->remaining_amount = $allocation->allocated_amount - $actualSpent;
            $allocation->save();
        }

        $this->createBudgetMonitoring($budgetId);
        $this->createVarianceSnapshot($budgetId);

        return true;
    }

    public function calculateActualSpending($accountId, $startDate, $endDate): float
    {
        $account = ChartOfAccount::find($accountId);

        if (!$account) {
            return 0;
        }

        $startDate = $startDate->format('Y-m-d');
        $endDate   = $endDate->format('Y-m-d');

        $items = JournalEntryItem::where('account_id', $accountId)
            ->whereHas('journalEntry', function ($q) use ($startDate, $endDate) {
                $q->whereBetween('journal_date', [$startDate, $endDate])
                  ->where('status', 'posted');
            })->get();

        $totalDebit  = $items->sum('debit_amount');
        $totalCredit = $items->sum('credit_amount');

        // Works for both debit-normal (expense) and credit-normal (revenue) accounts
        if ($account->normal_balance === 'debit') {
            $actualSpent = $totalDebit - $totalCredit;
        } else {
            $actualSpent = $totalCredit - $totalDebit;
        }

        return max(0, $actualSpent);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Monitoring snapshot
    // ──────────────────────────────────────────────────────────────────────────

    public function createBudgetMonitoring(int $budgetId): int
    {
        $budget      = Budget::find($budgetId);
        $allocations = $budget->allocations;

        $totalAllocated  = $allocations->sum('allocated_amount');
        $totalCommitted  = $allocations->sum('committed_amount');
        $totalSpent      = $allocations->sum('spent_amount');
        $totalRemaining  = $allocations->sum('remaining_amount');
        $varianceAmount  = $totalAllocated - $totalSpent;
        $variancePct     = $totalAllocated > 0 ? ($varianceAmount / $totalAllocated) * 100 : 0;

        $monitoring                     = new BudgetMonitoring();
        $monitoring->budget_id          = $budgetId;
        $monitoring->monitoring_date    = now();
        $monitoring->total_allocated    = $totalAllocated;
        $monitoring->total_committed    = $totalCommitted;
        $monitoring->total_spent        = $totalSpent;
        $monitoring->total_remaining    = $totalRemaining;
        $monitoring->variance_amount    = $varianceAmount;
        $monitoring->variance_percentage = $variancePct;
        $monitoring->creator_id         = Auth::id();
        $monitoring->created_by         = creatorId();
        $monitoring->save();

        return $monitoring->id;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Per-allocation variance snapshot (IPSAS budget_variance table)
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Create one BudgetVariance row per allocation for the given budget.
     * Captures a point-in-time variance record: budgeted vs actual vs committed.
     * Called automatically after each spending update so auditors can track
     * per-line variance history over time.
     */
    public function createVarianceSnapshot(int $budgetId): void
    {
        $budget      = Budget::with(['allocations', 'voteCostCentre'])->find($budgetId);
        $allocations = $budget->allocations;

        foreach ($allocations as $allocation) {
            $budgeted  = (float) $allocation->allocated_amount;
            $actual    = (float) $allocation->spent_amount;
            $committed = (float) $allocation->committed_amount;
            $variance  = $budgeted - $actual;
            $variancePct = $budgeted > 0 ? round(($variance / $budgeted) * 100, 2) : 0;

            BudgetVariance::create([
                'budget_id'              => $budgetId,
                'budget_allocation_id'   => $allocation->id,
                'vote_cost_centre_id'    => $budget->vote_cost_centre_id,
                'account_id'             => $allocation->account_id,
                'economic_classification'=> $allocation->economic_classification,
                'budgeted_amount'        => $budgeted,
                'committed_amount'       => $committed,
                'actual_amount'          => $actual,
                'variance'               => $variance,
                'variance_percentage'    => $variancePct,
                'snapshot_date'          => now()->toDateString(),
                'creator_id'             => Auth::id(),
                'created_by'             => $budget->created_by,
            ]);
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Budget Performance Report data (IPSAS 24)
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Builds row data for the IPSAS 24 Budget Performance Report.
     *
     * Returns per-allocation rows with:
     *   Vote | Fund | Economic Classification | GL Account |
     *   Original Budget | Revised Budget | Final Budget |
     *   Q1–Q4 Budget | Q1–Q4 Actual | Full Year Actual |
     *   Committed | Variance | Variance %
     *
     * Uses a single bulk JournalEntryItem query per period (not per allocation)
     * to keep the query count at O(1) regardless of allocation count.
     */
    public function getBudgetExecutionStatement(int $periodId, int $createdBy): array
    {
        $period = BudgetPeriod::find($periodId);
        if (!$period) {
            return [];
        }

        $qDates = $this->getQuarterDateRanges($period->start_date, $period->end_date);

        // Original budgets for this period
        $originalBudgets = Budget::with(['allocations.account', 'voteCostCentre'])
            ->where('period_id', $periodId)
            ->where('status', 'active')
            ->where('budget_subtype', 'original')
            ->where('created_by', $createdBy)
            ->get();

        // Revised / supplementary budgets keyed by parent_budget_id
        $revisedBudgets = Budget::with(['allocations'])
            ->where('period_id', $periodId)
            ->whereIn('budget_subtype', ['revised', 'supplementary'])
            ->where('created_by', $createdBy)
            ->get()
            ->keyBy('parent_budget_id');

        // ── Bulk quarterly actuals in a single query ──────────────────────────
        $accountIds = $originalBudgets
            ->flatMap(fn($b) => $b->allocations->pluck('account_id'))
            ->unique()->values()->all();

        $qActuals = $this->computeAllQuarterlyActuals($accountIds, $qDates, $period);
        // ─────────────────────────────────────────────────────────────────────

        $rows = [];

        foreach ($originalBudgets as $budget) {
            $revisedBudget = $revisedBudgets->get($budget->id);

            foreach ($budget->allocations as $allocation) {
                $revisedAllocation = null;
                if ($revisedBudget) {
                    $revisedAllocation = $revisedBudget->allocations
                        ->where('account_id', $allocation->account_id)
                        ->where('economic_classification', $allocation->economic_classification)
                        ->first();
                }

                $originalAmount = (float) $allocation->allocated_amount;
                $revisedAmount  = $revisedAllocation ? (float) $revisedAllocation->allocated_amount : null;
                $finalBudget    = $revisedAmount ?? $originalAmount;

                $qa  = $qActuals[$allocation->account_id] ?? [0.0, 0.0, 0.0, 0.0];
                $fullYearActual = $qa[0] + $qa[1] + $qa[2] + $qa[3];

                $rows[] = [
                    'vote_id'                 => $budget->vote_cost_centre_id,
                    'vote_code'               => $budget->voteCostCentre?->code ?? '-',
                    'vote_name'               => $budget->voteCostCentre?->name ?? '-',
                    'fund_type'               => $budget->fund_type,
                    'economic_classification' => $allocation->economic_classification,
                    'account_code'            => $allocation->account?->account_code,
                    'account_name'            => $allocation->account?->account_name,
                    'q1_budget'               => (float) $allocation->q1_amount,
                    'q2_budget'               => (float) $allocation->q2_amount,
                    'q3_budget'               => (float) $allocation->q3_amount,
                    'q4_budget'               => (float) $allocation->q4_amount,
                    'q1_actual'               => $qa[0],
                    'q2_actual'               => $qa[1],
                    'q3_actual'               => $qa[2],
                    'q4_actual'               => $qa[3],
                    'original_budget'         => $originalAmount,
                    'revised_budget'          => $revisedAmount,
                    'final_budget'            => $finalBudget,
                    'committed'               => (float) $allocation->committed_amount,
                    'full_year_actual'        => $fullYearActual,
                    'variance'                => $finalBudget - $fullYearActual,
                    'variance_pct'            => $finalBudget > 0
                        ? round((($finalBudget - $fullYearActual) / $finalBudget) * 100, 2)
                        : 0,
                    'allocation_id'           => $allocation->id,
                ];
            }
        }

        return $rows;
    }

    /**
     * Single bulk query: get all posted journal items for the given account IDs
     * within the period, then bucket into Q1–Q4 arrays in PHP.
     * Returns: [ accountId => [q1, q2, q3, q4] ]
     */
    private function computeAllQuarterlyActuals(array $accountIds, array $qDates, BudgetPeriod $period): array
    {
        if (empty($accountIds)) {
            return [];
        }

        $periodStart = $period->start_date->format('Y-m-d');
        $periodEnd   = $period->end_date->format('Y-m-d');

        // Pre-load normal_balance per account
        $normalBalances = ChartOfAccount::whereIn('id', $accountIds)
            ->pluck('normal_balance', 'id');

        $allItems = JournalEntryItem::whereIn('account_id', $accountIds)
            ->whereHas('journalEntry', fn($q) => $q
                ->whereBetween('journal_date', [$periodStart, $periodEnd])
                ->where('status', 'posted'))
            ->with('journalEntry:id,journal_date')
            ->get();

        // Quarter boundary strings for fast comparison
        $qBounds = array_map(fn($range) => [
            $range[0]->format('Y-m-d'),
            $range[1]->format('Y-m-d'),
        ], $qDates);

        $result = [];

        foreach ($allItems as $item) {
            $aid = $item->account_id;
            $jDate = $item->journalEntry->journal_date instanceof \Carbon\Carbon
                ? $item->journalEntry->journal_date->format('Y-m-d')
                : (string) $item->journalEntry->journal_date;

            $normalBalance = $normalBalances[$aid] ?? 'debit';
            $net = $normalBalance === 'debit'
                ? (float) $item->debit_amount - (float) $item->credit_amount
                : (float) $item->credit_amount - (float) $item->debit_amount;

            if (!isset($result[$aid])) {
                $result[$aid] = [0.0, 0.0, 0.0, 0.0];
            }

            for ($q = 0; $q < 4; $q++) {
                if ($jDate >= $qBounds[$q][0] && $jDate <= $qBounds[$q][1]) {
                    $result[$aid][$q] += $net;
                    break;
                }
            }
        }

        // Ensure non-negative per quarter
        foreach ($result as &$qa) {
            $qa = array_map(fn($v) => max(0.0, $v), $qa);
        }
        unset($qa);

        return $result;
    }

    /**
     * Split a budget period into four equal quarter date ranges.
     */
    private function getQuarterDateRanges($startDate, $endDate): array
    {
        return [
            [$startDate->copy(),               $startDate->copy()->addMonths(3)->subDay()],
            [$startDate->copy()->addMonths(3), $startDate->copy()->addMonths(6)->subDay()],
            [$startDate->copy()->addMonths(6), $startDate->copy()->addMonths(9)->subDay()],
            [$startDate->copy()->addMonths(9), $endDate->copy()],
        ];
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Virement application
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Apply an approved virement: deduct from source allocation, add to destination.
     * Called by BudgetAmendmentController::approve() for amendment_type=virement.
     */
    public function applyVirement(int $fromAllocationId, int $toAllocationId, float $amount): void
    {
        BudgetAllocation::where('id', $fromAllocationId)
            ->decrement('allocated_amount', $amount);

        BudgetAllocation::where('id', $toAllocationId)
            ->increment('allocated_amount', $amount);

        // Re-derive remaining for both (remaining = allocated − spent, not including commitments)
        foreach ([$fromAllocationId, $toAllocationId] as $id) {
            $alloc = BudgetAllocation::find($id);
            $alloc->remaining_amount = $alloc->allocated_amount - $alloc->spent_amount;
            $alloc->save();

            // Update the parent budget total
            $budget = $alloc->budget;
            $budget->total_budget_amount = $budget->allocations()->sum('allocated_amount');
            $budget->save();
        }
    }
}
