<?php

namespace Workdo\BudgetPlanner\Database\Seeders;

use Illuminate\Database\Seeder;
use Workdo\Account\Models\ChartOfAccount;
use Workdo\BudgetPlanner\Models\Budget;
use Workdo\BudgetPlanner\Models\BudgetAllocation;

class DemoBudgetAllocationSeeder extends Seeder
{
    public function run($userId): void
    {
        if (BudgetAllocation::where('created_by', $userId)->exists()) {
            return;
        }

        $budgets = Budget::where('created_by', $userId)->get()->keyBy('budget_name');

        // Resolve GL accounts by code (seeded by AccountUtility::defaultdata)
        $accounts = ChartOfAccount::where('created_by', $userId)
            ->whereIn('account_code', ['5100', '5110', '5120', '5200', '5210', '5300', '5310', '5320', '5360', '5380', '5600', '5620'])
            ->pluck('id', 'account_code');

        if ($budgets->isEmpty() || $accounts->isEmpty()) {
            return;
        }

        // Helper to find a budget by partial name
        $budget = fn(string $key) => $budgets->first(fn($b) => str_contains($b->budget_name, $key));

        $personnelBudget = $budget('Personnel');
        $goodsBudget     = $budget('Goods & Services');
        $capitalBudget   = $budget('Capital');
        $researchBudget  = $budget('Research');

        $allocations = [
            // ── Personnel Emoluments ─────────────────────────────────────────
            [
                'budget'                  => $personnelBudget,
                'account_code'            => '5100',
                'economic_classification' => 'personnel_emoluments',
                'allocated_amount'        => 1800000.00,
                'committed_amount'        => 0.00,
                'spent_amount'            => 1350000.00, // 3 quarters paid
                'remaining_amount'        => 450000.00,
                'q1_amount'               => 450000.00,
                'q2_amount'               => 450000.00,
                'q3_amount'               => 450000.00,
                'q4_amount'               => 450000.00,
            ],
            [
                'budget'                  => $personnelBudget,
                'account_code'            => '5110',
                'economic_classification' => 'personnel_emoluments',
                'allocated_amount'        => 480000.00,
                'committed_amount'        => 0.00,
                'spent_amount'            => 360000.00,
                'remaining_amount'        => 120000.00,
                'q1_amount'               => 120000.00,
                'q2_amount'               => 120000.00,
                'q3_amount'               => 120000.00,
                'q4_amount'               => 120000.00,
            ],
            [
                'budget'                  => $personnelBudget,
                'account_code'            => '5120',
                'economic_classification' => 'personnel_emoluments',
                'allocated_amount'        => 220000.00,
                'committed_amount'        => 0.00,
                'spent_amount'            => 165000.00,
                'remaining_amount'        => 55000.00,
                'q1_amount'               => 55000.00,
                'q2_amount'               => 55000.00,
                'q3_amount'               => 55000.00,
                'q4_amount'               => 55000.00,
            ],
            // ── Goods & Services ─────────────────────────────────────────────
            [
                'budget'                  => $goodsBudget,
                'account_code'            => '5200',
                'economic_classification' => 'goods_services',
                'allocated_amount'        => 95000.00,
                'committed_amount'        => 18000.00,
                'spent_amount'            => 52000.00,
                'remaining_amount'        => 25000.00,
                'q1_amount'               => 25000.00,
                'q2_amount'               => 25000.00,
                'q3_amount'               => 25000.00,
                'q4_amount'               => 20000.00,
            ],
            [
                'budget'                  => $goodsBudget,
                'account_code'            => '5210',
                'economic_classification' => 'goods_services',
                'allocated_amount'        => 80000.00,
                'committed_amount'        => 12000.00,
                'spent_amount'            => 45000.00,
                'remaining_amount'        => 23000.00,
                'q1_amount'               => 20000.00,
                'q2_amount'               => 20000.00,
                'q3_amount'               => 20000.00,
                'q4_amount'               => 20000.00,
            ],
            [
                'budget'                  => $goodsBudget,
                'account_code'            => '5310',
                'economic_classification' => 'goods_services',
                'allocated_amount'        => 75000.00,
                'committed_amount'        => 0.00,
                'spent_amount'            => 56250.00,
                'remaining_amount'        => 18750.00,
                'q1_amount'               => 18750.00,
                'q2_amount'               => 18750.00,
                'q3_amount'               => 18750.00,
                'q4_amount'               => 18750.00,
            ],
            [
                'budget'                  => $goodsBudget,
                'account_code'            => '5360',
                'economic_classification' => 'goods_services',
                'allocated_amount'        => 60000.00,
                'committed_amount'        => 8500.00,
                'spent_amount'            => 28000.00,
                'remaining_amount'        => 23500.00,
                'q1_amount'               => 15000.00,
                'q2_amount'               => 15000.00,
                'q3_amount'               => 15000.00,
                'q4_amount'               => 15000.00,
            ],
            // ── Capital Expenditure ───────────────────────────────────────────
            [
                'budget'                  => $capitalBudget,
                'account_code'            => '5600',
                'economic_classification' => 'capital_expenditure',
                'allocated_amount'        => 320000.00,
                'committed_amount'        => 95000.00,
                'spent_amount'            => 185000.00,
                'remaining_amount'        => 40000.00,
                'q1_amount'               => 80000.00,
                'q2_amount'               => 80000.00,
                'q3_amount'               => 80000.00,
                'q4_amount'               => 80000.00,
            ],
            // ── Research ─────────────────────────────────────────────────────
            [
                'budget'                  => $researchBudget,
                'account_code'            => '5380',
                'economic_classification' => 'goods_services',
                'allocated_amount'        => 120000.00,
                'committed_amount'        => 25000.00,
                'spent_amount'            => 62000.00,
                'remaining_amount'        => 33000.00,
                'q1_amount'               => 30000.00,
                'q2_amount'               => 30000.00,
                'q3_amount'               => 30000.00,
                'q4_amount'               => 30000.00,
            ],
        ];

        foreach ($allocations as $row) {
            $budgetModel = $row['budget'];
            if (!$budgetModel) {
                continue;
            }

            $accountId = $accounts[$row['account_code']] ?? null;
            if (!$accountId) {
                continue;
            }

            BudgetAllocation::create([
                'budget_id'               => $budgetModel->id,
                'account_id'              => $accountId,
                'economic_classification' => $row['economic_classification'],
                'allocated_amount'        => $row['allocated_amount'],
                'committed_amount'        => $row['committed_amount'],
                'spent_amount'            => $row['spent_amount'],
                'remaining_amount'        => $row['remaining_amount'],
                'q1_amount'               => $row['q1_amount'],
                'q2_amount'               => $row['q2_amount'],
                'q3_amount'               => $row['q3_amount'],
                'q4_amount'               => $row['q4_amount'],
                'creator_id'              => $userId,
                'created_by'              => $userId,
            ]);
        }
    }
}
