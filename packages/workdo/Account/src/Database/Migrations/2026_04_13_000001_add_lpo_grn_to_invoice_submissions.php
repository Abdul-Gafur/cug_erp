<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Add structural FK links from invoice_submissions to local_purchase_orders
 * and goods_received_notes, enabling real 3-way match enforcement rather
 * than relying solely on text references.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('invoice_submissions', function (Blueprint $table) {
            if (!Schema::hasColumn('invoice_submissions', 'lpo_id')) {
                $table->unsignedBigInteger('lpo_id')->nullable()->after('payment_id');
                // Note: FK deliberately not added here because the LPO table is in the
                // Quotation package and may not always be present. We use a soft reference.
            }
            if (!Schema::hasColumn('invoice_submissions', 'grn_id')) {
                $table->unsignedBigInteger('grn_id')->nullable()->after('lpo_id');
                // Same reasoning — soft FK into the Procurement package table.
            }
            if (!Schema::hasColumn('invoice_submissions', 'lpo_number')) {
                $table->string('lpo_number', 80)->nullable()->after('grn_id');
            }
            if (!Schema::hasColumn('invoice_submissions', 'grn_number')) {
                $table->string('grn_number', 80)->nullable()->after('lpo_number');
            }
        });
    }

    public function down(): void
    {
        Schema::table('invoice_submissions', function (Blueprint $table) {
            foreach (['lpo_id', 'grn_id', 'lpo_number', 'grn_number'] as $col) {
                if (Schema::hasColumn('invoice_submissions', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
