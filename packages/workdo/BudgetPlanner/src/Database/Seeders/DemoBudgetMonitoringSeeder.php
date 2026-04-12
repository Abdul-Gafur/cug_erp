<?php

namespace Workdo\BudgetPlanner\Database\Seeders;

use Illuminate\Database\Seeder;
use Workdo\BudgetPlanner\Models\Budget;
use Workdo\BudgetPlanner\Models\BudgetMonitoring;

class DemoBudgetMonitoringSeeder extends Seeder
{
    public function run($userId): void
    {
        if (BudgetMonitoring::where('created_by', $userId)->exists()) {
            return;
        }

        // Attach monitoring snapshots to the Personnel Emoluments budget
        $budget = Budget::where('created_by', $userId)
            ->where('budget_name', 'like', '%Personnel%')
            ->first()
            ?? Budget::where('created_by', $userId)->first();

        if (!$budget) {
            return;
        }

        // Monthly snapshots for FY 2024/2025 (Jul 2024 – Mar 2025)
        $monitorings = [
            [
                'monitoring_date'    => '2024-09-30',
                'total_allocated'    => 2500000.00,
                'total_committed'    => 0.00,
                'total_spent'        => 625000.00, // Q1 end — 25%
                'total_remaining'    => 1875000.00,
                'variance_amount'    => 0.00,
                'variance_percentage'=> 0.00,
            ],
            [
                'monitoring_date'    => '2024-12-31',
                'total_allocated'    => 2500000.00,
                'total_committed'    => 0.00,
                'total_spent'        => 1250000.00, // Q2 end — 50%
                'total_remaining'    => 1250000.00,
                'variance_amount'    => 0.00,
                'variance_percentage'=> 0.00,
            ],
            [
                'monitoring_date'    => '2025-01-31',
                'total_allocated'    => 2500000.00,
                'total_committed'    => 0.00,
                'total_spent'        => 1458000.00, // Jan — slight under-spend
                'total_remaining'    => 1042000.00,
                'variance_amount'    => -125000.00, // under budget (favourable)
                'variance_percentage'=> -5.00,
            ],
            [
                'monitoring_date'    => '2025-02-28',
                'total_allocated'    => 2500000.00,
                'total_committed'    => 0.00,
                'total_spent'        => 1666700.00,
                'total_remaining'    => 833300.00,
                'variance_amount'    => 0.00,
                'variance_percentage'=> 0.00,
            ],
            [
                'monitoring_date'    => '2025-03-31',
                'total_allocated'    => 2500000.00,
                'total_committed'    => 0.00,
                'total_spent'        => 1875000.00, // Q3 end — 75%
                'total_remaining'    => 625000.00,
                'variance_amount'    => 0.00,
                'variance_percentage'=> 0.00,
            ],
        ];

        foreach ($monitorings as $monitoring) {
            BudgetMonitoring::create(array_merge($monitoring, [
                'budget_id'  => $budget->id,
                'creator_id' => $userId,
                'created_by' => $userId,
            ]));
        }
    }
}
