<?php

namespace Workdo\Quotation\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class RfqEvaluationCriterion extends Model
{
    use HasFactory;

    protected $table = 'rfq_evaluation_criteria';

    protected $fillable = [
        'evaluation_id',
        'criterion_name',
        'weight',
        'sort_order',
        'creator_id',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'weight' => 'decimal:2',
        ];
    }

    public function evaluation(): BelongsTo
    {
        return $this->belongsTo(RfqEvaluation::class, 'evaluation_id');
    }

    public function scores(): HasMany
    {
        return $this->hasMany(RfqEvaluationScore::class, 'criterion_id');
    }
}
