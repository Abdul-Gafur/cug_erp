<?php

namespace Workdo\Account\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Models\User;

class VendorPayment extends Model
{
    protected $fillable = [
        'payment_number',
        'pv_number',
        'payment_date',
        'vendor_id',
        'bank_account_id',
        'reference_number',
        'payment_method',
        'cheque_number',
        'narration',
        'payment_amount',
        'status',
        'approval_stage',
        'hod_approved_by',
        'hod_approved_at',
        'finance_approved_by',
        'finance_approved_at',
        'cfo_approved_by',
        'cfo_approved_at',
        'notes',
        'creator_id',
        'created_by',
    ];

    protected $casts = [
        'payment_date'        => 'date',
        'payment_amount'      => 'decimal:2',
        'hod_approved_at'     => 'datetime',
        'finance_approved_at' => 'datetime',
        'cfo_approved_at'     => 'datetime',
    ];

    // -----------------------------------------------------------------------
    // Relationships
    // -----------------------------------------------------------------------

    public function vendor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'vendor_id');
    }

    public function bankAccount(): BelongsTo
    {
        return $this->belongsTo(BankAccount::class, 'bank_account_id');
    }

    public function allocations(): HasMany
    {
        return $this->hasMany(VendorPaymentAllocation::class, 'payment_id');
    }

    public function debitNoteApplications(): HasMany
    {
        return $this->hasMany(DebitNoteApplication::class, 'payment_id');
    }

    public function invoiceSubmission(): HasOne
    {
        return $this->hasOne(InvoiceSubmission::class, 'payment_id');
    }

    /** Head of Department */
    public function hodApprovedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'hod_approved_by');
    }

    /** Finance Officer */
    public function financeApprovedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'finance_approved_by');
    }

    /** Chief Finance Officer */
    public function cfoApprovedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'cfo_approved_by');
    }

    // -----------------------------------------------------------------------
    // Boot hooks
    // -----------------------------------------------------------------------

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($payment) {
            if (empty($payment->payment_number)) {
                $payment->payment_number = static::generatePaymentNumber();
            }
        });

        // Auto-generate PV number when the CFO approves (final stage)
        static::updating(function ($payment) {
            if ($payment->isDirty('approval_stage')
                && $payment->approval_stage === 'cfo_approved'
                && empty($payment->pv_number)) {
                $payment->pv_number = static::generatePvNumber();
            }
        });
    }

    // -----------------------------------------------------------------------
    // Number generators
    // -----------------------------------------------------------------------

    public static function generatePaymentNumber(): string
    {
        $year  = date('Y');
        $month = date('m');
        $last  = static::where('payment_number', 'like', "VP-{$year}-{$month}-%")
                        ->where('created_by', creatorId())
                        ->orderBy('payment_number', 'desc')
                        ->first();

        $next = $last ? ((int) substr($last->payment_number, -3)) + 1 : 1;

        return "VP-{$year}-{$month}-" . str_pad($next, 3, '0', STR_PAD_LEFT);
    }

    public static function generatePvNumber(): string
    {
        $year  = date('Y');
        $month = date('m');
        $last  = static::where('pv_number', 'like', "PV-{$year}-{$month}-%")
                        ->where('created_by', creatorId())
                        ->orderBy('pv_number', 'desc')
                        ->first();

        $next = $last ? ((int) substr($last->pv_number, -4)) + 1 : 1;

        return "PV-{$year}-{$month}-" . str_pad($next, 4, '0', STR_PAD_LEFT);
    }
}