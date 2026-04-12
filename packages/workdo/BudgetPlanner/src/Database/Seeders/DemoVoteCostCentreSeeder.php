<?php

namespace Workdo\BudgetPlanner\Database\Seeders;

use Illuminate\Database\Seeder;
use Workdo\BudgetPlanner\Models\VoteCostCentre;

class DemoVoteCostCentreSeeder extends Seeder
{
    public function run($userId): void
    {
        if (VoteCostCentre::where('created_by', $userId)->exists()) {
            return;
        }

        $costCentres = [
            [
                'code'        => 'VC-001',
                'name'        => 'Vice Chancellor\'s Office',
                'description' => 'Office of the Vice Chancellor, Deputy Vice Chancellors, and University Council Secretariat',
                'is_active'   => true,
            ],
            [
                'code'        => 'VC-002',
                'name'        => 'Finance & Accounts Division',
                'description' => 'Bursary, financial management, accounts payable/receivable, and payroll operations',
                'is_active'   => true,
            ],
            [
                'code'        => 'VC-003',
                'name'        => 'School of Business & Management Studies',
                'description' => 'Undergraduate and postgraduate programmes in Business Administration, Accounting, and Economics',
                'is_active'   => true,
            ],
            [
                'code'        => 'VC-004',
                'name'        => 'School of Engineering & Applied Sciences',
                'description' => 'Engineering, Computer Science, Mathematics, and Applied Sciences departments',
                'is_active'   => true,
            ],
            [
                'code'        => 'VC-005',
                'name'        => 'Library & Information Services',
                'description' => 'Main university library, digital resources, and academic information services',
                'is_active'   => true,
            ],
            [
                'code'        => 'VC-006',
                'name'        => 'Facilities Management & Works',
                'description' => 'Buildings maintenance, security, grounds, utilities, and campus infrastructure',
                'is_active'   => true,
            ],
            [
                'code'        => 'VC-007',
                'name'        => 'ICT Services',
                'description' => 'University-wide ICT infrastructure, systems administration, and digital services',
                'is_active'   => true,
            ],
            [
                'code'        => 'VC-008',
                'name'        => 'Human Resource Management',
                'description' => 'Staff recruitment, welfare, performance management, and HR administration',
                'is_active'   => true,
            ],
        ];

        foreach ($costCentres as $centre) {
            VoteCostCentre::create(array_merge($centre, [
                'creator_id' => $userId,
                'created_by' => $userId,
            ]));
        }
    }
}
