<?php

namespace Workdo\Paypal\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use Workdo\LaundryManagement\Models\LaundryRequest;

class LaundryBookingPaymentPaypal
{
    use Dispatchable;

    public function __construct(
        public LaundryRequest $booking
    ) {}
}
