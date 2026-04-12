<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sales_quotations', function (Blueprint $table) {
            if (!Schema::hasColumn('sales_quotations', 'closing_date')) {
                $table->date('closing_date')->nullable()->after('due_date');
            }
            if (!Schema::hasColumn('sales_quotations', 'department')) {
                $table->string('department')->nullable()->after('closing_date');
            }
            if (!Schema::hasColumn('sales_quotations', 'pr_id')) {
                $table->unsignedBigInteger('pr_id')->nullable()->after('department');
            }
            if (!Schema::hasColumn('sales_quotations', 'awarded_supplier_id')) {
                $table->unsignedBigInteger('awarded_supplier_id')->nullable()->after('pr_id');
            }
        });

        // Add FKs separately after columns are confirmed present
        // Check for existing constraints to stay idempotent on re-run
        $existingFks = collect(\DB::select("
            SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'sales_quotations'
              AND CONSTRAINT_TYPE = 'FOREIGN KEY'
        "))->pluck('CONSTRAINT_NAME')->toArray();

        if (!in_array('sales_quotations_pr_id_foreign', $existingFks)
            && Schema::hasTable('purchase_requisitions')) {
            Schema::table('sales_quotations', function (Blueprint $table) {
                $table->foreign('pr_id')
                      ->references('id')->on('purchase_requisitions')
                      ->onDelete('set null');
            });
        }

        if (!in_array('sales_quotations_awarded_supplier_id_foreign', $existingFks)) {
            Schema::table('sales_quotations', function (Blueprint $table) {
                $table->foreign('awarded_supplier_id')
                      ->references('id')->on('users')
                      ->onDelete('set null');
            });
        }

        // Extend status enum to cover full RFQ lifecycle.
        // MySQL requires redefining the column.
        DB::statement("ALTER TABLE sales_quotations MODIFY COLUMN status ENUM(
            'draft',
            'issued',
            'closed',
            'under_evaluation',
            'awarded',
            'lpo_issued',
            'rejected'
        ) NOT NULL DEFAULT 'draft'");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE sales_quotations MODIFY COLUMN status ENUM(
            'draft','sent','accepted','rejected'
        ) NOT NULL DEFAULT 'draft'");

        Schema::table('sales_quotations', function (Blueprint $table) {
            $table->dropForeign(['pr_id']);
            $table->dropForeign(['awarded_supplier_id']);
            $table->dropColumn(['closing_date', 'department', 'pr_id', 'awarded_supplier_id']);
        });
    }
};
