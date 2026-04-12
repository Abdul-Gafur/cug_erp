<?php

namespace Workdo\BudgetPlanner\Http\Controllers;

use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Workdo\BudgetPlanner\Http\Requests\StoreBudgetAmendmentRequest;
use Workdo\BudgetPlanner\Models\Budget;
use Workdo\BudgetPlanner\Models\BudgetAllocation;
use Workdo\BudgetPlanner\Models\BudgetAmendment;
use Workdo\BudgetPlanner\Models\BudgetAuditLog;
use Workdo\BudgetPlanner\Services\BudgetService;

class BudgetAmendmentController extends Controller
{
    public function __construct(private BudgetService $budgetService) {}

    public function index()
    {
        if (Auth::user()->can('manage-budget-amendments')) {
            $amendments = BudgetAmendment::query()
                ->with([
                    'budget.voteCostCentre',
                    'fromAllocation.account',
                    'toAllocation.account',
                    'approvedBy',
                    'createdBy',
                ])
                ->whereHas('budget', fn($q) => $q->where('created_by', creatorId()))
                ->when(request('budget_id'), fn($q) => $q->where('budget_id', request('budget_id')))
                ->when(request('amendment_type') && request('amendment_type') !== '', fn($q) =>
                    $q->where('amendment_type', request('amendment_type')))
                ->when(request('status') && request('status') !== '', fn($q) =>
                    $q->where('status', request('status')))
                ->when(request('sort'),
                    fn($q) => $q->orderBy(request('sort'), request('direction', 'asc')),
                    fn($q) => $q->latest())
                ->paginate(request('per_page', 10))
                ->withQueryString();

            $budgets = Budget::where('created_by', creatorId())
                ->whereIn('status', ['active'])
                ->get(['id', 'budget_name', 'fund_type', 'vote_cost_centre_id']);

            $allocations = BudgetAllocation::whereHas('budget', fn($q) =>
                    $q->where('created_by', creatorId())->where('status', 'active'))
                ->with(['account', 'budget.voteCostCentre'])
                ->get();

            return Inertia::render('BudgetPlanner/BudgetAmendments/Index', [
                'amendments'  => $amendments,
                'budgets'     => $budgets,
                'allocations' => $allocations,
            ]);
        }

        return back()->with('error', __('Permission denied'));
    }

    public function store(StoreBudgetAmendmentRequest $request)
    {
        if (Auth::user()->can('create-budget-amendments')) {
            $validated = $request->validated();

            BudgetAmendment::create([
                'budget_id'          => $validated['budget_id'],
                'amendment_type'     => $validated['amendment_type'],
                'from_allocation_id' => $validated['from_allocation_id'] ?? null,
                'to_allocation_id'   => $validated['to_allocation_id'] ?? null,
                'amount'             => $validated['amount'],
                'reason'             => $validated['reason'],
                'status'             => 'draft',
                'creator_id'         => Auth::id(),
                'created_by'         => creatorId(),
            ]);

            return redirect()->route('budget-planner.budget-amendments.index')
                ->with('success', __('Budget amendment submitted for approval.'));
        }

        return redirect()->route('budget-planner.budget-amendments.index')
            ->with('error', __('Permission denied'));
    }

    /**
     * Approve an amendment.
     * For virements: applies the transfer between allocations immediately.
     * For revisions / supplementary: the new budget document has already been
     * created separately; this just records the approval.
     */
    public function approve(BudgetAmendment $amendment)
    {
        if (Auth::user()->can('approve-budget-amendments')) {
            if ($amendment->status !== 'draft') {
                return back()->with('error', __('Only draft amendments can be approved.'));
            }

            DB::transaction(function () use ($amendment) {
                $amendment->update([
                    'status'      => 'approved',
                    'approved_by' => Auth::id(),
                    'approved_at' => now(),
                ]);

                if ($amendment->amendment_type === 'virement') {
                    $this->budgetService->applyVirement(
                        $amendment->from_allocation_id,
                        $amendment->to_allocation_id,
                        $amendment->amount
                    );

                    // Log the virement in the audit trail for both allocations
                    foreach ([$amendment->from_allocation_id, $amendment->to_allocation_id] as $allocationId) {
                        $alloc = BudgetAllocation::find($allocationId);
                        BudgetAuditLog::create([
                            'budget_allocation_id' => $allocationId,
                            'event_type'           => 'virement',
                            'source_type'          => 'budget_amendment',
                            'source_id'            => $amendment->id,
                            'amount'               => $amendment->amount,
                            'result'               => 'passed',
                            'approved_at_event'    => $alloc->allocated_amount,
                            'committed_at_event'   => $alloc->committed_amount,
                            'actual_at_event'      => $alloc->spent_amount,
                            'available_at_event'   => $alloc->available_amount,
                            'user_id'              => Auth::id(),
                            'created_by'           => creatorId(),
                        ]);
                    }
                }

                // Unlock the budget so it can be edited further after an amendment
                $amendment->budget->update(['locked_at' => null]);
            });

            return back()->with('success', __('Amendment approved and applied.'));
        }

        return back()->with('error', __('Permission denied'));
    }

    public function reject(BudgetAmendment $amendment)
    {
        if (Auth::user()->can('approve-budget-amendments')) {
            if ($amendment->status !== 'draft') {
                return back()->with('error', __('Only draft amendments can be rejected.'));
            }

            $amendment->update([
                'status'           => 'rejected',
                'approved_by'      => Auth::id(),
                'approved_at'      => now(),
                'rejection_reason' => request('rejection_reason'),
            ]);

            return back()->with('success', __('Amendment rejected.'));
        }

        return back()->with('error', __('Permission denied'));
    }
}
