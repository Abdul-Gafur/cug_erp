<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (Schema::hasTable('rfq_evaluations')) {
            Schema::table('rfq_evaluations', function (Blueprint $table) {
                // Change status from fixed enum to string for flexibility
                $table->string('status')->default('draft')->change();
                
                // Add committee columns if they don't exist
                if (!Schema::hasColumn('rfq_evaluations', 'committee_members')) {
                    $table->json('committee_members')->nullable()->after('recommendation_notes');
                }
                if (!Schema::hasColumn('rfq_evaluations', 'committee_approved_by')) {
                    $table->foreignId('committee_approved_by')->nullable()->constrained('users')->onDelete('set null')->after('finalised_at');
                }
                if (!Schema::hasColumn('rfq_evaluations', 'committee_approved_at')) {
                    $table->timestamp('committee_approved_at')->nullable()->after('committee_approved_by');
                }
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('rfq_evaluations')) {
            Schema::table('rfq_evaluations', function (Blueprint $table) {
                // We don't easily change back to enum in down() because data might be invalid
                $table->dropColumn(['committee_members', 'committee_approved_by', 'committee_approved_at']);
            });
        }
    }
};
