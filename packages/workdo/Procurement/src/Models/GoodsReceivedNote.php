<?php

namespace Workdo\Procurement\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use App\Models\User;
use Workdo\Quotation\Models\LocalPurchaseOrder;

class GoodsReceivedNote extends Model
{
    use HasFactory;

    protected $table = 'goods_received_notes';

    protected $fillable = [
        'grn_number',
        'lpo_id',
        'grn_date',
        'receiving_department',
        'receiving_officer_id',
        'delivery_note_number',
        'status',
        'posted_at',
        'posted_by',
        'remarks',
        'inspection_status',
        'inspected_by',
        'inspected_at',
        'inspection_remarks',
        'creator_id',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'grn_date'     => 'date',
            'posted_at'    => 'datetime',
            'inspected_at' => 'datetime',
        ];
    }

    public function lpo(): BelongsTo
    {
        return $this->belongsTo(LocalPurchaseOrder::class, 'lpo_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(GrnItem::class, 'grn_id');
    }

    public function receivingOfficer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'receiving_officer_id');
    }

    public function postedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'posted_by');
    }

    public function inspectedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'inspected_by');
    }

    protected static function boot()
    {
        parent::boot();

        static::creating(function (GoodsReceivedNote $grn) {
            if (empty($grn->grn_number)) {
                $grn->grn_number = static::generateGrnNumber();
            }
        });
    }

    public static function generateGrnNumber(): string
    {
        $year  = date('Y');
        $month = date('m');
        $last  = static::where('grn_number', 'like', "GRN-{$year}-{$month}-%")
                       ->where('created_by', creatorId())
                       ->orderBy('grn_number', 'desc')
                       ->first();

        $next = $last ? ((int) substr($last->grn_number, -4)) + 1 : 1;

        return "GRN-{$year}-{$month}-" . str_pad($next, 4, '0', STR_PAD_LEFT);
    }

    /**
     * Total received quantity across all items (for a given lpo_item_id).
     * Used by ThreeWayMatchService.
     */
    public static function totalReceivedQty(int $lpoItemId, int $createdBy): float
    {
        return (float) static::join('grn_items', 'goods_received_notes.id', '=', 'grn_items.grn_id')
            ->where('goods_received_notes.status', 'posted')
            ->where('goods_received_notes.created_by', $createdBy)
            ->where('grn_items.lpo_item_id', $lpoItemId)
            ->sum('grn_items.received_qty');
    }
}
