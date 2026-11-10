<?php

use Illuminate\Support\Facades\Route;
use Workdo\Account\Http\Controllers\WhtRegisterController;

Route::group(['middleware' => ['web', 'auth']], function () {
    Route::get('account/wht-register', [WhtRegisterController::class, 'index'])->name('account.wht-register.index');
    Route::post('account/wht-register/remit', [WhtRegisterController::class, 'markRemitted'])->name('account.wht-register.remit');
    Route::post('account/wht-register/{wht_register}/issue-certificate', [WhtRegisterController::class, 'issueCertificate'])->name('account.wht-register.issue-certificate');
    Route::get('account/wht-register/print', [WhtRegisterController::class, 'print'])->name('account.wht-register.print');
});
