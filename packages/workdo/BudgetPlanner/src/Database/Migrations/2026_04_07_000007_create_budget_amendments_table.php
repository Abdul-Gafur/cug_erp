<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Budget amendment audit trail.
     *
     * Covers two amendment patterns:
     *
     * 1. Virement — transfer of budget between two allocation lines within
     *    the same Vote and Fund. Requires Finance Committee approval.
     *    from_allocation_id and to_allocation_id are both populated.
     *
     * 2. Revision / Supplementary — creates a new budget document
     *    (budget_subtype = revised | supplementary) linked via
     *    Budget.parent_budget_id. The amendment row records the authority
     *    and reason for the revision.
     *    from_allocation_id = null, to_allocation_id = null.
     */
    public function up(): void
    {
        if (!Schema::hasTable('budget_amendments')) {
            Schema::create('budget_amendments', function (Blueprint $table) {
                $table->id();

                $table->foreignId('budget_id')
                    ->constrained('budgets')
                    ->onDelete('cascade');

                $table->enum('amendment_type', [
                    'virement',       // inter-vote or intra-vote transfer
                    'revision',       // mid-year revised budget
                    'supplementary',  // additional allocation approved by VC/Council
                ]);

                // Virement: source allocation
                $table->foreignId('from_allocation_id')
                    ->nullable()
                    ->constrained('budget_allocations')
                    ->onDelete('set null');

                // Virement: destination allocation
                $table->foreignId('to_allocation_id')
                    ->nullable()
                    ->constrained('budget_allocations')
                    ->onDelete('set null');

                $table->decimal('amount', 15, 2);
                $table->text('reason');

                $table->enum('status', ['draft', 'approved', 'rejected'])
                    ->default('draft');

                $table->foreignId('approved_by')
                    ->nullable()
                    ->constrained('users')
                    ->onDelete('set null');

                $table->timestamp('approved_at')->nullable();
                $table->text('rejection_reason')->nullable();

                $table->foreignId('creator_id')->nullable()->index();
                $table->foreignId('created_by')->nullable()->index();
                $table->foreign('creator_id')->references('id')->on('users')->onDelete('set null');
                $table->foreign('created_by')->references('id')->on('users')->onDelete('cascade');
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('budget_amendments');
    }
};
