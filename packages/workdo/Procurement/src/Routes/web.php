<?php

use Illuminate\Support\Facades\Route;
use Workdo\Procurement\Http\Controllers\ProcurementPlanController;
use Workdo\Procurement\Http\Controllers\PurchaseRequisitionController;
use Workdo\Procurement\Http\Controllers\GoodsReceivedNoteController;

Route::middleware(['web', 'auth', 'verified', 'PlanModuleCheck:BudgetPlanner'])->group(function () {

    // ── Annual Procurement Plans ──────────────────────────────────────────────
    Route::prefix('procurement/plans')->name('procurement.plans.')->group(function () {
        Route::get('/',                           [ProcurementPlanController::class, 'index'])->name('index');
        Route::post('/',                          [ProcurementPlanController::class, 'store'])->name('store');
        Route::get('/{plan}',                     [ProcurementPlanController::class, 'show'])->name('show');
        Route::put('/{plan}',                     [ProcurementPlanController::class, 'update'])->name('update');
        Route::delete('/{plan}',                  [ProcurementPlanController::class, 'destroy'])->name('destroy');
        Route::post('/{plan}/approve',            [ProcurementPlanController::class, 'approve'])->name('approve');
        Route::post('/{plan}/activate',           [ProcurementPlanController::class, 'activate'])->name('activate');
        Route::post('/{plan}/close',              [ProcurementPlanController::class, 'close'])->name('close');

        // Plan item sub-resource
        Route::post('/{plan}/items',                        [ProcurementPlanController::class, 'storeItem'])->name('items.store');
        Route::put('/{plan}/items/{item}',                  [ProcurementPlanController::class, 'updateItem'])->name('items.update');
        Route::delete('/{plan}/items/{item}',               [ProcurementPlanController::class, 'destroyItem'])->name('items.destroy');
    });

    // ── Purchase Requisitions ─────────────────────────────────────────────────
    Route::prefix('procurement/requisitions')->name('procurement.requisitions.')->group(function () {
        Route::get('/',                           [PurchaseRequisitionController::class, 'index'])->name('index');
        Route::get('/create',                     [PurchaseRequisitionController::class, 'create'])->name('create');
        Route::post('/',                          [PurchaseRequisitionController::class, 'store'])->name('store');
        Route::get('/{requisition}',              [PurchaseRequisitionController::class, 'show'])->name('show');
        Route::delete('/{requisition}',           [PurchaseRequisitionController::class, 'destroy'])->name('destroy');

        // Approval workflow
        Route::post('/{requisition}/submit',               [PurchaseRequisitionController::class, 'submit'])->name('submit');
        Route::post('/{requisition}/approve-hod',          [PurchaseRequisitionController::class, 'approveHod'])->name('approve-hod');
        Route::post('/{requisition}/finance-check',        [PurchaseRequisitionController::class, 'financeCheck'])->name('finance-check');
        Route::post('/{requisition}/approve-procurement',  [PurchaseRequisitionController::class, 'approveProcurement'])->name('approve-procurement');
        Route::post('/{requisition}/reject',               [PurchaseRequisitionController::class, 'reject'])->name('reject');
    });

    // ── Goods Received Notes ──────────────────────────────────────────────────
    Route::prefix('procurement/grns')->name('procurement.grns.')->group(function () {
        Route::get('/',                    [GoodsReceivedNoteController::class, 'index'])->name('index');
        Route::get('/create',              [GoodsReceivedNoteController::class, 'create'])->name('create');
        Route::post('/',                   [GoodsReceivedNoteController::class, 'store'])->name('store');
        Route::get('/{grn}',               [GoodsReceivedNoteController::class, 'show'])->name('show');
        Route::post('/{grn}/post',         [GoodsReceivedNoteController::class, 'post'])->name('post');
        Route::post('/{grn}/inspect',      [GoodsReceivedNoteController::class, 'inspect'])->name('inspect');
    });
});
