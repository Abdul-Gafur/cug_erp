<?php

namespace Workdo\Quotation\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use App\Models\User;
use Workdo\Account\Models\ChartOfAccount;
use Workdo\BudgetPlanner\Models\BudgetPeriod;

class LocalPurchaseOrder extends Model
{
    use HasFactory;

    protected $table = 'local_purchase_orders';

    protected $fillable = [
        'lpo_number',
        'lpo_date',
        'rfq_id',
        'requisition_id',
        'supplier_id',
        'issuing_department',
        'delivery_location',
        'delivery_date',
        'payment_terms',
        'vote_account_id',
        'fund_type',
        'economic_classification',
        'budget_period_id',
        'subtotal',
        'tax_amount',
        'discount_amount',
        'total_amount',
        'status',
        'approved_by',
        'approved_at',
        'emailed_at',
        'notes',
        'creator_id',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'lpo_date'      => 'date',
            'delivery_date' => 'date',
            'approved_at'   => 'datetime',
            'emailed_at'    => 'datetime',
            'subtotal'      => 'decimal:2',
            'tax_amount'    => 'decimal:2',
            'discount_amount' => 'decimal:2',
            'total_amount'  => 'decimal:2',
        ];
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'supplier_id');
    }

    public function rfq(): BelongsTo
    {
        return $this->belongsTo(SalesQuotation::class, 'rfq_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(LocalPurchaseOrderItem::class, 'lpo_id');
    }

    public function approvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function voteAccount(): BelongsTo
    {
        return $this->belongsTo(ChartOfAccount::class, 'vote_account_id');
    }

    public function budgetPeriod(): BelongsTo
    {
        return $this->belongsTo(BudgetPeriod::class, 'budget_period_id');
    }

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($lpo) {
            if (empty($lpo->lpo_number)) {
                $lpo->lpo_number = static::generateLpoNumber();
            }
        });
    }

    public static function generateLpoNumber(): string
    {
        $year  = date('Y');
        $month = date('m');
        $last  = static::where('lpo_number', 'like', "LPO-{$year}-{$month}-%")
                       ->where('created_by', creatorId())
                       ->orderBy('lpo_number', 'desc')
                       ->first();

        $next = $last ? ((int) substr($last->lpo_number, -4)) + 1 : 1;

        return "LPO-{$year}-{$month}-" . str_pad($next, 4, '0', STR_PAD_LEFT);
    }
}
