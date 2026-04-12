<?php

namespace Workdo\Account\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class UniversityFund extends Model
{
    protected $fillable = [
        'code',
        'name',
        'description',
        'is_active',
        'creator_id',
        'created_by',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    public function chartOfAccounts(): HasMany
    {
        return $this->hasMany(ChartOfAccount::class, 'fund_id');
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }
}
