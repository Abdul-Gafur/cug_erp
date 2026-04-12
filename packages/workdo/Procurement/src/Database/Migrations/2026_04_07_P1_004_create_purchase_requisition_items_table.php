<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('purchase_requisition_items')) {
            Schema::create('purchase_requisition_items', function (Blueprint $table) {
                $table->id();
                $table->foreignId('requisition_id')
                    ->constrained('purchase_requisitions')
                    ->onDelete('cascade');
                $table->text('description');
                $table->decimal('quantity', 15, 3)->default(1);
                $table->string('unit', 30)->nullable();
                $table->decimal('estimated_unit_cost', 15, 2)->default(0);
                $table->decimal('estimated_total_cost', 15, 2)->default(0)
                    ->comment('quantity × unit cost');

                // Budget coding per line — each line can hit a different budget head
                $table->foreignId('account_id')
                    ->constrained('chart_of_accounts')
                    ->onDelete('restrict')
                    ->comment('GL account / budget head for this line');
                $table->string('fund_type', 50)
                    ->comment('IGF | GoG | Donor | Grant');
                $table->string('economic_classification', 50)
                    ->comment('personal_emoluments | goods_services | capital_expenditure | transfers');

                $table->text('notes')->nullable();
                $table->foreignId('creator_id')->nullable()->index();
                $table->foreignId('created_by')->nullable()->index();
                $table->foreign('creator_id')->references('id')->on('users')->onDelete('set null');
                $table->foreign('created_by')->references('id')->on('users')->onDelete('cascade');
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('purchase_requisition_items');
    }
};
