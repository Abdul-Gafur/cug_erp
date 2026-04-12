<?php

namespace Workdo\Account\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class FixedAssetCategory extends Model
{
    protected $fillable = [
        'name',
        'description',
        'asset_account_code',
        'accumulated_depreciation_account_code',
        'depreciation_expense_account_code',
        'default_useful_life_months',
        'depreciation_method',
        'is_depreciable',
        'created_by',
        'creator_id',
    ];

    protected $casts = [
        'is_depreciable' => 'boolean',
    ];

    public function assets(): HasMany
    {
        return $this->hasMany(FixedAsset::class, 'category_id');
    }
}
