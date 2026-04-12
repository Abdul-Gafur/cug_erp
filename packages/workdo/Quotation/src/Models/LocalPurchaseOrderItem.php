<?php

namespace Workdo\Quotation\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Workdo\ProductService\Models\ProductServiceItem;

class LocalPurchaseOrderItem extends Model
{
    use HasFactory;

    protected $table = 'local_purchase_order_items';

    protected $fillable = [
        'lpo_id',
        'product_id',
        'description',
        'quantity',
        'unit',
        'unit_price',
        'discount_percentage',
        'discount_amount',
        'tax_percentage',
        'tax_amount',
        'total_amount',
    ];

    protected function casts(): array
    {
        return [
            'unit_price'          => 'decimal:2',
            'discount_percentage' => 'decimal:2',
            'discount_amount'     => 'decimal:2',
            'tax_percentage'      => 'decimal:2',
            'tax_amount'          => 'decimal:2',
            'total_amount'        => 'decimal:2',
        ];
    }

    public function lpo(): BelongsTo
    {
        return $this->belongsTo(LocalPurchaseOrder::class, 'lpo_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(ProductServiceItem::class, 'product_id');
    }
}
