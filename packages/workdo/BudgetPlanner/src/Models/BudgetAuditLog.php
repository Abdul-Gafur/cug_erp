<?php

namespace Workdo\BudgetPlanner\Models;

use Illuminate\Database\Eloquent\Model;
use App\Models\User;

/**
 * Immutable audit log — rows are never updated or deleted.
 */
class BudgetAuditLog extends Model
{
    // No SoftDeletes — this table must be immutable
    const UPDATED_AT = null; // only created_at is meaningful

    protected $table = 'budget_audit_log';

    protected $fillable = [
        'budget_allocation_id',
        'event_type',
        'source_type',
        'source_id',
        'amount',
        'result',
        'override_reason',
        'approved_at_event',
        'committed_at_event',
        'actual_at_event',
        'available_at_event',
        'user_id',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'amount'              => 'decimal:2',
            'approved_at_event'   => 'decimal:2',
            'committed_at_event'  => 'decimal:2',
            'actual_at_event'     => 'decimal:2',
            'available_at_event'  => 'decimal:2',
        ];
    }

    public function budgetAllocation()
    {
        return $this->belongsTo(BudgetAllocation::class, 'budget_allocation_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
