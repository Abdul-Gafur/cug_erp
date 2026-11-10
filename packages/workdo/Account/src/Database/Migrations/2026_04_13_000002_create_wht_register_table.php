<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * WHT Register — tracks every Withholding Tax deduction per Payment Voucher.
 *
 * This table is the source of truth for GRA WHT remittance. At period-end,
 * the Finance Officer runs the WHT Register report, aggregates the total WHT
 * deducted, and remits to the Ghana Revenue Authority together with individual
 * WHT Certificates issued to suppliers.
 *
 * Columns mirror the GRA WHT Certificate requirements:
 *   - Supplier TIN
 *   - Nature of payment (goods / services)
 *   - Gross amount and WHT rate/amount
 *   - PV / payment reference
 *   - Remittance status (whether this WHT has been filed with GRA yet)
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('wht_register')) {
            return; // Idempotent guard
        }

        Schema::create('wht_register', function (Blueprint $table) {
            $table->id();

            // Payment link
            $table->foreignId('payment_id')
                  ->constrained('vendor_payments')
                  ->onDelete('cascade');

            $table->foreignId('invoice_submission_id')
                  ->nullable()
                  ->constrained('invoice_submissions')
                  ->onDelete('set null');

            // Supplier / vendor
            $table->foreignId('vendor_id')
                  ->constrained('users')
                  ->onDelete('cascade');
            $table->string('vendor_name', 255);
            $table->string('vendor_tin', 50)->nullable();

            // Transaction metadata
            $table->string('pv_number', 60)->nullable();
            $table->string('payment_reference', 60)->nullable();
            $table->date('payment_date');
            $table->enum('nature_of_payment', ['goods', 'services'])->default('goods');
            $table->enum('supplier_type', ['resident', 'non_resident'])->default('resident');

            // Financial amounts (from GRA computation)
            $table->decimal('gross_amount', 15, 2)->default(0);  // Before WHT
            $table->decimal('wht_rate', 5, 2)->default(0);       // e.g. 3.00
            $table->decimal('wht_amount', 15, 2)->default(0);    // Amount withheld
            $table->decimal('net_paid', 15, 2)->default(0);      // Gross - WHT

            // WHT Certificate
            $table->string('wht_certificate_number', 80)->nullable();
            $table->date('certificate_issued_date')->nullable();

            // GRA Remittance tracking
            $table->enum('remittance_status', ['pending', 'remitted', 'exempt'])->default('pending');
            $table->date('remitted_date')->nullable();
            $table->string('remittance_reference', 100)->nullable();

            // Description / narration from the PV
            $table->text('narration')->nullable();

            // Multi-tenancy
            $table->foreignId('created_by')
                  ->nullable()
                  ->constrained('users')
                  ->onDelete('set null');

            $table->timestamps();

            // Indexes for reporting performance
            $table->index(['payment_date', 'created_by']);
            $table->index(['remittance_status', 'created_by']);
            $table->index(['vendor_id', 'payment_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('wht_register');
    }
};
