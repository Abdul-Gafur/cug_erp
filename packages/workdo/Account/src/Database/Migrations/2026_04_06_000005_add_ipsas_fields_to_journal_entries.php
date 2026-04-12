<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('journal_entries', function (Blueprint $table) {
            // Fiscal period — links every entry to a monthly period for period-lock enforcement
            $table->unsignedBigInteger('fiscal_period_id')
                  ->nullable()->after('journal_date');

            // Fund attribution at entry level (overrides default fund on individual accounts)
            $table->string('fund_code', 20)->nullable()->after('fiscal_period_id');

            // Approval workflow: Preparer → Finance Officer review → Bursar approval → Posted
            // Sits alongside existing status (draft/posted/reversed) which remains for system use
            $table->enum('approval_status', ['prepared', 'under_review', 'approved', 'rejected'])
                  ->default('prepared')->after('status');
            $table->unsignedBigInteger('prepared_by')->nullable()->after('approval_status');
            $table->unsignedBigInteger('reviewed_by')->nullable()->after('prepared_by');
            $table->unsignedBigInteger('bursar_approved_by')->nullable()->after('reviewed_by');

            // Reversal chain — posted entries are immutable; corrections are reversing entries only
            $table->unsignedBigInteger('reversal_of_id')
                  ->nullable()->after('bursar_approved_by')
                  ->comment('ID of the original entry this entry reverses');
            $table->unsignedBigInteger('reversal_entry_id')
                  ->nullable()->after('reversal_of_id')
                  ->comment('ID of the reversing entry created against this entry');

            $table->foreign('fiscal_period_id')
                  ->references('id')->on('fiscal_periods')
                  ->onDelete('restrict');
            $table->foreign('prepared_by')->references('id')->on('users')->onDelete('set null');
            $table->foreign('reviewed_by')->references('id')->on('users')->onDelete('set null');
            $table->foreign('bursar_approved_by')->references('id')->on('users')->onDelete('set null');
            $table->foreign('reversal_of_id')
                  ->references('id')->on('journal_entries')
                  ->onDelete('set null');
            $table->foreign('reversal_entry_id')
                  ->references('id')->on('journal_entries')
                  ->onDelete('set null');

            $table->index('fiscal_period_id');
            $table->index('fund_code');
            $table->index(['approval_status', 'status']);
        });
    }

    public function down(): void
    {
        Schema::table('journal_entries', function (Blueprint $table) {
            $table->dropForeign(['fiscal_period_id']);
            $table->dropForeign(['prepared_by']);
            $table->dropForeign(['reviewed_by']);
            $table->dropForeign(['bursar_approved_by']);
            $table->dropForeign(['reversal_of_id']);
            $table->dropForeign(['reversal_entry_id']);
            $table->dropIndex(['fiscal_period_id']);
            $table->dropIndex(['fund_code']);
            $table->dropIndex(['approval_status', 'status']);
            $table->dropColumn([
                'fiscal_period_id', 'fund_code', 'approval_status',
                'prepared_by', 'reviewed_by', 'bursar_approved_by',
                'reversal_of_id', 'reversal_entry_id',
            ]);
        });
    }
};
