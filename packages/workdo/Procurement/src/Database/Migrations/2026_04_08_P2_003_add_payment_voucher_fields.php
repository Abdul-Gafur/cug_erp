<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // ── Add narration (purpose field) to vendor_payments ─────────────────
        Schema::table('vendor_payments', function (Blueprint $table) {
            if (!Schema::hasColumn('vendor_payments', 'narration')) {
                $table->text('narration')->nullable()->after('notes')
                    ->comment('Purpose of payment — printed on Payment Voucher');
            }
            if (!Schema::hasColumn('vendor_payments', 'cheque_number')) {
                $table->string('cheque_number')->nullable()->after('narration')
                    ->comment('Cheque number if payment is by cheque');
            }
        });

        // ── Track receipt status on LPOs ──────────────────────────────────────
        Schema::table('local_purchase_orders', function (Blueprint $table) {
            if (!Schema::hasColumn('local_purchase_orders', 'received_status')) {
                $table->enum('received_status', ['none', 'partial', 'fully_received'])
                    ->default('none')->after('status')
                    ->comment('Updated automatically when GRNs are posted against this LPO');
            }
        });
    }

    public function down(): void
    {
        Schema::table('vendor_payments', function (Blueprint $table) {
            $table->dropColumn(['narration', 'cheque_number']);
        });
        Schema::table('local_purchase_orders', function (Blueprint $table) {
            $table->dropColumn('received_status');
        });
    }
};
