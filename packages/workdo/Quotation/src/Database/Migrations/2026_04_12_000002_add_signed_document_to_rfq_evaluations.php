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
                if (!Schema::hasColumn('rfq_evaluations', 'signed_document')) {
                    $table->string('signed_document')->nullable()->after('committee_approved_at');
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
                $table->dropColumn('signed_document');
            });
        }
    }
};
