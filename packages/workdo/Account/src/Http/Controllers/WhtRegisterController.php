<?php

namespace Workdo\Account\Http\Controllers;

use Workdo\Account\Models\WhtRegister;
use Workdo\Account\Models\VendorPayment;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\Request;
use Inertia\Inertia;
use App\Models\User;

/**
 * WhtRegisterController
 *
 * Manages the Withholding Tax (WHT) Register — the central GRA compliance ledger
 * that records every WHT deduction made via a Payment Voucher.
 *
 * Responsibilities:
 *   1. Display all WHT entries (filterable by date, supplier, remittance status)
 *   2. Allow Finance Officers to mark batches as "remitted" to GRA
 *   3. Issue WHT Certificates for individual payments
 *   4. Print the WHT Register in GRA-prescribed format
 *   5. Generate summary totals for period-end GRA filings
 */
class WhtRegisterController extends Controller
{
    // =========================================================================
    // INDEX — WHT Register list
    // =========================================================================

    public function index(Request $request)
    {
        if (!Auth::user()->can('view-wht-register')) {
            return back()->with('error', __('Permission denied'));
        }

        $createdBy = creatorId();
        $currentYear = date('Y');

        $query = WhtRegister::with(['vendor', 'payment'])
            ->where('created_by', $createdBy);

        // Filters
        if ($request->vendor_id) {
            $query->where('vendor_id', $request->vendor_id);
        }
        if ($request->remittance_status) {
            $query->where('remittance_status', $request->remittance_status);
        }
        if ($request->nature_of_payment) {
            $query->where('nature_of_payment', $request->nature_of_payment);
        }
        if ($request->date_from) {
            $query->whereDate('payment_date', '>=', $request->date_from);
        }
        if ($request->date_to) {
            $query->whereDate('payment_date', '<=', $request->date_to);
        }
        if ($request->search) {
            $query->where(function ($q) use ($request) {
                $q->where('pv_number', 'like', '%' . $request->search . '%')
                  ->orWhere('payment_reference', 'like', '%' . $request->search . '%')
                  ->orWhere('vendor_name', 'like', '%' . $request->search . '%')
                  ->orWhere('vendor_tin', 'like', '%' . $request->search . '%')
                  ->orWhere('wht_certificate_number', 'like', '%' . $request->search . '%');
            });
        }

        $query->orderByDesc('payment_date');

        $entries = $query->paginate($request->get('per_page', 15));

        // Summary aggregates for the header cards
        $summary = WhtRegister::where('created_by', $createdBy)
            ->when($request->date_from, fn ($q) => $q->whereDate('payment_date', '>=', $request->date_from))
            ->when($request->date_to,   fn ($q) => $q->whereDate('payment_date', '<=', $request->date_to))
            ->selectRaw('
                COUNT(*) as total_entries,
                SUM(wht_amount) as total_wht,
                SUM(CASE WHEN remittance_status = \'pending\' THEN wht_amount ELSE 0 END) as pending_wht,
                SUM(CASE WHEN remittance_status = \'remitted\' THEN wht_amount ELSE 0 END) as remitted_wht
            ')
            ->first();

        // Vendors for filter dropdown
        $vendors = User::where('type', 'vendor')
            ->where('created_by', $createdBy)
            ->get(['id', 'name']);

        return Inertia::render('Account/WhtRegister/Index', [
            'entries'   => $entries,
            'summary'   => $summary,
            'vendors'   => $vendors,
            'filters'   => $request->only([
                'vendor_id', 'remittance_status', 'nature_of_payment',
                'date_from', 'date_to', 'search',
            ]),
        ]);
    }

    // =========================================================================
    // MARK AS REMITTED — batch mark entries as filed with GRA
    // =========================================================================

    public function markRemitted(Request $request)
    {
        if (!Auth::user()->can('manage-wht-register')) {
            return back()->with('error', __('Permission denied'));
        }

        $request->validate([
            'ids'                   => 'required|array',
            'ids.*'                 => 'integer|exists:wht_register,id',
            'remittance_reference'  => 'required|string|max:100',
            'remitted_date'         => 'required|date',
        ]);

        $updated = WhtRegister::where('created_by', creatorId())
            ->whereIn('id', $request->ids)
            ->where('remittance_status', 'pending')
            ->update([
                'remittance_status'     => 'remitted',
                'remitted_date'         => $request->remitted_date,
                'remittance_reference'  => $request->remittance_reference,
            ]);

        return back()->with('success', __(':count WHT entries marked as remitted to GRA.', ['count' => $updated]));
    }

    // =========================================================================
    // ISSUE WHT CERTIFICATE for a single entry
    // =========================================================================

    public function issueCertificate(WhtRegister $whtRegister)
    {
        if (!Auth::user()->can('manage-wht-register') || $whtRegister->created_by !== creatorId()) {
            return back()->with('error', __('Permission denied'));
        }

        if ($whtRegister->wht_certificate_number) {
            return back()->with('error', __('A WHT certificate has already been issued for this entry.'));
        }

        $certNumber = WhtRegister::generateCertificateNumber();
        $whtRegister->update([
            'wht_certificate_number' => $certNumber,
            'certificate_issued_date'=> now()->toDateString(),
        ]);

        return back()->with('success', __('WHT Certificate ') . $certNumber . __(' issued successfully.'));
    }

    // =========================================================================
    // PRINT — WHT Register printable report
    // =========================================================================

    public function print(Request $request)
    {
        if (!Auth::user()->can('view-wht-register')) {
            return back()->with('error', __('Permission denied'));
        }

        $createdBy   = creatorId();
        $currentYear = date('Y');
        $fromDate    = $request->get('date_from', "$currentYear-01-01");
        $toDate      = $request->get('date_to',   "$currentYear-12-31");

        $entries = WhtRegister::with(['vendor', 'payment'])
            ->where('created_by', $createdBy)
            ->whereDate('payment_date', '>=', $fromDate)
            ->whereDate('payment_date', '<=', $toDate)
            ->when($request->remittance_status, fn ($q) => $q->where('remittance_status', $request->remittance_status))
            ->orderByDesc('payment_date')
            ->get();

        // Summary
        $summary = [
            'total_entries'   => $entries->count(),
            'total_gross'     => $entries->sum('gross_amount'),
            'total_wht'       => $entries->sum('wht_amount'),
            'total_net'       => $entries->sum('net_paid'),
            'goods_wht'       => $entries->where('nature_of_payment', 'goods')->sum('wht_amount'),
            'services_wht'    => $entries->where('nature_of_payment', 'services')->sum('wht_amount'),
            'resident_wht'    => $entries->where('supplier_type', 'resident')->sum('wht_amount'),
            'nonresident_wht' => $entries->where('supplier_type', 'non_resident')->sum('wht_amount'),
            'pending_wht'     => $entries->where('remittance_status', 'pending')->sum('wht_amount'),
            'remitted_wht'    => $entries->where('remittance_status', 'remitted')->sum('wht_amount'),
        ];

        $companySettings = getCompanyAllSetting();

        return Inertia::render('Account/WhtRegister/Print', [
            'entries'         => $entries,
            'summary'         => $summary,
            'from_date'       => $fromDate,
            'to_date'         => $toDate,
            'companySettings' => $companySettings,
        ]);
    }
}
