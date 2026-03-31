<?php

namespace Workdo\Stripe\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Workdo\BeautySpaManagement\Models\BeautyBooking;

class BeautyBookingPaymentStripe
{
    use Dispatchable;

    public function __construct(
        public BeautyBooking $booking
    ) {}
}
