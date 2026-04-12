<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Step 1: widen the enum to allow both equity and net_asset simultaneously
        DB::statement(
            "ALTER TABLE `account_categories`
             MODIFY COLUMN `type`
             ENUM('assets','liabilities','equity','net_asset','revenue','expenses') NOT NULL"
        );

        // Step 2: move every existing equity row to net_asset
        DB::table('account_categories')
            ->where('type', 'equity')
            ->update(['type' => 'net_asset']);

        // Step 3: now that equity is vacated, remove it from the enum definition
        DB::statement(
            "ALTER TABLE `account_categories`
             MODIFY COLUMN `type`
             ENUM('assets','liabilities','net_asset','revenue','expenses') NOT NULL"
        );
    }

    public function down(): void
    {
        // Reverse: add equity back, move net_asset rows back to equity, drop net_asset
        DB::statement(
            "ALTER TABLE `account_categories`
             MODIFY COLUMN `type`
             ENUM('assets','liabilities','net_asset','equity','revenue','expenses') NOT NULL"
        );

        DB::table('account_categories')
            ->where('type', 'net_asset')
            ->update(['type' => 'equity']);

        DB::statement(
            "ALTER TABLE `account_categories`
             MODIFY COLUMN `type`
             ENUM('assets','liabilities','equity','revenue','expenses') NOT NULL"
        );
    }
};
