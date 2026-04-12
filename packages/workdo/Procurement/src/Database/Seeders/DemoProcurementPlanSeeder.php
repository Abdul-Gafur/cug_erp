<?php

namespace Workdo\Procurement\Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Workdo\Account\Models\ChartOfAccount;
use Workdo\BudgetPlanner\Models\VoteCostCentre;
use Workdo\Procurement\Models\ProcurementPlan;
use Workdo\Procurement\Models\ProcurementPlanItem;

class DemoProcurementPlanSeeder extends Seeder
{
    public function run($userId): void
    {
        if (ProcurementPlan::where('created_by', $userId)->exists()) {
            return;
        }

        $costCentres = VoteCostCentre::where('created_by', $userId)->pluck('id', 'code');

        // Resolve preferred expense accounts; fall back to any expense account in 5000-5999
        $accounts = ChartOfAccount::where('created_by', $userId)
            ->whereIn('account_code', ['5200', '5210', '5300', '5320', '5360', '5600'])
            ->pluck('id', 'account_code');

        // Build a fallback: any active expense account
        $fallbackAccountId = ChartOfAccount::where('created_by', $userId)
            ->whereBetween('account_code', ['5000', '5999'])
            ->value('id');

        $approver = User::where('created_by', $userId)->inRandomOrder()->first()?->id;

        // ── Annual Procurement Plan FY 2024/2025 (Approved) ──────────────────
        $plan = ProcurementPlan::create([
            'plan_number'          => 'PLAN-2025-001',
            'financial_year'       => '2024/2025',
            'title'                => 'Annual Procurement Plan — FY 2024/2025',
            'vote_cost_centre_id'  => $costCentres['VC-002'] ?? null,
            'status'               => 'approved',
            'approved_by'          => $approver,
            'approved_at'          => '2024-07-10 09:00:00',
            'notes'                => 'Approved by the Procurement Committee at its meeting of 10 July 2024. All items are linked to the approved FY 2024/2025 budget lines.',
            'creator_id'           => $userId,
            'created_by'           => $userId,
        ]);

        $planItems = [
            [
                'item_description'       => 'HP EliteBook 840 G10 Laptops for Academic Staff (20 units)',
                'quantity'               => 20,
                'unit'                   => 'unit',
                'estimated_unit_cost'    => 4500.00,
                'procurement_method'     => 'rfq',
                'planned_quarter'        => 1,
                'account_code'           => '5600',
                'fund_type'              => 'igf',
                'economic_classification'=> 'capital_expenditure',
                'notes'                  => 'Replacement of end-of-life laptops for lecturing staff',
            ],
            [
                'item_description'       => 'HP LaserJet Pro MFP 4301fdw Printers (10 units)',
                'quantity'               => 10,
                'unit'                   => 'unit',
                'estimated_unit_cost'    => 1800.00,
                'procurement_method'     => 'rfq',
                'planned_quarter'        => 1,
                'account_code'           => '5600',
                'fund_type'              => 'igf',
                'economic_classification'=> 'capital_expenditure',
                'notes'                  => 'Departmental office printers to replace ageing machines',
            ],
            [
                'item_description'       => 'Academic Textbooks & Reference Materials — School of Business (500 titles)',
                'quantity'               => 500,
                'unit'                   => 'volume',
                'estimated_unit_cost'    => 85.00,
                'procurement_method'     => 'restricted_tender',
                'planned_quarter'        => 2,
                'account_code'           => '5210',
                'fund_type'              => 'igf',
                'economic_classification'=> 'goods_services',
                'notes'                  => 'Core texts for Business Administration, Accounting, and Economics programmes',
            ],
            [
                'item_description'       => 'Office Stationery & Consumables — Annual Supply (all departments)',
                'quantity'               => 1,
                'unit'                   => 'lot',
                'estimated_unit_cost'    => 35000.00,
                'procurement_method'     => 'rfq',
                'planned_quarter'        => 1,
                'account_code'           => '5300',
                'fund_type'              => 'igf',
                'economic_classification'=> 'goods_services',
                'notes'                  => 'Stationery, toner cartridges, and printing materials for administrative offices',
            ],
            [
                'item_description'       => 'Laboratory Chemicals & Consumables — Chemistry & Applied Sciences',
                'quantity'               => 1,
                'unit'                   => 'lot',
                'estimated_unit_cost'    => 48000.00,
                'procurement_method'     => 'restricted_tender',
                'planned_quarter'        => 2,
                'account_code'           => '5200',
                'fund_type'              => 'research_grants',
                'economic_classification'=> 'goods_services',
                'notes'                  => 'Annual reagents and consumables for undergraduate and postgraduate laboratory work',
            ],
            [
                'item_description'       => 'Campus Maintenance & Repairs — Buildings (Annual Contract)',
                'quantity'               => 1,
                'unit'                   => 'contract',
                'estimated_unit_cost'    => 120000.00,
                'procurement_method'     => 'open_tender',
                'planned_quarter'        => 1,
                'account_code'           => '5320',
                'fund_type'              => 'general_fund',
                'economic_classification'=> 'goods_services',
                'notes'                  => 'Periodic maintenance of academic and residential buildings including painting, roofing, and plumbing',
            ],
            [
                'item_description'       => 'Staff Conference & Workshop Travel (Annual Provision)',
                'quantity'               => 1,
                'unit'                   => 'provision',
                'estimated_unit_cost'    => 65000.00,
                'procurement_method'     => 'single_source',
                'planned_quarter'        => 3,
                'account_code'           => '5360',
                'fund_type'              => 'igf',
                'economic_classification'=> 'goods_services',
                'notes'                  => 'Travel, accommodation, and per diem for staff attending conferences and training',
            ],
        ];

        foreach ($planItems as $item) {
            ProcurementPlanItem::create([
                'plan_id'                => $plan->id,
                'item_description'       => $item['item_description'],
                'quantity'               => $item['quantity'],
                'unit'                   => $item['unit'],
                'estimated_unit_cost'    => $item['estimated_unit_cost'],
                'procurement_method'     => $item['procurement_method'],
                'planned_quarter'        => $item['planned_quarter'],
                'account_id'             => $accounts[$item['account_code']] ?? $fallbackAccountId,
                'fund_type'              => $item['fund_type'],
                'economic_classification'=> $item['economic_classification'],
                'notes'                  => $item['notes'],
                'creator_id'             => $userId,
                'created_by'             => $userId,
            ]);
        }

        // ── Draft Plan FY 2025/2026 (not yet approved) ───────────────────────
        $draftPlan = ProcurementPlan::create([
            'plan_number'          => 'PLAN-2025-002',
            'financial_year'       => '2025/2026',
            'title'                => 'Annual Procurement Plan — FY 2025/2026 (Draft)',
            'vote_cost_centre_id'  => $costCentres['VC-007'] ?? null,
            'status'               => 'draft',
            'approved_by'          => null,
            'notes'                => 'Prepared by ICT Services. Pending Procurement Committee review and budget linkage.',
            'creator_id'           => $userId,
            'created_by'           => $userId,
        ]);

        ProcurementPlanItem::create([
            'plan_id'                => $draftPlan->id,
            'item_description'       => 'Network Infrastructure Upgrade — Campus-wide Fibre Backbone',
            'quantity'               => 1,
            'unit'                   => 'project',
            'estimated_unit_cost'    => 280000.00,
            'procurement_method'     => 'open_tender',
            'planned_quarter'        => 1,
            'account_id'             => $accounts['5600'] ?? $fallbackAccountId,
            'fund_type'              => 'capital_development',
            'economic_classification'=> 'capital_expenditure',
            'notes'                  => 'Full replacement of ageing Cat5e cabling with fibre-optic backbone across all campus buildings',
            'creator_id'             => $userId,
            'created_by'             => $userId,
        ]);
    }
}
