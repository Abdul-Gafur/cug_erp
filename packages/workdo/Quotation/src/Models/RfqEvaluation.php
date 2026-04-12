<?php

namespace Workdo\Quotation\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use App\Models\User;

class RfqEvaluation extends Model
{
    use HasFactory;

    protected $table = 'rfq_evaluations';

    protected $fillable = [
        'rfq_id',
        'status',
        'recommendation_notes',
        'recommended_supplier_id',
        'finalised_by',
        'finalised_at',
        'committee_members',
        'committee_approved_by',
        'committee_approved_at',
        'signed_document',
        'creator_id',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'finalised_at' => 'datetime',
            'committee_approved_at' => 'datetime',
            'committee_members' => 'json',
        ];
    }

    public function rfq(): BelongsTo
    {
        return $this->belongsTo(SalesQuotation::class, 'rfq_id');
    }

    public function criteria(): HasMany
    {
        return $this->hasMany(RfqEvaluationCriterion::class, 'evaluation_id')->orderBy('sort_order');
    }

    public function scores(): HasMany
    {
        return $this->hasMany(RfqEvaluationScore::class, 'evaluation_id');
    }

    public function recommendedSupplier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recommended_supplier_id');
    }

    public function finalisedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'finalised_by');
    }

    /**
     * Compute total weighted score per supplier.
     * Returns: [ supplier_id => total_weighted_score ]
     */
    public function supplierTotals(): array
    {
        $totals = [];
        foreach ($this->scores as $score) {
            $totals[$score->supplier_id] = ($totals[$score->supplier_id] ?? 0) + $score->weighted_score;
        }
        arsort($totals);
        return $totals;
    }
}
