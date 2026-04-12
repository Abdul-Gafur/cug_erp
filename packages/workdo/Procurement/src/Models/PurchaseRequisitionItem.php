<?php

namespace Workdo\Procurement\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Workdo\Account\Models\ChartOfAccount;

class PurchaseRequisitionItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'requisition_id',
        'description',
        'quantity',
        'unit',
        'estimated_unit_cost',
        'estimated_total_cost',
        'account_id',
        'fund_type',
        'economic_classification',
        'notes',
        'creator_id',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'quantity'             => 'decimal:3',
            'estimated_unit_cost'  => 'decimal:2',
            'estimated_total_cost' => 'decimal:2',
        ];
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Boot — recompute total on save
    // ─────────────────────────────────────────────────────────────────────────

    protected static function boot(): void
    {
        parent::boot();

        static::saving(function (PurchaseRequisitionItem $item) {
            $item->estimated_total_cost = (float) $item->quantity * (float) $item->estimated_unit_cost;
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Relationships
    // ─────────────────────────────────────────────────────────────────────────

    public function requisition()
    {
        return $this->belongsTo(PurchaseRequisition::class, 'requisition_id');
    }

    public function account()
    {
        return $this->belongsTo(ChartOfAccount::class, 'account_id');
    }
}
