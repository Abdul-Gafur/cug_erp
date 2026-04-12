<?php

namespace Workdo\BudgetPlanner\Models;

use Illuminate\Database\Eloquent\Model;
use Workdo\Account\Models\ChartOfAccount;

class BudgetVariance extends Model
{
    protected $fillable = [
        'budget_id',
        'budget_allocation_id',
        'vote_cost_centre_id',
        'account_id',
        'economic_classification',
        'budgeted_amount',
        'committed_amount',
        'actual_amount',
        'variance',
        'variance_percentage',
        'snapshot_date',
        'creator_id',
        'created_by',
    ];

    protected $casts = [
        'snapshot_date'      => 'date',
        'budgeted_amount'    => 'float',
        'committed_amount'   => 'float',
        'actual_amount'      => 'float',
        'variance'           => 'float',
        'variance_percentage'=> 'float',
    ];

    public function budget()
    {
        return $this->belongsTo(Budget::class);
    }

    public function budgetAllocation()
    {
        return $this->belongsTo(BudgetAllocation::class);
    }

    public function voteCostCentre()
    {
        return $this->belongsTo(VoteCostCentre::class);
    }

    public function account()
    {
        return $this->belongsTo(ChartOfAccount::class, 'account_id');
    }
}
