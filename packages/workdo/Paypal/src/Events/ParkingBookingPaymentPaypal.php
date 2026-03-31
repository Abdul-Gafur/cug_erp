<?php

namespace Workdo\Paypal\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Workdo\ParkingManagement\Models\ParkingBooking;

class ParkingBookingPaymentPaypal
{
    use Dispatchable;

    public function __construct(
        public ParkingBooking $booking
    ) {}
}