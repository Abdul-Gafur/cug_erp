<?php

namespace Workdo\BudgetPlanner\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use App\Models\User;

class Budget extends Model
{
    use HasFactory;

    protected $fillable = [
        // Original fields
        'budget_name',
        'period_id',
        'budget_type',
        'total_budget_amount',
        'status',
        'approved_by',
        'creator_id',
        'created_by',
        // IPSAS 24 additions
        'vote_cost_centre_id',
        'fund_type',
        'budget_subtype',
        'parent_budget_id',
        'revision_reason',
        'finance_office_reviewed_by',
        'finance_office_reviewed_at',
        'finance_committee_approved_by',
        'finance_committee_approved_at',
        'vc_authorised_by',
        'vc_authorised_at',
        'locked_at',
        // Planning stage fields
        'programme_name',
        'strategic_objective',
        'justification',
        'document',
    ];

    protected function casts(): array
    {
        return [
            'total_budget_amount'          => 'decimal:2',
            'finance_office_reviewed_at'   => 'datetime',
            'finance_committee_approved_at' => 'datetime',
            'vc_authorised_at'             => 'datetime',
            'locked_at'                    => 'datetime',
        ];
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * A budget is locked once the VC has authorised it.
     * Locked budgets may not have allocations added/edited/deleted directly.
     * Changes must go through a BudgetAmendment (virement / revision).
     */
    public function isLocked(): bool
    {
        return !is_null($this->locked_at);
    }

    /**
     * Statuses that are considered "approved enough" to allow the budget
     * to move to active (handles both old 'approved' and new 'vc_authorised').
     */
    public function isReadyToActivate(): bool
    {
        return in_array($this->status, ['vc_authorised', 'approved']);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Relationships
    // ──────────────────────────────────────────────────────────────────────────

    public function budgetPeriod()
    {
        return $this->belongsTo(BudgetPeriod::class, 'period_id');
    }

    public function voteCostCentre()
    {
        return $this->belongsTo(VoteCostCentre::class, 'vote_cost_centre_id');
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'creator_id');
    }

    public function approvedBy()
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function financeOfficeReviewedBy()
    {
        return $this->belongsTo(User::class, 'finance_office_reviewed_by');
    }

    public function financeCommitteeApprovedBy()
    {
        return $this->belongsTo(User::class, 'finance_committee_approved_by');
    }

    public function vcAuthorisedBy()
    {
        return $this->belongsTo(User::class, 'vc_authorised_by');
    }

    /**
     * For revised/supplementary budgets, the original budget they are based on.
     */
    public function parentBudget()
    {
        return $this->belongsTo(Budget::class, 'parent_budget_id');
    }

    /**
     * Revised / supplementary budgets derived from this one.
     */
    public function childBudgets()
    {
        return $this->hasMany(Budget::class, 'parent_budget_id');
    }

    public function allocations()
    {
        return $this->hasMany(BudgetAllocation::class, 'budget_id');
    }

    public function amendments()
    {
        return $this->hasMany(BudgetAmendment::class, 'budget_id');
    }
}
