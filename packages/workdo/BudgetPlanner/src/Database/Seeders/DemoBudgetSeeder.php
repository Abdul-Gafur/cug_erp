<?php

namespace Workdo\BudgetPlanner\Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Workdo\BudgetPlanner\Models\Budget;
use Workdo\BudgetPlanner\Models\BudgetPeriod;
use Workdo\BudgetPlanner\Models\VoteCostCentre;

class DemoBudgetSeeder extends Seeder
{
    public function run($userId): void
    {
        if (Budget::where('created_by', $userId)->exists()) {
            return;
        }

        // Use the Annual FY 2024/2025 period as the primary budget period
        $annualPeriod = BudgetPeriod::where('created_by', $userId)
            ->where('financial_year', '2024/2025')
            ->whereRaw("DATE_FORMAT(start_date,'%m-%d') = '07-01'")
            ->first()
            ?? BudgetPeriod::where('created_by', $userId)->first();

        if (!$annualPeriod) {
            return;
        }

        $costCentres = VoteCostCentre::where('created_by', $userId)
            ->pluck('id', 'code');

        $approver = User::where('created_by', $userId)->inRandomOrder()->first()?->id;

        $budgets = [
            // ── Personnel Emoluments Budget (approved & active) ──────────────
            [
                'budget_name'         => 'Personnel Emoluments — FY 2024/2025',
                'period_id'           => $annualPeriod->id,
                'budget_type'         => 'operational',
                'total_budget_amount' => 2500000.00,
                'status'              => 'active',
                'fund_type'           => 'general_fund',
                'budget_subtype'      => 'original',
                'vote_cost_centre_id' => $costCentres['VC-002'] ?? null,
                'approved_by'         => $approver,
            ],
            // ── Goods & Services Budget (VC-authorised) ──────────────────────
            [
                'budget_name'         => 'Goods & Services — FY 2024/2025',
                'period_id'           => $annualPeriod->id,
                'budget_type'         => 'operational',
                'total_budget_amount' => 980000.00,
                'status'              => 'vc_authorised',
                'fund_type'           => 'igf',
                'budget_subtype'      => 'original',
                'vote_cost_centre_id' => $costCentres['VC-002'] ?? null,
                'approved_by'         => $approver,
                'vc_authorised_by'    => $approver,
                'vc_authorised_at'    => '2024-07-05 10:00:00',
                'locked_at'           => '2024-07-05 10:00:00',
            ],
            // ── Capital Expenditure Budget (active) ───────────────────────────
            [
                'budget_name'         => 'Capital Expenditure — FY 2024/2025',
                'period_id'           => $annualPeriod->id,
                'budget_type'         => 'capital',
                'total_budget_amount' => 650000.00,
                'status'              => 'active',
                'fund_type'           => 'capital_development',
                'budget_subtype'      => 'original',
                'vote_cost_centre_id' => $costCentres['VC-006'] ?? null,
                'approved_by'         => $approver,
            ],
            // ── Research & Grants Budget (finance reviewed) ───────────────────
            [
                'budget_name'         => 'Research & Grants — FY 2024/2025',
                'period_id'           => $annualPeriod->id,
                'budget_type'         => 'operational',
                'total_budget_amount' => 320000.00,
                'status'              => 'finance_reviewed',
                'fund_type'           => 'research_grants',
                'budget_subtype'      => 'original',
                'vote_cost_centre_id' => $costCentres['VC-004'] ?? null,
                'approved_by'         => null,
                'finance_office_reviewed_by' => $approver,
                'finance_office_reviewed_at' => '2024-07-08 14:30:00',
            ],
            // ── ICT Infrastructure Budget (draft) ─────────────────────────────
            [
                'budget_name'         => 'ICT Infrastructure Upgrade — FY 2025/2026',
                'period_id'           => $annualPeriod->id,
                'budget_type'         => 'capital',
                'total_budget_amount' => 420000.00,
                'status'              => 'draft',
                'fund_type'           => 'igf',
                'budget_subtype'      => 'original',
                'vote_cost_centre_id' => $costCentres['VC-007'] ?? null,
                'approved_by'         => null,
            ],
        ];

        foreach ($budgets as $budget) {
            Budget::create(array_merge($budget, [
                'creator_id' => $userId,
                'created_by' => $userId,
            ]));
        }
    }
}
