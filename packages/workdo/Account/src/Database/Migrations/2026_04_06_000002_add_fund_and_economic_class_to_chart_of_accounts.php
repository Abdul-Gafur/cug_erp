<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('chart_of_accounts', function (Blueprint $table) {
            $table->unsignedBigInteger('fund_id')
                  ->nullable()
                  ->after('description')
                  ->comment('Default fund for this account; null = usable across all funds');

            $table->enum('economic_classification', [
                'personnel_emoluments',
                'goods_services',
                'capital_expenditure',
                'transfers_grants',
            ])->nullable()->after('fund_id');

            $table->foreign('fund_id')
                  ->references('id')->on('university_funds')
                  ->onDelete('set null');

            $table->index('fund_id');
            $table->index('economic_classification');
        });
    }

    public function down(): void
    {
        Schema::table('chart_of_accounts', function (Blueprint $table) {
            $table->dropForeign(['fund_id']);
            $table->dropIndex(['fund_id']);
            $table->dropIndex(['economic_classification']);
            $table->dropColumn(['fund_id', 'economic_classification']);
        });
    }
};
