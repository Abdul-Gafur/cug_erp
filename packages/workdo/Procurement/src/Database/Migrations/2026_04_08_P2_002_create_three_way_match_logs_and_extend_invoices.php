<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // ── Extend purchase_invoices with LPO link and match state ────────────
        Schema::table('purchase_invoices', function (Blueprint $table) {
            if (!Schema::hasColumn('purchase_invoices', 'lpo_id')) {
                $table->unsignedBigInteger('lpo_id')->nullable()->after('warehouse_id')
                    ->comment('LPO this invoice is presented against (enables three-way match)');
                $table->foreign('lpo_id')
                    ->references('id')->on('local_purchase_orders')
                    ->onDelete('set null');
            }
            if (!Schema::hasColumn('purchase_invoices', 'match_status')) {
                $table->enum('match_status', ['pending', 'pass', 'fail', 'override'])
                    ->default('pending')->after('lpo_id')
                    ->comment('Result of the three-way match check');
            }
            if (!Schema::hasColumn('purchase_invoices', 'match_override_reason')) {
                $table->text('match_override_reason')->nullable()->after('match_status');
            }
            if (!Schema::hasColumn('purchase_invoices', 'match_override_by')) {
                $table->foreignId('match_override_by')->nullable()->after('match_override_reason')
                    ->references('id')->on('users')->onDelete('set null');
            }
        });

        // ── Three-way match audit log ─────────────────────────────────────────
        if (!Schema::hasTable('three_way_match_logs')) {
            Schema::create('three_way_match_logs', function (Blueprint $table) {
                $table->id();
                $table->string('match_ref', 30)->unique()
                    ->comment('Auto-generated: MATCH-YYYY-MM-NNNN');

                $table->unsignedBigInteger('invoice_id')
                    ->comment('FK purchase_invoices');
                $table->foreign('invoice_id')
                    ->references('id')->on('purchase_invoices')
                    ->onDelete('cascade');

                $table->unsignedBigInteger('lpo_id')->nullable();
                $table->foreign('lpo_id')
                    ->references('id')->on('local_purchase_orders')
                    ->onDelete('set null');

                $table->unsignedBigInteger('grn_id')->nullable()
                    ->comment('Primary GRN matched against');
                $table->foreign('grn_id')
                    ->references('id')->on('goods_received_notes')
                    ->onDelete('set null');

                $table->enum('match_status', ['pass', 'fail', 'override'])
                    ->comment('Outcome of the match attempt');

                $table->json('discrepancies')->nullable()
                    ->comment('JSON array of per-line discrepancy detail');

                // Override fields (only populated when Finance Officer overrides a fail)
                $table->text('override_reason')->nullable();
                $table->foreignId('override_by')->nullable()
                    ->references('id')->on('users')->onDelete('set null');
                $table->timestamp('override_at')->nullable();

                $table->foreignId('performed_by')
                    ->nullable()
                    ->references('id')->on('users')->onDelete('set null');

                $table->foreignId('creator_id')->nullable()
                    ->references('id')->on('users')->onDelete('set null');
                $table->foreignId('created_by')
                    ->references('id')->on('users')->onDelete('cascade');

                $table->timestamps();

                $table->index(['invoice_id']);
                $table->index(['created_by', 'match_status']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('three_way_match_logs');

        Schema::table('purchase_invoices', function (Blueprint $table) {
            $table->dropForeign(['match_override_by']);
            $table->dropForeign(['lpo_id']);
            $table->dropColumn(['lpo_id', 'match_status', 'match_override_reason', 'match_override_by']);
        });
    }
};
