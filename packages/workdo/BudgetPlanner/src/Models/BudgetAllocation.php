<?php

namespace Workdo\BudgetPlanner\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Workdo\Account\Models\ChartOfAccount;

class BudgetAllocation extends Model
{
    use HasFactory;

    protected $fillable = [
        // Original fields
        'budget_id',
        'account_id',
        'allocated_amount',
        'spent_amount',
        'remaining_amount',
        'creator_id',
        'created_by',
        // IPSAS 24 additions
        'economic_classification',
        'q1_amount',
        'q2_amount',
        'q3_amount',
        'q4_amount',
        'committed_amount',
    ];

    protected function casts(): array
    {
        return [
            'allocated_amount'  => 'decimal:2',
            'spent_amount'      => 'decimal:2',
            'remaining_amount'  => 'decimal:2',
            'committed_amount'  => 'decimal:2',
            'q1_amount'         => 'decimal:2',
            'q2_amount'         => 'decimal:2',
            'q3_amount'         => 'decimal:2',
            'q4_amount'         => 'decimal:2',
        ];
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Computed attribute
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Available balance = Approved Budget − Commitments − Actuals
     * This is the real-time spendable amount checked at each transaction.
     */
    public function getAvailableAmountAttribute(): float
    {
        return (float) $this->allocated_amount
            - (float) $this->committed_amount
            - (float) $this->spent_amount;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Relationships
    // ──────────────────────────────────────────────────────────────────────────

    public function budget()
    {
        return $this->belongsTo(Budget::class, 'budget_id');
    }

    public function account()
    {
        return $this->belongsTo(ChartOfAccount::class, 'account_id');
    }

    public function commitments()
    {
        return $this->hasMany(BudgetCommitment::class, 'budget_allocation_id');
    }

    public function activeCommitments()
    {
        return $this->hasMany(BudgetCommitment::class, 'budget_allocation_id')
            ->whereIn('status', ['active', 'updated']);
    }

    public function auditLogs()
    {
        return $this->hasMany(BudgetAuditLog::class, 'budget_allocation_id');
    }

    public function amendments()
    {
        return $this->hasMany(BudgetAmendment::class, 'from_allocation_id')
            ->orWhere('to_allocation_id', $this->id);
    }
}
