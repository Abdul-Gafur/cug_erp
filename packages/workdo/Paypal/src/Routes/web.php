<?php

use Illuminate\Support\Facades\Route;
use Workdo\Paypal\Http\Controllers\PaypalController;
use Workdo\Paypal\Http\Controllers\PaypalSettingsController;

Route::middleware(['web', 'auth', 'verified', 'PlanModuleCheck:Paypal'])->group(function () {
    Route::post('/paypal/settings', [PaypalSettingsController::class, 'update'])->name('paypal.settings.update');
});
Route::middleware(['web'])->group(function() {
    Route::prefix('paypal')->group(function() {
        Route::post('/plan/company/payment', [PaypalController::class,'planPayWithPaypal'])->name('payment.paypal.store')->middleware(['auth']);
        Route::get('/plan/company/status/{plan_id}', [PaypalController::class,'planGetPaypalStatus'])->name('payment.paypal.status')->middleware(['auth']);

        // Booking payment routes
        Route::post('{userSlug?}/booking/payment', [PaypalController::class,'bookingPayWithPaypal'])->name('booking.payment.paypal.store');
        Route::get('{userSlug?}/booking/status', [PaypalController::class,'bookingGetPaypalStatus'])->name('booking.payment.paypal.status');



        // BeautySpa payment routes
        Route::post('{userSlug?}/beauty-spa/payment', [PaypalController::class,'beautySpaPayWithPaypal'])->name('beauty-spa.payment.paypal.store');
        Route::get('{userSlug?}/beauty-spa/status', [PaypalController::class,'beautySpaGetPaypalStatus'])->name('beauty-spa.payment.paypal.status');

        // LMS payment routes
        Route::post('{userSlug?}/lms/payment', [PaypalController::class,'lmsPayWithPaypal'])->name('lms.payment.paypal.store');
        Route::get('{userSlug?}/lms/status', [PaypalController::class,'lmsGetPaypalStatus'])->name('lms.payment.paypal.status');

        // Parking payment routes
        Route::post('{userSlug}/parking/payment', [PaypalController::class, 'parkingPayWithPaypal'])->name('parking.payment.paypal.store');
        Route::get('{userSlug}/parking/status', [PaypalController::class, 'parkingGetPaypalStatus'])->name('parking.payment.paypal.status');

        // Laundry payment routes
        Route::post('{userSlug?}/laundry/payment', [PaypalController::class, 'laundryPayWithPaypal'])->name('laundry.payment.paypal.store');
        Route::get('{userSlug?}/laundry/status', [PaypalController::class, 'laundryGetPaypalStatus'])->name('laundry.payment.paypal.status');

        // Events payment routes
        Route::post('{userSlug?}/events/payment', [PaypalController::class,'eventsPayWithPaypal'])->name('events-management.payment.paypal.store');
        Route::get('{userSlug?}/events/status', [PaypalController::class,'eventsGetPaypalStatus'])->name('events-management.payment.paypal.status');
    });
});
