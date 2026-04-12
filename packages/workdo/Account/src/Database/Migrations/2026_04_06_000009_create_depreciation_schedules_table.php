<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Depreciation schedules — one row per depreciation run per asset.
 *
 * Each row is created by FixedAssetService::runDepreciation() and links
 * back to the journal entry created in the same operation.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('depreciation_schedules', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('asset_id');
            $table->string('period_label', 50);   // e.g. "April 2026"
            $table->date('depreciation_date');
            $table->decimal('depreciation_amount', 15, 2);
            $table->decimal('accumulated_depreciation_after', 15, 2); // snapshot after this run
            $table->unsignedBigInteger('journal_entry_id')->nullable();

            $table->unsignedBigInteger('created_by');
            $table->unsignedBigInteger('creator_id');
            $table->timestamps();

            $table->foreign('asset_id')->references('id')->on('fixed_assets')->cascadeOnDelete();
            $table->foreign('journal_entry_id')->references('id')->on('journal_entries')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('depreciation_schedules');
    }
};
