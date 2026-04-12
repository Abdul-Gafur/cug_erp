<?php

namespace Workdo\BudgetPlanner\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class BudgetControlSetting extends Model
{
    use HasFactory;

    protected $fillable = [
        'economic_classification',
        'control_mode',
        'creator_id',
        'created_by',
    ];

    /**
     * Fetch the effective control mode for a given economic classification
     * and tenant (created_by). Falls back to the 'all' catch-all row, then
     * to 'hard_block' if nothing is configured.
     */
    public static function modeFor(string $classification, int $createdBy): string
    {
        $setting = static::where('created_by', $createdBy)
            ->where(function ($q) use ($classification) {
                $q->where('economic_classification', $classification)
                  ->orWhere('economic_classification', 'all');
            })
            ->orderByRaw("CASE WHEN economic_classification = ? THEN 0 ELSE 1 END", [$classification])
            ->first();

        return $setting?->control_mode ?? 'hard_block';
    }
}
