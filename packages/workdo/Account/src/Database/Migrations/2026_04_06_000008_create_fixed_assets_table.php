<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Asset register — IPSAS 17 Property, Plant and Equipment.
 *
 * Carrying amount = purchase_cost − accumulated_depreciation.
 * Computed on the fly; not stored to avoid drift.
 *
 * GL account IDs are resolved from the category's account codes at
 * asset creation and stored directly on the asset so each asset can
 * override its category defaults if required.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fixed_assets', function (Blueprint $table) {
            $table->id();

            // Identity
            $table->string('asset_code', 30)->unique(); // FA-YYYY-NNN auto-generated
            $table->string('asset_name', 200);
            $table->unsignedBigInteger('category_id');
            $table->text('description')->nullable();

            // University-specific fields
            $table->unsignedBigInteger('fund_id')->nullable();  // university_funds.id
            $table->string('department', 120)->nullable();
            $table->string('location', 200)->nullable();

            // Acquisition
            $table->date('purchase_date');
            $table->decimal('purchase_cost', 15, 2);

            // IPSAS 17 depreciation parameters
            $table->decimal('residual_value', 15, 2)->default(0);
            $table->unsignedSmallInteger('useful_life_months'); // stored in months for precision
            $table->string('depreciation_method', 30)->default('straight_line');

            // Running total updated after each depreciation run
            $table->decimal('accumulated_depreciation', 15, 2)->default(0);

            // GL accounts resolved from category at creation (overrideable per asset)
            $table->unsignedBigInteger('asset_account_id');
            $table->unsignedBigInteger('accumulated_depreciation_account_id')->nullable();
            $table->unsignedBigInteger('depreciation_expense_account_id')->nullable();

            // Lifecycle status
            $table->string('status', 30)->default('active'); // active | fully_depreciated | disposed

            // Disposal fields (populated when status = disposed)
            $table->date('disposal_date')->nullable();
            $table->string('disposal_method', 30)->nullable(); // sale | transfer | write_off | scrapped
            $table->decimal('disposal_proceeds', 15, 2)->default(0);
            $table->unsignedBigInteger('authorising_officer_id')->nullable();
            $table->unsignedBigInteger('disposal_journal_id')->nullable(); // journal_entries.id

            $table->unsignedBigInteger('created_by');
            $table->unsignedBigInteger('creator_id');
            $table->timestamps();

            $table->foreign('category_id')->references('id')->on('fixed_asset_categories')->restrictOnDelete();
            $table->foreign('asset_account_id')->references('id')->on('chart_of_accounts')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fixed_assets');
    }
};
