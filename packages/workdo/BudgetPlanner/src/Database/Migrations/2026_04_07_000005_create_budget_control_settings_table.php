<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Per-economic-classification budget control mode.
     * Bursar configures whether overspending triggers a hard block or a warning
     * with override. One row per economic_classification per tenant (created_by).
     */
    public function up(): void
    {
        if (!Schema::hasTable('budget_control_settings')) {
            Schema::create('budget_control_settings', function (Blueprint $table) {
                $table->id();

                $table->enum('economic_classification', [
                    'personnel_emoluments',
                    'goods_services',
                    'capital_expenditure',
                    'transfers_grants',
                    'all', // catch-all default row
                ])->default('all');

                // hard_block: transaction is rejected outright
                // warning:    transaction proceeds but a warning is shown and logged;
                //             the user must confirm with a reason
                $table->enum('control_mode', ['hard_block', 'warning'])
                    ->default('hard_block');

                $table->foreignId('creator_id')->nullable()->index();
                $table->foreignId('created_by')->nullable()->index();
                $table->foreign('creator_id')->references('id')->on('users')->onDelete('set null');
                $table->foreign('created_by')->references('id')->on('users')->onDelete('cascade');
                $table->timestamps();

                $table->unique(['economic_classification', 'created_by'], 'bcs_econ_cls_created_by_unique');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('budget_control_settings');
    }
};
