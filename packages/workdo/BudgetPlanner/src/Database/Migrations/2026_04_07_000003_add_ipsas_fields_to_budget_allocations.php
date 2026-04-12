<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('budget_allocations', function (Blueprint $table) {
            // Economic Classification (IPSAS 24 / GFS 2014 classification)
            $table->enum('economic_classification', [
                'personnel_emoluments',
                'goods_services',
                'capital_expenditure',
                'transfers_grants',
            ])->nullable()->after('account_id');

            // Quarterly distribution — must sum to allocated_amount (enforced in FormRequest)
            $table->decimal('q1_amount', 15, 2)->default(0)->after('allocated_amount');
            $table->decimal('q2_amount', 15, 2)->default(0)->after('q1_amount');
            $table->decimal('q3_amount', 15, 2)->default(0)->after('q2_amount');
            $table->decimal('q4_amount', 15, 2)->default(0)->after('q3_amount');

            // Commitment tracking (sum of active BudgetCommitment records)
            // Updated atomically by CommitmentService — never edited manually
            $table->decimal('committed_amount', 15, 2)->default(0)->after('spent_amount');
        });
    }

    public function down(): void
    {
        Schema::table('budget_allocations', function (Blueprint $table) {
            $table->dropColumn([
                'economic_classification',
                'q1_amount',
                'q2_amount',
                'q3_amount',
                'q4_amount',
                'committed_amount',
            ]);
        });
    }
};
