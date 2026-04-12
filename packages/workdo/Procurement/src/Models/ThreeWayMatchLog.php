<?php

namespace Workdo\Procurement\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Models\PurchaseInvoice;
use App\Models\User;
use Workdo\Quotation\Models\LocalPurchaseOrder;

class ThreeWayMatchLog extends Model
{
    use HasFactory;

    protected $table = 'three_way_match_logs';

    protected $fillable = [
        'match_ref',
        'invoice_id',
        'lpo_id',
        'grn_id',
        'match_status',
        'discrepancies',
        'override_reason',
        'override_by',
        'override_at',
        'performed_by',
        'creator_id',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'discrepancies' => 'array',
            'override_at'   => 'datetime',
        ];
    }

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(PurchaseInvoice::class, 'invoice_id');
    }

    public function lpo(): BelongsTo
    {
        return $this->belongsTo(LocalPurchaseOrder::class, 'lpo_id');
    }

    public function grn(): BelongsTo
    {
        return $this->belongsTo(GoodsReceivedNote::class, 'grn_id');
    }

    public function overrideBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'override_by');
    }

    public function performedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'performed_by');
    }

    protected static function boot()
    {
        parent::boot();

        static::creating(function (ThreeWayMatchLog $log) {
            if (empty($log->match_ref)) {
                $log->match_ref = static::generateRef();
            }
        });
    }

    public static function generateRef(): string
    {
        $year  = date('Y');
        $month = date('m');
        $last  = static::where('match_ref', 'like', "MATCH-{$year}-{$month}-%")
                       ->where('created_by', creatorId())
                       ->orderBy('match_ref', 'desc')
                       ->first();

        $next = $last ? ((int) substr($last->match_ref, -4)) + 1 : 1;

        return "MATCH-{$year}-{$month}-" . str_pad($next, 4, '0', STR_PAD_LEFT);
    }
}
