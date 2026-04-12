<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('goods_received_notes')) {
            Schema::create('goods_received_notes', function (Blueprint $table) {
                $table->id();
                $table->string('grn_number', 30)->unique()
                    ->comment('Auto-generated: GRN-YYYY-MM-NNNN');

                $table->foreignId('lpo_id')
                    ->constrained('local_purchase_orders')
                    ->onDelete('restrict')
                    ->comment('The LPO this GRN is receiving against');

                $table->date('grn_date');
                $table->string('receiving_department')->nullable();

                $table->foreignId('receiving_officer_id')
                    ->constrained('users')
                    ->onDelete('restrict')
                    ->comment('Store officer or staff member signing for receipt');

                $table->string('delivery_note_number')->nullable()
                    ->comment("Supplier's delivery note / waybill reference");

                $table->enum('status', ['draft', 'posted'])
                    ->default('draft');

                $table->timestamp('posted_at')->nullable();
                $table->foreignId('posted_by')->nullable()
                    ->references('id')->on('users')->onDelete('set null');

                $table->text('remarks')->nullable()
                    ->comment('General remarks about the delivery');

                $table->foreignId('creator_id')->nullable()
                    ->references('id')->on('users')->onDelete('set null');
                $table->foreignId('created_by')
                    ->references('id')->on('users')->onDelete('cascade');

                $table->timestamps();

                $table->index(['created_by', 'status']);
                $table->index(['lpo_id']);
            });
        }

        if (!Schema::hasTable('grn_items')) {
            Schema::create('grn_items', function (Blueprint $table) {
                $table->id();
                $table->foreignId('grn_id')
                    ->constrained('goods_received_notes')
                    ->onDelete('cascade');

                $table->unsignedBigInteger('lpo_item_id')
                    ->comment('FK to local_purchase_order_items');
                $table->foreign('lpo_item_id')
                    ->references('id')->on('local_purchase_order_items')
                    ->onDelete('restrict');

                $table->unsignedBigInteger('product_id')->nullable();
                $table->foreign('product_id')
                    ->references('id')->on('product_service_items')
                    ->onDelete('set null');

                $table->string('description');
                $table->string('unit')->nullable();

                $table->decimal('ordered_qty', 12, 3);
                $table->decimal('received_qty', 12, 3)->default(0);
                $table->decimal('rejected_qty', 12, 3)->default(0)
                    ->comment('Quantity rejected at point of receipt (e.g. damaged)');

                $table->enum('condition', ['good', 'damaged', 'defective', 'partial'])
                    ->default('good');

                $table->string('condition_notes')->nullable();

                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('grn_items');
        Schema::dropIfExists('goods_received_notes');
    }
};
