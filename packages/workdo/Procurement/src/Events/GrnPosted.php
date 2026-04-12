<?php

namespace Workdo\Procurement\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use Workdo\Procurement\Models\GoodsReceivedNote;

/**
 * Fired after a Goods Received Note transitions to 'posted'.
 * Listeners may use this to trigger further workflow steps
 * (e.g., notifying the Finance Officer that a GRN is ready for invoice matching).
 */
class GrnPosted
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public readonly GoodsReceivedNote $grn
    ) {}
}
