<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fiscal_years', function (Blueprint $table) {
            $table->id();
            $table->string('year_code', 20)->unique();  // e.g. FY2026
            $table->smallInteger('year_number');         // e.g. 2026
            $table->date('start_date');                  // 2026-01-01
            $table->date('end_date');                    // 2026-12-31
            $table->enum('status', ['draft', 'active', 'closed'])->default('draft');
            $table->unsignedBigInteger('closed_by')->nullable();
            $table->timestamp('closed_at')->nullable();
            $table->foreignId('creator_id')->nullable()->index();
            $table->foreignId('created_by')->nullable()->index();
            $table->timestamps();

            $table->foreign('closed_by')->references('id')->on('users')->onDelete('set null');
            $table->foreign('creator_id')->references('id')->on('users')->onDelete('set null');
            $table->foreign('created_by')->references('id')->on('users')->onDelete('cascade');

            $table->index('status');
            $table->index('year_number');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fiscal_years');
    }
};
