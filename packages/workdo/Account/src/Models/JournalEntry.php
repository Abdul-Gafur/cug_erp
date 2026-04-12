<?php

namespace Workdo\Account\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Models\User;

class JournalEntry extends Model
{
    protected $fillable = [
        'journal_number',
        'journal_date',
        'entry_type',
        'reference_type',
        'reference_id',
        'description',
        'total_debit',
        'total_credit',
        'status',
        'fiscal_period_id',
        'fund_code',
        'approval_status',
        'prepared_by',
        'reviewed_by',
        'bursar_approved_by',
        'reversal_of_id',
        'reversal_entry_id',
        'creator_id',
        'created_by',
    ];

    protected $casts = [
        'journal_date' => 'date',
        'total_debit'  => 'decimal:2',
        'total_credit' => 'decimal:2',
    ];

    public function items(): HasMany
    {
        return $this->hasMany(JournalEntryItem::class);
    }

    public function fiscalPeriod(): BelongsTo
    {
        return $this->belongsTo(FiscalPeriod::class);
    }

    public function preparedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'prepared_by');
    }

    public function reviewedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function bursarApprovedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'bursar_approved_by');
    }

    /** The original entry that this entry reverses. */
    public function reversalOf(): BelongsTo
    {
        return $this->belongsTo(JournalEntry::class, 'reversal_of_id');
    }

    /** The reversing entry created against this entry. */
    public function reversalEntry(): BelongsTo
    {
        return $this->belongsTo(JournalEntry::class, 'reversal_entry_id');
    }

    public function isPrepared(): bool
    {
        return $this->approval_status === 'prepared';
    }

    public function isUnderReview(): bool
    {
        return $this->approval_status === 'under_review';
    }

    public function isApproved(): bool
    {
        return $this->approval_status === 'approved';
    }

    public function isRejected(): bool
    {
        return $this->approval_status === 'rejected';
    }

    public function isBalanced(): bool
    {
        return $this->total_debit == $this->total_credit;
    }

    public function isPosted(): bool
    {
        return $this->status === 'posted';
    }

    public function isDraft(): bool
    {
        return $this->status === 'draft';
    }

    public function isReversed(): bool
    {
        return $this->status === 'reversed';
    }

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($journalEntry) {
            if (empty($journalEntry->journal_number)) {
                $journalEntry->journal_number = static::generateJournalNumber();
            }
        });
    }

    public static function generateJournalNumber(): string
    {
        $year = date('Y');
        $lastEntry = static::where('journal_number', 'like', "JE-{$year}-%")
            ->orderBy('journal_number', 'desc')
            ->first();

        if ($lastEntry) {
            $lastNumber = (int) substr($lastEntry->journal_number, -3);
            $nextNumber = $lastNumber + 1;
        } else {
            $nextNumber = 1;
        }

        return "JE-{$year}-" . str_pad($nextNumber, 3, '0', STR_PAD_LEFT);
    }
}