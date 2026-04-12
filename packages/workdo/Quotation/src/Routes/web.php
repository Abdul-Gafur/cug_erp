<?php

use Illuminate\Support\Facades\Route;
use Workdo\Quotation\Http\Controllers\QuotationController;
use Workdo\Quotation\Http\Controllers\RfqEvaluationController;
use Workdo\Quotation\Http\Controllers\LocalPurchaseOrderController;

Route::middleware(['web', 'auth', 'verified', 'PlanModuleCheck:Quotation'])->group(function () {

    // ── Request for Quotation (RFQ) ───────────────────────────────────────────

    Route::resource('quotations', QuotationController::class);
    Route::get('quotations/{quotation}/print',   [QuotationController::class, 'print'])->name('quotations.print');

    // RFQ lifecycle
    Route::post('quotations/{quotation}/issue',         [QuotationController::class, 'issue'])->name('quotations.issue');
    Route::post('quotations/{quotation}/sent',          [QuotationController::class, 'sent'])->name('quotations.sent');   // legacy alias
    Route::post('quotations/{quotation}/close',         [QuotationController::class, 'closeRfq'])->name('quotations.close');
    Route::post('quotations/{quotation}/reject',        [QuotationController::class, 'reject'])->name('quotations.reject');
    Route::post('quotations/{quotation}/award',         [QuotationController::class, 'award'])->name('quotations.award');

    // Supplier management on an RFQ
    Route::post('quotations/{quotation}/suppliers',                        [QuotationController::class, 'addSupplier'])->name('quotations.suppliers.add');
    Route::delete('quotations/{quotation}/suppliers/{rfqSupplier}',        [QuotationController::class, 'removeSupplier'])->name('quotations.suppliers.remove');
    Route::post('quotations/{quotation}/suppliers/{rfqSupplier}/response', [QuotationController::class, 'recordResponse'])->name('quotations.suppliers.response');

    // Bid evaluation
    Route::post('quotations/{quotation}/evaluation/start',            [QuotationController::class, 'startEvaluation'])->name('rfq.evaluation.start');
    Route::get('quotations/{quotation}/evaluation',                   [RfqEvaluationController::class, 'show'])->name('rfq.evaluation.show');
    Route::put('quotations/{quotation}/evaluation/criteria',          [RfqEvaluationController::class, 'updateCriteria'])->name('rfq.evaluation.criteria');
    Route::post('quotations/{quotation}/evaluation/scores',           [RfqEvaluationController::class, 'saveScores'])->name('rfq.evaluation.scores');
    Route::post('quotations/{quotation}/evaluation/finalise',         [RfqEvaluationController::class, 'finalise'])->name('rfq.evaluation.finalise');
    Route::post('quotations/{quotation}/evaluation/committee-approve',[RfqEvaluationController::class, 'committeeApprove'])->name('rfq.evaluation.committee-approve');
    Route::get('quotations/{quotation}/evaluation/print',             [RfqEvaluationController::class, 'print'])->name('rfq.evaluation.print');

    // Revision / duplicate (kept from original)
    Route::post('quotations/{quotation}/create-revision', [QuotationController::class, 'createRevision'])->name('quotations.create-revision');
    Route::post('quotations/{quotation}/duplicate',       [QuotationController::class, 'duplicate'])->name('quotations.duplicate');

    // Product lookup helper
    Route::get('sales-quotations/warehouse/products', [QuotationController::class, 'getWarehouseProducts'])->name('quotations.warehouse.products');

    // ── Local Purchase Orders ────────────────────────────────────────────────

    Route::prefix('lpo')->name('lpo.')->group(function () {
        Route::get('/',               [LocalPurchaseOrderController::class, 'index'])->name('index');
        Route::get('/create',         [LocalPurchaseOrderController::class, 'create'])->name('create');
        Route::post('/',              [LocalPurchaseOrderController::class, 'store'])->name('store');
        Route::get('/{lpo}',          [LocalPurchaseOrderController::class, 'show'])->name('show');
        Route::post('/{lpo}/approve', [LocalPurchaseOrderController::class, 'approve'])->name('approve');
        Route::post('/{lpo}/email',   [LocalPurchaseOrderController::class, 'email'])->name('email');
        Route::get('/{lpo}/print',    [LocalPurchaseOrderController::class, 'print'])->name('print');
    });
});
