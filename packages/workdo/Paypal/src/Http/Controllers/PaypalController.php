<?php

namespace Workdo\Paypal\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\Coupon;
use Illuminate\Http\Request;
use App\Models\User;
use App\Models\Plan;
use App\Models\Order;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Session;
use Workdo\Paypal\Events\PaypalPaymentStatus;
use Inertia\Inertia;
use Srmklive\PayPal\Services\PayPal as PayPalClient;
use Workdo\Bookings\Models\BookingAppointment;
use Workdo\Bookings\Models\BookingPackage;
use Workdo\Bookings\Models\BookingCustomer;

use Workdo\LMS\Models\LMSCart;
use Workdo\LMS\Models\LMSOrder;
use Workdo\LMS\Models\LMSOrderItem;
use Workdo\LMS\Models\LMSCoupon;
use Illuminate\Support\Facades\Log;
use Workdo\BeautySpaManagement\Models\BeautyBooking;
use Workdo\BeautySpaManagement\Models\BeautyService;
use Workdo\BeautySpaManagement\Models\BeautyBookingReceipt;
use Workdo\ParkingManagement\Models\ParkingBooking;
use Workdo\Paypal\Events\BeautyBookingPaymentPaypal;
use Workdo\Paypal\Events\ParkingBookingPaymentPaypal;
use Workdo\Paypal\Events\LaundryBookingPaymentPaypal;
use Workdo\EventsManagement\Models\Event;
use Workdo\EventsManagement\Models\EventBooking;
use Workdo\EventsManagement\Models\EventBookingPayment;

class PaypalController extends Controller
{
    /**
     * Create PayPal order with reusable parameters
     */
    private function createPaypalOrder($provider, $routeParams, $currency, $price, $routeName)
    {
        return $provider->createOrder([
            "intent" => "CAPTURE",
            "application_context" => [
                "return_url" => route($routeName, $routeParams),
                "cancel_url" => route($routeName, $routeParams),
            ],
            "purchase_units" => [
                0 => [
                    "amount" => [
                        "currency_code" => $currency,
                        "value" => $price,
                    ]
                ]
            ]
        ]);
    }
    public function planPayWithPaypal(Request $request)
    {
        $plan = Plan::find($request->plan_id);
        $user = User::find($request->user_id);
        $admin_settings = getAdminAllSetting();
        $admin_currancy = !empty($admin_settings['defaultCurrency']) ? $admin_settings['defaultCurrency'] : 'USD';

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
        if ($admin_settings['paypal_mode'] == 'live') {
            config(
                [
                    'paypal.live.client_id' => isset($admin_settings['paypal_client_id']) ? $admin_settings['paypal_client_id'] : '',
                    'paypal.live.client_secret' => isset($admin_settings['paypal_secret_key']) ? $admin_settings['paypal_secret_key'] : '',
                    'paypal.mode' => isset($admin_settings['paypal_mode']) ? $admin_settings['paypal_mode'] : '',
                ]
            );
        } else {
            config(
                [
                    'paypal.sandbox.client_id' => isset($admin_settings['paypal_client_id']) ? $admin_settings['paypal_client_id'] : '',
                    'paypal.sandbox.client_secret' => isset($admin_settings['paypal_secret_key']) ? $admin_settings['paypal_secret_key'] : '',
                    'paypal.mode' => isset($admin_settings['paypal_mode']) ? $admin_settings['paypal_mode'] : '',
                ]
            );
        }
        $provider = new PayPalClient;
        $provider->setApiCredentials(config('paypal'));

        if ($plan) {
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
            $provider->getAccessToken();

            $routeParams = [
                $plan->id,
                'amount' => $price,
                'user_module' => $user_module,
                'counter' => $counter,
                'duration' => $duration,
                'coupon_code' => $request->coupon_code,
            ];
            $routeName = 'payment.paypal.status';
            $response = $this->createPaypalOrder($provider, $routeParams, $admin_currancy, $price,$routeName);

            if (isset($response['id']) && $response['id'] != null) {
                // redirect to approve href
                foreach ($response['links'] as $links) {
                    if ($links['rel'] == 'approve') {
                        return redirect()->away($links['href']);
                    }
                }
                return redirect()
                    ->route('plans.index', \Illuminate\Support\Facades\Crypt::encrypt($plan->id))
                    ->with('error', 'Something went wrong. OR Unknown error occurred');
            } else {
                return redirect()
                    ->route('plans.index', \Illuminate\Support\Facades\Crypt::encrypt($plan->id))
                    ->with('error', $response['message'] ?? 'Something went wrong.');
            }
        } else {
            return redirect()->route('plans.index')->with('error', __('Plan is deleted.'));
        }
    }

    public function planGetPaypalStatus(Request $request, $plan_id)
    {
        $user = Auth::user();
        $plan = Plan::find($plan_id);
        if ($plan) {
            $admin_settings = getAdminAllSetting();
            if ($admin_settings['paypal_mode'] == 'live') {
                config(
                    [
                        'paypal.live.client_id' => isset($admin_settings['paypal_client_id']) ? $admin_settings['paypal_client_id'] : '',
                        'paypal.live.client_secret' => isset($admin_settings['paypal_secret_key']) ? $admin_settings['paypal_secret_key'] : '',
                        'paypal.mode' => isset($admin_settings['paypal_mode']) ? $admin_settings['paypal_mode'] : '',
                    ]
                );
            } else {
                config(
                    [
                        'paypal.sandbox.client_id' => isset($admin_settings['paypal_client_id']) ? $admin_settings['paypal_client_id'] : '',
                        'paypal.sandbox.client_secret' => isset($admin_settings['paypal_secret_key']) ? $admin_settings['paypal_secret_key'] : '',
                        'paypal.mode' => isset($admin_settings['paypal_mode']) ? $admin_settings['paypal_mode'] : '',
                    ]
                );
            }
            $admin_currancy = !empty($admin_settings['defaultCurrency']) ? $admin_settings['defaultCurrency'] : 'USD';

            $provider = new PayPalClient;
            $provider->setApiCredentials(config('paypal'));
            $provider->getAccessToken();
            $response = $provider->capturePaymentOrder($request['token']);

            $orderID = strtoupper(substr(uniqid(), -12));
            try {
                $order = Order::create(
                    [
                        'order_id' => $orderID,
                        'name' => null,
                        'email' => null,
                        'card_number' => null,
                        'card_exp_month' => null,
                        'card_exp_year' => null,
                        'plan_name' => !empty($plan->name) ? $plan->name : 'Basic Package',
                        'plan_id' => $plan->id,
                        'price' => !empty($request->amount) ? $request->amount : 0,
                        'currency' => $admin_currancy,
                        'txn_id' => '',
                        'payment_type' => 'Paypal',
                        'payment_status' => 'succeeded',
                        'receipt' => null,
                        'created_by' => $user->id,
                    ]
                );
                $type = 'Subscription';
                $user = User::find($user->id);
                $counter = [
                    'user_counter' => -1,
                    'storage_counter' => 0,
                ];
                $assignPlan = assignPlan($plan->id, $request->duration, $request->user_module, $counter, $user->id);
                if ($request->coupon_code) {
                    $coupon = Coupon::where('code', $request->coupon_code)->first();
                    if ($coupon) {
                        recordCouponUsage($coupon->id, $user->id, $orderID);
                    }
                }
                $value = Session::get('user-module-selection');

                PaypalPaymentStatus::dispatch($plan, $type, $order);

                if (!empty($value)) {
                    Session::forget('user-module-selection');
                }

                if ($assignPlan['is_success']) {
                    return redirect()->route('plans.index')->with('success', __('Plan activated Successfully.'));
                } else {
                    return redirect()->route('plans.index')->with('error', __($assignPlan['error']));
                }
            } catch (\Exception $e) {
                return redirect()->route('plans.index')->with('error', __('Transaction has been failed.'));
            }
        } else {
            return redirect()->route('plans.index')->with('error', __('Plan is deleted.'));
        }
    }

    public function bookingPayWithPaypal(Request $request)
    {
        $userSlug = $request->route('userSlug');
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
            return redirect()->route('booking.home', ['userSlug' => $userSlug])->with('error', __('Package not found.'));
        }

        $company_settings = getCompanyAllSetting($package->created_by);
        $company_currancy = !empty($company_settings['defaultCurrency']) ? $company_settings['defaultCurrency'] : 'USD';

        $price = $package->price ?? 0;
        if ($price <= 0) {
            return redirect()->route('booking.home', ['userSlug' => $userSlug])->with('error', __('Invalid payment amount.'));
        }

        // Configure PayPal
        if ($company_settings['paypal_mode'] == 'live') {
            config([
                'paypal.live.client_id' => $company_settings['paypal_client_id'] ?? '',
                'paypal.live.client_secret' => $company_settings['paypal_secret_key'] ?? '',
                'paypal.mode' => $company_settings['paypal_mode'] ?? '',
            ]);
        } else {
            config([
                'paypal.sandbox.client_id' => $company_settings['paypal_client_id'] ?? '',
                'paypal.sandbox.client_secret' => $company_settings['paypal_secret_key'] ?? '',
                'paypal.mode' => $company_settings['paypal_mode'] ?? '',
            ]);
        }

        $provider = new PayPalClient;
        $provider->setApiCredentials(config('paypal'));
        $provider->getAccessToken();

        $routeParams = [
            'return_type' => 'success',
            'userSlug' => $request->route('userSlug')
        ];
        $routeName = 'booking.payment.paypal.status';
        $response = $this->createPaypalOrder($provider, $routeParams, $company_currancy, $price, $routeName);

        if (isset($response['id']) && $response['id'] != null) {
            // Store PayPal order ID in session
            Session::put('paypal_order_id', $response['id']);

            // redirect to approve href
            foreach ($response['links'] as $links) {
                if ($links['rel'] == 'approve') {
                    return redirect()->away($links['href']);
                }
            }
            return redirect()->route('booking.home', ['userSlug' => $userSlug])->with('error', 'Something went wrong. OR Unknown error occurred');
        } else {
            return redirect()->route('booking.home', ['userSlug' => $userSlug])->with('error', $response['message'] ?? 'Something went wrong.');
        }
    }

    public function bookingGetPaypalStatus(Request $request)
    {
        $bookingData = Session::get('booking_data');
        $userSlug = $request->route('userSlug');
        $paypalOrderId = Session::get('paypal_order_id');

        if (!$bookingData) {
            return redirect()->route('booking.home', ['userSlug' => $userSlug])->with('error', __('Booking data not found.'));
        }

        $package = BookingPackage::find($bookingData['selectedPackageItem']);
        $company_settings = getCompanyAllSetting($package->created_by ?? 1);

        // Configure PayPal
        if ($company_settings['paypal_mode'] == 'live') {
            config([
                'paypal.live.client_id' => $company_settings['paypal_client_id'] ?? '',
                'paypal.live.client_secret' => $company_settings['paypal_secret_key'] ?? '',
                'paypal.mode' => $company_settings['paypal_mode'] ?? '',
            ]);
        } else {
            config([
                'paypal.sandbox.client_id' => $company_settings['paypal_client_id'] ?? '',
                'paypal.sandbox.client_secret' => $company_settings['paypal_secret_key'] ?? '',
                'paypal.mode' => $company_settings['paypal_mode'] ?? '',
            ]);
        }

        $provider = new PayPalClient;
        $provider->setApiCredentials(config('paypal'));
        $provider->getAccessToken();

        Session::forget('booking_data');
        Session::forget('booking_user_slug');
        Session::forget('paypal_order_id');

        try {
            if ($request->return_type == 'success' && $request->token) {
                $response = $provider->capturePaymentOrder($request->token);

                if (isset($response['status']) && $response['status'] == 'COMPLETED') {
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
                        'payment' => 'paypal',
                        'payment_status' => 'paid',
                        'payment_receipt' => null,
                        'online_payment_id' => $response['purchase_units'][0]['payments']['captures'][0]['id'] ?? null,
                        'status' => 'pending',
                        'created_by' => $userId,
                        'creator_id' => $userId,
                    ]);

                    return redirect()->route('booking.home', ['userSlug' => $userSlug])->with('success', __('Payment completed and appointment created successfully!'));
                } else {
                    return redirect()->route('booking.home', ['userSlug' => $userSlug])->with('error', __('Payment failed.'));
                }
            } else {
                return redirect()->route('booking.home', ['userSlug' => $userSlug])->with('error', __('Payment was cancelled.'));
            }
        } catch (\Exception $exception) {
            return redirect()->route('booking.home', ['userSlug' => $userSlug])->with('error', $exception->getMessage());
        }
    }


    public function beautySpaPayWithPaypal(Request $request)
    {
        $userSlug = $request->route('userSlug');
        $user = User::where('slug', $userSlug)->first();
        $userId = $user ? $user->id : 1;

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
        Session::put('beauty_booking_user_slug', $userSlug);

        $service = BeautyService::where('id', $request->service)
            ->where('created_by', $userId)
            ->first();

        if (!$service) {
            return redirect()->route('beauty-spa.booking', ['userSlug' => $userSlug])->with('error', __('Service not found.'));
        }

        $company_settings = getCompanyAllSetting($userId);
        $company_currancy = !empty($company_settings['defaultCurrency']) ? $company_settings['defaultCurrency'] : 'USD';

        $price = $service->price * $request->person;

        if ($price <= 0) {
            return redirect()->route('beauty-spa.booking', ['userSlug' => $userSlug])->with('error', __('Invalid payment amount.'));
        }

        // Configure PayPal
        if ($company_settings['paypal_mode'] == 'live') {
            config([
                'paypal.live.client_id' => $company_settings['paypal_client_id'] ?? '',
                'paypal.live.client_secret' => $company_settings['paypal_secret_key'] ?? '',
                'paypal.mode' => $company_settings['paypal_mode'] ?? '',
            ]);
        } else {
            config([
                'paypal.sandbox.client_id' => $company_settings['paypal_client_id'] ?? '',
                'paypal.sandbox.client_secret' => $company_settings['paypal_secret_key'] ?? '',
                'paypal.mode' => $company_settings['paypal_mode'] ?? '',
            ]);
        }

        $provider = new PayPalClient;
        $provider->setApiCredentials(config('paypal'));
        $provider->getAccessToken();

        $routeParams = [
            'return_type' => 'success',
            'userSlug' => $userSlug
        ];
        $routeName = 'beauty-spa.payment.paypal.status';
        $response = $this->createPaypalOrder($provider, $routeParams, $company_currancy, $price, $routeName);

        if (isset($response['id']) && $response['id'] != null) {
            Session::put('beauty_paypal_order_id', $response['id']);

            foreach ($response['links'] as $links) {
                if ($links['rel'] == 'approve') {
                    return redirect()->away($links['href']);
                }
            }
            return redirect()->route('beauty-spa.booking', ['userSlug' => $userSlug])->with('error', 'Something went wrong.');
        } else {
            return redirect()->route('beauty-spa.booking', ['userSlug' => $userSlug])->with('error', $response['message'] ?? 'Something went wrong.');
        }
    }

    public function beautySpaGetPaypalStatus(Request $request)
    {
        $bookingData = Session::get('beauty_booking_data');
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

        // Configure PayPal
        if ($company_settings['paypal_mode'] == 'live') {
            config([
                'paypal.live.client_id' => $company_settings['paypal_client_id'] ?? '',
                'paypal.live.client_secret' => $company_settings['paypal_secret_key'] ?? '',
                'paypal.mode' => $company_settings['paypal_mode'] ?? '',
            ]);
        } else {
            config([
                'paypal.sandbox.client_id' => $company_settings['paypal_client_id'] ?? '',
                'paypal.sandbox.client_secret' => $company_settings['paypal_secret_key'] ?? '',
                'paypal.mode' => $company_settings['paypal_mode'] ?? '',
            ]);
        }

        $provider = new PayPalClient;
        $provider->setApiCredentials(config('paypal'));
        $provider->getAccessToken();
        $response = $provider->capturePaymentOrder($request['token']);
        try {
            if (isset($response['status']) && $response['status'] == 'COMPLETED') {
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
                    $booking->payment_option = 'Paypal';
                    $booking->payment_status = 'paid';
                    $booking->stage_id = 0;
                    $booking->creator_id = null;
                    $booking->created_by = $userId;
                    $booking->save();

                    $beautyreceipt = new BeautyBookingReceipt();
                    $beautyreceipt->beauty_booking_id = $booking->id;
                    $beautyreceipt->name = $booking->name;
                    $beautyreceipt->service = $booking->service;
                    $beautyreceipt->number = $booking->phone_number;
                    $beautyreceipt->gender = $booking->gender;
                    $beautyreceipt->start_time = $booking->start_time;
                    $beautyreceipt->end_time = $booking->end_time;
                    $beautyreceipt->price = $booking->price;
                    $beautyreceipt->payment_type = 'Paypal';
                    $beautyreceipt->created_by = $booking->created_by;
                    $beautyreceipt->save();

                try {
                    BeautyBookingPaymentPaypal::dispatch($booking);
                } catch (\Throwable $th) {
                   return back()->with('error', $th->getMessage());
                }

                    return redirect()->route('beauty-spa.booking-success', ['userSlug' => $userSlug, 'id' => \Illuminate\Support\Facades\Crypt::encrypt($booking->id)])
                        ->with('success', __('Payment completed and booking confirmed successfully!'));
                Session::forget('beauty_booking_data');
                Session::forget('beauty_booking_user_slug');
                Session::forget('beauty_paypal_order_id');

                return redirect()->route('beauty-spa.booking-success', ['userSlug' => $userSlug, 'id' => \Illuminate\Support\Facades\Crypt::encrypt($booking->id)])
                    ->with('success', __('Payment completed and booking confirmed successfully!'));
            } else {
                return redirect()->route('beauty-spa.booking', ['userSlug' => $userSlug])->with('error', __('Payment failed.'));
            }
        } catch (\Exception $exception) {
            return redirect()->route('beauty-spa.booking', ['userSlug' => $userSlug])->with('error', __('Transaction has been failed.'));
        }
    }

    public function lmsPayWithPaypal(Request $request)
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
            'payment_method' => $request->payment_method,
            'payment_note' => $request->payment_note,
            'original_total' => $originalTotal,
            'subtotal' => $subtotal,
            'course_discount' => $courseDiscount,
            'coupon_discount' => $couponDiscount,
            'total' => $total,
            'applied_coupon' => $appliedCoupon
        ]);
        Session::put('lms_user_slug', $userSlug);

        $company_settings = getCompanyAllSetting($user->id);
        $company_currancy = !empty($company_settings['defaultCurrency']) ? $company_settings['defaultCurrency'] : 'USD';

        // Configure PayPal
        if ($company_settings['paypal_mode'] == 'live') {
            config([
                'paypal.live.client_id' => $company_settings['paypal_client_id'] ?? '',
                'paypal.live.client_secret' => $company_settings['paypal_secret_key'] ?? '',
                'paypal.mode' => $company_settings['paypal_mode'] ?? '',
            ]);
        } else {
            config([
                'paypal.sandbox.client_id' => $company_settings['paypal_client_id'] ?? '',
                'paypal.sandbox.client_secret' => $company_settings['paypal_secret_key'] ?? '',
                'paypal.mode' => $company_settings['paypal_mode'] ?? '',
            ]);
        }

        $provider = new PayPalClient;
        $provider->setApiCredentials(config('paypal'));
        $provider->getAccessToken();

        $routeParams = [
            'return_type' => 'success',
            'userSlug' => $userSlug
        ];
        $routeName = 'lms.payment.paypal.status';
        $response = $this->createPaypalOrder($provider, $routeParams, $company_currancy, $total, $routeName);

        if (isset($response['id']) && $response['id'] != null) {
            Session::put('lms_paypal_order_id', $response['id']);

            foreach ($response['links'] as $links) {
                if ($links['rel'] == 'approve') {
                    return redirect()->away($links['href']);
                }
            }
            return redirect()->route('lms.frontend.checkout', ['userSlug' => $userSlug])->with('error', 'Something went wrong. OR Unknown error occurred');
        } else {
            return redirect()->route('lms.frontend.checkout', ['userSlug' => $userSlug])->with('error', $response['message'] ?? 'Something went wrong.');
        }
    }

    public function lmsGetPaypalStatus(Request $request)
    {
        $orderData = Session::get('lms_order_data');
        $userSlug = Session::get('lms_user_slug');
        $paypalOrderId = Session::get('lms_paypal_order_id');

        if (!$orderData) {
            return redirect()->route('lms.frontend.home', ['userSlug' => $userSlug])->with('error', __('Order data not found.'));
        }

        $user = User::where('slug', $userSlug)->first();
        $student = auth('lms_student')->user();

        if (!$user || !$student) {
            return redirect()->route('lms.frontend.home', ['userSlug' => $userSlug])->with('error', __('Invalid session.'));
        }

        $company_settings = getCompanyAllSetting($user->id);

        // Configure PayPal
        if ($company_settings['paypal_mode'] == 'live') {
            config([
                'paypal.live.client_id' => $company_settings['paypal_client_id'] ?? '',
                'paypal.live.client_secret' => $company_settings['paypal_secret_key'] ?? '',
                'paypal.mode' => $company_settings['paypal_mode'] ?? '',
            ]);
        } else {
            config([
                'paypal.sandbox.client_id' => $company_settings['paypal_client_id'] ?? '',
                'paypal.sandbox.client_secret' => $company_settings['paypal_secret_key'] ?? '',
                'paypal.mode' => $company_settings['paypal_mode'] ?? '',
            ]);
        }

        $provider = new PayPalClient;
        $provider->setApiCredentials(config('paypal'));
        $provider->getAccessToken();

        Session::forget('lms_order_data');
        Session::forget('lms_user_slug');
        Session::forget('lms_paypal_order_id');

        try {
            if ($request->return_type == 'success' && $request->token) {
                $response = $provider->capturePaymentOrder($request->token);

                if (isset($response['status']) && $response['status'] == 'COMPLETED') {
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
                        'payment_method' => 'paypal',
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
                        'notes' => $orderData['payment_note'],
                        'order_date' => now(),
                        'payment_id' => $response['purchase_units'][0]['payments']['captures'][0]['id'] ?? null,
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
                        ->with('error', __('Payment failed.'));
                }
            } else {
                return redirect()->route('lms.frontend.checkout', ['userSlug' => $userSlug])
                    ->with('error', __('Payment was cancelled.'));
            }
        } catch (\Exception $exception) {
            return redirect()->route('lms.frontend.checkout', ['userSlug' => $userSlug])
                ->with('error', $exception->getMessage());
        }
    }

    public function parkingPayWithPaypal(Request $request)
    {
        $userSlug = $request->route('userSlug');
        $user = User::where('slug', $userSlug)->first();
        $userId = $user ? $user->id : 1;

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
        Session::put('parking_booking_user_slug', $userSlug);

        $company_settings = getCompanyAllSetting($userId);
        $company_currancy = !empty($company_settings['defaultCurrency']) ? $company_settings['defaultCurrency'] : 'USD';

        $price = floatval($request->total_amount);
        if ($price <= 0) {
            return redirect()->route('parking-management.frontend.booking', ['userSlug' => $userSlug])->with('error', __('Invalid payment amount.'));
        }

        // Configure PayPal
        if ($company_settings['paypal_mode'] == 'live') {
            config([
                'paypal.live.client_id' => $company_settings['paypal_client_id'] ?? '',
                'paypal.live.client_secret' => $company_settings['paypal_secret_key'] ?? '',
                'paypal.mode' => $company_settings['paypal_mode'] ?? '',
            ]);
        } else {
            config([
                'paypal.sandbox.client_id' => $company_settings['paypal_client_id'] ?? '',
                'paypal.sandbox.client_secret' => $company_settings['paypal_secret_key'] ?? '',
                'paypal.mode' => $company_settings['paypal_mode'] ?? '',
            ]);
        }

        $provider = new PayPalClient;
        $provider->setApiCredentials(config('paypal'));
        $provider->getAccessToken();

        $routeParams = [
            'return_type' => 'success',
            'userSlug' => $userSlug
        ];
        $routeName = 'parking.payment.paypal.status';
        $response = $this->createPaypalOrder($provider, $routeParams, $company_currancy, $price, $routeName);

        if (isset($response['id']) && $response['id'] != null) {
            Session::put('parking_paypal_order_id', $response['id']);

            foreach ($response['links'] as $links) {
                if ($links['rel'] == 'approve') {
                    return redirect()->away($links['href']);
                }
            }
            return redirect()->route('parking-management.frontend.booking', ['userSlug' => $userSlug])->with('error', 'Something went wrong.');
        } else {
            return redirect()->route('parking-management.frontend.booking', ['userSlug' => $userSlug])->with('error', $response['message'] ?? 'Something went wrong.');
        }
    }

    public function parkingGetPaypalStatus(Request $request)
    {
        $bookingData = Session::get('parking_booking_data');
        $userSlug = Session::get('parking_booking_user_slug');

        if (!$bookingData) {
            return redirect()->route('parking-management.frontend.booking', ['userSlug' => $userSlug])->with('error', __('Booking data not found.'));
        }

        $user = User::where('slug', $userSlug)->first();
        $userId = $user ? $user->id : 1;
        $company_settings = getCompanyAllSetting($userId);

        // Configure PayPal
        if ($company_settings['paypal_mode'] == 'live') {
            config([
                'paypal.live.client_id' => $company_settings['paypal_client_id'] ?? '',
                'paypal.live.client_secret' => $company_settings['paypal_secret_key'] ?? '',
                'paypal.mode' => $company_settings['paypal_mode'] ?? '',
            ]);
        } else {
            config([
                'paypal.sandbox.client_id' => $company_settings['paypal_client_id'] ?? '',
                'paypal.sandbox.client_secret' => $company_settings['paypal_secret_key'] ?? '',
                'paypal.mode' => $company_settings['paypal_mode'] ?? '',
            ]);
        }

        $provider = new PayPalClient;
        $provider->setApiCredentials(config('paypal'));
        $provider->getAccessToken();

        Session::forget('parking_booking_data');
        Session::forget('parking_booking_user_slug');
        Session::forget('parking_paypal_order_id');

        try {
            if ($request->return_type == 'success' && $request->token) {
                $response = $provider->capturePaymentOrder($request->token);

                if (isset($response['status']) && $response['status'] == 'COMPLETED') {
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
                    $booking->payment_method = 'paypal';
                    $booking->payment_status = 'paid';
                    $booking->booking_status = 'confirmed';
                    $booking->creator_id = $userId;
                    $booking->created_by = $userId;
                    $booking->save();

                    try {
                        ParkingBookingPaymentPaypal::dispatch($booking);
                    } catch (\Throwable $th) {
                        return back()->with('error', $th->getMessage());
                    }

                    return redirect()->route('parking-management.frontend.booking-success', ['userSlug' => $userSlug, 'id' => \Illuminate\Support\Facades\Crypt::encrypt($booking->id)])
                        ->with('success', __('Payment completed and booking confirmed successfully!'));
                } else {
                    return redirect()->route('parking-management.frontend.booking', ['userSlug' => $userSlug])->with('error', __('Payment failed.'));
                }
            } else {
                return redirect()->route('parking-management.frontend.booking', ['userSlug' => $userSlug])->with('error', __('Payment was cancelled.'));
            }
        } catch (\Exception $exception) {
            return redirect()->route('parking-management.frontend.booking', ['userSlug' => $userSlug])->with('error', __('Transaction has been failed.'));
        }
    }

    public function laundryPayWithPaypal(Request $request)
    {
        $userSlug = $request->route('userSlug');
        $user = User::where('slug', $userSlug)->first();
        $userId = $user ? $user->id : 1;

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
        Session::put('laundry_booking_user_slug', $userSlug);

        $company_settings = getCompanyAllSetting($userId);
        $company_currancy = !empty($company_settings['defaultCurrency']) ? $company_settings['defaultCurrency'] : 'USD';

        $price = floatval($request->total ?? 0);
        if ($price <= 0) {
            return redirect()->route('laundry-management.frontend.booking', ['userSlug' => $userSlug])->with('error', __('Invalid payment amount.'));
        }

        // Configure PayPal
        if ($company_settings['paypal_mode'] == 'live') {
            config([
                'paypal.live.client_id' => $company_settings['paypal_client_id'] ?? '',
                'paypal.live.client_secret' => $company_settings['paypal_secret_key'] ?? '',
                'paypal.mode' => $company_settings['paypal_mode'] ?? '',
            ]);
        } else {
            config([
                'paypal.sandbox.client_id' => $company_settings['paypal_client_id'] ?? '',
                'paypal.sandbox.client_secret' => $company_settings['paypal_secret_key'] ?? '',
                'paypal.mode' => $company_settings['paypal_mode'] ?? '',
            ]);
        }

        $provider = new PayPalClient;
        $provider->setApiCredentials(config('paypal'));
        $provider->getAccessToken();

        $routeParams = [
            'return_type' => 'success',
            'userSlug' => $userSlug
        ];
        $routeName = 'laundry.payment.paypal.status';
        $response = $this->createPaypalOrder($provider, $routeParams, $company_currancy, $price, $routeName);

        if (isset($response['id']) && $response['id'] != null) {
            Session::put('laundry_paypal_order_id', $response['id']);

            foreach ($response['links'] as $links) {
                if ($links['rel'] == 'approve') {
                    return redirect()->away($links['href']);
                }
            }
            return redirect()->route('laundry-management.frontend.booking', ['userSlug' => $userSlug])->with('error', 'Something went wrong.');
        } else {
            return redirect()->route('laundry-management.frontend.booking', ['userSlug' => $userSlug])->with('error', $response['message'] ?? 'Something went wrong.');
        }
    }

    public function laundryGetPaypalStatus(Request $request)
    {
        $bookingData = Session::get('laundry_booking_data');
        $userSlug = Session::get('laundry_booking_user_slug');

        if (!$bookingData) {
            return redirect()->route('laundry-management.frontend.booking', ['userSlug' => $userSlug])->with('error', __('Booking data not found.'));
        }

        $user = User::where('slug', $userSlug)->first();
        $userId = $user ? $user->id : 1;
        $company_settings = getCompanyAllSetting($userId);

        // Configure PayPal
        if ($company_settings['paypal_mode'] == 'live') {
            config([
                'paypal.live.client_id' => $company_settings['paypal_client_id'] ?? '',
                'paypal.live.client_secret' => $company_settings['paypal_secret_key'] ?? '',
                'paypal.mode' => $company_settings['paypal_mode'] ?? '',
            ]);
        } else {
            config([
                'paypal.sandbox.client_id' => $company_settings['paypal_client_id'] ?? '',
                'paypal.sandbox.client_secret' => $company_settings['paypal_secret_key'] ?? '',
                'paypal.mode' => $company_settings['paypal_mode'] ?? '',
            ]);
        }

        $provider = new PayPalClient;
        $provider->setApiCredentials(config('paypal'));
        $provider->getAccessToken();

        Session::forget('laundry_booking_data');
        Session::forget('laundry_booking_user_slug');
        Session::forget('laundry_paypal_order_id');

        try {
            if ($request->return_type == 'success' && $request->token) {
                $response = $provider->capturePaymentOrder($request->token);

                if (isset($response['status']) && $response['status'] == 'COMPLETED') {
                    $booking = new \Workdo\LaundryManagement\Models\LaundryRequest();
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
                    $booking->payment_id = $response['purchase_units'][0]['payments']['captures'][0]['id'] ?? null;
                    $booking->status = 2;
                    $booking->total = $bookingData['total'];
                    $booking->created_by = $userId;
                    $booking->creator_id = $userId;
                    $booking->save();

                    try {
                        LaundryBookingPaymentPaypal::dispatch($booking);
                    } catch (\Throwable $th) {
                        return back()->with('error', $th->getMessage());
                    }

                    return redirect()->route('laundry-management.frontend.booking-success', [
                        'userSlug' => $userSlug,
                        'requestId' => encrypt($booking->id)
                    ]);
                } else {
                    return redirect()->route('laundry-management.frontend.booking', ['userSlug' => $userSlug])->with('error', __('Payment failed.'));
                }
            } else {
                return redirect()->route('laundry-management.frontend.booking', ['userSlug' => $userSlug])->with('error', __('Payment was cancelled.'));
            }
        } catch (\Exception $exception) {
            return redirect()->route('laundry-management.frontend.booking', ['userSlug' => $userSlug])->with('error', __('Transaction has been failed.'));
        }
    }

    public function eventsPayWithPaypal(Request $request)
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

        $price = floatval($request->total);
        if ($price <= 0) {
            return redirect()->back()->with('error', __('Invalid payment amount.'));
        }

        // Configure PayPal
        if ($company_settings['paypal_mode'] == 'live') {
            config([
                'paypal.live.client_id' => $company_settings['paypal_client_id'] ?? '',
                'paypal.live.client_secret' => $company_settings['paypal_secret_key'] ?? '',
                'paypal.mode' => $company_settings['paypal_mode'] ?? '',
            ]);
        } else {
            config([
                'paypal.sandbox.client_id' => $company_settings['paypal_client_id'] ?? '',
                'paypal.sandbox.client_secret' => $company_settings['paypal_secret_key'] ?? '',
                'paypal.mode' => $company_settings['paypal_mode'] ?? '',
            ]);
        }

        $provider = new PayPalClient;
        $provider->setApiCredentials(config('paypal'));
        $provider->getAccessToken();

        $routeParams = [
            'return_type' => 'success',
            'userSlug' => $userSlug
        ];
        $routeName = 'events-management.payment.paypal.status';
        $response = $this->createPaypalOrder($provider, $routeParams, $company_currancy, $price, $routeName);

        if (isset($response['id']) && $response['id'] != null) {
            Session::put('events_paypal_order_id', $response['id']);

            foreach ($response['links'] as $links) {
                if ($links['rel'] == 'approve') {
                    return redirect()->away($links['href']);
                }
            }
            return redirect()->back()->with('error', 'Something went wrong. OR Unknown error occurred');
        } else {
            return redirect()->back()->with('error', $response['message'] ?? 'Something went wrong.');
        }
    }

    public function eventsGetPaypalStatus(Request $request)
    {
        $bookingData = Session::get('events_booking_data');
        $userSlug = Session::get('events_user_slug');
        $paypalOrderId = Session::get('events_paypal_order_id');

        if (!$bookingData) {
            return redirect()->route('events-management.frontend.index', ['userSlug' => $userSlug])->with('error', __('Booking data not found.'));
        }

        $user = User::where('slug', $userSlug)->first();
        $event = Event::where('id', $bookingData['event_id'])
            ->where('created_by', $user->id)
            ->first();

        $company_settings = getCompanyAllSetting($user->id);

        // Configure PayPal
        if ($company_settings['paypal_mode'] == 'live') {
            config([
                'paypal.live.client_id' => $company_settings['paypal_client_id'] ?? '',
                'paypal.live.client_secret' => $company_settings['paypal_secret_key'] ?? '',
                'paypal.mode' => $company_settings['paypal_mode'] ?? '',
            ]);
        } else {
            config([
                'paypal.sandbox.client_id' => $company_settings['paypal_client_id'] ?? '',
                'paypal.sandbox.client_secret' => $company_settings['paypal_secret_key'] ?? '',
                'paypal.mode' => $company_settings['paypal_mode'] ?? '',
            ]);
        }

        $provider = new PayPalClient;
        $provider->setApiCredentials(config('paypal'));
        $provider->getAccessToken();

        Session::forget('events_booking_data');
        Session::forget('events_user_slug');
        Session::forget('events_paypal_order_id');

        try {
            if ($request->return_type == 'success' && $request->token) {
                $response = $provider->capturePaymentOrder($request->token);

                if (isset($response['status']) && $response['status'] == 'COMPLETED') {
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
                    $eventBookingPayment->payment_type = 'PayPal';
                    $eventBookingPayment->description = 'Payment via PayPal';
                    $eventBookingPayment->created_by = $user->id;
                    $eventBookingPayment->creator_id = $user->id;
                    $eventBookingPayment->save();

                    return redirect()->route('events-management.frontend.ticket', ['userSlug' => $userSlug, 'id' => $eventbooking->id, 'paymentId' => $eventBookingPayment->id])
                        ->with('success', __('Payment completed and booking confirmed successfully!'));
                } else {
                    return redirect()->route('events-management.frontend.payment', ['userSlug' => $userSlug, 'id' => $bookingData['event_id']])
                        ->with('error', __('Payment failed.'));
                }
            } else {
                return redirect()->route('events-management.frontend.payment', ['userSlug' => $userSlug, 'id' => $bookingData['event_id']])
                    ->with('error', __('Payment was cancelled.'));
            }
        } catch (\Exception $exception) {
            return redirect()->route('events-management.frontend.payment', ['userSlug' => $userSlug, 'id' => $bookingData['event_id']])
                ->with('error', $exception->getMessage());
        }
    }
}
