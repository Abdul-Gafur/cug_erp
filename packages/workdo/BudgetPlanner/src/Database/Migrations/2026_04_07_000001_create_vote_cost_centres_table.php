<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('vote_cost_centres')) {
            Schema::create('vote_cost_centres', function (Blueprint $table) {
                $table->id();
                $table->string('code', 20)->comment('Short code, e.g. FAC-ENG');
                $table->string('name')->comment('Full name, e.g. Faculty of Engineering');
                $table->text('description')->nullable();
                $table->boolean('is_active')->default(true);
                $table->foreignId('creator_id')->nullable()->index();
                $table->foreignId('created_by')->nullable()->index();
                $table->foreign('creator_id')->references('id')->on('users')->onDelete('set null');
                $table->foreign('created_by')->references('id')->on('users')->onDelete('cascade');
                $table->timestamps();

                $table->unique(['code', 'created_by']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('vote_cost_centres');
    }
};
