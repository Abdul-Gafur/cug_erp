<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('purchase_requisitions')) {
            Schema::create('purchase_requisitions', function (Blueprint $table) {
                $table->id();
                $table->string('requisition_number', 30)->unique()
                    ->comment('Auto-generated: REQ-YYYY-NNN');
                $table->date('requisition_date');
                $table->foreignId('requesting_department_id')
                    ->constrained('vote_cost_centres')
                    ->onDelete('restrict')
                    ->comment('The Vote / Cost Centre raising this requisition');
                $table->text('purpose')
                    ->comment('What this procurement is for');
                $table->text('justification')
                    ->comment('Why it is needed');
                $table->enum('category', ['academic', 'administrative'])
                    ->default('administrative');

                // Link to annual procurement plan
                $table->foreignId('plan_item_id')->nullable()
                    ->constrained('procurement_plan_items')
                    ->onDelete('set null')
                    ->comment('Null = off-plan requisition');
                $table->boolean('is_off_plan')->default(false);
                $table->text('off_plan_justification')->nullable()
                    ->comment('Required when is_off_plan = true');

                // Budget dimension
                $table->foreignId('budget_period_id')
                    ->constrained('budget_periods')
                    ->onDelete('restrict');

                // Financials (sum of items)
                $table->decimal('subtotal', 15, 2)->default(0);
                $table->decimal('total_amount', 15, 2)->default(0);

                // Approval workflow
                $table->enum('status', [
                    'draft',
                    'submitted',
                    'hod_approved',
                    'finance_checked',
                    'procurement_approved',
                    'rejected',
                    'cancelled',
                ])->default('draft');

                // Head of Department step
                $table->foreignId('hod_approved_by')->nullable()
                    ->references('id')->on('users')->onDelete('set null');
                $table->timestamp('hod_approved_at')->nullable();

                // Finance Office step (triggers CommitmentService)
                $table->foreignId('finance_checked_by')->nullable()
                    ->references('id')->on('users')->onDelete('set null');
                $table->timestamp('finance_checked_at')->nullable();
                $table->text('finance_notes')->nullable();

                // Procurement Officer step
                $table->foreignId('procurement_approved_by')->nullable()
                    ->references('id')->on('users')->onDelete('set null');
                $table->timestamp('procurement_approved_at')->nullable();

                // Rejection
                $table->foreignId('rejected_by')->nullable()
                    ->references('id')->on('users')->onDelete('set null');
                $table->timestamp('rejected_at')->nullable();
                $table->text('rejection_reason')->nullable();

                $table->foreignId('creator_id')->nullable()->index();
                $table->foreignId('created_by')->nullable()->index();
                $table->foreign('creator_id')->references('id')->on('users')->onDelete('set null');
                $table->foreign('created_by')->references('id')->on('users')->onDelete('cascade');
                $table->timestamps();

                $table->index(['created_by', 'status']);
                $table->index(['requesting_department_id', 'status']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('purchase_requisitions');
    }
};
