<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('invoice_submissions', function (Blueprint $table) {
            $table->id();

            // Link to payment (nullable — submission may happen before payment record)
            $table->foreignId('payment_id')->nullable()
                  ->references('id')->on('vendor_payments')->onDelete('cascade');
            $table->foreignId('vendor_id')
                  ->references('id')->on('users')->onDelete('cascade');

            // Step 1 — Invoice Submission fields
            $table->string('invoice_number', 100);
            $table->date('invoice_date');
            $table->string('po_reference', 100)->nullable();
            $table->string('delivery_note_number', 100)->nullable();
            $table->date('submission_date');
            $table->foreignId('submitted_by')
                  ->references('id')->on('users')->onDelete('cascade');

            // Supplier residency — determines WHT rate
            $table->enum('supplier_type', ['resident', 'non_resident'])->default('resident');
            $table->enum('goods_or_services', ['goods', 'services'])->default('goods');

            // GRA Tax Breakdown (Ghana Revenue Authority)
            // VAT Base = base_amount + nhil_amount + getfund_amount + chrl_amount
            // Gross Amount = VAT Base + vat_amount
            // Net Payable = Gross Amount - wht_amount
            $table->decimal('base_amount', 15, 2)->default(0);        // Invoice value before taxes
            $table->decimal('nhil_amount', 15, 2)->default(0);         // NHIL 2.5%
            $table->decimal('getfund_amount', 15, 2)->default(0);      // GETFund 2.5%
            $table->decimal('chrl_amount', 15, 2)->default(0);         // COVID Health Recovery Levy 1%
            $table->decimal('vat_base_amount', 15, 2)->default(0);     // Augmented base for VAT
            $table->decimal('vat_amount', 15, 2)->default(0);          // VAT 15% on vat_base
            $table->decimal('gross_amount', 15, 2)->default(0);        // Total before WHT
            $table->decimal('wht_rate', 5, 2)->default(3.00);          // WHT % applied
            $table->decimal('wht_amount', 15, 2)->default(0);          // WHT deduction
            $table->decimal('net_payable', 15, 2)->default(0);         // Amount to pay supplier

            // Step 2 — Invoice Verification
            $table->enum('verification_status', ['pending', 'verified', 'rejected'])->default('pending');
            $table->foreignId('verified_by')->nullable()
                  ->references('id')->on('users')->onDelete('set null');
            $table->timestamp('verified_at')->nullable();
            $table->text('rejection_reason')->nullable();

            // 3-Way Match result (cross-checked against LPO & GRN)
            $table->enum('three_way_match_status', ['not_checked', 'matched', 'discrepancy'])->default('not_checked');
            $table->text('match_notes')->nullable();

            $table->foreignId('created_by')->nullable()
                  ->references('id')->on('users')->onDelete('set null');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('invoice_submissions');
    }
};
