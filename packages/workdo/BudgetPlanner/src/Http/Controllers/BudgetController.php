<?php

namespace Workdo\BudgetPlanner\Http\Controllers;

use Workdo\BudgetPlanner\Models\Budget;
use Workdo\BudgetPlanner\Models\BudgetPeriod;
use Workdo\BudgetPlanner\Models\VoteCostCentre;
use Workdo\BudgetPlanner\Http\Requests\StoreBudgetRequest;
use Workdo\BudgetPlanner\Http\Requests\UpdateBudgetRequest;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Workdo\BudgetPlanner\Events\ActiveBudget;
use Workdo\BudgetPlanner\Events\ApproveBudget;
use Workdo\BudgetPlanner\Events\CloseBudget;
use Workdo\BudgetPlanner\Events\CreateBudget;
use Workdo\BudgetPlanner\Events\DestroyBudget;
use Workdo\BudgetPlanner\Events\UpdateBudget;

class BudgetController extends Controller
{
    public function index()
    {
        if (Auth::user()->can('manage-budgets')) {
            $budgets = Budget::query()
                ->with(['budgetPeriod', 'approvedBy', 'voteCostCentre', 'vcAuthorisedBy', 'parentBudget'])
                ->where(function ($q) {
                    if (Auth::user()->can('manage-any-budgets')) {
                        $q->where('created_by', creatorId());
                    } elseif (Auth::user()->can('manage-own-budgets')) {
                        $q->where('creator_id', Auth::id());
                    } else {
                        $q->whereRaw('1 = 0');
                    }
                })
                ->when(request('budget_name'), fn($q) =>
                    $q->where('budget_name', 'like', '%' . request('budget_name') . '%'))
                ->when(request('budget_type') && request('budget_type') !== '', fn($q) =>
                    $q->where('budget_type', request('budget_type')))
                ->when(request('budget_subtype') && request('budget_subtype') !== '', fn($q) =>
                    $q->where('budget_subtype', request('budget_subtype')))
                ->when(request('fund_type') && request('fund_type') !== '', fn($q) =>
                    $q->where('fund_type', request('fund_type')))
                ->when(request('vote_cost_centre_id') && request('vote_cost_centre_id') !== '', fn($q) =>
                    $q->where('vote_cost_centre_id', request('vote_cost_centre_id')))
                ->when(request('status') && request('status') !== '', fn($q) =>
                    $q->where('status', request('status')))
                ->when(request('period_id') && request('period_id') !== '', fn($q) =>
                    $q->where('period_id', request('period_id')))
                ->when(request('sort'),
                    fn($q) => $q->orderBy(request('sort'), request('direction', 'asc')),
                    fn($q) => $q->latest())
                ->paginate(request('per_page', 10))
                ->withQueryString();

            $budgetPeriods = BudgetPeriod::where('created_by', creatorId())
                ->whereIn('status', ['approved', 'active'])
                ->get();

            $voteCostCentres = VoteCostCentre::where('created_by', creatorId())
                ->where('is_active', true)
                ->orderBy('code')
                ->get();

            // Original budgets available as parents for revised/supplementary subtypes
            $parentBudgets = Budget::where('created_by', creatorId())
                ->where('budget_subtype', 'original')
                ->whereIn('status', ['active', 'vc_authorised', 'committee_approved', 'finance_reviewed', 'dept_approved', 'approved'])
                ->with('budgetPeriod:id,period_name')
                ->orderByDesc('id')
                ->get(['id', 'budget_name', 'period_id']);

            $base = Budget::where('created_by', creatorId());
            $stageCounts = [
                'preparation'   => (clone $base)->where('status', 'draft')->count(),
                'review'        => (clone $base)->whereIn('status', ['dept_approved', 'finance_reviewed'])->count(),
                'consolidation' => (clone $base)->where('status', 'committee_approved')->count(),
                'approval'      => (clone $base)->where('status', 'vc_authorised')->count(),
                'active'        => (clone $base)->where('status', 'active')->count(),
                'closed'        => (clone $base)->where('status', 'closed')->count(),
            ];

            return Inertia::render('BudgetPlanner/Budgets/Index', [
                'budgets'         => $budgets,
                'budgetPeriods'   => $budgetPeriods,
                'voteCostCentres' => $voteCostCentres,
                'parentBudgets'   => $parentBudgets,
                'stageCounts'     => $stageCounts,
            ]);
        }

        return back()->with('error', __('Permission denied'));
    }

    public function show(Budget $budget)
    {
        if (Auth::user()->can('manage-budgets')) {
            $budget->load([
                'budgetPeriod',
                'voteCostCentre',
                'approvedBy',
                'financeOfficeReviewedBy',
                'financeCommitteeApprovedBy',
                'vcAuthorisedBy',
                'parentBudget.budgetPeriod',
                'allocations.account',
                'creator',
            ]);

            return Inertia::render('BudgetPlanner/Budgets/Show', [
                'budget' => $budget,
            ]);
        }

        return back()->with('error', __('Permission denied'));
    }

    public function store(StoreBudgetRequest $request)
    {
        if (Auth::user()->can('create-budgets')) {
            $validated = $request->validated();

            $budget = new Budget();
            $budget->budget_name          = $validated['budget_name'];
            $budget->period_id            = $validated['period_id'];
            $budget->budget_type          = $validated['budget_type'];
            $budget->budget_subtype       = $validated['budget_subtype'] ?? 'original';
            $budget->vote_cost_centre_id  = $validated['vote_cost_centre_id'] ?? null;
            $budget->fund_type            = $validated['fund_type'] ?? null;
            $budget->total_budget_amount  = $validated['total_budget_amount'] ?? 0;
            $budget->status               = 'draft';
            $budget->creator_id           = Auth::id();
            $budget->created_by           = creatorId();
            $budget->programme_name       = $validated['programme_name'] ?? null;
            $budget->strategic_objective  = $validated['strategic_objective'] ?? null;
            $budget->justification        = $validated['justification'] ?? null;

            if ($request->hasFile('document')) {
                $file = $request->file('document');
                $filename = time() . '_' . $file->getClientOriginalName();
                $path = $file->storeAs('uploads/budgets', $filename, 'public');
                $budget->document = $path;
            }

            $budget->save();

            CreateBudget::dispatch($request, $budget);

            return redirect()->route('budget-planner.budgets.index')
                ->with('success', __('The budget has been created successfully.'));
        }

        return redirect()->route('budget-planner.budgets.index')
            ->with('error', __('Permission denied'));
    }

    public function update(UpdateBudgetRequest $request, Budget $budget)
    {
        if (Auth::user()->can('edit-budgets')) {
            if ($budget->status !== 'draft') {
                return back()->with('error', __('Only draft budgets can be edited.'));
            }

            if ($budget->isLocked()) {
                return back()->with('error', __('This budget is locked. Submit a budget amendment for changes.'));
            }

            $validated = $request->validated();

            $budget->budget_name         = $validated['budget_name'];
            $budget->period_id           = $validated['period_id'];
            $budget->budget_type         = $validated['budget_type'];
            $budget->budget_subtype      = $validated['budget_subtype'] ?? $budget->budget_subtype;
            $budget->vote_cost_centre_id = $validated['vote_cost_centre_id'] ?? $budget->vote_cost_centre_id;
            $budget->fund_type           = $validated['fund_type'] ?? $budget->fund_type;
            $budget->programme_name      = $validated['programme_name'] ?? $budget->programme_name;
            $budget->strategic_objective = $validated['strategic_objective'] ?? $budget->strategic_objective;
            $budget->justification       = $validated['justification'] ?? $budget->justification;
            // Only update the requested amount if no allocations exist yet;
            // once allocations are present, total_budget_amount is driven by allocation sums.
            if ($budget->allocations()->count() === 0 && isset($validated['total_budget_amount'])) {
                $budget->total_budget_amount = $validated['total_budget_amount'];
            }

            if ($request->hasFile('document')) {
                $file = $request->file('document');
                $filename = time() . '_' . $file->getClientOriginalName();
                $path = $file->storeAs('uploads/budgets', $filename, 'public');
                $budget->document = $path;
            }

            $budget->save();

            UpdateBudget::dispatch($request, $budget);

            return back()->with('success', __('The budget details are updated successfully.'));
        }

        return back()->with('error', __('Permission denied'));
    }

    // ─── Approval hierarchy ───────────────────────────────────────────────────

    /**
     * Step 1 — Department head / Vote holder approves the draft budget.
     * Maps to the old 'approve' action; kept as 'approve' for route compatibility
     * but now advances to 'dept_approved' status.
     */
    public function approve(Budget $budget)
    {
        if (Auth::user()->can('approve-budgets')) {
            if ($budget->status !== 'draft') {
                return back()->with('error', __('Only draft budgets can be submitted for approval.'));
            }

            $budget->update([
                'status'      => 'dept_approved',
                'approved_by' => Auth::id(),
            ]);

            ApproveBudget::dispatch($budget);

            return back()->with('success', __('Budget submitted for Finance Office review.'));
        }

        return back()->with('error', __('Permission denied'));
    }

    /**
     * Step 2 — Finance Office reviews the budget (dept_approved → finance_reviewed).
     */
    public function financeReview(Budget $budget)
    {
        if (Auth::user()->can('finance-review-budgets')) {
            if ($budget->status !== 'dept_approved') {
                return back()->with('error', __('Only department-approved budgets can be reviewed by Finance Office.'));
            }

            $budget->update([
                'status'                      => 'finance_reviewed',
                'finance_office_reviewed_by'  => Auth::id(),
                'finance_office_reviewed_at'  => now(),
            ]);

            return back()->with('success', __('Budget reviewed by Finance Office. Awaiting Finance Committee approval.'));
        }

        return back()->with('error', __('Permission denied'));
    }

    /**
     * Step 3 — Finance Committee approves (finance_reviewed → committee_approved).
     */
    public function committeeApprove(Budget $budget)
    {
        if (Auth::user()->can('committee-approve-budgets')) {
            if ($budget->status !== 'finance_reviewed') {
                return back()->with('error', __('Only Finance Office-reviewed budgets can be approved by the Finance Committee.'));
            }

            $budget->update([
                'status'                          => 'committee_approved',
                'finance_committee_approved_by'   => Auth::id(),
                'finance_committee_approved_at'   => now(),
            ]);

            return back()->with('success', __('Budget approved by Finance Committee. Awaiting Vice-Chancellor authorisation.'));
        }

        return back()->with('error', __('Permission denied'));
    }

    /**
     * Step 4 — Vice-Chancellor authorises (committee_approved → vc_authorised).
     * This locks the budget figures.
     */
    public function vcAuthorise(Budget $budget)
    {
        if (Auth::user()->can('vc-authorise-budgets')) {
            if ($budget->status !== 'committee_approved') {
                return back()->with('error', __('Only Finance Committee-approved budgets can be authorised by the Vice-Chancellor.'));
            }

            $budget->update([
                'status'            => 'vc_authorised',
                'vc_authorised_by'  => Auth::id(),
                'vc_authorised_at'  => now(),
            ]);

            return back()->with('success', __('Budget authorised by Vice-Chancellor.'));
        }

        return back()->with('error', __('Permission denied'));
    }

    /**
     * Activate budget — only possible once VC-authorised (or legacy 'approved').
     */
    public function active(Budget $budget)
    {
        if (Auth::user()->can('active-budgets')) {
            if (!$budget->isReadyToActivate()) {
                return back()->with('error', __('Budget must be authorised by the Vice-Chancellor before it can be activated.'));
            }

            $budget->update(['status' => 'active']);

            ActiveBudget::dispatch($budget);

            return back()->with('success', __('Budget is now active.'));
        }

        return back()->with('error', __('Permission denied'));
    }

    public function close(Budget $budget)
    {
        if (Auth::user()->can('close-budgets')) {
            if ($budget->status !== 'active') {
                return back()->with('error', __('Only active budgets can be closed.'));
            }

            $budget->update(['status' => 'closed']);

            CloseBudget::dispatch($budget);

            return back()->with('success', __('Budget closed successfully.'));
        }

        return back()->with('error', __('Permission denied'));
    }

    public function destroy(Budget $budget)
    {
        if (Auth::user()->can('delete-budgets')) {
            if ($budget->status !== 'draft') {
                return back()->with('error', __('Only draft budgets can be deleted.'));
            }

            DestroyBudget::dispatch($budget);
            $budget->delete();

            return redirect()->back()->with('success', __('The budget has been deleted.'));
        }

        return redirect()->route('budget-planner.budgets.index')
            ->with('error', __('Permission denied'));
    }
}
