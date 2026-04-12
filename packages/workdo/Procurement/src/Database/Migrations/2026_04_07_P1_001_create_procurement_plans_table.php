<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('procurement_plans')) {
            Schema::create('procurement_plans', function (Blueprint $table) {
                $table->id();
                $table->string('plan_number', 30)->unique()
                    ->comment('Auto-generated: PLAN-YYYY-NNN');
                $table->string('financial_year', 20)
                    ->comment('e.g. 2025/2026');
                $table->string('title');
                $table->foreignId('vote_cost_centre_id')
                    ->constrained('vote_cost_centres')
                    ->onDelete('restrict');
                $table->enum('status', ['draft', 'approved', 'active', 'closed'])
                    ->default('draft');
                $table->foreignId('approved_by')->nullable()
                    ->references('id')->on('users')->onDelete('set null');
                $table->timestamp('approved_at')->nullable();
                $table->text('notes')->nullable();
                $table->foreignId('creator_id')->nullable()->index();
                $table->foreignId('created_by')->nullable()->index();
                $table->foreign('creator_id')->references('id')->on('users')->onDelete('set null');
                $table->foreign('created_by')->references('id')->on('users')->onDelete('cascade');
                $table->timestamps();

                $table->index(['created_by', 'financial_year']);
                $table->index(['created_by', 'status']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('procurement_plans');
    }
};
