<?php

namespace Workdo\Stripe\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Workdo\ParkingManagement\Models\ParkingBooking;

class ParkingBookingPaymentStripe
{
    use Dispatchable;

     public function __construct(
        public ParkingBooking $booking
    ) {}
}