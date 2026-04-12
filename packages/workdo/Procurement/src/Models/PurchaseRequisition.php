<?php

namespace Workdo\Procurement\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use App\Models\User;
use Workdo\BudgetPlanner\Models\VoteCostCentre;
use Workdo\BudgetPlanner\Models\BudgetPeriod;

class PurchaseRequisition extends Model
{
    use HasFactory;

    protected $fillable = [
        'requisition_number',
        'requisition_date',
        'requesting_department_id',
        'purpose',
        'justification',
        'category',
        'plan_item_id',
        'is_off_plan',
        'off_plan_justification',
        'budget_period_id',
        'subtotal',
        'total_amount',
        'status',
        'hod_approved_by',
        'hod_approved_at',
        'finance_checked_by',
        'finance_checked_at',
        'finance_notes',
        'procurement_approved_by',
        'procurement_approved_at',
        'rejected_by',
        'rejected_at',
        'rejection_reason',
        'creator_id',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'requisition_date'       => 'date',
            'is_off_plan'            => 'boolean',
            'subtotal'               => 'decimal:2',
            'total_amount'           => 'decimal:2',
            'hod_approved_at'        => 'datetime',
            'finance_checked_at'     => 'datetime',
            'procurement_approved_at'=> 'datetime',
            'rejected_at'            => 'datetime',
        ];
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Boot — auto-generate requisition_number
    // ─────────────────────────────────────────────────────────────────────────

    protected static function boot(): void
    {
        parent::boot();

        static::creating(function (PurchaseRequisition $pr) {
            if (empty($pr->requisition_number)) {
                $pr->requisition_number = static::generateRequisitionNumber();
            }
        });
    }

    public static function generateRequisitionNumber(): string
    {
        $year  = now()->format('Y');
        $count = static::whereYear('created_at', $year)
            ->when(auth()->check(), fn($q) => $q->where('created_by', creatorId()))
            ->count();

        return sprintf('REQ-%s-%04d', $year, $count + 1);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Relationships
    // ─────────────────────────────────────────────────────────────────────────

    public function requestingDepartment()
    {
        return $this->belongsTo(VoteCostCentre::class, 'requesting_department_id');
    }

    public function planItem()
    {
        return $this->belongsTo(ProcurementPlanItem::class, 'plan_item_id');
    }

    public function budgetPeriod()
    {
        return $this->belongsTo(BudgetPeriod::class, 'budget_period_id');
    }

    public function items()
    {
        return $this->hasMany(PurchaseRequisitionItem::class, 'requisition_id');
    }

    public function requester()
    {
        return $this->belongsTo(User::class, 'creator_id');
    }

    public function hodApprovedBy()
    {
        return $this->belongsTo(User::class, 'hod_approved_by');
    }

    public function financeCheckedBy()
    {
        return $this->belongsTo(User::class, 'finance_checked_by');
    }

    public function procurementApprovedBy()
    {
        return $this->belongsTo(User::class, 'procurement_approved_by');
    }

    public function rejectedBy()
    {
        return $this->belongsTo(User::class, 'rejected_by');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────────

    public function recalculateTotals(): void
    {
        $total         = $this->items()->sum('estimated_total_cost');
        $this->subtotal      = $total;
        $this->total_amount  = $total;
        $this->saveQuietly();
    }

    public function isEditable(): bool
    {
        return $this->status === 'draft';
    }

    public static function statusLabels(): array
    {
        return [
            'draft'                  => 'Draft',
            'submitted'              => 'Submitted',
            'hod_approved'           => 'HoD Approved',
            'finance_checked'        => 'Finance Checked',
            'procurement_approved'   => 'Approved',
            'rejected'               => 'Rejected',
            'cancelled'              => 'Cancelled',
        ];
    }
}
