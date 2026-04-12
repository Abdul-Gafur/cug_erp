<?php

namespace Workdo\Quotation\Http\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Mail;
use Inertia\Inertia;
use App\Models\User;
use Workdo\Quotation\Models\SalesQuotation;
use Workdo\Quotation\Models\LocalPurchaseOrder;
use Workdo\Quotation\Models\LocalPurchaseOrderItem;
use Workdo\Quotation\Mail\LpoMailable;
use Workdo\Account\Models\ChartOfAccount;
use Workdo\BudgetPlanner\Models\BudgetPeriod;
use Workdo\BudgetPlanner\Services\CommitmentService;
use Workdo\BudgetPlanner\Exceptions\BudgetExceededException;

class LocalPurchaseOrderController extends Controller
{
    public function __construct(private CommitmentService $commitmentService) {}

    /**
     * Show the form to create an LPO — pre-populated from an awarded RFQ if given.
     */
    public function create(Request $request)
    {
        if (!Auth::user()->can('create-quotations')) {
            return redirect()->route('quotations.index')->with('error', __('Permission denied'));
        }

        $rfq = null;
        if ($request->rfq_id) {
            $rfq = SalesQuotation::with(['suppliers.supplier', 'items.product', 'awardedSupplier'])
                ->where('created_by', creatorId())
                ->where('status', 'awarded')
                ->findOrFail($request->rfq_id);
        }

        $suppliers     = User::where('type', 'vendor')->where('created_by', creatorId())->select('id', 'name', 'email')->get();
        $accounts      = ChartOfAccount::where('created_by', creatorId())->where('is_active', true)->select('id', 'account_code', 'account_name')->orderBy('account_code')->get();
        $budgetPeriods = BudgetPeriod::where('created_by', creatorId())->whereIn('status', ['active', 'approved'])->select('id', 'period_name')->get();

        return Inertia::render('Quotation/Lpo/Create', [
            'rfq'           => $rfq,
            'suppliers'     => $suppliers,
            'accounts'      => $accounts,
            'budgetPeriods' => $budgetPeriods,
        ]);
    }

    public function store(Request $request)
    {
        if (!Auth::user()->can('create-quotations')) {
            return redirect()->route('quotations.index')->with('error', __('Permission denied'));
        }

        $request->validate([
            'rfq_id'                  => 'nullable|exists:sales_quotations,id',
            'requisition_id'          => 'nullable|exists:purchase_requisitions,id',
            'supplier_id'             => 'required|exists:users,id',
            'is_contract'             => 'nullable|boolean',
            'contract_number'         => 'nullable|string|max:100',
            'contract_terms'          => 'nullable|string',
            'lpo_date'                => 'required|date',
            'issuing_department'      => 'required|string|max:255',
            'delivery_location'       => 'nullable|string|max:500',
            'delivery_date'           => 'nullable|date|after_or_equal:lpo_date',
            'payment_terms'           => 'nullable|string|max:255',
            'vote_account_id'         => 'nullable|exists:chart_of_accounts,id',
            'fund_type'               => 'nullable|string|max:100',
            'economic_classification' => 'nullable|string|max:100',
            'budget_period_id'        => 'nullable|exists:budget_periods,id',
            'notes'                   => 'nullable|string|max:2000',
            'items'                   => 'required|array|min:1',
            'items.*.description'     => 'required|string|max:500',
            'items.*.quantity'        => 'required|integer|min:1',
            'items.*.unit'            => 'nullable|string|max:50',
            'items.*.unit_price'      => 'required|numeric|min:0',
            'items.*.discount_percentage' => 'nullable|numeric|min:0|max:100',
            'items.*.tax_percentage'  => 'nullable|numeric|min:0|max:100',
            'items.*.product_id'      => 'nullable|exists:product_service_items,id',
        ]);

        $totals = $this->calculateTotals($request->items);

        $lpo = LocalPurchaseOrder::create([
            'rfq_id'                  => $request->rfq_id,
            'requisition_id'          => $request->requisition_id,
            'supplier_id'             => $request->supplier_id,
            'is_contract'             => $request->boolean('is_contract'),
            'contract_number'         => $request->contract_number,
            'contract_terms'          => $request->contract_terms,
            'lpo_date'                => $request->lpo_date,
            'issuing_department'      => $request->issuing_department,
            'delivery_location'       => $request->delivery_location,
            'delivery_date'           => $request->delivery_date,
            'payment_terms'           => $request->payment_terms,
            'vote_account_id'         => $request->vote_account_id,
            'fund_type'               => $request->fund_type,
            'economic_classification' => $request->economic_classification,
            'budget_period_id'        => $request->budget_period_id,
            'notes'                   => $request->notes,
            'subtotal'                => $totals['subtotal'],
            'tax_amount'              => $totals['tax_amount'],
            'discount_amount'         => $totals['discount_amount'],
            'total_amount'            => $totals['total_amount'],
            'status'                  => 'draft',
            'creator_id'              => Auth::id(),
            'created_by'              => creatorId(),
        ]);

        $this->createItems($lpo->id, $request->items);

        // Mark RFQ as LPO issued
        if ($request->rfq_id) {
            SalesQuotation::where('id', $request->rfq_id)
                          ->where('created_by', creatorId())
                          ->update(['status' => 'lpo_issued']);
        }

        return redirect()->route('lpo.show', $lpo->id)->with('success', __('Local Purchase Order created.'));
    }

    public function show(LocalPurchaseOrder $lpo)
    {
        if (!Auth::user()->can('view-quotations')) {
            return redirect()->route('quotations.index')->with('error', __('Permission denied'));
        }
        if ($lpo->created_by != creatorId()) {
            return redirect()->route('quotations.index')->with('error', __('Access denied'));
        }

        $lpo->load(['supplier', 'items.product', 'rfq', 'approvedBy', 'voteAccount', 'budgetPeriod']);

        return Inertia::render('Quotation/Lpo/Show', ['lpo' => $lpo]);
    }

    /**
     * Approve the LPO — updates budget commitment from PR amount to LPO amount.
     */
    public function approve(LocalPurchaseOrder $lpo)
    {
        if (!Auth::user()->can('approve-quotations') || $lpo->created_by != creatorId()) {
            return back()->with('error', __('Permission denied'));
        }
        if ($lpo->status !== 'draft') {
            return back()->with('error', __('Only draft LPOs can be approved.'));
        }

        // Call CommitmentService to update budget commitment to LPO amount.
        // CommitmentService requires a VoteCostCentre ID (vote_cost_centres table),
        // not a ChartOfAccount ID. When the LPO was raised from a PR, the PR's
        // requesting_department_id IS the VoteCostCentre ID and is the correct key.
        // For standalone LPOs (no PR link), we skip commitment update — no PR
        // commitment exists to supersede.
        $voteCostCentreId = null;
        if ($lpo->requisition_id) {
            $pr = \Workdo\Procurement\Models\PurchaseRequisition::find($lpo->requisition_id);
            $voteCostCentreId = $pr?->requesting_department_id;
        }

        if ($voteCostCentreId && $lpo->budget_period_id) {
            $items = [[
                'vote_cost_centre_id'     => $voteCostCentreId,
                'fund_type'               => $lpo->fund_type ?? 'recurrent',
                'economic_classification' => $lpo->economic_classification ?? 'goods_and_services',
                'period_id'               => $lpo->budget_period_id,
                'amount'                  => $lpo->total_amount,
            ]];

            try {
                $result = $this->commitmentService->onLPOIssued(
                    $lpo->id,
                    $lpo->requisition_id ?? 0,
                    $items
                );

                if (!empty($result['warnings'])) {
                    foreach ($result['warnings'] as $warning) {
                        session()->push('warnings', $warning);
                    }
                }
            } catch (BudgetExceededException $e) {
                return back()->with('error', $e->getMessage());
            }
        }

        $lpo->update([
            'status'      => 'approved',
            'approved_by' => Auth::id(),
            'approved_at' => now(),
        ]);

        return back()->with('success', __('LPO approved and budget commitment updated.'));
    }

    /**
     * Email the approved LPO to the supplier.
     */
    public function email(LocalPurchaseOrder $lpo)
    {
        if (!Auth::user()->can('sent-quotations') || $lpo->created_by != creatorId()) {
            return back()->with('error', __('Permission denied'));
        }
        if ($lpo->status !== 'approved') {
            return back()->with('error', __('Only approved LPOs can be emailed.'));
        }

        $lpo->load(['supplier', 'items.product', 'voteAccount', 'budgetPeriod', 'approvedBy']);

        $supplierEmail = $lpo->supplier->email;
        if (!$supplierEmail) {
            return back()->with('error', __('Supplier does not have an email address on record.'));
        }

        Mail::to($supplierEmail)->send(new LpoMailable($lpo));

        $lpo->update(['emailed_at' => now(), 'status' => 'emailed']);

        return back()->with('success', __('LPO emailed to :supplier.', ['supplier' => $lpo->supplier->name]));
    }

    /**
     * Print / PDF view of the LPO.
     */
    public function print(LocalPurchaseOrder $lpo)
    {
        if (!Auth::user()->can('print-quotations') || $lpo->created_by != creatorId()) {
            return back()->with('error', __('Permission denied'));
        }

        $lpo->load(['supplier', 'items.product', 'rfq', 'approvedBy', 'voteAccount', 'budgetPeriod']);

        return Inertia::render('Quotation/Lpo/Print', ['lpo' => $lpo]);
    }

    public function index(Request $request)
    {
        if (!Auth::user()->can('manage-quotations')) {
            return redirect()->route('quotations.index')->with('error', __('Permission denied'));
        }

        $query = LocalPurchaseOrder::with(['supplier'])
            ->where('created_by', creatorId());

        if ($request->status) {
            $query->where('status', $request->status);
        }
        if ($request->search) {
            $query->where('lpo_number', 'like', '%' . $request->search . '%');
        }

        $lpos = $query->orderBy('created_at', 'desc')->paginate(15);

        return Inertia::render('Quotation/Lpo/Index', [
            'lpos'    => $lpos,
            'filters' => $request->only(['status', 'search']),
        ]);
    }

    // ─── helpers ────────────────────────────────────────────────────────────────

    private function calculateTotals(array $items): array
    {
        $subtotal = $tax = $discount = 0;
        foreach ($items as $item) {
            $lineTotal  = $item['quantity'] * $item['unit_price'];
            $disc       = ($lineTotal * ($item['discount_percentage'] ?? 0)) / 100;
            $afterDisc  = $lineTotal - $disc;
            $taxAmt     = ($afterDisc * ($item['tax_percentage'] ?? 0)) / 100;

            $subtotal  += $lineTotal;
            $discount  += $disc;
            $tax       += $taxAmt;
        }
        return [
            'subtotal'        => $subtotal,
            'tax_amount'      => $tax,
            'discount_amount' => $discount,
            'total_amount'    => $subtotal + $tax - $discount,
        ];
    }

    private function createItems(int $lpoId, array $items): void
    {
        foreach ($items as $i) {
            $lineTotal  = $i['quantity'] * $i['unit_price'];
            $disc       = ($lineTotal * ($i['discount_percentage'] ?? 0)) / 100;
            $afterDisc  = $lineTotal - $disc;
            $taxAmt     = ($afterDisc * ($i['tax_percentage'] ?? 0)) / 100;

            LocalPurchaseOrderItem::create([
                'lpo_id'               => $lpoId,
                'product_id'           => $i['product_id'] ?? null,
                'description'          => $i['description'],
                'quantity'             => $i['quantity'],
                'unit'                 => $i['unit'] ?? null,
                'unit_price'           => $i['unit_price'],
                'discount_percentage'  => $i['discount_percentage'] ?? 0,
                'discount_amount'      => $disc,
                'tax_percentage'       => $i['tax_percentage'] ?? 0,
                'tax_amount'           => $taxAmt,
                'total_amount'         => $afterDisc + $taxAmt,
            ]);
        }
    }
}
