<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('local_purchase_orders', function (Blueprint $table) {
            $table->id();
            $table->string('lpo_number')->unique();
            $table->date('lpo_date');

            // Source references
            $table->foreignId('rfq_id')->nullable()->constrained('sales_quotations')->onDelete('set null');
            $table->unsignedBigInteger('requisition_id')->nullable();
            if (Schema::hasTable('purchase_requisitions')) {
                $table->foreign('requisition_id')
                      ->references('id')->on('purchase_requisitions')
                      ->onDelete('set null');
            }

            // Supplier
            $table->foreignId('supplier_id')->constrained('users')->onDelete('restrict');

            // University procurement fields
            $table->string('issuing_department');
            $table->text('delivery_location')->nullable();
            $table->date('delivery_date')->nullable();
            $table->string('payment_terms')->nullable();

            // Budget / commitment dimensions
            $table->unsignedBigInteger('vote_account_id')->nullable();
            $table->foreign('vote_account_id')
                  ->references('id')->on('chart_of_accounts')
                  ->onDelete('set null');
            $table->string('fund_type')->nullable()
                  ->comment('recurrent, development, donor_funded, etc.');
            $table->string('economic_classification')->nullable();
            $table->unsignedBigInteger('budget_period_id')->nullable();
            if (Schema::hasTable('budget_periods')) {
                $table->foreign('budget_period_id')
                      ->references('id')->on('budget_periods')
                      ->onDelete('set null');
            }

            // Financials
            $table->decimal('subtotal', 15, 2)->default(0);
            $table->decimal('tax_amount', 15, 2)->default(0);
            $table->decimal('discount_amount', 15, 2)->default(0);
            $table->decimal('total_amount', 15, 2)->default(0);

            // Lifecycle
            $table->enum('status', ['draft', 'approved', 'emailed', 'completed', 'cancelled'])->default('draft');
            $table->foreignId('approved_by')->nullable()->constrained('users')->onDelete('set null');
            $table->timestamp('approved_at')->nullable();
            $table->timestamp('emailed_at')->nullable();

            $table->text('notes')->nullable();
            $table->foreignId('creator_id')->nullable()->constrained('users')->onDelete('set null');
            $table->foreignId('created_by')->constrained('users')->onDelete('cascade');
            $table->timestamps();
        });

        Schema::create('local_purchase_order_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('lpo_id')->constrained('local_purchase_orders')->onDelete('cascade');
            $table->unsignedBigInteger('product_id')->nullable();
            $table->foreign('product_id')
                  ->references('id')->on('product_service_items')
                  ->onDelete('set null');
            $table->string('description');
            $table->integer('quantity');
            $table->string('unit')->nullable();
            $table->decimal('unit_price', 15, 2)->default(0);
            $table->decimal('discount_percentage', 5, 2)->default(0);
            $table->decimal('discount_amount', 15, 2)->default(0);
            $table->decimal('tax_percentage', 5, 2)->default(0);
            $table->decimal('tax_amount', 15, 2)->default(0);
            $table->decimal('total_amount', 15, 2)->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('local_purchase_order_items');
        Schema::dropIfExists('local_purchase_orders');
    }
};
