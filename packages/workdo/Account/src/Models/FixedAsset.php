<?php

namespace Workdo\Account\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use App\Models\User;

class FixedAsset extends Model
{
    protected $fillable = [
        'asset_code',
        'asset_name',
        'category_id',
        'description',
        'fund_id',
        'department',
        'location',
        'purchase_date',
        'purchase_cost',
        'residual_value',
        'useful_life_months',
        'depreciation_method',
        'accumulated_depreciation',
        'asset_account_id',
        'accumulated_depreciation_account_id',
        'depreciation_expense_account_id',
        'status',
        'disposal_date',
        'disposal_method',
        'disposal_proceeds',
        'authorising_officer_id',
        'disposal_journal_id',
        'created_by',
        'creator_id',
    ];

    protected $casts = [
        'purchase_date'           => 'date',
        'disposal_date'           => 'date',
        'purchase_cost'           => 'decimal:2',
        'residual_value'          => 'decimal:2',
        'accumulated_depreciation'=> 'decimal:2',
        'disposal_proceeds'       => 'decimal:2',
    ];

    // -------------------------------------------------------------------------
    // Computed attributes
    // -------------------------------------------------------------------------

    /** Carrying amount = Cost − Accumulated Depreciation */
    public function getCarryingAmountAttribute(): float
    {
        return (float) $this->purchase_cost - (float) $this->accumulated_depreciation;
    }

    /**
     * Monthly depreciation charge per IPSAS 17 straight-line formula:
     *   (Cost − Residual Value) ÷ Useful Life in Months
     */
    public function getMonthlyDepreciationAttribute(): float
    {
        if ($this->useful_life_months <= 0) {
            return 0.0;
        }
        return ((float) $this->purchase_cost - (float) $this->residual_value) / $this->useful_life_months;
    }

    public function isActive(): bool
    {
        return $this->status === 'active';
    }

    public function isDisposed(): bool
    {
        return $this->status === 'disposed';
    }

    public function isFullyDepreciated(): bool
    {
        return $this->status === 'fully_depreciated';
    }

    // -------------------------------------------------------------------------
    // Auto-generate asset code
    // -------------------------------------------------------------------------

    protected static function boot(): void
    {
        parent::boot();

        static::creating(function (FixedAsset $asset) {
            if (empty($asset->asset_code)) {
                $asset->asset_code = static::generateAssetCode();
            }
        });
    }

    public static function generateAssetCode(): string
    {
        $year = date('Y');
        $last = static::where('asset_code', 'like', "FA-{$year}-%")
            ->orderBy('asset_code', 'desc')
            ->first();

        $next = $last ? ((int) substr($last->asset_code, -4)) + 1 : 1;

        return "FA-{$year}-" . str_pad($next, 4, '0', STR_PAD_LEFT);
    }

    // -------------------------------------------------------------------------
    // Relationships
    // -------------------------------------------------------------------------

    public function category(): BelongsTo
    {
        return $this->belongsTo(FixedAssetCategory::class, 'category_id');
    }

    public function fund(): BelongsTo
    {
        return $this->belongsTo(UniversityFund::class, 'fund_id');
    }

    public function assetAccount(): BelongsTo
    {
        return $this->belongsTo(ChartOfAccount::class, 'asset_account_id');
    }

    public function accumulatedDepreciationAccount(): BelongsTo
    {
        return $this->belongsTo(ChartOfAccount::class, 'accumulated_depreciation_account_id');
    }

    public function depreciationExpenseAccount(): BelongsTo
    {
        return $this->belongsTo(ChartOfAccount::class, 'depreciation_expense_account_id');
    }

    public function authorisingOfficer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'authorising_officer_id');
    }

    public function disposalJournal(): BelongsTo
    {
        return $this->belongsTo(JournalEntry::class, 'disposal_journal_id');
    }

    public function depreciationSchedules(): HasMany
    {
        return $this->hasMany(DepreciationSchedule::class, 'asset_id')->orderBy('depreciation_date');
    }
}
