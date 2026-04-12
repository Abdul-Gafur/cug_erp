<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Extend the vendors table with university procurement supplier fields:
 * - Registration number (company registration / certificate)
 * - TIN (Ghana Revenue Authority tax identification)
 * - Supplier category (seven university procurement categories)
 * - Bank details for payment processing
 * - Performance rating (1–5)
 * - Blacklist tracking with reason and audit trail
 *
 * The existing vendor_code, tax_number, payment_terms, etc. are retained.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('vendors', function (Blueprint $table) {
            if (!Schema::hasColumn('vendors', 'registration_number')) {
                $table->string('registration_number')->nullable()
                    ->after('company_name')
                    ->comment('Company / business registration certificate number');
            }
            if (!Schema::hasColumn('vendors', 'tin_number')) {
                $table->string('tin_number')->nullable()
                    ->after('registration_number')
                    ->comment('Ghana Revenue Authority Tax Identification Number');
            }
            if (!Schema::hasColumn('vendors', 'supplier_category')) {
                $table->string('supplier_category')->nullable()
                    ->after('tin_number')
                    ->comment(
                        'academic_laboratory | it_equipment_services | ' .
                        'construction_maintenance | catering_hospitality | ' .
                        'professional_services | general_supplies | books_publications'
                    );
            }
            if (!Schema::hasColumn('vendors', 'bank_name')) {
                $table->string('bank_name')->nullable()->after('payment_terms');
            }
            if (!Schema::hasColumn('vendors', 'bank_branch')) {
                $table->string('bank_branch')->nullable()->after('bank_name');
            }
            if (!Schema::hasColumn('vendors', 'bank_account_number')) {
                $table->string('bank_account_number')->nullable()->after('bank_branch');
            }
            if (!Schema::hasColumn('vendors', 'bank_account_name')) {
                $table->string('bank_account_name')->nullable()->after('bank_account_number')
                    ->comment('Account name as it appears on bank records');
            }
            if (!Schema::hasColumn('vendors', 'performance_rating')) {
                $table->tinyInteger('performance_rating')->nullable()
                    ->after('bank_account_name')
                    ->comment('1 (poor) – 5 (excellent); updated after each contract evaluation');
            }
            if (!Schema::hasColumn('vendors', 'is_blacklisted')) {
                $table->boolean('is_blacklisted')->default(false)->after('notes');
            }
            if (!Schema::hasColumn('vendors', 'blacklist_reason')) {
                $table->text('blacklist_reason')->nullable()->after('is_blacklisted');
            }
            if (!Schema::hasColumn('vendors', 'blacklisted_at')) {
                $table->timestamp('blacklisted_at')->nullable()->after('blacklist_reason');
            }
            if (!Schema::hasColumn('vendors', 'blacklisted_by')) {
                $table->foreignId('blacklisted_by')->nullable()
                    ->after('blacklisted_at')
                    ->references('id')->on('users')
                    ->onDelete('set null');
            }
        });
    }

    public function down(): void
    {
        Schema::table('vendors', function (Blueprint $table) {
            $drops = [
                'registration_number', 'tin_number', 'supplier_category',
                'bank_name', 'bank_branch', 'bank_account_number', 'bank_account_name',
                'performance_rating', 'is_blacklisted', 'blacklist_reason',
                'blacklisted_at', 'blacklisted_by',
            ];
            foreach ($drops as $col) {
                if (Schema::hasColumn('vendors', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
