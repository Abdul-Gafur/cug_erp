<?php

namespace Workdo\Quotation\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Models\User;

class RfqEvaluationScore extends Model
{
    use HasFactory;

    protected $table = 'rfq_evaluation_scores';

    protected $fillable = [
        'evaluation_id',
        'criterion_id',
        'supplier_id',
        'score',
        'weighted_score',
        'notes',
        'creator_id',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'score'          => 'decimal:2',
            'weighted_score' => 'decimal:4',
        ];
    }

    public function evaluation(): BelongsTo
    {
        return $this->belongsTo(RfqEvaluation::class, 'evaluation_id');
    }

    public function criterion(): BelongsTo
    {
        return $this->belongsTo(RfqEvaluationCriterion::class, 'criterion_id');
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'supplier_id');
    }
}
