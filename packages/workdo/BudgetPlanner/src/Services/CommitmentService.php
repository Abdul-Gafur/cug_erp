<?php

namespace Workdo\BudgetPlanner\Services;

use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Workdo\BudgetPlanner\Exceptions\BudgetExceededException;
use Workdo\BudgetPlanner\Models\Budget;
use Workdo\BudgetPlanner\Models\BudgetAllocation;
use Workdo\BudgetPlanner\Models\BudgetAuditLog;
use Workdo\BudgetPlanner\Models\BudgetCommitment;
use Workdo\BudgetPlanner\Models\BudgetControlSetting;

/**
 * CommitmentService — the central commitment accounting engine.
 *
 * Called by procurement sessions (P1–P3) at defined lifecycle points:
 *   - PR approved   → onRequisitionApproved()
 *   - LPO issued    → onLPOIssued()
 *   - Invoice posted → onInvoicePosted()
 *
 * Also used for pre-transaction budget checks by any module.
 *
 * Available balance formula (IPSAS 24):
 *   Available = Approved Budget − Total Commitments − Total Actuals
 *
 * Each item array passed to these methods must contain:
 *   [
 *     'vote_cost_centre_id'    => int,
 *     'fund_type'              => string,
 *     'economic_classification' => string,
 *     'period_id'              => int,
 *     'amount'                 => float,
 *   ]
 */
class CommitmentService
{
    // ──────────────────────────────────────────────────────────────────────────
    // Public API — called by procurement session controllers
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Purchase Requisition approved → create a commitment (pre-encumbrance).
     *
     * @param  int    $requisitionId
     * @param  array  $items  Each item: see class docblock
     * @return array  ['committed' => bool, 'warnings' => [], 'errors' => []]
     *
     * @throws BudgetExceededException if any item hits a hard block
     */
    public function onRequisitionApproved(int $requisitionId, array $items): array
    {
        return $this->createCommitmentsForItems(
            'purchase_requisition',
            $requisitionId,
            $items
        );
    }

    /**
     * LPO issued → update existing commitment to the confirmed LPO amount.
     * The old PR commitment is marked 'updated'; a new commitment row records
     * the LPO amount.
     *
     * @param  int   $lpoId
     * @param  int   $requisitionId  The PR this LPO was raised against
     * @param  array $items
     */
    public function onLPOIssued(int $lpoId, int $requisitionId, array $items): array
    {
        return DB::transaction(function () use ($lpoId, $requisitionId, $items) {
            // Mark existing PR commitments as updated
            BudgetCommitment::where('source_type', 'purchase_requisition')
                ->where('source_id', $requisitionId)
                ->where('status', 'active')
                ->update(['status' => 'updated']);

            // Create fresh commitment rows for the LPO amounts
            return $this->createCommitmentsForItems('lpo', $lpoId, $items);
        });
    }

    /**
     * Invoice posted → reverse the commitment, actuals will be picked up by
     * BudgetService::updateBudgetSpending() via the existing UpdateBudgetSpending
     * event from JournalService.
     *
     * @param  string $sourceType  'purchase_requisition' | 'lpo' | 'purchase_order'
     * @param  int    $sourceId
     */
    public function onInvoicePosted(string $sourceType, int $sourceId): void
    {
        DB::transaction(function () use ($sourceType, $sourceId) {
            $commitments = BudgetCommitment::where('source_type', $sourceType)
                ->where('source_id', $sourceId)
                ->whereIn('status', ['active', 'updated'])
                ->get();

            foreach ($commitments as $commitment) {
                $commitment->update([
                    'status'      => 'reversed',
                    'reversed_at' => now(),
                ]);

                // Decrement the allocation's committed_amount atomically
                BudgetAllocation::where('id', $commitment->budget_allocation_id)
                    ->decrement('committed_amount', $commitment->amount);

                $allocation = BudgetAllocation::find($commitment->budget_allocation_id);
                if ($allocation) {
                    $this->writeAuditLog($allocation, 'reversal', $sourceType, $sourceId, $commitment->amount);
                }
            }
        });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Budget position — for display on transaction screens
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Returns the live budget position for a given combination of dimensions.
     * Used by BudgetPositionController to serve the position widget on any
     * transaction screen (PR, LPO, journal entry, etc.).
     *
     * @return array{
     *   approved: float,
     *   committed: float,
     *   actual: float,
     *   available: float,
     *   allocation_id: int|null,
     *   control_mode: string,
     * }
     */
    public function getBudgetPosition(
        int    $voteCostCentreId,
        string $fundType,
        string $economicClassification,
        int    $periodId,
        int    $createdBy
    ): array {
        $allocation = $this->resolveAllocation(
            $voteCostCentreId,
            $fundType,
            $economicClassification,
            $periodId,
            $createdBy
        );

        if (!$allocation) {
            return [
                'approved'        => 0,
                'committed'       => 0,
                'actual'          => 0,
                'available'       => 0,
                'allocation_id'   => null,
                'control_mode'    => BudgetControlSetting::modeFor($economicClassification, $createdBy),
            ];
        }

        return [
            'approved'        => (float) $allocation->allocated_amount,
            'committed'       => (float) $allocation->committed_amount,
            'actual'          => (float) $allocation->spent_amount,
            'available'       => $allocation->available_amount,
            'allocation_id'   => $allocation->id,
            'control_mode'    => BudgetControlSetting::modeFor($economicClassification, $createdBy),
        ];
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Internal helpers
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Core commitment creation loop — handles check → create → log for each item.
     *
     * @throws BudgetExceededException on hard block
     */
    private function createCommitmentsForItems(
        string $sourceType,
        int    $sourceId,
        array  $items
    ): array {
        $result = ['committed' => true, 'warnings' => [], 'errors' => []];

        DB::transaction(function () use ($sourceType, $sourceId, $items, &$result) {
            foreach ($items as $item) {
                $allocation = $this->resolveAllocation(
                    $item['vote_cost_centre_id'],
                    $item['fund_type'],
                    $item['economic_classification'],
                    $item['period_id'],
                    creatorId()
                );

                $amount = (float) $item['amount'];

                if (!$allocation) {
                    // No matching budget line — treat as a hard block with a
                    // clear message; the Bursar must set up the budget line first.
                    $result['errors'][] = sprintf(
                        'No active budget allocation found for Vote %s / Fund %s / %s.',
                        $item['vote_cost_centre_id'],
                        $item['fund_type'],
                        $item['economic_classification']
                    );
                    throw new BudgetExceededException(
                        'No budget allocation exists for this combination of Vote, Fund, and Economic Classification. ' .
                        'Please contact the Finance Office.'
                    );
                }

                $available = $allocation->available_amount;
                $mode      = BudgetControlSetting::modeFor(
                    $allocation->economic_classification,
                    creatorId()
                );

                if ($amount > $available) {
                    $this->writeAuditLog($allocation, 'check', $sourceType, $sourceId, $amount, 'blocked');

                    if ($mode === 'hard_block') {
                        throw new BudgetExceededException(sprintf(
                            'Insufficient budget on %s / %s / %s. ' .
                            'Requested: %s. Available: %s.',
                            $allocation->budget->voteCostCentre->name ?? 'Vote',
                            $allocation->budget->fund_type,
                            $allocation->economic_classification,
                            number_format($amount, 2),
                            number_format($available, 2)
                        ));
                    }

                    // Warning mode — log and continue; caller must surface the warning to the user
                    $result['warnings'][] = sprintf(
                        'Warning: %s / %s / %s is over budget. Requested %s, Available %s.',
                        $allocation->budget->voteCostCentre->name ?? 'Vote',
                        $allocation->budget->fund_type,
                        $allocation->economic_classification,
                        number_format($amount, 2),
                        number_format($available, 2)
                    );

                    $this->writeAuditLog($allocation, 'check', $sourceType, $sourceId, $amount, 'warned');
                } else {
                    $this->writeAuditLog($allocation, 'check', $sourceType, $sourceId, $amount, 'passed');
                }

                // Record the commitment
                BudgetCommitment::create([
                    'budget_allocation_id' => $allocation->id,
                    'source_type'          => $sourceType,
                    'source_id'            => $sourceId,
                    'amount'               => $amount,
                    'status'               => 'active',
                    'creator_id'           => Auth::id(),
                    'created_by'           => creatorId(),
                ]);

                // Increment committed_amount atomically
                BudgetAllocation::where('id', $allocation->id)
                    ->increment('committed_amount', $amount);

                // Refresh for the audit snapshot
                $allocation->refresh();
                $this->writeAuditLog($allocation, 'commitment', $sourceType, $sourceId, $amount);
            }
        });

        return $result;
    }

    /**
     * Find the active budget allocation for the given dimensions.
     * There should be exactly one active allocation per vote/fund/classification/period.
     */
    private function resolveAllocation(
        int    $voteCostCentreId,
        string $fundType,
        string $economicClassification,
        int    $periodId,
        int    $createdBy
    ): ?BudgetAllocation {
        return BudgetAllocation::whereHas('budget', function ($q) use (
            $voteCostCentreId, $fundType, $periodId, $createdBy
        ) {
            $q->where('vote_cost_centre_id', $voteCostCentreId)
              ->where('fund_type', $fundType)
              ->where('period_id', $periodId)
              ->whereIn('status', ['active'])
              ->where('created_by', $createdBy);
        })
        ->where('economic_classification', $economicClassification)
        ->where('created_by', $createdBy)
        ->first();
    }

    /**
     * Write a single row to the immutable budget audit log.
     */
    private function writeAuditLog(
        BudgetAllocation $allocation,
        string           $eventType,
        string           $sourceType,
        int              $sourceId,
        float            $amount,
        ?string          $result = null
    ): void {
        BudgetAuditLog::create([
            'budget_allocation_id' => $allocation->id,
            'event_type'           => $eventType,
            'source_type'          => $sourceType,
            'source_id'            => $sourceId,
            'amount'               => $amount,
            'result'               => $result,
            'approved_at_event'    => $allocation->allocated_amount,
            'committed_at_event'   => $allocation->committed_amount,
            'actual_at_event'      => $allocation->spent_amount,
            'available_at_event'   => $allocation->available_amount,
            'user_id'              => Auth::id(),
            'created_by'           => creatorId(),
        ]);
    }

    /**
     * Log a budget override (user proceeded past a warning with explicit reason).
     */
    public function logOverride(
        BudgetAllocation $allocation,
        string           $sourceType,
        int              $sourceId,
        float            $amount,
        string           $overrideReason
    ): void {
        BudgetAuditLog::create([
            'budget_allocation_id' => $allocation->id,
            'event_type'           => 'override',
            'source_type'          => $sourceType,
            'source_id'            => $sourceId,
            'amount'               => $amount,
            'result'               => 'overridden',
            'override_reason'      => $overrideReason,
            'approved_at_event'    => $allocation->allocated_amount,
            'committed_at_event'   => $allocation->committed_amount,
            'actual_at_event'      => $allocation->spent_amount,
            'available_at_event'   => $allocation->available_amount,
            'user_id'              => Auth::id(),
            'created_by'           => creatorId(),
        ]);
    }
}
