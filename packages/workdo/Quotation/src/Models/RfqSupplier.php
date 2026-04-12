<?php

namespace Workdo\Quotation\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Models\User;

class RfqSupplier extends Model
{
    use HasFactory;

    protected $table = 'rfq_suppliers';

    protected $fillable = [
        'rfq_id',
        'supplier_id',
        'response_received_at',
        'quoted_amount',
        'delivery_days',
        'response_notes',
        'status',
        'creator_id',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'response_received_at' => 'datetime',
            'quoted_amount'        => 'decimal:2',
        ];
    }

    public function rfq(): BelongsTo
    {
        return $this->belongsTo(SalesQuotation::class, 'rfq_id');
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'supplier_id');
    }
}
