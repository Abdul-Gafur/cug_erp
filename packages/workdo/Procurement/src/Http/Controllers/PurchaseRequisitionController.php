<?php

namespace Workdo\Procurement\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Workdo\Procurement\Http\Requests\StorePurchaseRequisitionRequest;
use Workdo\Procurement\Models\PurchaseRequisition;
use Workdo\Procurement\Models\PurchaseRequisitionItem;
use Workdo\Procurement\Models\ProcurementPlan;
use Workdo\BudgetPlanner\Models\VoteCostCentre;
use Workdo\BudgetPlanner\Models\BudgetPeriod;
use Workdo\BudgetPlanner\Services\CommitmentService;
use Workdo\BudgetPlanner\Exceptions\BudgetExceededException;
use Workdo\Account\Models\ChartOfAccount;

class PurchaseRequisitionController extends Controller
{
    public function __construct(private CommitmentService $commitmentService) {}

    // ─────────────────────────────────────────────────────────────────────────
    // Index
    // ─────────────────────────────────────────────────────────────────────────

    public function index(Request $request)
    {
        $query = PurchaseRequisition::with(['requestingDepartment', 'budgetPeriod', 'requester'])
            ->where('created_by', creatorId());

        if ($request->status) {
            $query->where('status', $request->status);
        }
        if ($request->department_id) {
            $query->where('requesting_department_id', $request->department_id);
        }
        if ($request->period_id) {
            $query->where('budget_period_id', $request->period_id);
        }
        if ($request->search) {
            $query->where(function ($q) use ($request) {
                $q->where('requisition_number', 'like', '%' . $request->search . '%')
                  ->orWhere('purpose', 'like', '%' . $request->search . '%');
            });
        }
        if ($request->date_from) {
            $query->where('requisition_date', '>=', $request->date_from);
        }
        if ($request->date_to) {
            $query->where('requisition_date', '<=', $request->date_to);
        }

        $requisitions = $query->orderBy('created_at', 'desc')->paginate(15)->withQueryString();

        return Inertia::render('Procurement/Requisitions/Index', [
            'requisitions'   => $requisitions,
            'departments'    => VoteCostCentre::where('created_by', creatorId())->where('is_active', true)->get(['id', 'code', 'name']),
            'budgetPeriods'  => BudgetPeriod::where('created_by', creatorId())->whereIn('status', ['active', 'approved'])->get(['id', 'period_name']),
            'filters'        => $request->only(['status', 'department_id', 'period_id', 'search', 'date_from', 'date_to']),
            'statusLabels'   => PurchaseRequisition::statusLabels(),
        ]);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Create
    // ─────────────────────────────────────────────────────────────────────────

    public function create()
    {
        $activePlan = ProcurementPlan::with('items.account')
            ->where('created_by', creatorId())
            ->where('status', 'active')
            ->latest()
            ->first();

        return Inertia::render('Procurement/Requisitions/Create', [
            'departments'   => VoteCostCentre::where('created_by', creatorId())->where('is_active', true)->get(['id', 'code', 'name']),
            'budgetPeriods' => BudgetPeriod::where('created_by', creatorId())->whereIn('status', ['active', 'approved'])->get(['id', 'period_name', 'financial_year']),
            'activePlan'    => $activePlan,
            'accounts'      => ChartOfAccount::where('created_by', creatorId())
                ->where('is_active', true)
                ->whereBetween('account_code', ['5000', '5999'])
                ->get(['id', 'account_code', 'account_name']),
            'fundTypes'     => ['IGF', 'GoG', 'Donor', 'Grant'],
            'economicClassifications' => [
                'goods_services'      => 'Goods & Services',
                'capital_expenditure' => 'Capital Expenditure',
                'transfers'           => 'Transfers & Grants',
                'personal_emoluments' => 'Personal Emoluments',
            ],
        ]);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Store
    // ─────────────────────────────────────────────────────────────────────────

    public function store(StorePurchaseRequisitionRequest $request)
    {
        DB::transaction(function () use ($request) {
            $pr = PurchaseRequisition::create([
                'requisition_date'        => $request->requisition_date,
                'requesting_department_id'=> $request->requesting_department_id,
                'purpose'                 => $request->purpose,
                'justification'           => $request->justification,
                'category'                => $request->category,
                'plan_item_id'            => $request->plan_item_id,
                'is_off_plan'             => $request->boolean('is_off_plan'),
                'off_plan_justification'  => $request->off_plan_justification,
                'budget_period_id'        => $request->budget_period_id,
                'status'                  => 'draft',
                'creator_id'              => Auth::id(),
                'created_by'              => creatorId(),
            ]);

            foreach ($request->items as $itemData) {
                PurchaseRequisitionItem::create([
                    'requisition_id'          => $pr->id,
                    'description'             => $itemData['description'],
                    'quantity'                => $itemData['quantity'],
                    'unit'                    => $itemData['unit'] ?? null,
                    'estimated_unit_cost'     => $itemData['estimated_unit_cost'],
                    'account_id'              => $itemData['account_id'],
                    'fund_type'               => $itemData['fund_type'],
                    'economic_classification' => $itemData['economic_classification'],
                    'notes'                   => $itemData['notes'] ?? null,
                    'creator_id'              => Auth::id(),
                    'created_by'              => creatorId(),
                ]);
            }

            $pr->recalculateTotals();
        });

        return redirect()->route('procurement.requisitions.index')
            ->with('success', __('Purchase Requisition created.'));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Show
    // ─────────────────────────────────────────────────────────────────────────

    public function show(PurchaseRequisition $requisition)
    {
        abort_if($requisition->created_by !== creatorId(), 403);

        $requisition->load([
            'requestingDepartment',
            'budgetPeriod',
            'planItem.plan',
            'items.account',
            'requester',
            'hodApprovedBy',
            'financeCheckedBy',
            'procurementApprovedBy',
            'rejectedBy',
        ]);

        // Build live budget positions for each line item (for the Finance approval panel)
        $budgetPositions = [];
        foreach ($requisition->items as $item) {
            $budgetPositions[$item->id] = $this->commitmentService->getBudgetPosition(
                $requisition->requesting_department_id,
                $item->fund_type,
                $item->economic_classification,
                $requisition->budget_period_id,
                creatorId()
            );
        }

        return Inertia::render('Procurement/Requisitions/Show', [
            'requisition'    => $requisition,
            'budgetPositions'=> $budgetPositions,
            'statusLabels'   => PurchaseRequisition::statusLabels(),
        ]);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Destroy
    // ─────────────────────────────────────────────────────────────────────────

    public function destroy(PurchaseRequisition $requisition)
    {
        abort_if($requisition->created_by !== creatorId(), 403);

        if ($requisition->status !== 'draft') {
            return back()->with('error', __('Only draft requisitions can be deleted.'));
        }

        $requisition->delete();

        return redirect()->route('procurement.requisitions.index')
            ->with('success', __('Requisition deleted.'));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Approval workflow steps
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Requester submits the draft PR for HoD approval.
     */
    public function submit(PurchaseRequisition $requisition)
    {
        abort_if($requisition->created_by !== creatorId(), 403);

        if ($requisition->status !== 'draft') {
            return back()->with('error', __('Only draft requisitions can be submitted.'));
        }

        if ($requisition->items()->count() === 0) {
            return back()->with('error', __('A requisition must have at least one item.'));
        }

        if ($requisition->is_off_plan && empty($requisition->off_plan_justification)) {
            return back()->with('error', __('Off-plan requisitions require a written justification.'));
        }

        $requisition->update(['status' => 'submitted']);

        return back()->with('success', __('Requisition submitted for Head of Department approval.'));
    }

    /**
     * Head of Department approves the submitted PR.
     */
    public function approveHod(PurchaseRequisition $requisition)
    {
        abort_if($requisition->created_by !== creatorId(), 403);

        if ($requisition->status !== 'submitted') {
            return back()->with('error', __('Requisition is not awaiting HoD approval.'));
        }

        $requisition->update([
            'status'          => 'hod_approved',
            'hod_approved_by' => Auth::id(),
            'hod_approved_at' => now(),
        ]);

        return back()->with('success', __('Requisition approved by Head of Department. Forwarded to Finance Office.'));
    }

    /**
     * Finance Office checks budget availability and creates a commitment.
     * Calls CommitmentService::onRequisitionApproved() — the core IPSAS 24 step.
     */
    public function financeCheck(Request $request, PurchaseRequisition $requisition)
    {
        abort_if($requisition->created_by !== creatorId(), 403);

        if ($requisition->status !== 'hod_approved') {
            return back()->with('error', __('Requisition is not awaiting Finance Office review.'));
        }

        $request->validate([
            'finance_notes' => 'nullable|string|max:1000',
        ]);

        // Build items array for CommitmentService
        $commitmentItems = $requisition->items->map(function ($item) use ($requisition) {
            return [
                'vote_cost_centre_id'     => $requisition->requesting_department_id,
                'fund_type'               => $item->fund_type,
                'economic_classification' => $item->economic_classification,
                'period_id'               => $requisition->budget_period_id,
                'amount'                  => (float) $item->estimated_total_cost,
            ];
        })->toArray();

        try {
            $result = $this->commitmentService->onRequisitionApproved($requisition->id, $commitmentItems);
        } catch (BudgetExceededException $e) {
            // Budget hard-block — PR is blocked; requester notified via flash
            return back()->with('error',
                __('Budget check failed: ') . $e->getMessage()
            );
        }

        $requisition->update([
            'status'              => 'finance_checked',
            'finance_checked_by'  => Auth::id(),
            'finance_checked_at'  => now(),
            'finance_notes'       => $request->finance_notes,
        ]);

        $message = __('Budget commitment created. Requisition forwarded to Procurement Officer.');

        if (!empty($result['warnings'])) {
            $message .= ' ' . __('Warning: ') . implode(' | ', $result['warnings']);
        }

        return back()->with('success', $message);
    }

    /**
     * Procurement Officer gives final approval. PR is now ready to become an LPO.
     */
    public function approveProcurement(PurchaseRequisition $requisition)
    {
        abort_if($requisition->created_by !== creatorId(), 403);

        if ($requisition->status !== 'finance_checked') {
            return back()->with('error', __('Requisition is not awaiting Procurement Officer approval.'));
        }

        $requisition->update([
            'status'                   => 'procurement_approved',
            'procurement_approved_by'  => Auth::id(),
            'procurement_approved_at'  => now(),
        ]);

        return back()->with('success', __('Requisition fully approved. Ready to proceed to Local Purchase Order.'));
    }

    /**
     * Reject at any approval stage, with mandatory reason.
     */
    public function reject(Request $request, PurchaseRequisition $requisition)
    {
        abort_if($requisition->created_by !== creatorId(), 403);

        $rejectableStatuses = ['submitted', 'hod_approved', 'finance_checked'];
        if (!in_array($requisition->status, $rejectableStatuses)) {
            return back()->with('error', __('Requisition cannot be rejected from its current status.'));
        }

        $request->validate([
            'rejection_reason' => 'required|string|min:10|max:1000',
        ]);

        // If a commitment was already created (finance step completed), reverse it
        if ($requisition->status === 'finance_checked') {
            $this->commitmentService->onInvoicePosted('purchase_requisition', $requisition->id);
        }

        $requisition->update([
            'status'           => 'rejected',
            'rejected_by'      => Auth::id(),
            'rejected_at'      => now(),
            'rejection_reason' => $request->rejection_reason,
        ]);

        return back()->with('success', __('Requisition rejected.'));
    }
}
