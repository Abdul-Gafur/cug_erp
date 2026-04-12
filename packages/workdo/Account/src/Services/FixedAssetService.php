<?php

namespace Workdo\Account\Services;

use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Workdo\Account\Models\ChartOfAccount;
use Workdo\Account\Models\DepreciationSchedule;
use Workdo\Account\Models\FixedAsset;
use Workdo\Account\Models\FiscalPeriod;

/**
 * FixedAssetService — IPSAS 17 PPE business logic.
 *
 * All journal postings are delegated to JournalService to ensure a single
 * authoritative posting mechanism (no parallel posting).
 */
class FixedAssetService
{
    public function __construct(private JournalService $journalService) {}

    // =========================================================================
    // DEPRECIATION
    // =========================================================================

    /**
     * Run one period's straight-line depreciation for an asset.
     *
     * Formula: (Cost − Residual Value) ÷ Useful Life in Months
     *
     * Throws if:
     *  - The asset is not active
     *  - The asset is not depreciable (Land)
     *  - The target fiscal period is closed (delegated to JournalService)
     *  - The asset is already fully depreciated
     *  - A depreciation entry already exists for this date (prevents double-run)
     *
     * @param  FixedAsset  $asset
     * @param  string      $date  ISO date string (YYYY-MM-DD)
     * @return DepreciationSchedule
     */
    public function runDepreciation(FixedAsset $asset, string $date): DepreciationSchedule
    {
        if (! $asset->isActive()) {
            throw new \RuntimeException("Asset '{$asset->asset_code}' is not active and cannot be depreciated.");
        }

        if (! $asset->category->is_depreciable) {
            throw new \RuntimeException("Asset '{$asset->asset_code}' belongs to a non-depreciable category (e.g. Land).");
        }

        if (is_null($asset->accumulated_depreciation_account_id) || is_null($asset->depreciation_expense_account_id)) {
            throw new \RuntimeException("Asset '{$asset->asset_code}' is missing depreciation GL accounts.");
        }

        // Prevent double-run for the same calendar month
        $alreadyRun = DepreciationSchedule::where('asset_id', $asset->id)
            ->whereRaw('DATE_FORMAT(depreciation_date, "%Y-%m") = ?', [substr($date, 0, 7)])
            ->exists();

        if ($alreadyRun) {
            throw new \RuntimeException(
                "Depreciation has already been posted for asset '{$asset->asset_code}' in " .
                date('F Y', strtotime($date)) . "."
            );
        }

        $monthly = $asset->monthly_depreciation;

        if ($monthly <= 0) {
            throw new \RuntimeException("Asset '{$asset->asset_code}' has zero monthly depreciation (check cost, residual value, and useful life).");
        }

        // Do not depreciate below residual value
        $depreciableRemaining = (float) $asset->purchase_cost
            - (float) $asset->residual_value
            - (float) $asset->accumulated_depreciation;

        if ($depreciableRemaining <= 0) {
            // Mark fully depreciated and exit cleanly
            $asset->update(['status' => 'fully_depreciated']);
            throw new \RuntimeException("Asset '{$asset->asset_code}' is already fully depreciated.");
        }

        $amount = min($monthly, $depreciableRemaining);
        $amount = round($amount, 2);

        return DB::transaction(function () use ($asset, $date, $amount) {
            // Post journal entry via JournalService (period-lock checked inside)
            $journalEntry = $this->journalService->createDepreciationJournal($asset, $amount, $date);

            // Update asset accumulated depreciation
            $newAccumulated = (float) $asset->accumulated_depreciation + $amount;
            $fullyDepreciated = round($newAccumulated, 2) >= round(
                (float) $asset->purchase_cost - (float) $asset->residual_value,
                2
            );

            $asset->update([
                'accumulated_depreciation' => $newAccumulated,
                'status' => $fullyDepreciated ? 'fully_depreciated' : 'active',
            ]);

            // Record depreciation schedule line
            return DepreciationSchedule::create([
                'asset_id'                       => $asset->id,
                'period_label'                   => date('F Y', strtotime($date)),
                'depreciation_date'              => $date,
                'depreciation_amount'            => $amount,
                'accumulated_depreciation_after' => $newAccumulated,
                'journal_entry_id'               => $journalEntry->id,
                'created_by'                     => creatorId(),
                'creator_id'                     => Auth::id(),
            ]);
        });
    }

    // =========================================================================
    // DISPOSAL
    // =========================================================================

    /**
     * Dispose of an asset per IPSAS 17.
     *
     * Journal generated:
     *   DR  Accumulated Depreciation          (full accumulated amount)
     *   DR  Cash / Other Receivables          (proceeds, if any)
     *   DR  Loss on Disposal of Assets 5850   (if loss)
     *   CR  Asset Account                     (at cost)
     *   CR  Gain on Disposal of Assets 4800   (if gain)
     *
     * @param  FixedAsset  $asset
     * @param  array       $data  Keys: disposal_date, disposal_method, disposal_proceeds, authorising_officer_id
     */
    public function dispose(FixedAsset $asset, array $data): void
    {
        if ($asset->isDisposed()) {
            throw new \RuntimeException("Asset '{$asset->asset_code}' has already been disposed.");
        }

        $proceeds = (float) ($data['disposal_proceeds'] ?? 0);

        DB::transaction(function () use ($asset, $data, $proceeds) {
            $journalEntry = $this->journalService->createAssetDisposalJournal($asset, $proceeds, $data['disposal_date']);

            $asset->update([
                'status'                 => 'disposed',
                'disposal_date'          => $data['disposal_date'],
                'disposal_method'        => $data['disposal_method'],
                'disposal_proceeds'      => $proceeds,
                'authorising_officer_id' => $data['authorising_officer_id'] ?? null,
                'disposal_journal_id'    => $journalEntry->id,
            ]);
        });
    }

    // =========================================================================
    // HELPERS
    // =========================================================================

    /**
     * Resolve a COA account ID from a code, scoped to the current tenant.
     * Returns null if not found (non-depreciable assets).
     */
    public static function resolveAccountId(string $code): ?int
    {
        $account = ChartOfAccount::where('account_code', $code)
            ->where('created_by', creatorId())
            ->first();

        return $account?->id;
    }
}
