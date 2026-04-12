<?php

namespace Workdo\Quotation\Http\Controllers;

use App\Http\Controllers\Controller;
use Workdo\Quotation\Models\SalesQuotation;
use Workdo\Quotation\Models\SalesQuotationItem;
use Workdo\Quotation\Models\SalesQuotationItemTax;
use Workdo\Quotation\Models\RfqSupplier;
use Workdo\Quotation\Models\RfqEvaluation;
use Workdo\Quotation\Models\RfqEvaluationCriterion;
use Workdo\Quotation\Http\Requests\StoreQuotationRequest;
use Workdo\Quotation\Http\Requests\UpdateQuotationRequest;
use App\Models\User;
use App\Models\Warehouse;
use Workdo\ProductService\Models\ProductServiceItem;
use App\Models\SalesInvoice;
use App\Models\SalesInvoiceItem;
use App\Models\SalesInvoiceItemTax;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Workdo\Quotation\Events\AcceptSalesQuotation;
use Workdo\Quotation\Events\ConvertSalesQuotation;
use Workdo\Quotation\Events\CreateQuotation;
use Workdo\Quotation\Events\UpdateQuotation;
use Workdo\Quotation\Events\DestroyQuotation;
use Workdo\Quotation\Events\RejectSalesQuotation;
use Workdo\Quotation\Events\SentSalesQuotation;

class QuotationController extends Controller
{
    public function index(Request $request)
    {
        if (Auth::user()->can('manage-quotations')) {
            $query = SalesQuotation::with(['awardedSupplier', 'suppliers.supplier', 'items'])
                ->where(function ($q) {
                    if (Auth::user()->can('manage-any-quotations')) {
                        $q->where('created_by', creatorId());
                    } elseif (Auth::user()->can('manage-own-quotations')) {
                        $q->where('creator_id', Auth::id());
                    } else {
                        $q->whereRaw('1 = 0');
                    }
                });

            if ($request->status) {
                $query->where('status', $request->status);
            }
            if ($request->search) {
                $query->where('quotation_number', 'like', '%' . $request->search . '%');
            }
            if ($request->date_range) {
                $dates = explode(' - ', $request->date_range);
                if (count($dates) === 2) {
                    $query->whereBetween('quotation_date', [$dates[0], $dates[1]]);
                }
            }

            $sortField     = $request->get('sort', 'created_at');
            $sortDirection = $request->get('direction', 'desc');

            $allowedSortFields = ['quotation_number', 'quotation_date', 'closing_date', 'total_amount', 'status', 'created_at'];
            if (!in_array($sortField, $allowedSortFields) || empty($sortField)) {
                $sortField = 'created_at';
            }

            $query->orderBy($sortField, $sortDirection);

            $perPage    = $request->get('per_page', 10);
            $quotations = $query->paginate($perPage);

            return Inertia::render('Quotation/Quotations/Index', [
                'quotations' => $quotations,
                'filters'    => $request->only(['status', 'search', 'date_range']),
            ]);
        } else {
            return back()->with('error', __('Permission denied'));
        }
    }

    public function create(Request $request)
    {
        if (Auth::user()->can('create-quotations')) {
            $suppliers  = User::where('type', 'vendor')->select('id', 'name', 'email')->where('created_by', creatorId())->get();
            $warehouses = Warehouse::where('is_active', true)->select('id', 'name', 'address')->where('created_by', creatorId())->get();

            // Load Purchase Requisition if linked from the procurement workflow
            $purchaseRequisition = null;
            if ($request->pr_id) {
                $purchaseRequisition = \Workdo\Procurement\Models\PurchaseRequisition::with([
                        'items.account',
                        'requestingDepartment',
                        'budgetPeriod',
                    ])
                    ->where('created_by', creatorId())
                    ->where('status', 'procurement_approved')
                    ->find($request->pr_id);
            }

            return Inertia::render('Quotation/Quotations/Create', [
                'suppliers'            => $suppliers,
                'warehouses'           => $warehouses,
                'purchaseRequisition'  => $purchaseRequisition,
            ]);
        } else {
            return back()->with('error', __('Permission denied'));
        }
    }

    public function store(StoreQuotationRequest $request)
    {
        if (Auth::user()->can('create-quotations')) {
            $totals = $this->calculateTotals($request->items);

            $quotation                  = new SalesQuotation();
            $quotation->quotation_date  = $request->invoice_date;
            $quotation->due_date        = $request->due_date;
            $quotation->closing_date    = $request->closing_date;
            $quotation->customer_id     = $request->customer_id ?? null;
            $quotation->department      = $request->department;
            $quotation->pr_id           = $request->pr_id;
            $quotation->warehouse_id    = $request->warehouse_id;
            $quotation->payment_terms   = $request->payment_terms;
            $quotation->notes           = $request->notes;
            $quotation->subtotal        = $totals['subtotal'];
            $quotation->tax_amount      = $totals['tax_amount'];
            $quotation->discount_amount = $totals['discount_amount'];
            $quotation->total_amount    = $totals['total_amount'];
            $quotation->creator_id      = Auth::id();
            $quotation->created_by      = creatorId();
            $quotation->save();

            // Save invited suppliers (Handle both new build 'invited_supplier_ids' and old build 'customer_id')
            $supplierIds = $request->invited_supplier_ids ?? [];
            if ($request->customer_id && !in_array($request->customer_id, $supplierIds)) {
                $supplierIds[] = $request->customer_id;
            }

            foreach ($supplierIds as $supplierId) {
                RfqSupplier::create([
                    'rfq_id'      => $quotation->id,
                    'supplier_id' => $supplierId,
                    'status'      => 'invited',
                    'creator_id'  => Auth::id(),
                    'created_by'  => creatorId(),
                ]);
            }

              // Create quotation items
            $this->createQuotationItems($quotation->id, $request->items);

            try {
                CreateQuotation::dispatch($request, $quotation);
            } catch (\Throwable $th) {
                return back()->with('error', $th->getMessage());
            }

            return redirect()->route('quotations.index')->with('success', __('The quotation has been created successfully.'));
        } else {
            return redirect()->route('quotations.index')->with('error', __('Permission denied'));
        }
    }



    public function show(SalesQuotation $quotation)
    {
        if (Auth::user()->can('view-quotations')) {
            if (!$this->canAccessQuotation($quotation)) {
                return redirect()->route('quotations.index')->with('error', __('Access denied'));
            }

            $quotation->load([
                'awardedSupplier',
                'suppliers.supplier',
                'items.product',
                'items.taxes',
                'warehouse',
                'parentQuotation',
                'evaluation.criteria',
                'evaluation.scores.supplier',
                'evaluation.recommendedSupplier',
                'lpo',
            ]);

            $suppliers = User::where('type', 'vendor')->select('id', 'name', 'email')->where('created_by', creatorId())->get();
            
            return Inertia::render('Quotation/Quotations/View', [
                'quotation' => $quotation,
                'suppliers' => $suppliers,
            ]);
        } else {
            return redirect()->route('quotations.index')->with('error', __('Permission denied'));
        }
    }

    public function edit(SalesQuotation $quotation)
    {
        if (Auth::user()->can('edit-quotations')) {
            if (!$this->canAccessQuotation($quotation)) {
                return redirect()->route('quotations.index')->with('error', __('Access denied'));
            }

            if ($quotation->status != 'draft') {
                return redirect()->route('quotations.index')->with('error', __('Cannot update an issued RFQ.'));
            }

            $quotation->load(['items.taxes']);
            $suppliers  = User::where('type', 'vendor')->select('id', 'name', 'email')->where('created_by', creatorId())->get();
            $warehouses = Warehouse::where('is_active', true)->select('id', 'name', 'address')->where('created_by', creatorId())->get();

            return Inertia::render('Quotation/Quotations/Edit', [
                'quotation'  => $quotation,
                'suppliers'  => $suppliers,
                'customers'  => $suppliers, // Compatibility with stale build
                'warehouses' => $warehouses,
            ]);
        } else {
            return redirect()->route('quotations.index')->with('error', __('Permission denied'));
        }
    }

    public function update(UpdateQuotationRequest $request, SalesQuotation $quotation)
    {
        if (Auth::user()->can('edit-quotations') && $quotation->created_by == creatorId()) {
            if ($quotation->status != 'draft') {
                return redirect()->route('quotations.index')->with('error', __('Cannot update an issued RFQ.'));
            }

            $totals = $this->calculateTotals($request->items);

            $quotation->quotation_date  = $request->invoice_date;
            $quotation->due_date        = $request->due_date;
            $quotation->closing_date    = $request->closing_date;
            $quotation->customer_id     = $request->customer_id ?? null;
            $quotation->department      = $request->department;
            $quotation->pr_id           = $request->pr_id;
            $quotation->warehouse_id    = $request->warehouse_id;
            $quotation->payment_terms   = $request->payment_terms;
            $quotation->notes           = $request->notes;
            $quotation->subtotal        = $totals['subtotal'];
            $quotation->tax_amount      = $totals['tax_amount'];
            $quotation->discount_amount = $totals['discount_amount'];
            $quotation->total_amount    = $totals['total_amount'];
            $quotation->save();

            $quotation->items()->delete();
            $this->createQuotationItems($quotation->id, $request->items);

            // Sync suppliers (Handle both new build 'invited_supplier_ids' and old build 'customer_id')
            $supplierIds = $request->invited_supplier_ids ?? [];
            if ($request->customer_id && !in_array($request->customer_id, $supplierIds)) {
                $supplierIds[] = $request->customer_id;
            }

            if (!empty($supplierIds)) {
                // Remove suppliers not in the new list
                RfqSupplier::where('rfq_id', $quotation->id)
                    ->whereNotIn('supplier_id', $supplierIds)
                    ->delete();

                // Add new suppliers
                foreach ($supplierIds as $supplierId) {
                    RfqSupplier::firstOrCreate([
                        'rfq_id'      => $quotation->id,
                        'supplier_id' => $supplierId,
                    ], [
                        'status'      => 'invited',
                        'creator_id'  => Auth::id(),
                        'created_by'  => creatorId(),
                    ]);
                }
            }

            UpdateQuotation::dispatch($request, $quotation);

            return redirect()->route('quotations.index')->with('success', __('The quotation details are updated successfully.'));
        } else {
            return redirect()->route('quotations.index')->with('error', __('Permission denied'));
        }
    }

    public function destroy(SalesQuotation $quotation)
    {
        if (Auth::user()->can('delete-quotations')) {
            if ($quotation->status === 'sent') {
                return back()->with('error', __('Cannot delete sent quotation.'));
            }

            DestroyQuotation::dispatch($quotation);

            $quotation->delete();

            return redirect()->route('quotations.index')->with('success', __('The quotation has been deleted.'));
        } else {
            return redirect()->route('quotations.index')->with('error', __('Permission denied'));
        }
    }

    private function calculateTotals($items)
    {
        $subtotal      = 0;
        $totalTax      = 0;
        $totalDiscount = 0;

        foreach ($items as $item) {
            $lineTotal      = $item['quantity'] * $item['unit_price'];
            $discountAmount = ($lineTotal * ($item['discount_percentage'] ?? 0)) / 100;
            $afterDiscount  = $lineTotal - $discountAmount;
            $taxAmount      = ($afterDiscount * ($item['tax_percentage'] ?? 0)) / 100;

            $subtotal      += $lineTotal;
            $totalDiscount += $discountAmount;
            $totalTax      += $taxAmount;
        }

        return [
            'subtotal'        => $subtotal,
            'tax_amount'      => $totalTax,
            'discount_amount' => $totalDiscount,
            'total_amount'    => $subtotal + $totalTax - $totalDiscount
        ];
    }

    private function createQuotationItems($quotationId, $items)
    {
        foreach ($items as $itemData) {
            $item                      = new SalesQuotationItem();
            $item->quotation_id        = $quotationId;
            $productId                 = $itemData['product_id'];
            $item->product_id          = ($productId == 0) ? null : $productId;
            $item->description         = $itemData['description'] ?? '';
            $item->quantity            = $itemData['quantity'];
            $item->unit_price          = $itemData['unit_price'];
            $item->discount_percentage = $itemData['discount_percentage'] ?? 0;
            $item->tax_percentage      = $itemData['tax_percentage'] ?? 0;
            $item->save();

              // Store individual taxes
            if (isset($itemData['taxes']) && is_array($itemData['taxes'])) {
                foreach ($itemData['taxes'] as $tax) {
                    $quotationItemTax           = new SalesQuotationItemTax();
                    $quotationItemTax->item_id  = $item->id;
                    $quotationItemTax->tax_name = $tax['tax_name'];
                    $quotationItemTax->tax_rate = $tax['tax_rate'] ?? $tax['rate'] ?? 0;
                    $quotationItemTax->save();
                }
            }
        }
    }

    /**
     * Issue the RFQ to invited suppliers (was: sent).
     */
    public function issue(SalesQuotation $quotation)
    {
        if (Auth::user()->can('sent-quotations') && $quotation->created_by == creatorId()) {
            if ($quotation->status !== 'draft') {
                return back()->with('error', __('Only draft RFQs can be issued.'));
            }
            if ($quotation->suppliers()->count() === 0) {
                return back()->with('error', __('Add at least one invited supplier before issuing the RFQ.'));
            }
            SentSalesQuotation::dispatch($quotation);
            $quotation->update(['status' => 'issued']);

            return back()->with('success', __('RFQ issued to suppliers.'));
        }
        return back()->with('error', __('Permission denied'));
    }

    // Keep legacy route alias
    public function sent(SalesQuotation $quotation)
    {
        return $this->issue($quotation);
    }

    /**
     * Close the RFQ — no more supplier responses accepted.
     */
    public function closeRfq(SalesQuotation $quotation)
    {
        if (Auth::user()->can('approve-quotations') && $quotation->created_by == creatorId()) {
            if ($quotation->status !== 'issued') {
                return back()->with('error', __('Only issued RFQs can be closed.'));
            }
            $quotation->update(['status' => 'closed']);
            return back()->with('success', __('RFQ closed. No further supplier responses will be accepted.'));
        }
        return back()->with('error', __('Permission denied'));
    }

    /**
     * Add or update an invited supplier on this RFQ.
     */
    public function addSupplier(Request $request, SalesQuotation $quotation)
    {
        if (!Auth::user()->can('edit-quotations') || $quotation->created_by != creatorId()) {
            return back()->with('error', __('Permission denied'));
        }
        if (!in_array($quotation->status, ['draft', 'issued'])) {
            return back()->with('error', __('Cannot add suppliers to a closed or evaluated RFQ.'));
        }

        $request->validate(['supplier_id' => 'required|exists:users,id']);

        RfqSupplier::firstOrCreate(
            ['rfq_id' => $quotation->id, 'supplier_id' => $request->supplier_id],
            ['status' => 'invited', 'creator_id' => Auth::id(), 'created_by' => creatorId()]
        );

        return back()->with('success', __('Supplier added to RFQ.'));
    }

    /**
     * Remove an invited supplier from this RFQ.
     */
    public function removeSupplier(SalesQuotation $quotation, RfqSupplier $rfqSupplier)
    {
        if (!Auth::user()->can('edit-quotations') || $quotation->created_by != creatorId()) {
            return back()->with('error', __('Permission denied'));
        }
        if ($rfqSupplier->status === 'responded') {
            return back()->with('error', __('Cannot remove a supplier who has already responded.'));
        }
        $rfqSupplier->delete();
        return back()->with('success', __('Supplier removed from RFQ.'));
    }

    /**
     * Record a supplier's quotation response.
     */
    public function recordResponse(Request $request, SalesQuotation $quotation, RfqSupplier $rfqSupplier)
    {
        if (!Auth::user()->can('edit-quotations') || $quotation->created_by != creatorId()) {
            return back()->with('error', __('Permission denied'));
        }
        if (!in_array($quotation->status, ['issued', 'closed'])) {
            return back()->with('error', __('Responses can only be recorded when the RFQ is issued or closed.'));
        }

        $request->validate([
            'quoted_amount' => 'required|numeric|min:0',
            'delivery_days' => 'nullable|integer|min:1',
            'response_notes' => 'nullable|string|max:2000',
        ]);

        $rfqSupplier->update([
            'quoted_amount'        => $request->quoted_amount,
            'delivery_days'        => $request->delivery_days,
            'response_notes'       => $request->response_notes,
            'response_received_at' => now(),
            'status'               => 'responded',
        ]);

        return back()->with('success', __('Supplier response recorded.'));
    }

    /**
     * Start the bid evaluation — creates the evaluation record with default criteria.
     */
    public function startEvaluation(SalesQuotation $quotation)
    {
        if (!Auth::user()->can('approve-quotations') || $quotation->created_by != creatorId()) {
            return back()->with('error', __('Permission denied'));
        }
        if (!in_array($quotation->status, ['closed', 'under_evaluation'])) {
            return back()->with('error', __('Close the RFQ before starting evaluation.'));
        }
        if ($quotation->evaluation) {
            return redirect()->route('rfq.evaluation.show', $quotation->id);
        }

        $evaluation = RfqEvaluation::create([
            'rfq_id'     => $quotation->id,
            'status'     => 'draft',
            'creator_id' => Auth::id(),
            'created_by' => creatorId(),
        ]);

        // Default weighted criteria (IPSAS-appropriate)
        $defaults = [
            ['criterion_name' => 'Price',                 'weight' => 40.00, 'sort_order' => 1],
            ['criterion_name' => 'Technical Compliance',  'weight' => 30.00, 'sort_order' => 2],
            ['criterion_name' => 'Delivery Time',         'weight' => 20.00, 'sort_order' => 3],
            ['criterion_name' => 'Supplier Reliability',  'weight' => 10.00, 'sort_order' => 4],
        ];

        foreach ($defaults as $d) {
            RfqEvaluationCriterion::create(array_merge($d, [
                'evaluation_id' => $evaluation->id,
                'creator_id'    => Auth::id(),
                'created_by'    => creatorId(),
            ]));
        }

        $quotation->update(['status' => 'under_evaluation']);

        return redirect()->route('rfq.evaluation.show', $quotation->id)
                         ->with('success', __('Evaluation started.'));
    }

    /**
     * Award the RFQ to the recommended supplier.
     */
    public function award(Request $request, SalesQuotation $quotation)
    {
        if (!Auth::user()->can('approve-quotations') || $quotation->created_by != creatorId()) {
            return back()->with('error', __('Permission denied'));
        }
        if ($quotation->status !== 'under_evaluation') {
            return back()->with('error', __('RFQ must be under evaluation before awarding.'));
        }

        $evaluation = $quotation->evaluation;
        if (!$evaluation || $evaluation->status !== 'committee_approved') {
            return back()->with('error', __('The bid evaluation has not been approved by the Tender Committee. Awarding is blocked until committee sign-off is recorded.'));
        }

        $request->validate(['awarded_supplier_id' => 'required|exists:users,id']);

        $quotation->update([
            'awarded_supplier_id' => $request->awarded_supplier_id,
            'status'              => 'awarded',
        ]);

        AcceptSalesQuotation::dispatch($quotation);

        return back()->with('success', __('RFQ awarded. You may now issue a Local Purchase Order.'));
    }

    // Legacy alias
    public function approve(SalesQuotation $quotation)
    {
        return back()->with('error', __('Use the Award action after completing the bid evaluation.'));
    }

    public function reject(SalesQuotation $quotation)
    {
        if (Auth::user()->can('reject-quotations') && $quotation->created_by == creatorId()) {
            if (!in_array($quotation->status, ['draft', 'issued', 'closed', 'under_evaluation'])) {
                return back()->with('error', __('This RFQ cannot be cancelled at its current stage.'));
            }
            RejectSalesQuotation::dispatch($quotation);
            $quotation->update(['status' => 'rejected']);
            return back()->with('success', __('RFQ cancelled.'));
        }
        return back()->with('error', __('Permission denied'));
    }

    public function print(SalesQuotation $quotation)
    {
        if (Auth::user()->can('print-quotations')) {
            $quotation->load(['suppliers.supplier', 'items.product', 'items.taxes', 'warehouse', 'awardedSupplier']);

            return Inertia::render('Quotation/Quotations/Print', [
                'quotation' => $quotation,
            ]);
        }
        return back()->with('error', __('Permission denied'));
    }

    public function createRevision(SalesQuotation $quotation)
    {
        if (Auth::user()->can('create-quotations-revision') && $quotation->created_by == creatorId()) {
            if ($quotation->status === 'draft') {
                return back()->with('error', __('Cannot create version of draft quotation.'));
            }

            $quotation->load(['items.taxes']);

            // Create new revision
            $newRevision = $quotation->replicate();
            $newRevision->parent_quotation_id = $quotation->id;
            $newRevision->revision_number = $quotation->revision_number + 1;
            $newRevision->status = 'draft';
            $newRevision->converted_to_invoice = false;
            $newRevision->invoice_id = null;
            $newRevision->quotation_number = null;
            $newRevision->save();

            // Copy items
            foreach ($quotation->items as $item) {
                $newItem = $item->replicate();
                $newItem->quotation_id = $newRevision->id;
                $newItem->save();

                // Copy taxes
                foreach ($item->taxes as $tax) {
                    $newTax = $tax->replicate();
                    $newTax->item_id = $newItem->id;
                    $newTax->save();
                }
            }

            return redirect()->route('quotations.edit', $newRevision);
        } else {
            return back()->with('error', __('Permission denied'));
        }
    }

    public function duplicate(SalesQuotation $quotation)
    {
        if (Auth::user()->can('duplicate-quotations')) {
            $quotation->load(['items.taxes']);

            // Create duplicate
            $duplicate = $quotation->replicate();
            $duplicate->status = 'draft';
            $duplicate->converted_to_invoice = false;
            $duplicate->invoice_id = null;
            $duplicate->quotation_number = null; // Will be auto-generated
            $duplicate->parent_quotation_id = null;
            $duplicate->revision_number = 1;
            $duplicate->save();

            // Copy items
            foreach ($quotation->items as $item) {
                $newItem = $item->replicate();
                $newItem->quotation_id = $duplicate->id;
                $newItem->save();

                // Copy taxes
                foreach ($item->taxes as $tax) {
                    $newTax = $tax->replicate();
                    $newTax->item_id = $newItem->id;
                    $newTax->save();
                }
            }
            return back()->with('success', __('Quotation duplicated successfully.'));
        } else {
            return back()->with('error', __('Permission denied'));
        }
    }

    public function convertToInvoice(SalesQuotation $quotation)
    {
        if (Auth::user()->can('convert-to-invoice-quotations') && $quotation->created_by == creatorId()) {
            if ($quotation->status !== 'accepted') {
                return back()->with('error', __('Only accepted quotations can be converted to invoice.'));
            }

            if ($quotation->converted_to_invoice) {
                return back()->with('error', __('Quotation already converted to invoice.'));
            }

            $quotation->load(['items.taxes']);

              // Create sales invoice from quotation
            $invoice                  = new SalesInvoice();
            $invoice->customer_id     = $quotation->customer_id;
            $invoice->warehouse_id    = $quotation->warehouse_id ?? 1;
            $invoice->invoice_date    = now();
            $invoice->due_date        = $quotation->due_date;
            $invoice->subtotal        = $quotation->subtotal;
            $invoice->tax_amount      = $quotation->tax_amount;
            $invoice->discount_amount = $quotation->discount_amount;
            $invoice->total_amount    = $quotation->total_amount;
            $invoice->balance_amount  = $quotation->total_amount;
            $invoice->paid_amount     = 0;
            $invoice->status          = 'draft';
            $invoice->payment_terms   = $quotation->payment_terms;
            $invoice->notes           = $quotation->notes;
            $invoice->creator_id      = Auth::id();
            $invoice->created_by      = creatorId();
            $invoice->save();

              // Copy quotation items to invoice items
            foreach ($quotation->items as $quotationItem) {
                $invoiceItem                      = new SalesInvoiceItem();
                $invoiceItem->invoice_id          = $invoice->id;
                $invoiceItem->product_id          = $quotationItem->product_id;
                $invoiceItem->quantity            = $quotationItem->quantity;
                $invoiceItem->unit_price          = $quotationItem->unit_price;
                $invoiceItem->discount_percentage = $quotationItem->discount_percentage;
                $invoiceItem->discount_amount     = $quotationItem->discount_amount;
                $invoiceItem->tax_percentage      = $quotationItem->tax_percentage;
                $invoiceItem->tax_amount          = $quotationItem->tax_amount;
                $invoiceItem->total_amount        = $quotationItem->total_amount;
                $invoiceItem->save();

                  // Copy tax details
                foreach ($quotationItem->taxes as $tax) {
                    $invoiceTax           = new SalesInvoiceItemTax();
                    $invoiceTax->item_id  = $invoiceItem->id;
                    $invoiceTax->tax_name = $tax->tax_name;
                    $invoiceTax->tax_rate = $tax->tax_rate;
                    $invoiceTax->save();
                }
            }

              // Mark quotation as converted
            $quotation->converted_to_invoice = true;
            $quotation->invoice_id           = $invoice->id;
            $quotation->save();
            try {
                ConvertSalesQuotation::dispatch($quotation, $invoice);
            } catch (\Throwable $th) {
                return back()->with('error', $th->getMessage());
            }
            return back()->with('success', __('Quotation converted to invoice successfully.'));
        } else {
            return back()->with('error', __('Permission denied'));
        }
    }

    private function canAccessQuotation(SalesQuotation $quotation)
    {
        if (Auth::user()->can('manage-any-quotations')) {
            return $quotation->created_by == creatorId();
        } elseif (Auth::user()->can('manage-own-quotations')) {
            return $quotation->creator_id == Auth::id() || $quotation->customer_id == Auth::id();
        } else {
            return false;
        }
    }

    public function getWarehouseProducts(Request $request)
    {
        if (Auth::user()->can('create-quotations') || Auth::user()->can('edit-quotations')) {
            $warehouseId = $request->warehouse_id;

            if (!$warehouseId) {
                return response()->json([]);
            }

            $products = ProductServiceItem::select('id', 'name', 'sku', 'sale_price', 'tax_ids', 'unit', 'type')
                ->where('is_active', true)
                ->where('created_by', creatorId())
                ->whereHas('warehouseStocks', function ($q) use ($warehouseId) {
                    $q->where('warehouse_id', $warehouseId)
                        ->where('quantity', '>', 0);
                })
                ->with(['warehouseStocks' => function ($q) use ($warehouseId) {
                    $q->where('warehouse_id', $warehouseId);
                }])
                ->get()
                ->map(function ($product) {
                    $stock = $product->warehouseStocks->first();
                    return [
                        'id'             => $product->id,
                        'name'           => $product->name,
                        'sku'            => $product->sku,
                        'sale_price'     => $product->sale_price,
                        'unit'           => $product->unit,
                        'type'           => $product->type,
                        'stock_quantity' => $stock ? $stock->quantity : 0,
                        'taxes'          => $product->taxes->map(function ($tax) {
                            return [
                                'id'       => $tax->id,
                                'tax_name' => $tax->tax_name,
                                'rate'     => $tax->rate
                            ];
                        })
                    ];
                });
            return response()->json($products);
        } else {
            return response()->json([], 403);
        }
    }
}
