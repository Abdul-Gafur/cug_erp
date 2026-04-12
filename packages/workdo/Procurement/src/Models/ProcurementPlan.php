<?php

namespace Workdo\Procurement\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use App\Models\User;
use Workdo\BudgetPlanner\Models\VoteCostCentre;

class ProcurementPlan extends Model
{
    use HasFactory;

    protected $fillable = [
        'plan_number',
        'financial_year',
        'title',
        'vote_cost_centre_id',
        'status',
        'approved_by',
        'approved_at',
        'notes',
        'creator_id',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'approved_at' => 'datetime',
        ];
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Boot — auto-generate plan_number
    // ─────────────────────────────────────────────────────────────────────────

    protected static function boot(): void
    {
        parent::boot();

        static::creating(function (ProcurementPlan $plan) {
            if (empty($plan->plan_number)) {
                $plan->plan_number = static::generatePlanNumber();
            }
        });
    }

    public static function generatePlanNumber(): string
    {
        $year  = now()->format('Y');
        $count = static::whereYear('created_at', $year)
            ->when(auth()->check(), fn($q) => $q->where('created_by', creatorId()))
            ->count();

        return sprintf('PLAN-%s-%03d', $year, $count + 1);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Relationships
    // ─────────────────────────────────────────────────────────────────────────

    public function voteCostCentre()
    {
        return $this->belongsTo(VoteCostCentre::class, 'vote_cost_centre_id');
    }

    public function items()
    {
        return $this->hasMany(ProcurementPlanItem::class, 'plan_id');
    }

    public function approvedBy()
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'creator_id');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────────

    public function getEstimatedTotalAttribute(): float
    {
        return (float) $this->items()->sum('estimated_total_cost');
    }
}
