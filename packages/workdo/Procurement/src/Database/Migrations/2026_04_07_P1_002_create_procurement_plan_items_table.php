<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('procurement_plan_items')) {
            Schema::create('procurement_plan_items', function (Blueprint $table) {
                $table->id();
                $table->foreignId('plan_id')
                    ->constrained('procurement_plans')
                    ->onDelete('cascade');
                $table->text('item_description');
                $table->decimal('quantity', 15, 3)->default(1);
                $table->string('unit', 30)->nullable()
                    ->comment('e.g. units, reams, litres');
                $table->decimal('estimated_unit_cost', 15, 2)->default(0);
                $table->decimal('estimated_total_cost', 15, 2)->default(0)
                    ->comment('Computed: quantity × unit cost');
                $table->enum('procurement_method', [
                    'open_tender',
                    'restricted_tender',
                    'rfq',
                    'single_source',
                    'framework_agreement',
                ])->comment('PPDA procurement threshold method');
                $table->tinyInteger('planned_quarter')->default(1)
                    ->comment('1–4 — which quarter of the financial year');
                $table->foreignId('account_id')
                    ->constrained('chart_of_accounts')
                    ->onDelete('restrict')
                    ->comment('Expenditure GL account / budget head');
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

                $table->index(['plan_id', 'planned_quarter']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('procurement_plan_items');
    }
};
