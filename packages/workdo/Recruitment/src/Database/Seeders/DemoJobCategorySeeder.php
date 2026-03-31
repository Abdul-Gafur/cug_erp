<?php

namespace Workdo\Recruitment\Database\Seeders;

use Workdo\Recruitment\Models\JobCategory;
use Illuminate\Database\Seeder;



class DemoJobCategorySeeder extends Seeder
{
    public function run($userId): void
    {
        $categories = [
            [
                'name' => 'Information Technology',
                'description' => 'Software development, system administration, cybersecurity, and IT support roles',
                'is_active' => true
            ],
            [
                'name' => 'Engineering',
                'description' => 'Mechanical, electrical, civil, and software engineering positions',
                'is_active' => true
            ],
            [
                'name' => 'Healthcare & Medical',
                'description' => 'Doctors, nurses, medical technicians, and healthcare administration',
                'is_active' => true
            ],
            [
                'name' => 'Finance & Accounting',
                'description' => 'Financial analysts, accountants, auditors, and banking professionals',
                'is_active' => true
            ],
            [
                'name' => 'Marketing & Sales',
                'description' => 'Digital marketing, sales representatives, brand management, and advertising',
                'is_active' => true
            ],
            [
                'name' => 'Human Resources',
                'description' => 'HR specialists, recruiters, training coordinators, and employee relations',
                'is_active' => false
            ],
            [
                'name' => 'Operations & Management',
                'description' => 'Operations managers, project managers, and business analysts',
                'is_active' => true
            ],
            [
                'name' => 'Customer Service',
                'description' => 'Customer support representatives, call center agents, and client relations',
                'is_active' => true
            ],
            [
                'name' => 'Design & Creative',
                'description' => 'Graphic designers, UX/UI designers, content creators, and creative directors',
                'is_active' => true
            ],
            [
                'name' => 'Education & Training',
                'description' => 'Teachers, trainers, instructional designers, and educational coordinators',
                'is_active' => false
            ],
            [
                'name' => 'Legal & Compliance',
                'description' => 'Lawyers, legal assistants, compliance officers, and paralegal staff',
                'is_active' => false
            ],
            [
                'name' => 'Manufacturing & Production',
                'description' => 'Production workers, quality control, manufacturing engineers, and supervisors',
                'is_active' => true
            ],
            [
                'name' => 'Research & Development',
                'description' => 'Research scientists, product developers, and innovation specialists',
                'is_active' => true
            ],
            [
                'name' => 'Administrative & Clerical',
                'description' => 'Administrative assistants, data entry clerks, and office coordinators',
                'is_active' => true
            ],
            [
                'name' => 'Logistics & Supply Chain',
                'description' => 'Supply chain managers, logistics coordinators, and warehouse operations',
                'is_active' => false
            ]
        ];

        foreach ($categories as $category) {
            JobCategory::create([
                'name' => $category['name'],
                'description' => $category['description'],
                'is_active' => $category['is_active'],
                'creator_id' => $userId,
                'created_by' => $userId,
            ]);
        }
    }
}
