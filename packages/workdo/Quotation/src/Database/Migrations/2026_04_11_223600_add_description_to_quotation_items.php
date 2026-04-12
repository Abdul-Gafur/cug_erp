<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sales_quotation_items', function (Blueprint $table) {
            if (!Schema::hasColumn('sales_quotation_items', 'description')) {
                $table->text('description')->nullable()->after('product_id');
            }
        });
    }

    public function down(): void
    {
        Schema::table('sales_quotation_items', function (Blueprint $table) {
            $table->dropColumn('description');
        });
    }
};
