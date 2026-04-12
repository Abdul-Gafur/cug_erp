<?php

namespace Workdo\BudgetPlanner\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class BudgetCommitment extends Model
{
    use HasFactory;

    protected $fillable = [
        'budget_allocation_id',
        'source_type',
        'source_id',
        'amount',
        'status',
        'notes',
        'reversed_at',
        'creator_id',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'amount'      => 'decimal:2',
            'reversed_at' => 'datetime',
        ];
    }

    public function budgetAllocation()
    {
        return $this->belongsTo(BudgetAllocation::class, 'budget_allocation_id');
    }
}
