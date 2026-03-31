<?php

namespace Workdo\Stripe\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\Coupon;
use Illuminate\Http\Request;
use App\Models\User;
use App\Models\Plan;
use App\Models\Order;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Session;
use Workdo\Stripe\Events\StripePaymentStatus;
use Workdo\Bookings\Models\BookingAppointment;
use Workdo\Bookings\Models\BookingPackage;
use Workdo\Bookings\Models\BookingCustomer;
use Workdo\LaundryManagement\Models\LaundryRequest;
use Workdo\Stripe\Events\CreateLaundryBooking;

use Workdo\LMS\Models\LMSCart;
use Workdo\LMS\Models\LMSOrder;
use Workdo\LMS\Models\LMSOrderItem;
use Workdo\LMS\Models\LMSCoupon;
use Inertia\Inertia;
use Workdo\BeautySpaManagement\Models\BeautyBooking;
use Workdo\BeautySpaManagement\Models\BeautyService;
use Workdo\BeautySpaManagement\Models\BeautyBookingReceipt;
use Workdo\Stripe\Events\BeautyBookingPaymentStripe;
use Stripe\StripeClient;

use Workdo\ParkingManagement\Models\ParkingBooking;
use Workdo\Stripe\Events\ParkingBookingPaymentStripe;
use Workdo\Stripe\Events\LaundryBookingPaymentStripe;
use Workdo\EventsManagement\Models\Event;
use Workdo\EventsManagement\Models\EventBooking;
use Workdo\EventsManagement\Models\EventBookingPayment;
class StripeController extends Controller
{
    public function planPayWithStripe(Request $request)
    {
        $plan = Plan::find($request->plan_id);
        $user = User::find($request->user_id);
        $admin_settings = getAdminAllSetting();
        $admin_currancy = !empty($admin_settings['defaultCurrency']) ? $admin_settings['defaultCurrency'] : 'INR';
        $supported_currencies = ['EUR', 'GBP', 'USD', 'CAD', 'AUD', 'JPY', 'INR', 'CNY', 'SGD', 'HKD', 'BRL'];

        if (!in_array($admin_currancy, $supported_currencies)) {
            return redirect()->back()->with('error', __('Currency is not supported.'));
        }
        $authuser = Auth::user();
        $user_module = !empty($request->user_module_input) ? $request->user_module_input : '';
        $duration = !empty($request->time_period) ? $request->time_period : 'Month';
        $user_module_price = 0;

        if (!empty($user_module)) {
            $user_module_array = explode(',', $user_module);
            foreach ($user_module_array as $key => $value) {
                $temp = ($duration == 'Year') ? ModulePriceByName($value)['yearly_price'] : ModulePriceByName($value)['monthly_price'];
                $user_module_price = $user_module_price + $temp;
            }
        }

        $plan_price = ($duration == 'Year') ? $plan->package_price_yearly : $plan->package_price_monthly;
        $counter = [
            'user_counter' => -1,
            'storage_counter' => 0,
        ];

        $stripe_session = '';
        $orderID = strtoupper(substr(uniqid(), -12));

        if ($plan) {
            /* Check for code usage */
            $plan->discounted_price = false;
            $payment_frequency = $plan->duration;
            $price = $plan_price + $user_module_price;

            if ($request->coupon_code) {
                $validation = applyCouponDiscount($request->coupon_code, $price, auth()->id());
                if ($validation['valid']) {
                    $price = $validation['final_amount'];
                }
            }
            if ($price <= 0) {
                $assignPlan = assignPlan($plan->id, $duration, $user_module, $counter, $request->user_id);
                if ($assignPlan['is_success']) {
                    return redirect()->route('plans.index')->with('success', __('Plan activated Successfully!'));
                } else {
                    return redirect()->route('plans.index')->with('error', __('Something went wrong, Please try again,'));
                }
            }

            try {

                $payment_plan = $duration;
                $payment_type = 'onetime';
                /* Payment details */
                $code = '';

                /* Final price */
                $stripe_formatted_price = in_array(
                    $admin_currancy,
                    [
                        'MGA',
                        'BIF',
                        'CLP',
                        'PYG',
                        'DJF',
                        'RWF',
                        'GNF',
                        'UGX',
                        'JPY',
                        'VND',
                        'VUV',
                        'XAF',
                        'KMF',
                        'KRW',
                        'XOF',
                        'XPF',
                        'BRL'
                    ]
                ) ? number_format($price, 2, '.', '') : number_format($price, 2, '.', '') * 100;
                $return_url_parameters = function ($return_type) use ($payment_frequency, $payment_type) {
                    return '&return_type=' . $return_type . '&payment_processor=stripe&payment_frequency=' . $payment_frequency . '&payment_type=' . $payment_type;
                };
                /* Initiate Stripe */
                $stripe_session = $this->createStripeSession([
                    'api_key' => $admin_settings['stripe_secret'] ?? '',
                    'currency' => $admin_currancy,
                    'amount' => $stripe_formatted_price,
                    'product_name' => $plan->name ?? 'Basic Package',
                    'description' => $payment_plan,
                    'metadata' => [
                        'user_id' => $user->id,
                        'package_id' => $plan->id,
                        'payment_frequency' => $payment_frequency,
                        'code' => $code,
                    ],
                    'success_url' => route('payment.stripe.status', [
                        'order_id' => $orderID,
                        'plan_id' => $plan->id,
                        'user_module' => $user_module,
                        'duration' => $duration,
                        'counter' => $counter,
                        'coupon_code' => $request->coupon_code,
                        'user_id' => $user->id,
                        $return_url_parameters('success'),
                    ]),
                    'cancel_url' => route('payment.stripe.status', [
                        'plan_id' => $orderID,
                        'order_id' => $plan->id,
                        $return_url_parameters('cancel'),
                    ]),
                ]);
                Order::create(
                    [
                        'order_id' => $orderID,
                        'name' => null,
                        'email' => null,
                        'card_number' => null,
                        'card_exp_month' => null,
                        'card_exp_year' => null,
                        'plan_name' => !empty($plan->name) ? $plan->name : 'Basic Package',
                        'plan_id' => $plan->id,
                        'price' => !empty($price) ? $price : 0,
                        'currency' => $admin_currancy,
                        'txn_id' => '',
                        'payment_type' => 'Stripe',
                        'payment_status' => 'pending',
                        'receipt' => null,
                        'created_by' => $user->id,
                    ]
                );
                Session::put('stripe_session', $stripe_session);
                $stripe_session = $stripe_session ?? false;
            } catch (\Exception $e) {
                return redirect()->route('plans.index')->with('error', $e->getMessage());
            }
            return Inertia::render('Stripe/StripePayment', [
                'stripe_session' => $stripe_session,
                'stripe_key' => $admin_settings['stripe_key'] ?? ''
            ]);
        } else {
            return redirect()->route('plans.index')->with('error', __('Plan is deleted.'));
        }
    }

    public function planGetStripeStatus(Request $request)
    {
        $admin_settings = getAdminAllSetting();
        try {
            $stripe = new StripeClient(!empty($admin_settings['stripe_secret']) ? $admin_settings['stripe_secret'] : '');
            $stripe_session = Session::get('stripe_session');
            if ($stripe_session && isset($stripe_session->payment_intent)) {
                $paymentIntents = $stripe->paymentIntents->retrieve(
                    $stripe_session->payment_intent,
                    []
                );
                $receipt_url = $paymentIntents->charges->data[0]->receipt_url;
            } else {
                $receipt_url = "";
            }
        } catch (\Exception $exception) {
            $receipt_url = "";
        }
        Session::forget('stripe_session');
        try {
            if ($request->return_type == 'success') {
                $Order = Order::where('order_id', $request->order_id)->first();
                $Order->payment_status = 'succeeded';
                $Order->receipt = $receipt_url;
                $Order->save();

                $plan = Plan::find($request->plan_id);
                $counter = [
                    'user_counter' => -1,
                    'storage_counter' => 0,
                ];
                $assignPlan = assignPlan($plan->id, $request->duration, $request->user_module, $counter, $request->user_id);
                if ($assignPlan['is_success']) {
                    if ($request->coupon_code) {
                        $coupon = Coupon::where('code', $request->coupon_code)->first();
                        if ($coupon) {
                            recordCouponUsage($coupon->id, $request->user_id, $request->order_id);
                        }
                    }
                    $type = 'Subscription';
                    StripePaymentStatus::dispatch($plan, $type, $Order);
                    $value = Session::get('user-module-selection');
                    if (!empty($value)) {
                        Session::forget('user-module-selection');
                    }
                    return redirect()->route('plans.index')->with('success', __('Plan activated Successfully!'));
                } else {
                    return redirect()->route('plans.index')->with('error', __('Something went wrong, Please try again,'));
                }
            } else {
                return redirect()->route('plans.index')->with('error', __('Your Payment has failed!'));
            }
        } catch (\Exception $exception) {
            return redirect()->route('plans.index')->with('error', $exception->getMessage());
        }
    }

    /**
     * Create Stripe checkout session - Dynamic for both plans and invoices
     */
    private function createStripeSession($params)
    {
        $api_key = $params['api_key'] ??
            $params['admin_settings']['stripe_secret'] ??
            ($params['company_settings'] ? company_setting('stripe_secret', $params['user_id'] ?? null) : null) ??
            '';
        \Stripe\Stripe::setApiKey($api_key);

        // Build session data
        $session_data = [
            'payment_method_types' => ['card'],
            'line_items' => [[
                'price_data' => [
                    'currency' => $params['currency'],
                    'unit_amount' => (int) $params['amount'],
                    'product_data' => [
                        'name' => $params['product_name'],
                        'description' => $params['description'] ?? '',
                    ],
                ],
                'quantity' => 1,
            ]],
            'mode' => 'payment',
            'metadata' => $params['metadata'],
            'success_url' => $params['success_url'],
            'cancel_url' => $params['cancel_url'],
        ];

        return \Stripe\Checkout\Session::create($session_data);
    }

    public function bookingPayWithStripe(Request $request)
    {
        // Get booking data from request (same structure as booking.store)
        $selectedTimeSlot = [
            'start_time' => $request->input('selectedTimeSlot.start_time'),
            'end_time' => $request->input('selectedTimeSlot.end_time'),
            'label' => $request->input('selectedTimeSlot.label')
        ];

        $bookingData = [
            'selectedDate' => $request->selectedDate,
            'selectedStaff' => $request->selectedStaff,
            'selectedItem' => $request->selectedItem,
            'selectedPackageItem' => $request->selectedPackageItem,
            'selectedTimeSlot' => $selectedTimeSlot,
            'formData' => [
                'firstName' => $request->input('formData.firstName'),
                'lastName' => $request->input('formData.lastName'),
                'email' => $request->input('formData.email'),
                'phone' => $request->input('formData.phone'),
                'description' => $request->input('formData.description'),
                'paymentOption' => $request->input('formData.paymentOption')
            ]
        ];

        // Store booking data and userSlug in session for after payment
        Session::put('booking_data', $bookingData);
        Session::put('booking_user_slug', $request->route('userSlug'));

        $package = BookingPackage::find($request->selectedPackageItem);
        if (!$package) {
            return redirect()->back()->with('error', __('Package not found.'));
        }

        $company_settings = getCompanyAllSetting($package->created_by);
        $company_currancy = !empty($company_settings['defaultCurrency']) ? $company_settings['defaultCurrency'] : 'USD';
        $supported_currencies = ['EUR', 'GBP', 'USD', 'CAD', 'AUD', 'JPY', 'INR', 'CNY', 'SGD', 'HKD', 'BRL'];

        if (!in_array($company_currancy, $supported_currencies)) {
            return redirect()->back()->with('error', __('Currency is not supported.'));
        }

        $price = $package->price ?? 0;
        if ($price <= 0) {
            return redirect()->back()->with('error', __('Invalid payment amount.'));
        }

        try {
            $stripe_formatted_price = in_array(
                $company_currancy,
                ['MGA', 'BIF', 'CLP', 'PYG', 'DJF', 'RWF', 'GNF', 'UGX', 'JPY', 'VND', 'VUV', 'XAF', 'KMF', 'KRW', 'XOF', 'XPF', 'BRL']
            ) ? number_format($price, 2, '.', '') : number_format($price, 2, '.', '') * 100;

            $stripe_session = $this->createStripeSession([
                'api_key' => $company_settings['stripe_secret'] ?? '',
                'currency' => $company_currancy,
                'amount' => $stripe_formatted_price,
                'product_name' => $package->name ?? 'Booking Service',
                'description' => 'Booking Service Payment',
                'metadata' => [
                    'package_id' => $package->id,
                    'customer_name' => $bookingData['formData']['firstName'] . ' ' . $bookingData['formData']['lastName'],
                    'customer_email' => $bookingData['formData']['email'],
                ],
                'success_url' => route('booking.payment.stripe.status', [
                    'return_type' => 'success',
                    'userSlug' => $request->route('userSlug')
                ]),
                'cancel_url' => route('booking.payment.stripe.status', [
                    'return_type' => 'cancel',
                    'userSlug' => $request->route('userSlug')
                ]),
            ]);

            Session::put('booking_stripe_session', $stripe_session);

            return Inertia::render('Stripe/StripePayment', [
                'stripe_session' => $stripe_session,
                'stripe_key' => $company_settings['stripe_key'] ?? ''
            ]);
        } catch (\Exception $e) {
            return redirect()->back()->with('error', $e->getMessage());
        }
    }

    public function bookingGetStripeStatus(Request $request)
    {
        $bookingData = Session::get('booking_data');
        $stripe_session = Session::get('booking_stripe_session');
        $userSlug = Session::get('booking_user_slug');
        if (!$bookingData) {
            return redirect()->route('booking.home', ['userSlug' => $userSlug])->with('error', __('Booking data not found.'));
        }

        $package = BookingPackage::find($bookingData['selectedPackageItem']);
        $company_settings = getCompanyAllSetting($package->created_by ?? 1);

        try {
            $stripe = new StripeClient(!empty($company_settings['stripe_secret']) ? $company_settings['stripe_secret'] : '');
            $payment_intent = null;
            $receipt_url = "";
            if ($stripe_session && isset($stripe_session['id'])) {
                // Retrieve fresh session from Stripe API
                $checkoutSession = $stripe->checkout->sessions->retrieve($stripe_session['id'], []);

                if (isset($checkoutSession->payment_intent)) {
                    $payment_intent = $checkoutSession->payment_intent;
                    $paymentIntents = $stripe->paymentIntents->retrieve($checkoutSession->payment_intent, []);
                    if (!empty($paymentIntents->latest_charge)) {
                        $charge = $stripe->charges->retrieve($paymentIntents->latest_charge, []);
                        $receipt_url = $charge->receipt_url ?? '';
                        \Log::info('Stripe receipt url: ' . $receipt_url);
                    }
                }
            }
        } catch (\Exception $exception) {
            $receipt_url = "";
        }

        Session::forget('booking_stripe_session');
        Session::forget('booking_data');

        try {
            if ($request->return_type == 'success') {
                // Create appointment after successful payment
                $timeSlot = $bookingData['selectedTimeSlot'];
                $userId = $package->created_by ?? 1;

                // Find or create customer (same as BookingController)
                $customer = BookingCustomer::where('email', $bookingData['formData']['email'])
                    ->where('created_by', $userId)
                    ->first();

                if ($customer) {
                    $customer->update([
                        'first_name' => $bookingData['formData']['firstName'],
                        'last_name' => $bookingData['formData']['lastName'],
                        'mobile_number' => $bookingData['formData']['phone'],
                        'description' => $bookingData['formData']['description'] ?? null,
                    ]);
                } else {
                    $customer = BookingCustomer::create([
                        'first_name' => $bookingData['formData']['firstName'],
                        'last_name' => $bookingData['formData']['lastName'],
                        'email' => $bookingData['formData']['email'],
                        'mobile_number' => $bookingData['formData']['phone'],
                        'description' => $bookingData['formData']['description'] ?? null,
                        'created_by' => $userId,
                        'creator_id' => $userId,
                    ]);
                }

                // Generate appointment number (same as BookingController)
                $currentYear = date('Y');
                $lastAppointment = BookingAppointment::where('created_by', $userId)
                    ->where('appointment_number', 'like', 'APT-' . $currentYear . '-' . $userId . '-%')
                    ->orderBy('appointment_number', 'desc')
                    ->first();

                if ($lastAppointment) {
                    $lastNumber = (int) substr($lastAppointment->appointment_number, -4);
                    $nextNumber = $lastNumber + 1;
                } else {
                    $nextNumber = 1;
                }

                $appointmentNumber = 'APT-' . $currentYear . '-' . $userId . '-' . str_pad($nextNumber, 4, '0', STR_PAD_LEFT);

                // Create appointment (same structure as BookingController)
                BookingAppointment::create([
                    'appointment_number' => $appointmentNumber,
                    'date' => $bookingData['selectedDate'],
                    'item_id' => $bookingData['selectedItem'],
                    'package_id' => $bookingData['selectedPackageItem'],
                    'staff_id' => $bookingData['selectedStaff'],
                    'customer_id' => $customer->id,
                    'start_time' => $timeSlot['start_time'],
                    'end_time' => $timeSlot['end_time'],
                    'payment' => 'stripe',
                    'status' => 'pending',
                    'payment_status' => 'paid',
                    'payment_receipt' => $receipt_url,
                    'online_payment_id' => $payment_intent ?? null,
                    'created_by' => $userId,
                    'creator_id' => $userId,
                ]);

                // Get userSlug from session
                Session::forget('booking_user_slug');

                return redirect()->route('booking.home', ['userSlug' => $userSlug])->with('success', __('Payment completed and appointment created successfully!'));
            } else {
                Session::forget('booking_user_slug');
                return redirect()->route('booking.home', ['userSlug' => $userSlug])->with('error', __('Payment was cancelled.'));
            }
        } catch (\Exception $exception) {
            return redirect()->route('booking.home', ['userSlug' => $userSlug])->with('error', $exception->getMessage());
        }
    }


    public function beautySpaPayWithStripe(Request $request)
    {
        // Store booking data in session
        $bookingData = [
            'service' => $request->service,
            'date' => $request->date,
            'time_slot' => $request->time_slot,
            'person' => $request->person,
            'gender' => $request->gender,
            'name' => $request->name,
            'email' => $request->email,
            'phone_number' => $request->phone_number,
            'reference' => $request->reference,
            'additional_notes' => $request->additional_notes,
            'payment_option' => $request->payment_option
        ];

        Session::put('beauty_booking_data', $bookingData);
        Session::put('beauty_booking_user_slug', $request->route('userSlug'));

        $userSlug = $request->route('userSlug');
        $user = User::where('slug', $userSlug)->first();
        $userId = $user ? $user->id : 1;

        $service = BeautyService::where('id', $request->service)
            ->where('created_by', $userId)
            ->firstOrFail();

        $company_settings = getCompanyAllSetting($userId);
        $company_currancy = !empty($company_settings['defaultCurrency']) ? $company_settings['defaultCurrency'] : 'USD';
        $supported_currencies = ['EUR', 'GBP', 'USD', 'CAD', 'AUD', 'JPY', 'INR', 'CNY', 'SGD', 'HKD', 'BRL'];

        if (!in_array($company_currancy, $supported_currencies)) {
            return redirect()->back()->with('error', __('Currency is not supported.'));
        }

        $price = $service->price * $request->person;
        if ($price <= 0) {
            return redirect()->back()->with('error', __('Invalid payment amount.'));
        }

        try {
            $stripe_formatted_price = in_array(
                $company_currancy,
                ['MGA', 'BIF', 'CLP', 'PYG', 'DJF', 'RWF', 'GNF', 'UGX', 'JPY', 'VND', 'VUV', 'XAF', 'KMF', 'KRW', 'XOF', 'XPF', 'BRL']
            ) ? number_format($price, 2, '.', '') : number_format($price, 2, '.', '') * 100;

            $stripe_session = $this->createStripeSession([
                'api_key' => $company_settings['stripe_secret'] ?? '',
                'currency' => $company_currancy,
                'amount' => $stripe_formatted_price,
                'product_name' => $service->name ?? 'Beauty Service',
                'description' => 'Beauty Service Payment',
                'metadata' => [
                    'service_id' => $service->id,
                    'customer_name' => $request->name,
                    'customer_email' => $request->email,
                ],
                'success_url' => route('beauty-spa.payment.stripe.status', [
                    'return_type' => 'success',
                    'userSlug' => $userSlug
                ]),
                'cancel_url' => route('beauty-spa.payment.stripe.status', [
                    'return_type' => 'cancel',
                    'userSlug' => $userSlug
                ]),
            ]);

            Session::put('beauty_stripe_session', $stripe_session);

            return Inertia::render('Stripe/StripePayment', [
                'stripe_session' => $stripe_session,
                'stripe_key' => $company_settings['stripe_key'] ?? ''
            ]);
        } catch (\Exception $e) {
            return redirect()->back()->with('error', $e->getMessage());
        }
    }

    public function beautySpaGetStripeStatus(Request $request)
    {
        $bookingData = Session::get('beauty_booking_data');
        $stripe_session = Session::get('beauty_stripe_session');
        $userSlug = Session::get('beauty_booking_user_slug');

        if (!$bookingData) {
            return redirect()->route('beauty-spa.booking', ['userSlug' => $userSlug])->with('error', __('Booking data not found.'));
        }

        $user = User::where('slug', $userSlug)->first();
        $userId = $user ? $user->id : 1;

        $service = BeautyService::where('id', $bookingData['service'])
            ->where('created_by', $userId)
            ->first();

        $company_settings = getCompanyAllSetting($userId);

        try {
            $stripe = new StripeClient(!empty($company_settings['stripe_secret']) ? $company_settings['stripe_secret'] : '');
            $payment_intent = null;
            $receipt_url = "";

            if ($stripe_session && isset($stripe_session['id'])) {
                $checkoutSession = $stripe->checkout->sessions->retrieve($stripe_session['id'], []);

                if (isset($checkoutSession->payment_intent)) {
                    $payment_intent = $checkoutSession->payment_intent;
                    $paymentIntents = $stripe->paymentIntents->retrieve($checkoutSession->payment_intent, []);
                    if (!empty($paymentIntents->latest_charge)) {
                        $charge = $stripe->charges->retrieve($paymentIntents->latest_charge, []);
                        $receipt_url = $charge->receipt_url ?? '';
                    }
                }
            }
        } catch (\Exception $exception) {
            $receipt_url = "";
        }

        Session::forget('beauty_stripe_session');
        Session::forget('beauty_booking_data');
        Session::forget('beauty_booking_user_slug');

        try {
            if ($request->return_type == 'success') {
                $servicePrice = $service->price * $bookingData['person'];
                $times = explode('-', $bookingData['time_slot']);

                $booking = new BeautyBooking();
                $booking->name = $bookingData['name'];
                $booking->email = $bookingData['email'];
                $booking->phone_number = $bookingData['phone_number'];
                $booking->service = $bookingData['service'];
                $booking->date = $bookingData['date'];
                $booking->start_time = $times[0];
                $booking->end_time = $times[1];
                $booking->person = $bookingData['person'];
                $booking->price = $servicePrice;
                $booking->gender = $bookingData['gender'];
                $booking->reference = $bookingData['reference'];
                $booking->notes = $bookingData['additional_notes'];
                $booking->payment_option = 'Stripe';
                $booking->payment_status = 'paid';
                $booking->stage_id = 0;
                $booking->creator_id = null;
                $booking->created_by = $userId;
                $booking->save();

                $beautyreceipt                  = new BeautyBookingReceipt();
                $beautyreceipt->beauty_booking_id      = $booking->id;
                $beautyreceipt->name            = $booking->name;
                $beautyreceipt->service         = $booking->service;
                $beautyreceipt->number          = $booking->number;
                $beautyreceipt->gender          = $booking->gender;
                $beautyreceipt->start_time      = $booking->start_time;
                $beautyreceipt->end_time        = $booking->end_time;
                $beautyreceipt->price           = $booking->price;
                $beautyreceipt->payment_type    = 'Stripe';
                $beautyreceipt->created_by      = $booking->created_by;
                $beautyreceipt->save();

                try {
                    BeautyBookingPaymentStripe::dispatch($booking);
                } catch (\Throwable $th) {
                    return back()->with('error', $th->getMessage());
                }

                return redirect()->route('beauty-spa.booking-success', ['userSlug' => $userSlug, 'id' => \Illuminate\Support\Facades\Crypt::encrypt($booking->id)])
                    ->with('success', __('Payment completed and booking confirmed successfully!'));
            } else {
                return redirect()->route('beauty-spa.booking', ['userSlug' => $userSlug])->with('error', __('Payment was cancelled.'));
            }
        } catch (\Exception $exception) {
            return redirect()->route('beauty-spa.booking', ['userSlug' => $userSlug])->with('error', $exception->getMessage());
        }
    }

    public function lmsPayWithStripe(Request $request)
    {
        $userSlug = $request->route('userSlug');
        $user = User::where('slug', $userSlug)->first();
        if (!$user) {
            return redirect()->back()->with('error', __('User not found.'));
        }

        $student = auth('lms_student')->user();
        if (!$student) {
            return redirect()->route('lms.frontend.login', ['userSlug' => $userSlug]);
        }

        // Get cart items
        $cartItems = LMSCart::where('created_by', $user->id)
            ->where('student_id', $student->id)
            ->with('course')
            ->get();

        if ($cartItems->isEmpty()) {
            return redirect()->route('lms.frontend.cart', ['userSlug' => $userSlug])
                ->with('error', __('Your cart is empty'));
        }

        // Calculate totals (same logic as placeOrder)
        $originalTotal = $cartItems->sum('original_price');
        $subtotal = $cartItems->sum('price');
        $courseDiscount = $originalTotal - $subtotal;
        $couponDiscount = 0;
        $appliedCoupon = session('applied_coupon');

        if ($appliedCoupon) {
            $coupon = LMSCoupon::where('id', $appliedCoupon['id'])
                ->where('created_by', $user->id)
                ->first();

            if ($coupon && $coupon->isValid()) {
                if (!$coupon->minimum_amount || $subtotal >= $coupon->minimum_amount) {
                    if ($coupon->type === 'percentage') {
                        $couponDiscount = ($subtotal * $coupon->value) / 100;
                    } else {
                        $couponDiscount = $coupon->value;
                    }
                    $couponDiscount = min($couponDiscount, $subtotal);
                }
            }
        }

        $total = $subtotal - $couponDiscount;

        if ($total <= 0) {
            return redirect()->back()->with('error', __('Invalid payment amount.'));
        }

        // Store order data in session
        Session::put('lms_order_data', [
            'original_total' => $originalTotal,
            'payment_method' => $request->payment_method,
            'payment_note' => $request->payment_note,
            'subtotal' => $subtotal,
            'course_discount' => $courseDiscount,
            'coupon_discount' => $couponDiscount,
            'total' => $total,
            'applied_coupon' => $appliedCoupon
        ]);
        Session::put('lms_user_slug', $userSlug);

        $company_settings = getCompanyAllSetting($user->id);
        $company_currancy = !empty($company_settings['defaultCurrency']) ? $company_settings['defaultCurrency'] : 'USD';
        $supported_currencies = ['EUR', 'GBP', 'USD', 'CAD', 'AUD', 'JPY', 'INR', 'CNY', 'SGD', 'HKD', 'BRL'];

        if (!in_array($company_currancy, $supported_currencies)) {
            return redirect()->back()->with('error', __('Currency is not supported.'));
        }

        try {
            $stripe_formatted_price = in_array(
                $company_currancy,
                ['MGA', 'BIF', 'CLP', 'PYG', 'DJF', 'RWF', 'GNF', 'UGX', 'JPY', 'VND', 'VUV', 'XAF', 'KMF', 'KRW', 'XOF', 'XPF', 'BRL']
            ) ? number_format($total, 2, '.', '') : number_format($total, 2, '.', '') * 100;

            $stripe_session = $this->createStripeSession([
                'api_key' => $company_settings['stripe_secret'] ?? '',
                'currency' => $company_currancy,
                'amount' => $stripe_formatted_price,
                'product_name' => 'LMS Course Purchase',
                'description' => 'Online Course Payment',
                'metadata' => [
                    'student_id' => $student->id,
                    'student_name' => $student->name,
                    'student_email' => $student->email,
                    'course_count' => $cartItems->count()
                ],
                'success_url' => route('lms.payment.stripe.status', [
                    'return_type' => 'success',
                    'userSlug' => $userSlug
                ]),
                'cancel_url' => route('lms.payment.stripe.status', [
                    'return_type' => 'cancel',
                    'userSlug' => $userSlug
                ]),
            ]);

            Session::put('lms_stripe_session', $stripe_session);

            return Inertia::render('Stripe/StripePayment', [
                'stripe_session' => $stripe_session,
                'stripe_key' => $company_settings['stripe_key'] ?? ''
            ]);
        } catch (\Exception $e) {
            return redirect()->back()->with('error', $e->getMessage());
        }
    }

    public function lmsGetStripeStatus(Request $request)
    {
        $orderData = Session::get('lms_order_data');
        $stripe_session = Session::get('lms_stripe_session');
        $userSlug = Session::get('lms_user_slug');

        if (!$orderData) {
            return redirect()->route('lms.frontend.home', ['userSlug' => $userSlug])->with('error', __('Order data not found.'));
        }

        $user = User::where('slug', $userSlug)->first();
        $student = auth('lms_student')->user();

        if (!$user || !$student) {
            return redirect()->route('lms.frontend.home', ['userSlug' => $userSlug])->with('error', __('Invalid session.'));
        }

        $company_settings = getCompanyAllSetting($user->id);

        try {
            $stripe = new StripeClient(!empty($company_settings['stripe_secret']) ? $company_settings['stripe_secret'] : '');
            $payment_intent = null;
            $receipt_url = "";

            if ($stripe_session && isset($stripe_session['id'])) {
                $checkoutSession = $stripe->checkout->sessions->retrieve($stripe_session['id'], []);

                if (isset($checkoutSession->payment_intent)) {
                    $payment_intent = $checkoutSession->payment_intent;
                    $paymentIntents = $stripe->paymentIntents->retrieve($checkoutSession->payment_intent, []);
                    if (!empty($paymentIntents->latest_charge)) {
                        $charge = $stripe->charges->retrieve($paymentIntents->latest_charge, []);
                        $receipt_url = $charge->receipt_url ?? '';
                    }
                }
            }
        } catch (\Exception $exception) {
            $receipt_url = "";
        }

        Session::forget('lms_stripe_session');
        Session::forget('lms_order_data');
        Session::forget('lms_user_slug');

        try {
            if ($request->return_type == 'success') {
                // Get cart items
                $cartItems = LMSCart::where('created_by', $user->id)
                    ->where('student_id', $student->id)
                    ->with('course')
                    ->get();

                if ($cartItems->isEmpty()) {
                    return redirect()->route('lms.frontend.cart', ['userSlug' => $userSlug])
                        ->with('error', __('Your cart is empty'));
                }

                // Create order
                $order = LMSOrder::create([
                    'order_number' => LMSOrder::generateOrderNumber($user->id),
                    'student_id' => $student->id,
                    'payment_method' => 'stripe',
                    'payment_status' => 'paid',
                    'original_total' => $orderData['original_total'],
                    'subtotal' => $orderData['subtotal'],
                    'discount_amount' => $orderData['course_discount'],
                    'coupon_discount' => $orderData['coupon_discount'],
                    'total_discount' => $orderData['course_discount'] + $orderData['coupon_discount'],
                    'total_amount' => $orderData['total'],
                    'coupon_id' => $orderData['applied_coupon'] ? $orderData['applied_coupon']['id'] : null,
                    'coupon_code' => $orderData['applied_coupon'] ? $orderData['applied_coupon']['code'] : null,
                    'status' => 'confirmed',
                    'receipt' => $receipt_url,
                    'notes' => $orderData['payment_note'],
                    'order_date' => now(),
                    'payment_id' => $payment_intent,
                    'creator_id' => $user->id,
                    'created_by' => $user->id
                ]);

                // Create order items
                foreach ($cartItems as $cartItem) {
                    LMSOrderItem::create([
                        'order_id' => $order->id,
                        'course_id' => $cartItem->course_id,
                        'quantity' => $cartItem->quantity,
                        'unit_price' => $cartItem->price,
                        'total_price' => $cartItem->price * $cartItem->quantity
                    ]);
                }

                // Clear cart and coupon
                $cartItems->each->delete();
                session()->forget('applied_coupon');

                return redirect()->route('lms.frontend.home', ['userSlug' => $userSlug])
                    ->with('success', __('Payment completed successfully! Order #:number', ['number' => $order->order_number]));
            } else {
                return redirect()->route('lms.frontend.checkout', ['userSlug' => $userSlug])
                    ->with('error', __('Payment was cancelled.'));
            }
        } catch (\Exception $exception) {
            return redirect()->route('lms.frontend.checkout', ['userSlug' => $userSlug])
                ->with('error', $exception->getMessage());
        }
    }
 public function laundryPayWithStripe(Request $request)
    {
        $bookingData = [
            'name' => $request->name,
            'email' => $request->email,
            'phone' => $request->phone,
            'address' => $request->address,
            'location' => $request->location,
            'numberOfItems' => $request->cloth_no,
            'specialInstructions' => $request->instructions,
            'pickupDate' => $request->pickup_date,
            'pickupTime' => $request->pickupTime,
            'deliveryDate' => $request->delivery_date,
            'deliveryTime' => $request->deliveryTime,
            'services' => json_decode($request->services, true) ?? [],
            'total' => $request->total
        ];

        Session::put('laundry_booking_data', $bookingData);
        Session::put('laundry_booking_user_slug', $request->route('userSlug'));

        $userSlug = $request->route('userSlug');
        $user = User::where('slug', $userSlug)->first();
        $userId = $user ? $user->id : 1;

        $company_settings = getCompanyAllSetting($userId);
        $company_currancy = !empty($company_settings['defaultCurrency']) ? $company_settings['defaultCurrency'] : 'USD';
        $supported_currencies = ['EUR', 'GBP', 'USD', 'CAD', 'AUD', 'JPY', 'INR', 'CNY', 'SGD', 'HKD', 'BRL'];

        if (!in_array($company_currancy, $supported_currencies)) {
            return redirect()->back()->with('error', __('Currency is not supported.'));
        }

        $price = floatval($request->total ?? 0);
        if ($price <= 0) {
            return redirect()->back()->with('error', __('Invalid payment amount.'));
        }

        try {
            $stripe_formatted_price = in_array(
                $company_currancy,
                ['MGA', 'BIF', 'CLP', 'PYG', 'DJF', 'RWF', 'GNF', 'UGX', 'JPY', 'VND', 'VUV', 'XAF', 'KMF', 'KRW', 'XOF', 'XPF', 'BRL']
            ) ? number_format($price, 2, '.', '') : number_format($price, 2, '.', '') * 100;

            $stripe_session = $this->createStripeSession([
                'api_key' => $company_settings['stripe_secret'] ?? '',
                'currency' => $company_currancy,
                'amount' => $stripe_formatted_price,
                'product_name' => 'Laundry Service',
                'description' => 'Laundry Service Payment',
                'metadata' => [
                    'customer_name' => $request->name,
                    'customer_email' => $request->email,
                ],
                'success_url' => route('laundry.payment.stripe.status', [
                    'return_type' => 'success',
                    'userSlug' => $userSlug
                ]),
                'cancel_url' => route('laundry.payment.stripe.status', [
                    'return_type' => 'cancel',
                    'userSlug' => $userSlug
                ]),
            ]);

            Session::put('laundry_stripe_session', $stripe_session);

            return Inertia::render('Stripe/StripePayment', [
                'stripe_session' => $stripe_session,
                'stripe_key' => $company_settings['stripe_key'] ?? ''
            ]);
        } catch (\Exception $e) {
            return redirect()->back()->with('error', $e->getMessage());
        }
    }

    public function laundryGetStripeStatus(Request $request)
    {
        $bookingData = Session::get('laundry_booking_data');
        $stripe_session = Session::get('laundry_stripe_session');
        $userSlug = Session::get('laundry_booking_user_slug');

        if (!$bookingData) {
            return redirect()->route('laundry-management.frontend.booking', ['userSlug' => $userSlug])->with('error', __('Booking data not found.'));
        }

        $user = User::where('slug', $userSlug)->first();
        $userId = $user ? $user->id : 1;
        $company_settings = getCompanyAllSetting($userId);

        try {
            $stripe = new StripeClient(!empty($company_settings['stripe_secret']) ? $company_settings['stripe_secret'] : '');
            $payment_intent = null;
            $receipt_url = "";

            if ($stripe_session && isset($stripe_session['id'])) {
                $checkoutSession = $stripe->checkout->sessions->retrieve($stripe_session['id'], []);

                if (isset($checkoutSession->payment_intent)) {
                    $payment_intent = $checkoutSession->payment_intent;
                    $paymentIntents = $stripe->paymentIntents->retrieve($checkoutSession->payment_intent, []);
                    if (!empty($paymentIntents->latest_charge)) {
                        $charge = $stripe->charges->retrieve($paymentIntents->latest_charge, []);
                        $receipt_url = $charge->receipt_url ?? '';
                    }
                }
            }
        } catch (\Exception $exception) {
            $receipt_url = "";
        }

        Session::forget('laundry_stripe_session');
        Session::forget('laundry_booking_data');
        Session::forget('laundry_booking_user_slug');

        try {
            if ($request->return_type == 'success') {
                $booking = new LaundryRequest();
                $booking->name = $bookingData['name'];
                $booking->email = $bookingData['email'];
                $booking->phone = $bookingData['phone'];
                $booking->address = $bookingData['address'];
                $booking->location = $bookingData['location'];
                $booking->cloth_no = $bookingData['numberOfItems'];
                $booking->instructions = $bookingData['specialInstructions'];
                $booking->pickup_date = $bookingData['pickupDate'] . ' ' . $bookingData['pickupTime'];
                $booking->delivery_date = $bookingData['deliveryDate'] . ' ' . $bookingData['deliveryTime'];
                $booking->services = $bookingData['services'];
                $booking->payment_method = 'online';
                $booking->payment_id = $payment_intent;
                $booking->status = 2;
                $booking->total = $bookingData['total'];
                $booking->created_by = $userId;
                $booking->creator_id = $userId;
                $booking->save();

                try {
                    LaundryBookingPaymentStripe::dispatch($booking);
                } catch (\Throwable $th) {
                    return back()->with('error', $th->getMessage());
                }

                return redirect()->route('laundry-management.frontend.booking-success', [
                    'userSlug' => $userSlug,
                    'requestId' => encrypt($booking->id)
                ]);
            } else {
                return redirect()->route('laundry-management.frontend.booking', ['userSlug' => $userSlug])
                    ->with('error', __('Payment was cancelled.'));
            }
        } catch (\Exception $exception) {
            return redirect()->route('laundry-management.frontend.booking', ['userSlug' => $userSlug])
                ->with('error', $exception->getMessage());
        }
    }
    public function parkingPayWithStripe(Request $request)
    {
        $bookingData = [
            'slot_name'      => $request->slot_name,
            'slot_type_id'   => $request->slot_type_id,
            'date'           => $request->date,
            'start_time'     => $request->start_time,
            'end_time'       => $request->end_time,
            'customer_name'  => $request->customer_name,
            'customer_email' => $request->customer_email,
            'customer_phone' => $request->customer_phone,
            'vehicle_name'   => $request->vehicle_name,
            'vehicle_number' => $request->vehicle_number,
            'payment_option' => $request->payment_option,
            'total_amount'   => $request->total_amount
        ];

        Session::put('parking_booking_data', $bookingData);
        Session::put('parking_booking_user_slug', $request->route('userSlug'));

        $userSlug = $request->route('userSlug');
        $user = User::where('slug', $userSlug)->first();
        $userId = $user ? $user->id : 1;

        $company_settings = getCompanyAllSetting($userId);
        $company_currancy = !empty($company_settings['defaultCurrency']) ? $company_settings['defaultCurrency'] : 'USD';
        $supported_currencies = ['EUR', 'GBP', 'USD', 'CAD', 'AUD', 'JPY', 'INR', 'CNY', 'SGD', 'HKD', 'BRL'];

        if (!in_array($company_currancy, $supported_currencies)) {
            return redirect()->back()->with('error', __('Currency is not supported.'));
        }

        $price = floatval($request->total_amount);
        if ($price <= 0) {
            return redirect()->back()->with('error', __('Invalid payment amount.'));
        }

        try {
            $stripe_formatted_price = in_array(
                $company_currancy,
                ['MGA', 'BIF', 'CLP', 'PYG', 'DJF', 'RWF', 'GNF', 'UGX', 'JPY', 'VND', 'VUV', 'XAF', 'KMF', 'KRW', 'XOF', 'XPF', 'BRL']
            ) ? number_format($price, 2, '.', '') : number_format($price, 2, '.', '') * 100;

            $stripe_session = $this->createStripeSession([
                'api_key' => $company_settings['stripe_secret'] ?? '',
                'currency' => $company_currancy,
                'amount' => $stripe_formatted_price,
                'product_name' => 'Parking Slot - ' . $request->slot_name,
                'description' => 'Parking Management Payment',
                'metadata' => [
                    'slot_name' => $request->slot_name,
                    'customer_name' => $request->customer_name,
                    'customer_email' => $request->customer_email,
                ],
                'success_url' => route('parking.payment.stripe.status', [
                    'return_type' => 'success',
                    'userSlug' => $userSlug
                ]),
                'cancel_url' => route('parking.payment.stripe.status', [
                    'return_type' => 'cancel',
                    'userSlug' => $userSlug
                ]),
            ]);

            Session::put('parking_stripe_session', $stripe_session);

            return Inertia::render('Stripe/StripePayment', [
                'stripe_session' => $stripe_session,
                'stripe_key' => $company_settings['stripe_key'] ?? ''
            ]);
        } catch (\Exception $e) {
            return redirect()->back()->with('error', $e->getMessage());
        }
    }

    public function parkingGetStripeStatus(Request $request)
    {
        $bookingData = Session::get('parking_booking_data');
        $stripe_session = Session::get('parking_stripe_session');
        $userSlug = Session::get('parking_booking_user_slug');

        if (!$bookingData) {
            return redirect()->route('parking-management.frontend.booking', ['userSlug' => $userSlug])->with('error', __('Booking data not found.'));
        }

        $user = User::where('slug', $userSlug)->first();
        $userId = $user ? $user->id : 1;
        $company_settings = getCompanyAllSetting($userId);

        try {
            $stripe = new StripeClient(!empty($company_settings['stripe_secret']) ? $company_settings['stripe_secret'] : '');
            $payment_intent = null;
            $receipt_url = "";

            if ($stripe_session && isset($stripe_session['id'])) {
                $checkoutSession = $stripe->checkout->sessions->retrieve($stripe_session['id'], []);

                if (isset($checkoutSession->payment_intent)) {
                    $payment_intent = $checkoutSession->payment_intent;
                    $paymentIntents = $stripe->paymentIntents->retrieve($checkoutSession->payment_intent, []);
                    if (!empty($paymentIntents->latest_charge)) {
                        $charge = $stripe->charges->retrieve($paymentIntents->latest_charge, []);
                        $receipt_url = $charge->receipt_url ?? '';
                    }
                }
            }
        } catch (\Exception $exception) {
            $receipt_url = "";
        }

        Session::forget('parking_stripe_session');
        Session::forget('parking_booking_data');
        Session::forget('parking_booking_user_slug');

        try {
            if ($request->return_type == 'success') {
                $booking = new ParkingBooking();
                $booking->slot_name = $bookingData['slot_name'];
                $booking->slot_type_id = $bookingData['slot_type_id'];
                $booking->booking_date = $bookingData['date'];
                $booking->start_time = $bookingData['start_time'];
                $booking->end_time = $bookingData['end_time'];
                $booking->customer_name = $bookingData['customer_name'];
                $booking->customer_email = $bookingData['customer_email'];
                $booking->customer_phone = $bookingData['customer_phone'];
                $booking->vehicle_name = $bookingData['vehicle_name'];
                $booking->vehicle_number = $bookingData['vehicle_number'];
                $booking->total_amount = $bookingData['total_amount'];
                $booking->payment_method = 'stripe';
                $booking->payment_status = 'paid';
                $booking->booking_status = 'confirmed';
                $booking->creator_id = $userId;
                $booking->created_by = $userId;
                $booking->save();

                try {
                    ParkingBookingPaymentStripe::dispatch($booking);

                } catch (\Throwable $th) {
                    return back()->with('error', $th->getMessage());
                }

                return redirect()->route('parking-management.frontend.booking-success', ['userSlug' => $userSlug, 'id' => \Illuminate\Support\Facades\Crypt::encrypt($booking->id)])
                    ->with('success', __('Payment completed and booking confirmed successfully!'));
            } else {
                return redirect()->route('parking-management.frontend.booking', ['userSlug' => $userSlug])->with('error', __('Payment was cancelled.'));
            }
        } catch (\Exception $exception) {
            return redirect()->route('parking-management.frontend.booking', ['userSlug' => $userSlug])->with('error', $exception->getMessage());
        }
    }

    public function eventsPayWithStripe(Request $request)
    {
        $userSlug = $request->route('userSlug');
        $user = User::where('slug', $userSlug)->first();
        if (!$user) {
            return redirect()->back()->with('error', __('User not found.'));
        }

        $eventId = $request->event_id;
        $event = Event::where('id', $eventId)
            ->where('created_by', $user->id)
            ->firstOrFail();

        // Store booking data in session
        $bookingData = [
            'event_id' => $eventId,
            'fullName' => $request->fullName,
            'email' => $request->email,
            'phone' => $request->phone,
            'persons' => $request->persons,
            'total' => $request->total,
            'ticket_type_id' => $request->ticket_type_id,
            'time_slot' => $request->time_slot,
            'selected_date' => $request->selected_date
        ];

        Session::put('events_booking_data', $bookingData);
        Session::put('events_user_slug', $userSlug);

        $company_settings = getCompanyAllSetting($user->id);
        $company_currancy = !empty($company_settings['defaultCurrency']) ? $company_settings['defaultCurrency'] : 'USD';
        $supported_currencies = ['EUR', 'GBP', 'USD', 'CAD', 'AUD', 'JPY', 'INR', 'CNY', 'SGD', 'HKD', 'BRL'];

        if (!in_array($company_currancy, $supported_currencies)) {
            return redirect()->back()->with('error', __('Currency is not supported.'));
        }

        $price = floatval($request->total);
        if ($price <= 0) {
            return redirect()->back()->with('error', __('Invalid payment amount.'));
        }

        try {
            $stripe_formatted_price = in_array(
                $company_currancy,
                ['MGA', 'BIF', 'CLP', 'PYG', 'DJF', 'RWF', 'GNF', 'UGX', 'JPY', 'VND', 'VUV', 'XAF', 'KMF', 'KRW', 'XOF', 'XPF', 'BRL']
            ) ? number_format($price, 2, '.', '') : number_format($price, 2, '.', '') * 100;

            $stripe_session = $this->createStripeSession([
                'api_key' => $company_settings['stripe_secret'] ?? '',
                'currency' => $company_currancy,
                'amount' => $stripe_formatted_price,
                'product_name' => $event->title ?? 'Event Booking',
                'description' => 'Event Booking Payment',
                'metadata' => [
                    'event_id' => $eventId,
                    'customer_name' => $request->fullName,
                    'customer_email' => $request->email,
                ],
                'success_url' => route('events-management.payment.stripe.status', [
                    'return_type' => 'success',
                    'userSlug' => $userSlug
                ]),
                'cancel_url' => route('events-management.payment.stripe.status', [
                    'return_type' => 'cancel',
                    'userSlug' => $userSlug
                ]),
            ]);

            Session::put('events_stripe_session', $stripe_session);

            return Inertia::render('Stripe/StripePayment', [
                'stripe_session' => $stripe_session,
                'stripe_key' => $company_settings['stripe_key'] ?? ''
            ]);
        } catch (\Exception $e) {
            return redirect()->back()->with('error', $e->getMessage());
        }
    }

    public function eventsGetStripeStatus(Request $request)
    {
        $bookingData = Session::get('events_booking_data');
        $stripe_session = Session::get('events_stripe_session');
        $userSlug = Session::get('events_user_slug');
        if (!$bookingData) {
            return redirect()->route('events-management.frontend.index', ['userSlug' => $userSlug])->with('error', __('Booking data not found.'));
        }

        $user = User::where('slug', $userSlug)->first();
        $event = Event::where('id', $bookingData['event_id'])
            ->where('created_by', $user->id)
            ->first();

        $company_settings = getCompanyAllSetting($user->id);

        try {
            $stripe = new StripeClient(!empty($company_settings['stripe_secret']) ? $company_settings['stripe_secret'] : '');
            $payment_intent = null;
            $receipt_url = "";

            if ($stripe_session && isset($stripe_session['id'])) {
                $checkoutSession = $stripe->checkout->sessions->retrieve($stripe_session['id'], []);

                if (isset($checkoutSession->payment_intent)) {
                    $payment_intent = $checkoutSession->payment_intent;
                    $paymentIntents = $stripe->paymentIntents->retrieve($checkoutSession->payment_intent, []);
                    if (!empty($paymentIntents->latest_charge)) {
                        $charge = $stripe->charges->retrieve($paymentIntents->latest_charge, []);
                        $receipt_url = $charge->receipt_url ?? '';
                    }
                }
            }
        } catch (\Exception $exception) {
            $receipt_url = "";
        }

        Session::forget('events_stripe_session');
        Session::forget('events_booking_data');
        Session::forget('events_user_slug');
        try {
            if ($request->return_type == 'success') {
                // Create event booking
                $eventbooking = new EventBooking();
                $eventbooking->event_id = $bookingData['event_id'];
                $eventbooking->ticket_type_id = $bookingData['ticket_type_id'];
                $eventbooking->time_slot = $bookingData['time_slot'];
                $eventbooking->name = $bookingData['fullName'];
                $eventbooking->email = $bookingData['email'];
                $eventbooking->mobile = $bookingData['phone'];
                $eventbooking->person = $bookingData['persons'];
                $eventbooking->date = $bookingData['selected_date'];
                $eventbooking->total_price = $bookingData['total'];
                $eventbooking->price = $bookingData['total'] / $bookingData['persons'];
                $eventbooking->status = 'confirmed';
                $eventbooking->created_by = $user->id;
                $eventbooking->creator_id = $user->id;
                $eventbooking->save();

                // Create payment record
                $eventBookingPayment = new EventBookingPayment();
                $eventBookingPayment->event_booking_id = $eventbooking->id;
                $eventBookingPayment->booking_number = $eventbooking->booking_number;
                $eventBookingPayment->event_name = $event->title;
                $eventBookingPayment->customer_name = $bookingData['fullName'];
                $eventBookingPayment->payment_date = now();
                $eventBookingPayment->amount = $bookingData['total'];
                $eventBookingPayment->payment_status = 'cleared';
                $eventBookingPayment->payment_type = 'Stripe';
                $eventBookingPayment->description = 'Payment via Stripe';
                $eventBookingPayment->created_by = $user->id;
                $eventBookingPayment->creator_id = $user->id;
                $eventBookingPayment->save();

                return redirect()->route('events-management.frontend.ticket', ['userSlug' => $userSlug, 'id' => $eventbooking->id, 'paymentId' => $eventBookingPayment->id])
                    ->with('success', __('Payment completed and booking confirmed successfully!'));
            } else {
                return redirect()->route('events-management.frontend.payment', ['userSlug' => $userSlug, 'id' => $bookingData['event_id']])
                    ->with('error', __('Payment was cancelled.'));
            }
        } catch (\Exception $exception) {
            return redirect()->route('events-management.frontend.payment', ['userSlug' => $userSlug, 'id' => $bookingData['event_id']])->with('error', $exception->getMessage());
        }
    }
}
