<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('budgets', function (Blueprint $table) {
            $table->string('programme_name', 200)->nullable()->after('revision_reason');
            $table->text('strategic_objective')->nullable()->after('programme_name');
            $table->text('justification')->nullable()->after('strategic_objective');
        });
    }

    public function down(): void
    {
        Schema::table('budgets', function (Blueprint $table) {
            $table->dropColumn(['programme_name', 'strategic_objective', 'justification']);
        });
    }
};
