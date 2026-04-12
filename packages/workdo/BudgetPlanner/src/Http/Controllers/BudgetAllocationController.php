<?php

namespace Workdo\BudgetPlanner\Http\Controllers;

use Workdo\BudgetPlanner\Models\BudgetAllocation;
use Workdo\BudgetPlanner\Models\Budget;
use Workdo\BudgetPlanner\Http\Requests\StoreBudgetAllocationRequest;
use Workdo\BudgetPlanner\Http\Requests\UpdateBudgetAllocationRequest;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Workdo\Account\Models\ChartOfAccount;
use Workdo\BudgetPlanner\Events\CreateBudgetAllocation;
use Workdo\BudgetPlanner\Events\DestroyBudgetAllocation;
use Workdo\BudgetPlanner\Events\UpdateBudgetAllocation;

class BudgetAllocationController extends Controller
{
    public function index()
    {
        if (Auth::user()->can('manage-budget-allocations')) {
            $budgetAllocations = BudgetAllocation::query()
                ->with(['budget.voteCostCentre', 'account'])
                ->where(function ($q) {
                    if (Auth::user()->can('manage-any-budget-allocations')) {
                        $q->where('created_by', creatorId());
                    } elseif (Auth::user()->can('manage-own-budget-allocations')) {
                        $q->where('creator_id', Auth::id());
                    } else {
                        $q->whereRaw('1 = 0');
                    }
                })
                ->when(request('search'), function ($q) {
                    $search = request('search');
                    $q->whereHas('budget', fn($query) =>
                        $query->where('budget_name', 'like', "%{$search}%"))
                      ->orWhereHas('account', fn($query) =>
                        $query->where('account_name', 'like', "%{$search}%"));
                })
                ->when(request('budget_id'), fn($q) => $q->where('budget_id', request('budget_id')))
                ->when(request('account_id'), fn($q) => $q->where('account_id', request('account_id')))
                ->when(request('economic_classification') && request('economic_classification') !== '', fn($q) =>
                    $q->where('economic_classification', request('economic_classification')))
                ->when(request('sort'),
                    fn($q) => $q->orderBy(request('sort'), request('direction', 'asc')),
                    fn($q) => $q->latest())
                ->paginate(request('per_page', 10))
                ->withQueryString();

            $budgets = Budget::where('created_by', creatorId())
                ->whereIn('status', ['approved', 'active', 'vc_authorised'])
                ->get();

            // Revenue budget allocations are now supported — the 5000-5999 restriction
            // has been removed per IPSAS 24. The full COA is available.
            $accounts = ChartOfAccount::where('created_by', creatorId())
                ->where('is_active', true)
                ->select('id', 'account_code', 'account_name', 'normal_balance')
                ->orderBy('account_code')
                ->get();

            return Inertia::render('BudgetPlanner/BudgetAllocations/Index', [
                'budgetAllocations' => $budgetAllocations,
                'budgets'           => $budgets,
                'accounts'          => $accounts,
            ]);
        }

        return back()->with('error', __('Permission denied'));
    }

    public function store(StoreBudgetAllocationRequest $request)
    {
        if (Auth::user()->can('create-budget-allocations')) {
            $validated = $request->validated();

            $budget = Budget::find($validated['budget_id']);

            if ($budget->isLocked()) {
                return redirect()->route('budget-planner.budget-allocations.index')
                    ->with('error', __('This budget is locked. Submit a budget amendment to add allocations.'));
            }

            $budgetAllocation = new BudgetAllocation();
            $budgetAllocation->budget_id                = $validated['budget_id'];
            $budgetAllocation->account_id               = $validated['account_id'];
            $budgetAllocation->economic_classification  = $validated['economic_classification'] ?? null;
            $budgetAllocation->allocated_amount         = $validated['allocated_amount'];
            $budgetAllocation->q1_amount                = $validated['q1_amount'] ?? 0;
            $budgetAllocation->q2_amount                = $validated['q2_amount'] ?? 0;
            $budgetAllocation->q3_amount                = $validated['q3_amount'] ?? 0;
            $budgetAllocation->q4_amount                = $validated['q4_amount'] ?? 0;
            $budgetAllocation->spent_amount             = 0;
            $budgetAllocation->committed_amount         = 0;
            $budgetAllocation->remaining_amount         = $validated['allocated_amount'];
            $budgetAllocation->creator_id               = Auth::id();
            $budgetAllocation->created_by               = creatorId();
            $budgetAllocation->save();

            // Update budget total
            $budget->total_budget_amount = $budget->allocations()->sum('allocated_amount');

            // NOTE: The silent auto-approve side-effect (audit §9.6) has been removed.
            // A budget must now go through the proper governance chain.
            $budget->save();

            CreateBudgetAllocation::dispatch($request, $budgetAllocation);

            return redirect()->route('budget-planner.budget-allocations.index')
                ->with('success', __('The budget allocation has been created successfully.'));
        }

        return redirect()->route('budget-planner.budget-allocations.index')
            ->with('error', __('Permission denied'));
    }

    public function update(UpdateBudgetAllocationRequest $request, BudgetAllocation $budget_allocation)
    {
        if (Auth::user()->can('edit-budget-allocations')) {
            $budget = Budget::find($budget_allocation->budget_id);

            if ($budget->isLocked()) {
                return back()->with('error', __('This budget is locked. Submit a virement to adjust allocations.'));
            }

            $validated = $request->validated();

            $budget_allocation->account_id              = $validated['account_id'];
            $budget_allocation->economic_classification = $validated['economic_classification'] ?? $budget_allocation->economic_classification;
            $budget_allocation->allocated_amount        = $validated['allocated_amount'];
            $budget_allocation->q1_amount               = $validated['q1_amount'] ?? $budget_allocation->q1_amount;
            $budget_allocation->q2_amount               = $validated['q2_amount'] ?? $budget_allocation->q2_amount;
            $budget_allocation->q3_amount               = $validated['q3_amount'] ?? $budget_allocation->q3_amount;
            $budget_allocation->q4_amount               = $validated['q4_amount'] ?? $budget_allocation->q4_amount;
            $budget_allocation->remaining_amount        = $validated['allocated_amount'] - $budget_allocation->spent_amount;
            $budget_allocation->save();

            // Update budget total
            $budget->total_budget_amount = $budget->allocations()->sum('allocated_amount');
            $budget->save();

            UpdateBudgetAllocation::dispatch($request, $budget_allocation);

            return back()->with('success', __('The budget allocation details are updated successfully.'));
        }

        return back()->with('error', __('Permission denied'));
    }

    public function destroy(BudgetAllocation $budget_allocation)
    {
        if (Auth::user()->can('delete-budget-allocations')) {
            $budget = Budget::find($budget_allocation->budget_id);

            if ($budget->isLocked()) {
                return back()->with('error', __('This budget is locked. Budget allocations on a locked budget cannot be deleted.'));
            }

            $budgetId = $budget_allocation->budget_id;

            DestroyBudgetAllocation::dispatch($budget_allocation);
            $budget_allocation->delete();

            $budget->total_budget_amount = $budget->allocations()->sum('allocated_amount');
            $budget->save();

            return back()->with('success', __('The budget allocation has been deleted.'));
        }

        return back()->with('error', __('Permission denied'));
    }
}
