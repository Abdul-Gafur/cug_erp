<?php

namespace Workdo\Account\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Workdo\Account\Models\ChartOfAccount;
use Workdo\Account\Models\FixedAsset;
use Workdo\Account\Models\FixedAssetCategory;
use Workdo\Account\Models\UniversityFund;
use Workdo\Account\Services\FixedAssetService;
use App\Models\User;

class FixedAssetController extends Controller
{
    public function __construct(private FixedAssetService $assetService) {}

    // -------------------------------------------------------------------------

    public function index(Request $request)
    {
        $query = FixedAsset::with(['category', 'fund', 'assetAccount'])
            ->where('created_by', creatorId());

        if ($request->search) {
            $query->where(function ($q) use ($request) {
                $q->where('asset_name', 'like', "%{$request->search}%")
                  ->orWhere('asset_code', 'like', "%{$request->search}%")
                  ->orWhere('department', 'like', "%{$request->search}%");
            });
        }

        if ($request->category_id) {
            $query->where('category_id', $request->category_id);
        }

        if ($request->status) {
            $query->where('status', $request->status);
        }

        if ($request->fund_id) {
            $query->where('fund_id', $request->fund_id);
        }

        $perPage = $request->per_page ?? 15;
        $assets  = $query->orderBy('asset_code')->paginate($perPage)->withQueryString();

        return Inertia::render('Account::FixedAssets/Index', [
            'assets'     => $assets,
            'categories' => FixedAssetCategory::where('created_by', creatorId())->orderBy('name')->get(),
            'funds'      => UniversityFund::where('created_by', creatorId())->orderBy('name')->get(),
            'filters'    => $request->only(['search', 'category_id', 'status', 'fund_id', 'per_page']),
        ]);
    }

    public function create()
    {
        return Inertia::render('Account::FixedAssets/Create', [
            'categories'   => FixedAssetCategory::where('created_by', creatorId())->orderBy('name')->get(),
            'funds'        => UniversityFund::where('created_by', creatorId())->orderBy('name')->get(),
            'chartAccounts'=> ChartOfAccount::where('created_by', creatorId())
                                ->where('is_active', true)
                                ->orderBy('account_code')
                                ->get(['id', 'account_code', 'account_name']),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'asset_name'          => 'required|string|max:200',
            'category_id'         => 'required|exists:fixed_asset_categories,id',
            'description'         => 'nullable|string',
            'fund_id'             => 'nullable|exists:university_funds,id',
            'department'          => 'nullable|string|max:120',
            'location'            => 'nullable|string|max:200',
            'purchase_date'       => 'required|date',
            'purchase_cost'       => 'required|numeric|min:0.01',
            'residual_value'      => 'required|numeric|min:0',
            'useful_life_months'  => 'required|integer|min:1',
            'depreciation_method' => 'required|in:straight_line',
        ]);

        // Resolve GL account IDs from the category's account codes
        $category = FixedAssetCategory::findOrFail($validated['category_id']);

        $assetAccountId = $this->resolveAccountId($category->asset_account_code);
        if (! $assetAccountId) {
            return back()->withErrors(['category_id' => "GL account {$category->asset_account_code} not found in Chart of Accounts."]);
        }

        $accDeprAccountId = $category->accumulated_depreciation_account_code
            ? $this->resolveAccountId($category->accumulated_depreciation_account_code)
            : null;

        $deprExpAccountId = $category->depreciation_expense_account_code
            ? $this->resolveAccountId($category->depreciation_expense_account_code)
            : null;

        FixedAsset::create(array_merge($validated, [
            'asset_account_id'                    => $assetAccountId,
            'accumulated_depreciation_account_id' => $accDeprAccountId,
            'depreciation_expense_account_id'     => $deprExpAccountId,
            'status'                              => 'active',
            'accumulated_depreciation'            => 0,
            'created_by'                          => creatorId(),
            'creator_id'                          => Auth::id(),
        ]));

        return redirect()->route('account.fixed-assets.index')
            ->with('success', __('Asset registered successfully.'));
    }

    public function show(FixedAsset $fixedasset)
    {
        $fixedasset->load([
            'category',
            'fund',
            'assetAccount',
            'accumulatedDepreciationAccount',
            'depreciationExpenseAccount',
            'authorisingOfficer',
            'disposalJournal',
            'depreciationSchedules.journalEntry',
        ]);

        $users = User::where('created_by', creatorId())
            ->select('id', 'name')
            ->orderBy('name')
            ->get();

        return Inertia::render('Account::FixedAssets/Show', [
            'asset' => $fixedasset,
            'users' => $users,
        ]);
    }

    public function edit(FixedAsset $fixedasset)
    {
        if (! $fixedasset->isActive()) {
            return back()->with('error', __('Only active assets can be edited.'));
        }

        return Inertia::render('Account::FixedAssets/Edit', [
            'asset'        => $fixedasset->load('category', 'fund'),
            'categories'   => FixedAssetCategory::where('created_by', creatorId())->orderBy('name')->get(),
            'funds'        => UniversityFund::where('created_by', creatorId())->orderBy('name')->get(),
            'chartAccounts'=> ChartOfAccount::where('created_by', creatorId())
                                ->where('is_active', true)
                                ->orderBy('account_code')
                                ->get(['id', 'account_code', 'account_name']),
        ]);
    }

    public function update(Request $request, FixedAsset $fixedasset)
    {
        if (! $fixedasset->isActive()) {
            return back()->with('error', __('Only active assets can be edited.'));
        }

        $validated = $request->validate([
            'asset_name'          => 'required|string|max:200',
            'description'         => 'nullable|string',
            'fund_id'             => 'nullable|exists:university_funds,id',
            'department'          => 'nullable|string|max:120',
            'location'            => 'nullable|string|max:200',
            'purchase_date'       => 'required|date',
            'purchase_cost'       => 'required|numeric|min:0.01',
            'residual_value'      => 'required|numeric|min:0',
            'useful_life_months'  => 'required|integer|min:1',
            'depreciation_method' => 'required|in:straight_line',
        ]);

        $fixedasset->update($validated);

        return redirect()->route('account.fixed-assets.show', $fixedasset->id)
            ->with('success', __('Asset updated successfully.'));
    }

    public function destroy(FixedAsset $fixedasset)
    {
        if ($fixedasset->depreciationSchedules()->exists()) {
            return back()->with('error', __('Cannot delete an asset that has depreciation entries. Dispose of it instead.'));
        }

        $fixedasset->delete();

        return redirect()->route('account.fixed-assets.index')
            ->with('success', __('Asset deleted successfully.'));
    }

    // -------------------------------------------------------------------------
    // IPSAS 17 — Depreciation
    // -------------------------------------------------------------------------

    public function depreciate(Request $request, FixedAsset $fixedasset)
    {
        $request->validate([
            'depreciation_date' => 'required|date',
        ]);

        try {
            $schedule = $this->assetService->runDepreciation(
                $fixedasset,
                $request->depreciation_date
            );

            return back()->with('success', __(
                'Depreciation of :amount posted for :period.',
                [
                    'amount' => number_format($schedule->depreciation_amount, 2),
                    'period' => $schedule->period_label,
                ]
            ));
        } catch (\Exception $e) {
            return back()->with('error', $e->getMessage());
        }
    }

    // -------------------------------------------------------------------------
    // IPSAS 17 — Disposal
    // -------------------------------------------------------------------------

    public function dispose(Request $request, FixedAsset $fixedasset)
    {
        $request->validate([
            'disposal_date'          => 'required|date',
            'disposal_method'        => 'required|in:sale,transfer,write_off,scrapped',
            'disposal_proceeds'      => 'required|numeric|min:0',
            'authorising_officer_id' => 'nullable|exists:users,id',
        ]);

        try {
            $this->assetService->dispose($fixedasset, $request->only([
                'disposal_date',
                'disposal_method',
                'disposal_proceeds',
                'authorising_officer_id',
            ]));

            return back()->with('success', __('Asset disposed successfully. Journal entry posted.'));
        } catch (\Exception $e) {
            return back()->with('error', $e->getMessage());
        }
    }

    // -------------------------------------------------------------------------

    private function resolveAccountId(string $code): ?int
    {
        $account = ChartOfAccount::where('account_code', $code)
            ->where('created_by', creatorId())
            ->first();

        return $account?->id;
    }
}
