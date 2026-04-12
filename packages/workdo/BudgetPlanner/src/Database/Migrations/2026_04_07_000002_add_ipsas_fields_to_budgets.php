<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('budgets', function (Blueprint $table) {
            // Vote / Cost Centre link
            $table->foreignId('vote_cost_centre_id')
                ->nullable()
                ->after('period_id')
                ->constrained('vote_cost_centres')
                ->onDelete('restrict');

            // Funding source dimension
            $table->enum('fund_type', [
                'general_fund',
                'igf',
                'research_grants',
                'donor_endowment',
                'capital_development',
            ])->nullable()->after('vote_cost_centre_id');

            // Budget document type (IPSAS 24 — original, revised, supplementary)
            $table->enum('budget_subtype', [
                'original',
                'revised',
                'supplementary',
            ])->default('original')->after('fund_type');

            // Revised / supplementary budgets link back to the original
            $table->foreignId('parent_budget_id')
                ->nullable()
                ->after('budget_subtype')
                ->constrained('budgets')
                ->onDelete('set null');

            $table->text('revision_reason')->nullable()->after('parent_budget_id');

            // Extended approval hierarchy
            // Step 1 — Finance Office review (after dept_approved)
            $table->foreignId('finance_office_reviewed_by')->nullable()->after('approved_by');
            $table->timestamp('finance_office_reviewed_at')->nullable()->after('finance_office_reviewed_by');

            // Step 2 — Finance Committee approval
            $table->foreignId('finance_committee_approved_by')->nullable()->after('finance_office_reviewed_at');
            $table->timestamp('finance_committee_approved_at')->nullable()->after('finance_committee_approved_by');

            // Step 3 — Vice-Chancellor authorisation (locks the budget)
            $table->foreignId('vc_authorised_by')->nullable()->after('finance_committee_approved_at');
            $table->timestamp('vc_authorised_at')->nullable()->after('vc_authorised_by');

            // Set when VC authorises; prevents any further direct edits
            $table->timestamp('locked_at')->nullable()->after('vc_authorised_at');

            // Extend status enum to cover the full university governance chain
            // MySQL ALTER COLUMN for enum — must list all values including existing ones
            // Existing values: draft, approved, active, closed
            // New values added: dept_approved, finance_reviewed, committee_approved, vc_authorised
            \DB::statement("ALTER TABLE budgets MODIFY COLUMN status ENUM(
                'draft',
                'dept_approved',
                'finance_reviewed',
                'committee_approved',
                'vc_authorised',
                'approved',
                'active',
                'closed'
            ) NOT NULL DEFAULT 'draft'");

            // FKs for the new user references
            $table->foreign('finance_office_reviewed_by')->references('id')->on('users')->onDelete('set null');
            $table->foreign('finance_committee_approved_by')->references('id')->on('users')->onDelete('set null');
            $table->foreign('vc_authorised_by')->references('id')->on('users')->onDelete('set null');
        });
    }

    public function down(): void
    {
        Schema::table('budgets', function (Blueprint $table) {
            $table->dropForeign(['vote_cost_centre_id']);
            $table->dropForeign(['parent_budget_id']);
            $table->dropForeign(['finance_office_reviewed_by']);
            $table->dropForeign(['finance_committee_approved_by']);
            $table->dropForeign(['vc_authorised_by']);

            $table->dropColumn([
                'vote_cost_centre_id',
                'fund_type',
                'budget_subtype',
                'parent_budget_id',
                'revision_reason',
                'finance_office_reviewed_by',
                'finance_office_reviewed_at',
                'finance_committee_approved_by',
                'finance_committee_approved_at',
                'vc_authorised_by',
                'vc_authorised_at',
                'locked_at',
            ]);

            \DB::statement("ALTER TABLE budgets MODIFY COLUMN status ENUM(
                'draft','approved','active','closed'
            ) NOT NULL DEFAULT 'draft'");
        });
    }
};
