<?php

namespace Workdo\BudgetPlanner\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use App\Models\User;

class BudgetAmendment extends Model
{
    use HasFactory;

    protected $fillable = [
        'budget_id',
        'amendment_type',
        'from_allocation_id',
        'to_allocation_id',
        'amount',
        'reason',
        'status',
        'approved_by',
        'approved_at',
        'rejection_reason',
        'creator_id',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'amount'      => 'decimal:2',
            'approved_at' => 'datetime',
        ];
    }

    public function budget()
    {
        return $this->belongsTo(Budget::class, 'budget_id');
    }

    public function fromAllocation()
    {
        return $this->belongsTo(BudgetAllocation::class, 'from_allocation_id');
    }

    public function toAllocation()
    {
        return $this->belongsTo(BudgetAllocation::class, 'to_allocation_id');
    }

    public function approvedBy()
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function createdBy()
    {
        return $this->belongsTo(User::class, 'creator_id');
    }
}
