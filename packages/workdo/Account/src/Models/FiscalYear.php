<?php

namespace Workdo\Account\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Models\User;

class FiscalYear extends Model
{
    protected $fillable = [
        'year_code',
        'year_number',
        'start_date',
        'end_date',
        'status',
        'closed_by',
        'closed_at',
        'creator_id',
        'created_by',
    ];

    protected $casts = [
        'start_date' => 'date',
        'end_date'   => 'date',
        'closed_at'  => 'datetime',
    ];

    public function periods(): HasMany
    {
        return $this->hasMany(FiscalPeriod::class);
    }

    public function closedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'closed_by');
    }

    public function isActive(): bool
    {
        return $this->status === 'active';
    }

    public function isClosed(): bool
    {
        return $this->status === 'closed';
    }

    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }

    /**
     * Generate the 12 monthly fiscal periods for this year.
     * Safe to call after creation; does nothing if periods already exist.
     */
    public function generatePeriods(int $createdBy): void
    {
        if ($this->periods()->exists()) {
            return;
        }

        $months = [
            1  => 'January',   2 => 'February', 3  => 'March',
            4  => 'April',     5 => 'May',       6  => 'June',
            7  => 'July',      8 => 'August',    9  => 'September',
            10 => 'October',  11 => 'November', 12 => 'December',
        ];

        foreach ($months as $num => $name) {
            $start = \Carbon\Carbon::create($this->year_number, $num, 1);
            $end   = $start->copy()->endOfMonth();

            $this->periods()->create([
                'period_number' => $num,
                'period_name'   => "{$name} {$this->year_number}",
                'start_date'    => $start->toDateString(),
                'end_date'      => $end->toDateString(),
                'status'        => 'open',
                'creator_id'    => $createdBy,
                'created_by'    => $createdBy,
            ]);
        }
    }
}
