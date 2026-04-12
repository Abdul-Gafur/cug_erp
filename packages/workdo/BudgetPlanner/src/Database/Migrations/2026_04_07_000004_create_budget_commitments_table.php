<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Commitment / encumbrance ledger.
     *
     * Each row represents a single commitment against a budget allocation line.
     * Lifecycle:
     *   PR approved   → status=active,   source_type=purchase_requisition
     *   LPO issued    → status=updated,  source_type=lpo (amount adjusted)
     *   Invoice posted → status=reversed, reversed_at set, committed_amount on
     *                    the parent allocation decremented
     */
    public function up(): void
    {
        if (!Schema::hasTable('budget_commitments')) {
            Schema::create('budget_commitments', function (Blueprint $table) {
                $table->id();
                $table->foreignId('budget_allocation_id')
                    ->constrained('budget_allocations')
                    ->onDelete('cascade');

                // What created this commitment
                $table->string('source_type')
                    ->comment('purchase_requisition | lpo | purchase_order');
                $table->unsignedBigInteger('source_id')
                    ->comment('PK of the source record');

                $table->decimal('amount', 15, 2);

                $table->enum('status', ['active', 'updated', 'reversed'])
                    ->default('active');

                $table->text('notes')->nullable();
                $table->timestamp('reversed_at')->nullable();

                $table->foreignId('creator_id')->nullable()->index();
                $table->foreignId('created_by')->nullable()->index();
                $table->foreign('creator_id')->references('id')->on('users')->onDelete('set null');
                $table->foreign('created_by')->references('id')->on('users')->onDelete('cascade');
                $table->timestamps();

                $table->index(['source_type', 'source_id']);
                $table->index(['budget_allocation_id', 'status']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('budget_commitments');
    }
};
