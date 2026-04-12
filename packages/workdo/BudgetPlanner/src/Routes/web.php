<?php

use Workdo\BudgetPlanner\Http\Controllers\BudgetPeriodController;
use Workdo\BudgetPlanner\Http\Controllers\BudgetController;
use Workdo\BudgetPlanner\Http\Controllers\BudgetAllocationController;
use Workdo\BudgetPlanner\Http\Controllers\BudgetMonitoringController;
use Workdo\BudgetPlanner\Http\Controllers\VoteCostCentreController;
use Workdo\BudgetPlanner\Http\Controllers\BudgetControlSettingController;
use Workdo\BudgetPlanner\Http\Controllers\BudgetExecutionController;
use Workdo\BudgetPlanner\Http\Controllers\BudgetAmendmentController;
use Workdo\BudgetPlanner\Http\Controllers\BudgetPositionController;
use Workdo\BudgetPlanner\Http\Controllers\BudgetVarianceController;
use Illuminate\Support\Facades\Route;

Route::middleware(['web', 'auth', 'verified', 'PlanModuleCheck:BudgetPlanner'])->group(function () {

    // ── Budget Periods ────────────────────────────────────────────────────────
    Route::prefix('budget-planner/budget-periods')->name('budget-planner.budget-periods.')->group(function () {
        Route::get('/',                             [BudgetPeriodController::class, 'index'])->name('index');
        Route::post('/',                            [BudgetPeriodController::class, 'store'])->name('store');
        Route::put('/{budget_period}',              [BudgetPeriodController::class, 'update'])->name('update');
        Route::post('/{budget_period}/approve',     [BudgetPeriodController::class, 'approve'])->name('approve');
        Route::post('/{budget_period}/active',      [BudgetPeriodController::class, 'active'])->name('active');
        Route::post('/{budget_period}/close',       [BudgetPeriodController::class, 'close'])->name('close');
        Route::delete('/{budget_period}',           [BudgetPeriodController::class, 'destroy'])->name('destroy');
    });

    // ── Budgets ───────────────────────────────────────────────────────────────
    Route::prefix('budget-planner/budgets')->name('budget-planner.budgets.')->group(function () {
        Route::get('/',                             [BudgetController::class, 'index'])->name('index');
        Route::get('/{budget}',                     [BudgetController::class, 'show'])->name('show');
        Route::post('/',                            [BudgetController::class, 'store'])->name('store');
        Route::put('/{budget}',                     [BudgetController::class, 'update'])->name('update');
        // Approval hierarchy
        Route::post('/{budget}/approve',            [BudgetController::class, 'approve'])->name('approve');
        Route::post('/{budget}/finance-review',     [BudgetController::class, 'financeReview'])->name('finance-review');
        Route::post('/{budget}/committee-approve',  [BudgetController::class, 'committeeApprove'])->name('committee-approve');
        Route::post('/{budget}/vc-authorise',       [BudgetController::class, 'vcAuthorise'])->name('vc-authorise');
        Route::post('/{budget}/active',             [BudgetController::class, 'active'])->name('active');
        Route::post('/{budget}/close',              [BudgetController::class, 'close'])->name('close');
        Route::delete('/{budget}',                  [BudgetController::class, 'destroy'])->name('destroy');
    });

    // ── Budget Allocations ────────────────────────────────────────────────────
    Route::prefix('budget-planner/budget-allocations')->name('budget-planner.budget-allocations.')->group(function () {
        Route::get('/',                             [BudgetAllocationController::class, 'index'])->name('index');
        Route::post('/',                            [BudgetAllocationController::class, 'store'])->name('store');
        Route::put('/{budget_allocation}',          [BudgetAllocationController::class, 'update'])->name('update');
        Route::delete('/{budget_allocation}',       [BudgetAllocationController::class, 'destroy'])->name('destroy');
    });

    // ── Budget Monitoring ─────────────────────────────────────────────────────
    Route::prefix('budget-planner/budget-monitoring')->name('budget-planner.budget-monitorings.')->group(function () {
        Route::get('/', [BudgetMonitoringController::class, 'index'])->name('index');
    });

    // ── Vote / Cost Centres ───────────────────────────────────────────────────
    Route::prefix('budget-planner/vote-cost-centres')->name('budget-planner.vote-cost-centres.')->group(function () {
        Route::get('/',                             [VoteCostCentreController::class, 'index'])->name('index');
        Route::post('/',                            [VoteCostCentreController::class, 'store'])->name('store');
        Route::put('/{voteCostCentre}',             [VoteCostCentreController::class, 'update'])->name('update');
        Route::delete('/{voteCostCentre}',          [VoteCostCentreController::class, 'destroy'])->name('destroy');
    });

    // ── Budget Control Settings (Bursar) ──────────────────────────────────────
    Route::prefix('budget-planner/budget-control-settings')->name('budget-planner.budget-control-settings.')->group(function () {
        Route::get('/',     [BudgetControlSettingController::class, 'index'])->name('index');
        Route::post('/save',[BudgetControlSettingController::class, 'upsert'])->name('upsert');
    });

    // ── Budget Execution Statement / Performance Report (IPSAS 24) ───────────
    Route::prefix('budget-planner/budget-execution')->name('budget-planner.budget-execution.')->group(function () {
        Route::get('/',              [BudgetExecutionController::class, 'index'])->name('index');
        Route::get('/print',         [BudgetExecutionController::class, 'print'])->name('print');
        Route::get('/export-excel',  [BudgetExecutionController::class, 'exportExcel'])->name('export-excel');
    });

    // ── Budget Amendments (Virement / Revision) ───────────────────────────────
    Route::prefix('budget-planner/budget-amendments')->name('budget-planner.budget-amendments.')->group(function () {
        Route::get('/',                             [BudgetAmendmentController::class, 'index'])->name('index');
        Route::post('/',                            [BudgetAmendmentController::class, 'store'])->name('store');
        Route::post('/{amendment}/approve',         [BudgetAmendmentController::class, 'approve'])->name('approve');
        Route::post('/{amendment}/reject',          [BudgetAmendmentController::class, 'reject'])->name('reject');
    });

    // ── Budget Variance Analysis (IPSAS budget_variance table) ───────────────
    Route::prefix('budget-planner/budget-variances')->name('budget-planner.budget-variances.')->group(function () {
        Route::get('/', [BudgetVarianceController::class, 'index'])->name('index');
    });

    // ── Budget Position (JSON widget for transaction screens) ─────────────────
    Route::get('budget-planner/budget-position', [BudgetPositionController::class, 'show'])
        ->name('budget-planner.budget-position');
});
