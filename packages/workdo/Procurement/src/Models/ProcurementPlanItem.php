<?php

namespace Workdo\Procurement\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Workdo\Account\Models\ChartOfAccount;

class ProcurementPlanItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'plan_id',
        'item_description',
        'quantity',
        'unit',
        'estimated_unit_cost',
        'estimated_total_cost',
        'procurement_method',
        'planned_quarter',
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
            'planned_quarter'      => 'integer',
        ];
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Boot — recompute estimated_total_cost on save
    // ─────────────────────────────────────────────────────────────────────────

    protected static function boot(): void
    {
        parent::boot();

        static::saving(function (ProcurementPlanItem $item) {
            $item->estimated_total_cost = (float) $item->quantity * (float) $item->estimated_unit_cost;
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Relationships
    // ─────────────────────────────────────────────────────────────────────────

    public function plan()
    {
        return $this->belongsTo(ProcurementPlan::class, 'plan_id');
    }

    public function account()
    {
        return $this->belongsTo(ChartOfAccount::class, 'account_id');
    }

    public function requisitions()
    {
        return $this->hasMany(PurchaseRequisition::class, 'plan_item_id');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────────

    public static function procurementMethodLabels(): array
    {
        return [
            'open_tender'          => 'Open Tender',
            'restricted_tender'    => 'Restricted Tender',
            'rfq'                  => 'Request for Quotation (RFQ)',
            'single_source'        => 'Single Source',
            'framework_agreement'  => 'Framework Agreement',
        ];
    }
}
