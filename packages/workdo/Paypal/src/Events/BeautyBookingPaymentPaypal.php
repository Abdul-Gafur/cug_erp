<?php

namespace Workdo\Paypal\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use Workdo\BeautySpaManagement\Models\BeautyBooking;

class BeautyBookingPaymentPaypal
{
    use Dispatchable;

    public function __construct(
        public BeautyBooking $booking
    ) {}
}
