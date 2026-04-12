<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Evaluation header — one per RFQ
        Schema::create('rfq_evaluations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('rfq_id')->unique()->constrained('sales_quotations')->onDelete('cascade');
            $table->enum('status', ['draft', 'finalised'])->default('draft');
            $table->text('recommendation_notes')->nullable();
            $table->foreignId('recommended_supplier_id')->nullable()->constrained('users')->onDelete('set null');
            $table->foreignId('finalised_by')->nullable()->constrained('users')->onDelete('set null');
            $table->timestamp('finalised_at')->nullable();
            $table->foreignId('creator_id')->nullable()->constrained('users')->onDelete('set null');
            $table->foreignId('created_by')->constrained('users')->onDelete('cascade');
            $table->timestamps();
        });

        // Weighted criteria — configurable per evaluation
        Schema::create('rfq_evaluation_criteria', function (Blueprint $table) {
            $table->id();
            $table->foreignId('evaluation_id')->constrained('rfq_evaluations')->onDelete('cascade');
            $table->string('criterion_name');
            $table->decimal('weight', 5, 2)->comment('Percentage weight, e.g. 40.00 for 40%');
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->foreignId('creator_id')->nullable()->constrained('users')->onDelete('set null');
            $table->foreignId('created_by')->constrained('users')->onDelete('cascade');
            $table->timestamps();
        });

        // Scores — per supplier per criterion
        Schema::create('rfq_evaluation_scores', function (Blueprint $table) {
            $table->id();
            $table->foreignId('evaluation_id')->constrained('rfq_evaluations')->onDelete('cascade');
            $table->foreignId('criterion_id')->constrained('rfq_evaluation_criteria')->onDelete('cascade');
            $table->foreignId('supplier_id')->constrained('users')->onDelete('cascade');
            $table->decimal('score', 5, 2)->comment('Raw score 0–100');
            $table->decimal('weighted_score', 8, 4)->default(0)->comment('score/100 * weight');
            $table->text('notes')->nullable();
            $table->foreignId('creator_id')->nullable()->constrained('users')->onDelete('set null');
            $table->foreignId('created_by')->constrained('users')->onDelete('cascade');
            $table->timestamps();

            $table->unique(['evaluation_id', 'criterion_id', 'supplier_id'], 'rfq_eval_scores_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rfq_evaluation_scores');
        Schema::dropIfExists('rfq_evaluation_criteria');
        Schema::dropIfExists('rfq_evaluations');
    }
};
