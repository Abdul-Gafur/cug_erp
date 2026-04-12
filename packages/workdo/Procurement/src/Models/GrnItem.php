<?php

namespace Workdo\Procurement\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Workdo\Quotation\Models\LocalPurchaseOrderItem;
use Workdo\ProductService\Models\ProductServiceItem;

class GrnItem extends Model
{
    use HasFactory;

    protected $table = 'grn_items';

    protected $fillable = [
        'grn_id',
        'lpo_item_id',
        'product_id',
        'description',
        'unit',
        'ordered_qty',
        'received_qty',
        'rejected_qty',
        'condition',
        'condition_notes',
    ];

    protected function casts(): array
    {
        return [
            'ordered_qty'  => 'decimal:3',
            'received_qty' => 'decimal:3',
            'rejected_qty' => 'decimal:3',
        ];
    }

    public function grn(): BelongsTo
    {
        return $this->belongsTo(GoodsReceivedNote::class, 'grn_id');
    }

    public function lpoItem(): BelongsTo
    {
        return $this->belongsTo(LocalPurchaseOrderItem::class, 'lpo_item_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(ProductServiceItem::class, 'product_id');
    }

    /**
     * Accepted quantity = received minus rejected.
     */
    public function getAcceptedQtyAttribute(): float
    {
        return max(0, (float)$this->received_qty - (float)$this->rejected_qty);
    }
}
