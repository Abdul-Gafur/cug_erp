<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('rfq_suppliers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('rfq_id')->constrained('sales_quotations')->onDelete('cascade');
            $table->foreignId('supplier_id')->constrained('users')->onDelete('cascade');

            // Supplier response fields (null until supplier responds)
            $table->timestamp('response_received_at')->nullable();
            $table->decimal('quoted_amount', 15, 2)->nullable();
            $table->integer('delivery_days')->nullable();
            $table->text('response_notes')->nullable();

            $table->enum('status', ['invited', 'responded', 'not_responded'])->default('invited');

            $table->foreignId('creator_id')->nullable()->constrained('users')->onDelete('set null');
            $table->foreignId('created_by')->constrained('users')->onDelete('cascade');
            $table->timestamps();

            $table->unique(['rfq_id', 'supplier_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rfq_suppliers');
    }
};
