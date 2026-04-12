<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('goods_received_notes', function (Blueprint $table) {
            $table->string('inspection_status')->default('pending')->after('status')->comment('pending, accepted, rejected');
            $table->unsignedBigInteger('inspected_by')->nullable()->after('inspection_status');
            $table->timestamp('inspected_at')->nullable()->after('inspected_by');
            $table->text('inspection_remarks')->nullable()->after('inspected_at');
            
            $table->foreign('inspected_by')->references('id')->on('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('goods_received_notes', function (Blueprint $table) {
            $table->dropForeign(['inspected_by']);
            $table->dropColumn(['inspection_status', 'inspected_by', 'inspected_at', 'inspection_remarks']);
        });
    }
};
