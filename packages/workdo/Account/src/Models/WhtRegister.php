<?php

namespace Workdo\Account\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Models\User;

/**
 * WhtRegister — records every Withholding Tax deduction made via a Payment Voucher.
 *
 * Purpose:
 *   - Enables the Finance Officer to generate a WHT Register Report at any time
 *   - Provides data for completing and issuing WHT Certificates to suppliers
 *   - Tracks GRA remittance status so the institution can prove compliance
 *
 * GRA Rules (for reference):
 *   - WHT 3% on goods (resident supplier)
 *   - WHT 5% on services (resident supplier)
 *   - WHT 15% on goods (non-resident)
 *   - WHT 20% on services (non-resident)
 *   - WHT must be remitted to GRA monthly (by 15th day of the following month)
 */
class WhtRegister extends Model
{
    protected $table = 'wht_register';

    protected $fillable = [
        'payment_id',
        'invoice_submission_id',
        'vendor_id',
        'vendor_name',
        'vendor_tin',
        'pv_number',
        'payment_reference',
        'payment_date',
        'nature_of_payment',
        'supplier_type',
        'gross_amount',
        'wht_rate',
        'wht_amount',
        'net_paid',
        'wht_certificate_number',
        'certificate_issued_date',
        'remittance_status',
        'remitted_date',
        'remittance_reference',
        'narration',
        'created_by',
    ];

    protected $casts = [
        'payment_date'           => 'date',
        'certificate_issued_date'=> 'date',
        'remitted_date'          => 'date',
        'gross_amount'           => 'decimal:2',
        'wht_rate'               => 'decimal:2',
        'wht_amount'             => 'decimal:2',
        'net_paid'               => 'decimal:2',
    ];

    // -----------------------------------------------------------------------
    // Relationships
    // -----------------------------------------------------------------------

    public function payment(): BelongsTo
    {
        return $this->belongsTo(VendorPayment::class, 'payment_id');
    }

    public function invoiceSubmission(): BelongsTo
    {
        return $this->belongsTo(InvoiceSubmission::class, 'invoice_submission_id');
    }

    public function vendor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'vendor_id');
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    // -----------------------------------------------------------------------
    // WHT Certificate Number Generator
    // -----------------------------------------------------------------------

    /**
     * Generate a sequential WHT Certificate number: WHTC-YYYY-MM-NNNN
     */
    public static function generateCertificateNumber(): string
    {
        $year  = date('Y');
        $month = date('m');
        $last  = static::where('wht_certificate_number', 'like', "WHTC-{$year}-{$month}-%")
                        ->where('created_by', creatorId())
                        ->orderBy('wht_certificate_number', 'desc')
                        ->first();

        $next = $last
            ? ((int) substr($last->wht_certificate_number, -4)) + 1
            : 1;

        return "WHTC-{$year}-{$month}-" . str_pad($next, 4, '0', STR_PAD_LEFT);
    }

    // -----------------------------------------------------------------------
    // Scopes
    // -----------------------------------------------------------------------

    /** Scope to only pending-remittance records (not yet filed with GRA). */
    public function scopePendingRemittance($query)
    {
        return $query->where('remittance_status', 'pending');
    }

    /** Tenant scope */
    public function scopeForCreator($query, int $creatorId)
    {
        return $query->where('created_by', $creatorId);
    }
}
