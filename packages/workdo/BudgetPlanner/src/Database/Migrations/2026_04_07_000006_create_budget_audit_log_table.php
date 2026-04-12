<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Immutable budget audit trail.
     * Records every budget check, commitment, override, and reversal
     * with the acting user, timestamp, and reason — as required by IPSAS
     * and public sector accountability standards.
     *
     * Rows are NEVER updated or deleted after creation.
     */
    public function up(): void
    {
        if (!Schema::hasTable('budget_audit_log')) {
            Schema::create('budget_audit_log', function (Blueprint $table) {
                $table->id();

                // Which allocation was affected (nullable for period-level events)
                $table->foreignId('budget_allocation_id')
                    ->nullable()
                    ->constrained('budget_allocations')
                    ->onDelete('set null');

                $table->enum('event_type', [
                    'check',        // budget availability check performed
                    'commitment',   // commitment recorded
                    'commitment_update', // commitment amount revised
                    'reversal',     // commitment reversed on invoice posting
                    'actual',       // actual expenditure posted
                    'override',     // user overrode a budget warning
                    'virement',     // budget transfer between votes
                ])->index();

                // What triggered this event
                $table->string('source_type')->nullable()
                    ->comment('purchase_requisition | lpo | purchase_invoice | journal_entry | virement');
                $table->unsignedBigInteger('source_id')->nullable();

                $table->decimal('amount', 15, 2)->nullable();

                // Result of a budget check
                $table->enum('result', ['passed', 'blocked', 'warned', 'overridden'])
                    ->nullable();

                // Required when result=overridden
                $table->text('override_reason')->nullable();

                // Budget position snapshot at the time of this event
                $table->decimal('approved_at_event', 15, 2)->nullable();
                $table->decimal('committed_at_event', 15, 2)->nullable();
                $table->decimal('actual_at_event', 15, 2)->nullable();
                $table->decimal('available_at_event', 15, 2)->nullable();

                $table->foreignId('user_id')
                    ->constrained('users')
                    ->onDelete('cascade');

                $table->foreignId('created_by')->nullable()->index();
                $table->timestamps();

                $table->index(['source_type', 'source_id']);
                $table->index(['budget_allocation_id', 'event_type']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('budget_audit_log');
    }
};
