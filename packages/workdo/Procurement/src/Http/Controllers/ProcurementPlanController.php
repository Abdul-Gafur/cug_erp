<?php

namespace Workdo\Procurement\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Workdo\Procurement\Http\Requests\StoreProcurementPlanRequest;
use Workdo\Procurement\Http\Requests\UpdateProcurementPlanRequest;
use Workdo\Procurement\Models\ProcurementPlan;
use Workdo\Procurement\Models\ProcurementPlanItem;
use Workdo\BudgetPlanner\Models\VoteCostCentre;
use Workdo\Account\Models\ChartOfAccount;

class ProcurementPlanController extends Controller
{
    public function index(Request $request)
    {
        $query = ProcurementPlan::with(['voteCostCentre', 'approvedBy'])
            ->where('created_by', creatorId());

        if ($request->financial_year) {
            $query->where('financial_year', $request->financial_year);
        }
        if ($request->status) {
            $query->where('status', $request->status);
        }
        if ($request->vote_id) {
            $query->where('vote_cost_centre_id', $request->vote_id);
        }
        if ($request->search) {
            $query->where(function ($q) use ($request) {
                $q->where('plan_number', 'like', '%' . $request->search . '%')
                  ->orWhere('title', 'like', '%' . $request->search . '%');
            });
        }

        $plans = $query->orderBy('created_at', 'desc')->paginate(15)->withQueryString();

        return Inertia::render('Procurement/Plans/Index', [
            'plans'          => $plans,
            'voteCostCentres'=> VoteCostCentre::where('created_by', creatorId())->where('is_active', true)->get(['id', 'code', 'name']),
            'filters'        => $request->only(['financial_year', 'status', 'vote_id', 'search']),
        ]);
    }

    public function store(StoreProcurementPlanRequest $request)
    {
        $plan = ProcurementPlan::create([
            'financial_year'      => $request->financial_year,
            'title'               => $request->title,
            'vote_cost_centre_id' => $request->vote_cost_centre_id,
            'notes'               => $request->notes,
            'status'              => 'draft',
            'creator_id'          => Auth::id(),
            'created_by'          => creatorId(),
        ]);

        return redirect()->route('procurement.plans.show', $plan)
            ->with('success', __('Annual Procurement Plan created.'));
    }

    public function show(ProcurementPlan $plan)
    {
        abort_if($plan->created_by !== creatorId(), 403);

        $plan->load([
            'voteCostCentre',
            'approvedBy',
            'items.account',
        ]);

        $accounts = ChartOfAccount::where('created_by', creatorId())
            ->where('is_active', true)
            ->whereBetween('account_code', ['5000', '5999'])
            ->get(['id', 'account_code', 'account_name']);

        return Inertia::render('Procurement/Plans/Show', [
            'plan'     => $plan,
            'accounts' => $accounts,
        ]);
    }

    public function update(UpdateProcurementPlanRequest $request, ProcurementPlan $plan)
    {
        abort_if($plan->created_by !== creatorId(), 403);

        if ($plan->status !== 'draft') {
            return back()->with('error', __('Only draft plans can be edited.'));
        }

        $plan->update($request->only(['financial_year', 'title', 'vote_cost_centre_id', 'notes']));

        return back()->with('success', __('Plan updated.'));
    }

    public function destroy(ProcurementPlan $plan)
    {
        abort_if($plan->created_by !== creatorId(), 403);

        if ($plan->status !== 'draft') {
            return back()->with('error', __('Only draft plans can be deleted.'));
        }

        $plan->delete();

        return redirect()->route('procurement.plans.index')
            ->with('success', __('Plan deleted.'));
    }

    public function approve(ProcurementPlan $plan)
    {
        abort_if($plan->created_by !== creatorId(), 403);

        if ($plan->status !== 'draft') {
            return back()->with('error', __('Plan is not in draft status.'));
        }

        if ($plan->items()->count() === 0) {
            return back()->with('error', __('A plan must have at least one item before it can be approved.'));
        }

        $plan->update([
            'status'      => 'approved',
            'approved_by' => Auth::id(),
            'approved_at' => now(),
        ]);

        return back()->with('success', __('Procurement plan approved.'));
    }

    public function activate(ProcurementPlan $plan)
    {
        abort_if($plan->created_by !== creatorId(), 403);

        if ($plan->status !== 'approved') {
            return back()->with('error', __('Only approved plans can be activated.'));
        }

        $plan->update(['status' => 'active']);

        return back()->with('success', __('Procurement plan is now active.'));
    }

    public function close(ProcurementPlan $plan)
    {
        abort_if($plan->created_by !== creatorId(), 403);

        if (!in_array($plan->status, ['approved', 'active'])) {
            return back()->with('error', __('Plan cannot be closed from its current status.'));
        }

        $plan->update(['status' => 'closed']);

        return back()->with('success', __('Procurement plan closed.'));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Plan items — managed as sub-resources of a plan (AJAX from Show page)
    // ─────────────────────────────────────────────────────────────────────────

    public function storeItem(Request $request, ProcurementPlan $plan)
    {
        abort_if($plan->created_by !== creatorId(), 403);

        if ($plan->status !== 'draft') {
            return back()->with('error', __('Items can only be added to draft plans.'));
        }

        $validated = $request->validate([
            'item_description'      => 'required|string|max:500',
            'quantity'              => 'required|numeric|min:0.001',
            'unit'                  => 'nullable|string|max:30',
            'estimated_unit_cost'   => 'required|numeric|min:0',
            'procurement_method'    => 'required|in:open_tender,restricted_tender,rfq,single_source,framework_agreement',
            'planned_quarter'       => 'required|integer|between:1,4',
            'account_id'            => 'required|exists:chart_of_accounts,id',
            'fund_type'             => 'required|string|max:50',
            'economic_classification'=> 'required|string|max:50',
            'notes'                 => 'nullable|string|max:1000',
        ]);

        $item = $plan->items()->create(array_merge($validated, [
            'creator_id' => Auth::id(),
            'created_by' => creatorId(),
        ]));

        $item->load('account');

        return back()->with('success', __('Plan item added.'));
    }

    public function updateItem(Request $request, ProcurementPlan $plan, ProcurementPlanItem $item)
    {
        abort_if($plan->created_by !== creatorId(), 403);
        abort_if($item->plan_id !== $plan->id, 404);

        if ($plan->status !== 'draft') {
            return back()->with('error', __('Items can only be edited on draft plans.'));
        }

        $validated = $request->validate([
            'item_description'       => 'required|string|max:500',
            'quantity'               => 'required|numeric|min:0.001',
            'unit'                   => 'nullable|string|max:30',
            'estimated_unit_cost'    => 'required|numeric|min:0',
            'procurement_method'     => 'required|in:open_tender,restricted_tender,rfq,single_source,framework_agreement',
            'planned_quarter'        => 'required|integer|between:1,4',
            'account_id'             => 'required|exists:chart_of_accounts,id',
            'fund_type'              => 'required|string|max:50',
            'economic_classification'=> 'required|string|max:50',
            'notes'                  => 'nullable|string|max:1000',
        ]);

        $item->update($validated);

        return back()->with('success', __('Plan item updated.'));
    }

    public function destroyItem(ProcurementPlan $plan, ProcurementPlanItem $item)
    {
        abort_if($plan->created_by !== creatorId(), 403);
        abort_if($item->plan_id !== $plan->id, 404);

        if ($plan->status !== 'draft') {
            return back()->with('error', __('Items can only be removed from draft plans.'));
        }

        $item->delete();

        return back()->with('success', __('Plan item removed.'));
    }
}
