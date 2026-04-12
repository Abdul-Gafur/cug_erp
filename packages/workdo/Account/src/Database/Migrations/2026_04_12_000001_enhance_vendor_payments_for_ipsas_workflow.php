<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('vendor_payments', function (Blueprint $table) {
            if (!Schema::hasColumn('vendor_payments', 'pv_number')) {
                $table->string('pv_number', 60)->nullable()->unique()->after('payment_number');
            }
            if (!Schema::hasColumn('vendor_payments', 'payment_method')) {
                $table->enum('payment_method', ['bank_transfer', 'cheque', 'electronic'])
                      ->nullable()->after('reference_number');
            }
            if (!Schema::hasColumn('vendor_payments', 'cheque_number')) {
                $table->string('cheque_number', 100)->nullable()->after('payment_method');
            }
            if (!Schema::hasColumn('vendor_payments', 'narration')) {
                $table->text('narration')->nullable()->after('cheque_number');
            }
            if (!Schema::hasColumn('vendor_payments', 'approval_stage')) {
                $table->enum('approval_stage', ['pending', 'hod_approved', 'finance_approved', 'cfo_approved'])
                      ->default('pending')->after('status');
            }
            if (!Schema::hasColumn('vendor_payments', 'hod_approved_by')) {
                $table->foreignId('hod_approved_by')->nullable()->after('approval_stage')
                      ->references('id')->on('users')->onDelete('set null');
            }
            if (!Schema::hasColumn('vendor_payments', 'hod_approved_at')) {
                $table->timestamp('hod_approved_at')->nullable()->after('hod_approved_by');
            }
            if (!Schema::hasColumn('vendor_payments', 'finance_approved_by')) {
                $table->foreignId('finance_approved_by')->nullable()->after('hod_approved_at')
                      ->references('id')->on('users')->onDelete('set null');
            }
            if (!Schema::hasColumn('vendor_payments', 'finance_approved_at')) {
                $table->timestamp('finance_approved_at')->nullable()->after('finance_approved_by');
            }
            if (!Schema::hasColumn('vendor_payments', 'cfo_approved_by')) {
                $table->foreignId('cfo_approved_by')->nullable()->after('finance_approved_at')
                      ->references('id')->on('users')->onDelete('set null');
            }
            if (!Schema::hasColumn('vendor_payments', 'cfo_approved_at')) {
                $table->timestamp('cfo_approved_at')->nullable()->after('cfo_approved_by');
            }
        });
    }

    public function down(): void
    {
        Schema::table('vendor_payments', function (Blueprint $table) {
            $cols = ['hod_approved_by', 'finance_approved_by', 'cfo_approved_by'];
            foreach ($cols as $col) {
                if (Schema::hasColumn('vendor_payments', $col)) {
                    $table->dropForeign([$col]);
                }
            }
            $drops = [
                'payment_method', 'cheque_number', 'narration', 'pv_number',
                'approval_stage', 'hod_approved_by', 'hod_approved_at',
                'finance_approved_by', 'finance_approved_at', 'cfo_approved_by', 'cfo_approved_at',
            ];
            foreach ($drops as $col) {
                if (Schema::hasColumn('vendor_payments', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
