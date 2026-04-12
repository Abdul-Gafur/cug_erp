<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Fixed asset categories — university PPE classifications per IPSAS 17.
 *
 * asset_account_code, accumulated_depreciation_account_code, and
 * depreciation_expense_account_code store COA account code strings
 * (e.g. '1600') so that the seed data is independent of tenant-specific
 * auto-incremented COA IDs.  The FixedAssetController resolves the actual
 * chart_of_accounts IDs at the time of asset creation.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fixed_asset_categories', function (Blueprint $table) {
            $table->id();
            $table->string('name', 120);
            $table->text('description')->nullable();

            // GL account codes resolved at asset creation time
            $table->string('asset_account_code', 10);
            $table->string('accumulated_depreciation_account_code', 10)->nullable(); // null = non-depreciable (e.g. Land)
            $table->string('depreciation_expense_account_code', 10)->nullable();

            // Defaults applied to new assets in this category (can be overridden per asset)
            $table->unsignedSmallInteger('default_useful_life_months')->default(60); // 5 years
            $table->string('depreciation_method', 30)->default('straight_line');
            $table->boolean('is_depreciable')->default(true);

            $table->unsignedBigInteger('created_by');
            $table->unsignedBigInteger('creator_id');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fixed_asset_categories');
    }
};
