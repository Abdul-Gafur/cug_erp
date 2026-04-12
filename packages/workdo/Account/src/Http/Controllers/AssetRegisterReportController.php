<?php

namespace Workdo\Account\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Inertia\Inertia;
use Workdo\Account\Models\FixedAsset;
use Workdo\Account\Models\FixedAssetCategory;
use Workdo\Account\Models\UniversityFund;

/**
 * Asset Register Report — IPSAS 17.
 *
 * Suitable for submission to the university Finance Committee.
 * Columns: Asset Code | Description | Category | Location/Department |
 *          Fund | Cost | Accumulated Depreciation | Carrying Amount | Status
 */
class AssetRegisterReportController extends Controller
{
    public function index(Request $request)
    {
        $assets = $this->buildQuery($request)->get();

        return Inertia::render('Account::Reports/AssetRegister', [
            'assets'     => $assets,
            'categories' => FixedAssetCategory::where('created_by', creatorId())->orderBy('name')->get(),
            'funds'      => UniversityFund::where('created_by', creatorId())->orderBy('name')->get(),
            'filters'    => $request->only(['category_id', 'fund_id', 'status', 'department']),
            'totals'     => $this->computeTotals($assets),
        ]);
    }

    public function print(Request $request)
    {
        $assets = $this->buildQuery($request)->get();

        return Inertia::render('Account::Reports/AssetRegisterPrint', [
            'assets'  => $assets,
            'totals'  => $this->computeTotals($assets),
            'filters' => $request->only(['category_id', 'fund_id', 'status', 'department']),
            'generatedAt' => now()->toDateTimeString(),
        ]);
    }

    private function buildQuery(Request $request)
    {
        $query = FixedAsset::with(['category', 'fund', 'assetAccount'])
            ->where('created_by', creatorId())
            ->orderBy('asset_code');

        if ($request->category_id) {
            $query->where('category_id', $request->category_id);
        }

        if ($request->fund_id) {
            $query->where('fund_id', $request->fund_id);
        }

        if ($request->status) {
            $query->where('status', $request->status);
        }

        if ($request->department) {
            $query->where('department', 'like', "%{$request->department}%");
        }

        return $query->select([
            'id',
            'asset_code',
            'asset_name',
            'category_id',
            'fund_id',
            'asset_account_id',
            'department',
            'location',
            'purchase_date',
            'purchase_cost',
            'residual_value',
            'useful_life_months',
            'depreciation_method',
            'accumulated_depreciation',
            'status',
            'disposal_date',
            'disposal_method',
        ]);
    }

    private function computeTotals($assets): array
    {
        return [
            'total_cost'                   => $assets->sum('purchase_cost'),
            'total_accumulated_depreciation'=> $assets->sum('accumulated_depreciation'),
            'total_carrying_amount'        => $assets->sum(fn ($a) => (float) $a->purchase_cost - (float) $a->accumulated_depreciation),
        ];
    }
}
