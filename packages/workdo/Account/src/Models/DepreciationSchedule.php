<?php

namespace Workdo\Account\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DepreciationSchedule extends Model
{
    protected $fillable = [
        'asset_id',
        'period_label',
        'depreciation_date',
        'depreciation_amount',
        'accumulated_depreciation_after',
        'journal_entry_id',
        'created_by',
        'creator_id',
    ];

    protected $casts = [
        'depreciation_date'             => 'date',
        'depreciation_amount'           => 'decimal:2',
        'accumulated_depreciation_after'=> 'decimal:2',
    ];

    public function asset(): BelongsTo
    {
        return $this->belongsTo(FixedAsset::class, 'asset_id');
    }

    public function journalEntry(): BelongsTo
    {
        return $this->belongsTo(JournalEntry::class, 'journal_entry_id');
    }
}
