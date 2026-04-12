<?php

namespace Workdo\BudgetPlanner\Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Workdo\BudgetPlanner\Models\BudgetPeriod;

class DemoBudgetPeriodSeeder extends Seeder
{
    public function run($userId): void
    {
        if (BudgetPeriod::where('created_by', $userId)->exists()) {
            return;
        }

        $budgetPeriods = [
            [
                'period_name'    => 'Annual Budget FY 2024/2025',
                'financial_year' => '2024/2025',
                'start_date'     => '2024-07-01',
                'end_date'       => '2025-06-30',
                'status'         => 'active',
            ],
            [
                'period_name'    => 'Q1 FY 2024/2025 (Jul–Sep 2024)',
                'financial_year' => '2024/2025',
                'start_date'     => '2024-07-01',
                'end_date'       => '2024-09-30',
                'status'         => 'closed',
            ],
            [
                'period_name'    => 'Q2 FY 2024/2025 (Oct–Dec 2024)',
                'financial_year' => '2024/2025',
                'start_date'     => '2024-10-01',
                'end_date'       => '2024-12-31',
                'status'         => 'closed',
            ],
            [
                'period_name'    => 'Q3 FY 2024/2025 (Jan–Mar 2025)',
                'financial_year' => '2024/2025',
                'start_date'     => '2025-01-01',
                'end_date'       => '2025-03-31',
                'status'         => 'active',
            ],
            [
                'period_name'    => 'Q4 FY 2024/2025 (Apr–Jun 2025)',
                'financial_year' => '2024/2025',
                'start_date'     => '2025-04-01',
                'end_date'       => '2025-06-30',
                'status'         => 'active',
            ],
            [
                'period_name'    => 'Annual Budget FY 2025/2026',
                'financial_year' => '2025/2026',
                'start_date'     => '2025-07-01',
                'end_date'       => '2026-06-30',
                'status'         => 'active',
            ],
        ];

        foreach ($budgetPeriods as $period) {
            BudgetPeriod::create(array_merge($period, [
                'approved_by' => User::where('created_by', $userId)->inRandomOrder()->first()?->id,
                'creator_id'  => $userId,
                'created_by'  => $userId,
            ]));
        }
    }
}
