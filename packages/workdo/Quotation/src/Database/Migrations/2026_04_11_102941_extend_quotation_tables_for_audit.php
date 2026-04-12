<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('rfq_evaluations', function (Blueprint $table) {
            $table->json('committee_members')->nullable()->after('recommended_supplier_id')->comment('Array of user IDs for committee');
            $table->unsignedBigInteger('committee_approved_by')->nullable()->after('finalised_at');
            $table->timestamp('committee_approved_at')->nullable()->after('committee_approved_by');
            
            $table->foreign('committee_approved_by')->references('id')->on('users')->nullOnDelete();
        });

        Schema::table('local_purchase_orders', function (Blueprint $table) {
            $table->boolean('is_contract')->default(false)->after('status');
            $table->string('contract_number')->nullable()->after('is_contract');
            $table->text('contract_terms')->nullable()->after('contract_number');
        });
    }

    public function down(): void
    {
        Schema::table('rfq_evaluations', function (Blueprint $table) {
            $table->dropForeign(['committee_approved_by']);
            $table->dropColumn(['committee_members', 'committee_approved_by', 'committee_approved_at']);
        });

        Schema::table('local_purchase_orders', function (Blueprint $table) {
            $table->dropColumn(['is_contract', 'contract_number', 'contract_terms']);
        });
    }
};
