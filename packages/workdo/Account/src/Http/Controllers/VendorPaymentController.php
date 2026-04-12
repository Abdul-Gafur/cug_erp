<?php

namespace Workdo\Account\Http\Controllers;

use Workdo\Account\Models\VendorPayment;
use Workdo\Account\Models\VendorPaymentAllocation;
use Workdo\Account\Models\InvoiceSubmission;
use Workdo\Account\Models\BankAccount;
use Workdo\Account\Models\DebitNote;
use Workdo\Account\Models\DebitNoteApplication;
use Workdo\Account\Http\Requests\StoreVendorPaymentRequest;
use Workdo\Account\Http\Requests\StoreInvoiceSubmissionRequest;
use Workdo\Account\Services\JournalService;
use Workdo\Account\Services\BankTransactionsService;
use App\Models\User;
use App\Models\PurchaseInvoice;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Auth;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Workdo\Account\Events\CreateVendorPayment;
use Workdo\Account\Events\UpdateVendorPaymentStatus;
use Workdo\Account\Events\DestroyVendorPayment;

class VendorPaymentController extends Controller
{
    protected $journalService;
    protected $bankTransactionsService;

    public function __construct(JournalService $journalService, BankTransactionsService $bankTransactionsService)
    {
        $this->journalService         = $journalService;
        $this->bankTransactionsService = $bankTransactionsService;
    }

    // =========================================================================
    // Step 1 — LIST
    // =========================================================================

    public function index(Request $request)
    {
        if (Auth::user()->can('manage-vendor-payments')) {
            $query = VendorPayment::with([
                    'vendor',
                    'bankAccount',
                    'allocations.invoice',
                    'debitNoteApplications.debitNote',
                    'invoiceSubmission',
                    'hodApprovedBy',
                    'financeApprovedBy',
                    'cfoApprovedBy',
                ])
                ->where(function ($q) {
                    if (Auth::user()->can('manage-any-vendor-payments')) {
                        $q->where('created_by', creatorId());
                    } elseif (Auth::user()->can('manage-own-vendor-payments')) {
                        $q->where('creator_id', Auth::id())->orWhere('vendor_id', Auth::id());
                    } else {
                        $q->whereRaw('1 = 0');
                    }
                });

            if ($request->vendor_id)       { $query->where('vendor_id', $request->vendor_id); }
            if ($request->status)          { $query->where('status', $request->status); }
            if ($request->approval_stage)  { $query->where('approval_stage', $request->approval_stage); }
            if ($request->search) {
                $query->where(function ($q) use ($request) {
                    $q->where('payment_number', 'like', '%' . $request->search . '%')
                      ->orWhere('pv_number', 'like', '%' . $request->search . '%');
                });
            }
            if ($request->date_from) { $query->whereDate('payment_date', '>=', $request->date_from); }
            if ($request->date_to)   { $query->whereDate('payment_date', '<=', $request->date_to); }
            if ($request->bank_account_id) { $query->where('bank_account_id', $request->bank_account_id); }

            $sortField     = $request->get('sort', 'created_at');
            $sortDirection = $request->get('direction', 'desc');
            $query->orderBy($sortField, $sortDirection);

            $payments     = $query->paginate($request->get('per_page', 10));
            $vendors      = User::where('type', 'vendor')->where('created_by', creatorId())->get();
            $bankAccounts = BankAccount::where('is_active', true)->where('created_by', creatorId())->get();

            return Inertia::render('Account/VendorPayments/Index', [
                'payments'     => $payments,
                'vendors'      => $vendors,
                'bankAccounts' => $bankAccounts,
                'filters'      => $request->only([
                    'vendor_id', 'status', 'approval_stage', 'search', 'bank_account_id',
                ]),
            ]);
        }

        return back()->with('error', __('Permission denied'));
    }

    // =========================================================================
    // Step 1 — CREATE PAYMENT RECORD
    // =========================================================================

    public function store(StoreVendorPaymentRequest $request)
    {
        if (Auth::user()->can('create-vendor-payments')) {

            if ($request->debit_notes) {
                $totalInvoiceAmount  = collect($request->allocations)->sum('amount');
                $totalDebitNoteAmount = collect($request->debit_notes)->sum('amount');
                if ($totalDebitNoteAmount > $totalInvoiceAmount) {
                    return back()->with('error', __('Debit note amount cannot exceed the total invoice allocation amount.'));
                }
            }

            $payment = new VendorPayment();
            $payment->payment_date    = $request->payment_date;
            $payment->vendor_id       = $request->vendor_id;
            $payment->bank_account_id = $request->bank_account_id;
            $payment->reference_number = $request->reference_number;
            $payment->payment_method  = $request->payment_method;
            $payment->cheque_number   = $request->cheque_number;
            $payment->narration       = $request->narration;
            $payment->payment_amount  = $request->payment_amount;
            $payment->notes           = $request->notes;
            $payment->approval_stage  = 'pending';
            $payment->creator_id      = Auth::id();
            $payment->created_by      = creatorId();
            $payment->save();

            foreach ($request->allocations as $allocation) {
                VendorPaymentAllocation::create([
                    'payment_id'       => $payment->id,
                    'invoice_id'       => $allocation['invoice_id'],
                    'allocated_amount' => $allocation['amount'],
                ]);
            }

            if ($request->debit_notes) {
                foreach ($request->debit_notes as $debitNote) {
                    $debitNoteModel = DebitNote::find($debitNote['debit_note_id']);
                    if (!$debitNoteModel) continue;

                    DebitNoteApplication::create([
                        'debit_note_id'    => $debitNote['debit_note_id'],
                        'payment_id'       => $payment->id,
                        'applied_amount'   => $debitNote['amount'],
                        'application_date' => $request->payment_date,
                        'creator_id'       => Auth::id(),
                        'created_by'       => creatorId(),
                    ]);
                }
            }

            CreateVendorPayment::dispatch($request, $payment);

            // Step 1b: Seamlessly capture Invoice Submission if data is provided
            if ($request->filled('invoice_number') && $request->filled('base_amount')) {
                $taxes = InvoiceSubmission::calculateGhaTaxes(
                    (float) $request->base_amount,
                    $request->supplier_type ?? 'resident',
                    $request->goods_or_services ?? 'goods'
                );

                InvoiceSubmission::create(array_merge($taxes, [
                    'payment_id'           => $payment->id,
                    'vendor_id'            => $payment->vendor_id,
                    'invoice_number'       => $request->invoice_number,
                    'invoice_date'         => $request->invoice_date ?? now()->toDateString(),
                    'po_reference'         => $request->po_reference,
                    'delivery_note_number' => $request->delivery_note_number,
                    'submission_date'      => now()->toDateString(),
                    'submitted_by'         => Auth::id(),
                    'supplier_type'        => $request->supplier_type ?? 'resident',
                    'goods_or_services'    => $request->goods_or_services ?? 'goods',
                    'verification_status'  => 'pending',
                    'three_way_match_status' => 'not_checked',
                    'created_by'           => creatorId(),
                ]));
            }

            return redirect()->route('account.vendor-payments.index')
                ->with('success', __('The vendor payment has been created successfully.'));
        }

        return back()->with('error', __('Permission denied'));
    }

    // =========================================================================
    // Step 2 — SUBMIT INVOICE (Invoice Submission with GRA tax calc)
    // =========================================================================

    public function submitInvoice(StoreInvoiceSubmissionRequest $request, VendorPayment $vendorPayment)
    {
        if (!Auth::user()->can('submit-vendor-invoice') || $vendorPayment->created_by !== creatorId()) {
            return back()->with('error', __('Permission denied'));
        }

        if ($vendorPayment->invoiceSubmission) {
            return back()->with('error', __('An invoice has already been submitted for this payment.'));
        }

        $taxes = InvoiceSubmission::calculateGhaTaxes(
            (float) $request->base_amount,
            $request->supplier_type,
            $request->goods_or_services
        );

        InvoiceSubmission::create(array_merge($taxes, [
            'payment_id'           => $vendorPayment->id,
            'vendor_id'            => $vendorPayment->vendor_id,
            'invoice_number'       => $request->invoice_number,
            'invoice_date'         => $request->invoice_date,
            'po_reference'         => $request->po_reference,
            'delivery_note_number' => $request->delivery_note_number,
            'submission_date'      => now()->toDateString(),
            'submitted_by'         => Auth::id(),
            'supplier_type'        => $request->supplier_type,
            'goods_or_services'    => $request->goods_or_services,
            'verification_status'  => 'pending',
            'three_way_match_status' => 'not_checked',
            'created_by'           => creatorId(),
        ]));

        return back()->with('success', __('Invoice submitted successfully. Awaiting verification.'));
    }

    // =========================================================================
    // Step 2 — VERIFY INVOICE (Finance Officer 3-Way Match check)
    // =========================================================================

    public function verifyInvoice(Request $request, VendorPayment $vendorPayment)
    {
        if (!Auth::user()->can('verify-vendor-invoice') || $vendorPayment->created_by !== creatorId()) {
            return back()->with('error', __('Permission denied'));
        }

        $request->validate([
            'verification_status'    => 'required|in:verified,rejected',
            'three_way_match_status' => 'required|in:matched,discrepancy',
            'match_notes'            => 'nullable|string',
            'rejection_reason'       => 'nullable|required_if:verification_status,rejected|string',
        ]);

        $submission = $vendorPayment->invoiceSubmission;
        if (!$submission) {
            return back()->with('error', __('No invoice submission found for this payment.'));
        }

        $submission->update([
            'verification_status'    => $request->verification_status,
            'three_way_match_status' => $request->three_way_match_status,
            'match_notes'            => $request->match_notes,
            'rejection_reason'       => $request->rejection_reason,
            'verified_by'            => Auth::id(),
            'verified_at'            => now(),
        ]);

        return back()->with('success', __('Invoice verification status updated.'));
    }

    // =========================================================================
    // Step 3 — APPROVE PAYMENT (3-Stage: HoD → Finance → CFO)
    // =========================================================================

    public function approve(Request $request, VendorPayment $vendorPayment)
    {
        if ($vendorPayment->created_by !== creatorId()) {
            return back()->with('error', __('Permission denied'));
        }

        $stage    = $request->input('stage'); // 'hod' | 'finance' | 'cfo'
        $user     = Auth::user();

        // Validate submission is verified before any approval
        $submission = $vendorPayment->invoiceSubmission;
        if (!$submission || $submission->verification_status !== 'verified') {
            return back()->with('error', __('Invoice must be verified before payment can be approved.'));
        }

        switch ($stage) {
            case 'hod':
                if (!$user->can('hod-approve-vendor-payments')) {
                    return back()->with('error', __('Permission denied'));
                }
                if ($vendorPayment->approval_stage !== 'pending') {
                    return back()->with('error', __('This payment has already been approved at this stage.'));
                }
                $vendorPayment->update([
                    'approval_stage'  => 'hod_approved',
                    'hod_approved_by' => $user->id,
                    'hod_approved_at' => now(),
                ]);
                return back()->with('success', __('Payment approved by Head of Department.'));

            case 'finance':
                if (!$user->can('finance-approve-vendor-payments')) {
                    return back()->with('error', __('Permission denied'));
                }
                if ($vendorPayment->approval_stage !== 'hod_approved') {
                    return back()->with('error', __('Head of Department approval is required first.'));
                }
                $vendorPayment->update([
                    'approval_stage'       => 'finance_approved',
                    'finance_approved_by'  => $user->id,
                    'finance_approved_at'  => now(),
                ]);
                return back()->with('success', __('Payment approved by Finance Officer.'));

            case 'cfo':
                if (!$user->can('cfo-approve-vendor-payments')) {
                    return back()->with('error', __('Permission denied'));
                }
                if ($vendorPayment->approval_stage !== 'finance_approved') {
                    return back()->with('error', __('Finance Officer approval is required first.'));
                }
                // PV number is auto-generated in the model boot hook on update
                $vendorPayment->update([
                    'approval_stage'  => 'cfo_approved',
                    'cfo_approved_by' => $user->id,
                    'cfo_approved_at' => now(),
                ]);
                return back()->with('success', __('Payment approved by Chief Finance Officer. PV number generated.'));

            default:
                return back()->with('error', __('Invalid approval stage.'));
        }
    }

    // =========================================================================
    // OUTSTANDING INVOICES API
    // =========================================================================

    public function getOutstandingInvoices($vendorId)
    {
        $invoices = PurchaseInvoice::where('vendor_id', $vendorId)
            ->where('balance_amount', '>', 0)
            ->whereIn('status', ['posted', 'partial'])
            ->where('created_by', creatorId())
            ->get();

        $debitNotes = \Workdo\Account\Models\DebitNote::where('vendor_id', $vendorId)
            ->where('balance_amount', '>', 0)
            ->whereIn('status', ['approved', 'partial'])
            ->where('created_by', creatorId())
            ->get(['id', 'debit_note_number', 'balance_amount', 'total_amount', 'status']);

        return response()->json([
            'invoices'   => $invoices,
            'debitNotes' => $debitNotes,
        ]);
    }

    // =========================================================================
    // Step 4 — UPDATE PAYMENT STATUS (cleared/cancelled — requires cfo_approved)
    // =========================================================================

    public function updateStatus(Request $request, VendorPayment $vendorPayment)
    {
        if (!Auth::user()->can('cleared-vendor-payments') || $vendorPayment->created_by !== creatorId()) {
            return back()->with('error', __('Permission denied'));
        }

        try {
            if ($request->status === 'cleared') {
                // Enforce CFO approval before clearing
                if ($vendorPayment->approval_stage !== 'cfo_approved') {
                    return back()->with('error', __('Payment requires full 3-stage approval (HoD → Finance → CFO) before it can be cleared.'));
                }

                if ($vendorPayment->payment_amount > 0) {
                    $this->journalService->createVendorPaymentJournal($vendorPayment);
                    $this->bankTransactionsService->createVendorPayment($vendorPayment);
                }

                foreach ($vendorPayment->allocations as $allocation) {
                    $invoice = $allocation->invoice;
                    $invoice->paid_amount    += $allocation->allocated_amount;
                    $invoice->balance_amount  = $invoice->total_amount - $invoice->paid_amount;
                    $invoice->status = $invoice->balance_amount == 0 ? 'paid' : 'partial';
                    $invoice->save();
                }
            }

            $debitNoteApplications = DebitNoteApplication::where('payment_id', $vendorPayment->id)->get();
            foreach ($debitNoteApplications as $dna) {
                $dn = DebitNote::find($dna->debit_note_id);
                $dn->applied_amount  += $dna->applied_amount;
                $dn->balance_amount   = $dn->total_amount - $dn->applied_amount;
                $dn->status           = $dn->balance_amount <= 0 ? 'applied' : 'partial';
                $dn->save();
            }

            $vendorPayment->update(['status' => $request->status]);
            UpdateVendorPaymentStatus::dispatch($request, $vendorPayment);

            return back()->with('success', __('The payment status has been updated successfully.'));
        } catch (\Exception $e) {
            return back()->with('error', $e->getMessage());
        }
    }

    // =========================================================================
    // Step 6 — PRINT PAYMENT VOUCHER (full GRA PV layout)
    // =========================================================================

    public function printVoucher(VendorPayment $vendorPayment)
    {
        if ($vendorPayment->created_by !== creatorId()) {
            return back()->with('error', __('Permission denied'));
        }

        $vendorPayment->load([
            'vendor',
            'bankAccount.glAccount',
            'allocations.invoice',
            'debitNoteApplications.debitNote',
            'invoiceSubmission.submittedBy',
            'invoiceSubmission.verifiedBy',
            'hodApprovedBy',
            'financeApprovedBy',
            'cfoApprovedBy',
        ]);

        $vendorProfile = \Workdo\Account\Models\Vendor::where('user_id', $vendorPayment->vendor_id)
            ->where('created_by', creatorId())
            ->first();

        $companySettings = getCompanyAllSetting();

        return Inertia::render('Account/VendorPayments/PrintVoucher', [
            'payment'         => $vendorPayment,
            'vendorProfile'   => $vendorProfile,
            'companySettings' => $companySettings,
        ]);
    }

    // =========================================================================
    // DELETE
    // =========================================================================

    public function destroy(VendorPayment $vendorPayment)
    {
        if (Auth::user()->can('delete-vendor-payments')
            && $vendorPayment->created_by == creatorId()
            && $vendorPayment->status === 'pending') {

            DestroyVendorPayment::dispatch($vendorPayment);
            $vendorPayment->delete();
            return back()->with('success', __('The vendor payment has been deleted.'));
        }

        return back()->with('error', __('Permission denied'));
    }
}
