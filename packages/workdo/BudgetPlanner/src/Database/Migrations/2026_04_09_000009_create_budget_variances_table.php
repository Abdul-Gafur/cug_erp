<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('budget_variances', function (Blueprint $table) {
            $table->id();

            $table->foreignId('budget_id')
                  ->constrained('budgets')
                  ->cascadeOnDelete();

            $table->foreignId('budget_allocation_id')
                  ->constrained('budget_allocations')
                  ->cascadeOnDelete();

            $table->foreignId('vote_cost_centre_id')
                  ->nullable()
                  ->constrained('vote_cost_centres')
                  ->nullOnDelete();

            $table->foreignId('account_id')
                  ->constrained('chart_of_accounts')
                  ->cascadeOnDelete();

            $table->string('economic_classification')->nullable();

            $table->decimal('budgeted_amount',  15, 2)->default(0);
            $table->decimal('committed_amount', 15, 2)->default(0);
            $table->decimal('actual_amount',    15, 2)->default(0);
            $table->decimal('variance',         15, 2)->default(0); // budgeted − actual
            $table->decimal('variance_percentage', 8, 2)->default(0);

            $table->date('snapshot_date');

            $table->foreignId('creator_id')->nullable()->constrained('users')->nullOnDelete();
            $table->unsignedBigInteger('created_by');

            $table->timestamps();

            $table->index('budget_id');
            $table->index('budget_allocation_id');
            $table->index(['snapshot_date', 'created_by']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('budget_variances');
    }
};
