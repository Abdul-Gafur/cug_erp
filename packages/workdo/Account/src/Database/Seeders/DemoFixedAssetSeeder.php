<?php

namespace Workdo\Account\Database\Seeders;

use Illuminate\Database\Seeder;
use Workdo\Account\Models\ChartOfAccount;
use Workdo\Account\Models\FixedAsset;
use Workdo\Account\Models\FixedAssetCategory;
use Workdo\Account\Models\UniversityFund;

class DemoFixedAssetSeeder extends Seeder
{
    public function run($userId): void
    {
        if (FixedAsset::where('created_by', $userId)->exists()) {
            return;
        }

        // Resolve GL accounts by code
        $accounts = ChartOfAccount::where('created_by', $userId)
            ->whereIn('account_code', ['1600', '1610', '1800', '1810', '5600', '5620'])
            ->pluck('id', 'account_code');

        // Resolve fixed-asset categories by name
        $categories = FixedAssetCategory::where('created_by', $userId)
            ->pluck('id', 'name');

        // Resolve funds by code
        $funds = UniversityFund::where('created_by', $userId)
            ->pluck('id', 'code');

        if ($categories->isEmpty() || $accounts->isEmpty()) {
            return;
        }

        $igfFundId     = $funds['IGF']     ?? null;
        $capitalFundId = $funds['CAPITAL'] ?? null;
        $gfFundId      = $funds['GF']      ?? null;

        $eqAccId    = $accounts['1600'] ?? null;
        $eqAccDepId = $accounts['1610'] ?? null;
        $eqDepExpId = $accounts['5600'] ?? null;
        $mvAccId    = $accounts['1800'] ?? null;
        $mvAccDepId = $accounts['1810'] ?? null;
        $mvDepExpId = $accounts['5620'] ?? null;

        $itCatId     = $categories['IT Equipment & Software']    ?? null;
        $labCatId    = $categories['Laboratory Equipment']       ?? null;
        $furniCatId  = $categories['Furniture & Fittings']       ?? null;
        $vehicleCatId= $categories['Motor Vehicles']             ?? $categories->first();
        $libCatId    = $categories['Library Books & Resources']  ?? null;

        $assets = [
            // ── IT Equipment ──────────────────────────────────────────────────
            [
                'asset_name'          => 'HP ProDesk 400 G9 Desktop Computers (Lab Batch — 30 units)',
                'category_id'         => $itCatId,
                'description'         => 'Computer laboratory workstations for School of Engineering undergraduate practicals',
                'fund_id'             => $igfFundId,
                'department'          => 'ICT Services',
                'location'            => 'Computer Lab 1, Block B',
                'purchase_date'       => '2023-09-01',
                'purchase_cost'       => 72000.00,
                'residual_value'      => 3600.00,
                'useful_life_months'  => 48,
                'depreciation_method' => 'straight_line',
                'accumulated_depreciation' => 34650.00, // ~18 months depreciated
                'asset_account_id'    => $eqAccId,
                'accumulated_depreciation_account_id' => $eqAccDepId,
                'depreciation_expense_account_id'     => $eqDepExpId,
                'status'              => 'active',
            ],
            // ── Network Server ────────────────────────────────────────────────
            [
                'asset_name'          => 'Dell PowerEdge R750 Server (Student Portal & ERP Host)',
                'category_id'         => $itCatId,
                'description'         => 'Primary application server hosting the student information system and ERP',
                'fund_id'             => $capitalFundId,
                'department'          => 'ICT Services',
                'location'            => 'Server Room, Admin Block',
                'purchase_date'       => '2024-01-15',
                'purchase_cost'       => 48500.00,
                'residual_value'      => 2425.00,
                'useful_life_months'  => 48,
                'depreciation_method' => 'straight_line',
                'accumulated_depreciation' => 11568.75, // ~12 months
                'asset_account_id'    => $eqAccId,
                'accumulated_depreciation_account_id' => $eqAccDepId,
                'depreciation_expense_account_id'     => $eqDepExpId,
                'status'              => 'active',
            ],
            // ── Laboratory Equipment ──────────────────────────────────────────
            [
                'asset_name'          => 'Shimadzu UV-Vis Spectrophotometer UV-1900i',
                'category_id'         => $labCatId,
                'description'         => 'Ultraviolet-visible spectrophotometer for Chemistry & Environmental Science labs',
                'fund_id'             => $funds['RESEARCH'] ?? $igfFundId,
                'department'          => 'School of Engineering & Applied Sciences',
                'location'            => 'Chemistry Laboratory, Block C',
                'purchase_date'       => '2022-06-10',
                'purchase_cost'       => 32000.00,
                'residual_value'      => 1600.00,
                'useful_life_months'  => 120,
                'depreciation_method' => 'straight_line',
                'accumulated_depreciation' => 8680.00, // ~33 months
                'asset_account_id'    => $eqAccId,
                'accumulated_depreciation_account_id' => $eqAccDepId,
                'depreciation_expense_account_id'     => $eqDepExpId,
                'status'              => 'active',
            ],
            // ── Furniture ────────────────────────────────────────────────────
            [
                'asset_name'          => 'Senate Chamber Furniture Set (Tables, Chairs & Podium)',
                'category_id'         => $furniCatId,
                'description'         => 'Formal furniture for the University Senate Chamber — 80-seat configuration',
                'fund_id'             => $capitalFundId,
                'department'          => 'Vice Chancellor\'s Office',
                'location'            => 'Senate Chamber, Admin Block, Ground Floor',
                'purchase_date'       => '2021-11-20',
                'purchase_cost'       => 28000.00,
                'residual_value'      => 1400.00,
                'useful_life_months'  => 120,
                'depreciation_method' => 'straight_line',
                'accumulated_depreciation' => 11113.33, // ~40 months
                'asset_account_id'    => $eqAccId,
                'accumulated_depreciation_account_id' => $eqAccDepId,
                'depreciation_expense_account_id'     => $eqDepExpId,
                'status'              => 'active',
            ],
            // ── Motor Vehicle ─────────────────────────────────────────────────
            [
                'asset_name'          => 'Toyota Land Cruiser 200 Series V8 (VC Official Vehicle)',
                'category_id'         => $vehicleCatId,
                'description'         => 'Official vehicle assigned to the Vice Chancellor — registration GS 3421-23',
                'fund_id'             => $gfFundId,
                'department'          => 'Vice Chancellor\'s Office',
                'location'            => 'University Vehicle Pool',
                'purchase_date'       => '2023-03-01',
                'purchase_cost'       => 95000.00,
                'residual_value'      => 19000.00,
                'useful_life_months'  => 60,
                'depreciation_method' => 'straight_line',
                'accumulated_depreciation' => 30400.00, // ~16 months
                'asset_account_id'    => $mvAccId ?? $eqAccId,
                'accumulated_depreciation_account_id' => $mvAccDepId ?? $eqAccDepId,
                'depreciation_expense_account_id'     => $mvDepExpId ?? $eqDepExpId,
                'status'              => 'active',
            ],
            // ── Power Generator ───────────────────────────────────────────────
            [
                'asset_name'          => 'Caterpillar 200kVA Diesel Generator (Campus Main Standby)',
                'category_id'         => $labCatId ?? $itCatId,
                'description'         => 'Standby diesel generator providing backup power to the main campus during ECG outages',
                'fund_id'             => $capitalFundId,
                'department'          => 'Facilities Management & Works',
                'location'            => 'Generator House, Main Campus',
                'purchase_date'       => '2020-08-05',
                'purchase_cost'       => 85000.00,
                'residual_value'      => 4250.00,
                'useful_life_months'  => 120,
                'depreciation_method' => 'straight_line',
                'accumulated_depreciation' => 48210.42, // ~56 months
                'asset_account_id'    => $eqAccId,
                'accumulated_depreciation_account_id' => $eqAccDepId,
                'depreciation_expense_account_id'     => $eqDepExpId,
                'status'              => 'active',
            ],
            // ── Library Resources ─────────────────────────────────────────────
            [
                'asset_name'          => 'Library Book Collection — Business & Management (500 titles)',
                'category_id'         => $libCatId,
                'description'         => 'Core text collection for School of Business, acquired under GETFUND academic resources grant',
                'fund_id'             => $funds['CAPITAL'] ?? $igfFundId,
                'department'          => 'Library & Information Services',
                'location'            => 'Main Library, Floor 2 — Business Section',
                'purchase_date'       => '2022-08-01',
                'purchase_cost'       => 15000.00,
                'residual_value'      => 0.00,
                'useful_life_months'  => 60,
                'depreciation_method' => 'straight_line',
                'accumulated_depreciation' => 8750.00, // ~35 months
                'asset_account_id'    => $eqAccId,
                'accumulated_depreciation_account_id' => $eqAccDepId,
                'depreciation_expense_account_id'     => $eqDepExpId,
                'status'              => 'active',
            ],
            // ── Photocopier (Fully Depreciated) ───────────────────────────────
            [
                'asset_name'          => 'Ricoh MP 3055 Multifunction Photocopier',
                'category_id'         => $itCatId,
                'description'         => 'High-volume multifunction copier for the Finance & Accounts Division',
                'fund_id'             => $igfFundId,
                'department'          => 'Finance & Accounts Division',
                'location'            => 'Finance Office, Admin Block',
                'purchase_date'       => '2020-01-10',
                'purchase_cost'       => 8500.00,
                'residual_value'      => 425.00,
                'useful_life_months'  => 48,
                'depreciation_method' => 'straight_line',
                'accumulated_depreciation' => 8075.00, // fully depreciated
                'asset_account_id'    => $eqAccId,
                'accumulated_depreciation_account_id' => $eqAccDepId,
                'depreciation_expense_account_id'     => $eqDepExpId,
                'status'              => 'fully_depreciated',
            ],
        ];

        foreach ($assets as $asset) {
            // Skip if a required FK is null
            if (!$asset['category_id'] || !$asset['asset_account_id']) {
                continue;
            }

            FixedAsset::create(array_merge($asset, [
                'creator_id' => $userId,
                'created_by' => $userId,
            ]));
        }
    }
}
