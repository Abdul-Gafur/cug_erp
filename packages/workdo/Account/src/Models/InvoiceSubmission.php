<?php

namespace Workdo\Account\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Models\User;

class InvoiceSubmission extends Model
{
    protected $fillable = [
        'payment_id',
        'vendor_id',
        'invoice_number',
        'invoice_date',
        'po_reference',
        'delivery_note_number',
        'submission_date',
        'submitted_by',
        'supplier_type',
        'goods_or_services',
        'base_amount',
        'nhil_amount',
        'getfund_amount',
        'chrl_amount',
        'vat_base_amount',
        'vat_amount',
        'gross_amount',
        'wht_rate',
        'wht_amount',
        'net_payable',
        'verification_status',
        'verified_by',
        'verified_at',
        'rejection_reason',
        'three_way_match_status',
        'match_notes',
        'created_by',
    ];

    protected $casts = [
        'invoice_date'    => 'date',
        'submission_date' => 'date',
        'verified_at'     => 'datetime',
        'base_amount'     => 'decimal:2',
        'nhil_amount'     => 'decimal:2',
        'getfund_amount'  => 'decimal:2',
        'chrl_amount'     => 'decimal:2',
        'vat_base_amount' => 'decimal:2',
        'vat_amount'      => 'decimal:2',
        'gross_amount'    => 'decimal:2',
        'wht_rate'        => 'decimal:2',
        'wht_amount'      => 'decimal:2',
        'net_payable'     => 'decimal:2',
    ];

    // -----------------------------------------------------------------------
    // Relationships
    // -----------------------------------------------------------------------

    public function payment(): BelongsTo
    {
        return $this->belongsTo(VendorPayment::class, 'payment_id');
    }

    public function vendor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'vendor_id');
    }

    public function submittedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'submitted_by');
    }

    public function verifiedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'verified_by');
    }

    // -----------------------------------------------------------------------
    // Static tax calculator — Ghana Revenue Authority rules
    // -----------------------------------------------------------------------

    /**
     * Calculate all GRA tax amounts from a base amount.
     *
     * @param  float  $base           Invoice value before taxes
     * @param  string $supplierType   'resident' | 'non_resident'
     * @param  string $goodsOrServices 'goods' | 'services'
     * @return array  Associative array of all tax components
     */
    public static function calculateGhaTaxes(float $base, string $supplierType = 'resident', string $goodsOrServices = 'goods'): array
    {
        // Step A: Levies applied straight on the base amount
        $nhil     = round($base * 0.025, 2);   // 2.5%
        $getfund  = round($base * 0.025, 2);   // 2.5%
        $chrl     = round($base * 0.01, 2);    // 1.0%

        // Step B: VAT is applied on the augmented base (Base + levies)
        $vatBase  = $base + $nhil + $getfund + $chrl;
        $vat      = round($vatBase * 0.15, 2); // 15%

        // Gross amount = base + all levies + VAT
        $gross    = round($base + $nhil + $getfund + $chrl + $vat, 2);

        // Withholding Tax rate depends on supplier type & transaction type
        if ($supplierType === 'non_resident') {
            $whtRate = $goodsOrServices === 'goods' ? 15.0 : 20.0;
        } else {
            $whtRate = $goodsOrServices === 'goods' ? 3.0 : 5.0;
        }

        $wht        = round($base * ($whtRate / 100), 2);
        $netPayable = round($gross - $wht, 2);

        return [
            'base_amount'     => $base,
            'nhil_amount'     => $nhil,
            'getfund_amount'  => $getfund,
            'chrl_amount'     => $chrl,
            'vat_base_amount' => round($vatBase, 2),
            'vat_amount'      => $vat,
            'gross_amount'    => $gross,
            'wht_rate'        => $whtRate,
            'wht_amount'      => $wht,
            'net_payable'     => $netPayable,
        ];
    }
}
