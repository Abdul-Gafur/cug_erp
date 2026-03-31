<?php

use Illuminate\Support\Facades\Route;
use Workdo\Stripe\Http\Controllers\DashboardController;
use Workdo\Stripe\Http\Controllers\StripeItemController;
use Workdo\Stripe\Http\Controllers\StripeSettingsController;
use Workdo\Stripe\Http\Controllers\StripeController;

Route::middleware(['web', 'auth', 'verified', 'PlanModuleCheck:Stripe'])->group(function () {
    Route::post('/stripe/settings', [StripeSettingsController::class, 'update'])->name('stripe.settings.update');
});

Route::middleware(['web'])->group(function() {
    Route::prefix('stripe')->group(function() {
        Route::post('/plan/company/payment', [StripeController::class,'planPayWithStripe'])->name('payment.stripe.store')->middleware(['auth']);
        Route::get('/plan/company/status', [StripeController::class,'planGetStripeStatus'])->name('payment.stripe.status')->middleware(['auth']);

        Route::post('{userSlug?}/booking/payment', [StripeController::class,'bookingPayWithStripe'])->name('booking.payment.stripe.store');
        Route::get('{userSlug?}/booking/status', [StripeController::class,'bookingGetStripeStatus'])->name('booking.payment.stripe.status');



        // BeautySpa payment routes
        Route::post('{userSlug?}/beauty-spa/payment', [StripeController::class,'beautySpaPayWithStripe'])->name('beauty-spa.payment.stripe.store');
        Route::get('{userSlug?}/beauty-spa/status', [StripeController::class,'beautySpaGetStripeStatus'])->name('beauty-spa.payment.stripe.status');

        // LMS payment routes
        Route::post('{userSlug?}/lms/payment', [StripeController::class,'lmsPayWithStripe'])->name('lms.payment.stripe.store');
        Route::get('{userSlug?}/lms/status', [StripeController::class,'lmsGetStripeStatus'])->name('lms.payment.stripe.status');

        // Laundry payment routes
        Route::post('{userSlug?}/laundry/payment', [StripeController::class,'laundryPayWithStripe'])->name('laundry.payment.stripe.store');
        Route::get('{userSlug?}/laundry/status', [StripeController::class,'laundryGetStripeStatus'])->name('laundry.payment.stripe.status');

        // Parking payment routes
        Route::post('{userSlug}/parking/payment', [StripeController::class, 'parkingPayWithStripe'])->name('parking.payment.stripe.store');
        Route::get('{userSlug}/parking/status', [StripeController::class, 'parkingGetStripeStatus'])->name('parking.payment.stripe.status');

        // EventsManagement payment routes
        Route::post('{userSlug?}/events/payment', [StripeController::class,'eventsPayWithStripe'])->name('events-management.payment.stripe.store');
        Route::get('{userSlug?}/events/status', [StripeController::class,'eventsGetStripeStatus'])->name('events-management.payment.stripe.status');
    });
});
