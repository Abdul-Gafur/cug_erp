<?php

namespace Workdo\BudgetPlanner\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class VoteCostCentre extends Model
{
    use HasFactory;

    protected $table = 'vote_cost_centres';

    protected $fillable = [
        'code',
        'name',
        'description',
        'is_active',
        'creator_id',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    public function budgets()
    {
        return $this->hasMany(Budget::class, 'vote_cost_centre_id');
    }
}
