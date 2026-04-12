<?php

namespace Workdo\Account\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Workdo\Account\Models\FixedAssetCategory;

class FixedAssetCategoryController extends Controller
{
    public function index()
    {
        $categories = FixedAssetCategory::where('created_by', creatorId())
            ->orderBy('name')
            ->get();

        return Inertia::render('Account::FixedAssetCategories/Index', [
            'categories' => $categories,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name'                                    => 'required|string|max:120',
            'description'                             => 'nullable|string',
            'asset_account_code'                      => 'required|string|max:10',
            'accumulated_depreciation_account_code'   => 'nullable|string|max:10',
            'depreciation_expense_account_code'       => 'nullable|string|max:10',
            'default_useful_life_months'              => 'required|integer|min:0',
            'depreciation_method'                     => 'required|in:straight_line',
            'is_depreciable'                          => 'required|boolean',
        ]);

        FixedAssetCategory::create(array_merge($validated, [
            'created_by' => creatorId(),
            'creator_id' => Auth::id(),
        ]));

        return back()->with('success', __('Asset category created successfully.'));
    }

    public function update(Request $request, FixedAssetCategory $fixedassetcategory)
    {
        $validated = $request->validate([
            'name'                                    => 'required|string|max:120',
            'description'                             => 'nullable|string',
            'asset_account_code'                      => 'required|string|max:10',
            'accumulated_depreciation_account_code'   => 'nullable|string|max:10',
            'depreciation_expense_account_code'       => 'nullable|string|max:10',
            'default_useful_life_months'              => 'required|integer|min:0',
            'depreciation_method'                     => 'required|in:straight_line',
            'is_depreciable'                          => 'required|boolean',
        ]);

        $fixedassetcategory->update($validated);

        return back()->with('success', __('Asset category updated successfully.'));
    }

    public function destroy(FixedAssetCategory $fixedassetcategory)
    {
        if ($fixedassetcategory->assets()->exists()) {
            return back()->with('error', __('Cannot delete a category that has assets assigned to it.'));
        }

        $fixedassetcategory->delete();

        return back()->with('success', __('Asset category deleted successfully.'));
    }
}
