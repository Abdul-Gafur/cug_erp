<?php

namespace Workdo\BudgetPlanner\Database\Seeders;

use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;
use Illuminate\Database\Seeder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Artisan;

class PermissionTableSeeder extends Seeder
{
    public function run()
    {
        Model::unguard();
        Artisan::call('cache:clear');

        $permission = [
            ['name' => 'manage-budget-planner', 'module' => 'budget-planner', 'label' => 'Manage BudgetPlanner'],

            // BudgetPeriod management
            ['name' => 'manage-budget-periods',     'module' => 'budget-periods', 'label' => 'Manage Budget Periods'],
            ['name' => 'manage-any-budget-periods',  'module' => 'budget-periods', 'label' => 'Manage All Budget Periods'],
            ['name' => 'manage-own-budget-periods',  'module' => 'budget-periods', 'label' => 'Manage Own Budget Periods'],
            ['name' => 'create-budget-periods',      'module' => 'budget-periods', 'label' => 'Create Budget Periods'],
            ['name' => 'edit-budget-periods',        'module' => 'budget-periods', 'label' => 'Edit Budget Periods'],
            ['name' => 'delete-budget-periods',      'module' => 'budget-periods', 'label' => 'Delete Budget Periods'],
            ['name' => 'approve-budget-periods',     'module' => 'budget-periods', 'label' => 'Approve Budget Periods'],
            ['name' => 'active-budget-periods',      'module' => 'budget-periods', 'label' => 'Activate Budget Periods'],
            ['name' => 'close-budget-periods',       'module' => 'budget-periods', 'label' => 'Close Budget Periods'],

            // Budgets management — core CRUD
            ['name' => 'manage-budgets',             'module' => 'budgets', 'label' => 'Manage Budgets'],
            ['name' => 'manage-any-budgets',         'module' => 'budgets', 'label' => 'Manage All Budgets'],
            ['name' => 'manage-own-budgets',         'module' => 'budgets', 'label' => 'Manage Own Budgets'],
            ['name' => 'create-budgets',             'module' => 'budgets', 'label' => 'Create Budgets'],
            ['name' => 'edit-budgets',               'module' => 'budgets', 'label' => 'Edit Budgets'],
            ['name' => 'delete-budgets',             'module' => 'budgets', 'label' => 'Delete Budgets'],

            // Budgets — IPSAS 24 governance chain
            ['name' => 'approve-budgets',            'module' => 'budgets', 'label' => 'Submit Budget for Finance Office Review (Dept Head)'],
            ['name' => 'finance-review-budgets',     'module' => 'budgets', 'label' => 'Finance Office Review of Budget'],
            ['name' => 'committee-approve-budgets',  'module' => 'budgets', 'label' => 'Finance Committee Approval of Budget'],
            ['name' => 'vc-authorise-budgets',       'module' => 'budgets', 'label' => 'Vice-Chancellor Authorisation of Budget'],
            ['name' => 'active-budgets',             'module' => 'budgets', 'label' => 'Activate Budgets'],
            ['name' => 'close-budgets',              'module' => 'budgets', 'label' => 'Close Budgets'],

            // Budget Allocations
            ['name' => 'manage-budget-allocations',      'module' => 'budget-allocations', 'label' => 'Manage Budget Allocations'],
            ['name' => 'manage-any-budget-allocations',  'module' => 'budget-allocations', 'label' => 'Manage All Budget Allocations'],
            ['name' => 'manage-own-budget-allocations',  'module' => 'budget-allocations', 'label' => 'Manage Own Budget Allocations'],
            ['name' => 'create-budget-allocations',      'module' => 'budget-allocations', 'label' => 'Create Budget Allocations'],
            ['name' => 'edit-budget-allocations',        'module' => 'budget-allocations', 'label' => 'Edit Budget Allocations'],
            ['name' => 'delete-budget-allocations',      'module' => 'budget-allocations', 'label' => 'Delete Budget Allocations'],

            // Budget Monitoring
            ['name' => 'manage-budget-monitoring',   'module' => 'budget-monitoring', 'label' => 'View Budget Monitoring'],

            // Budget Variance Analysis (IPSAS budget_variance per-line tracking)
            ['name' => 'view-budget-variances', 'module' => 'budget-variances', 'label' => 'View Budget Variance Analysis'],

            // Vote / Cost Centres
            ['name' => 'manage-vote-cost-centres',   'module' => 'vote-cost-centres', 'label' => 'Manage Vote / Cost Centres'],
            ['name' => 'create-vote-cost-centres',   'module' => 'vote-cost-centres', 'label' => 'Create Vote / Cost Centres'],
            ['name' => 'edit-vote-cost-centres',     'module' => 'vote-cost-centres', 'label' => 'Edit Vote / Cost Centres'],
            ['name' => 'delete-vote-cost-centres',   'module' => 'vote-cost-centres', 'label' => 'Delete Vote / Cost Centres'],

            // Budget Control Settings (Bursar only)
            ['name' => 'manage-budget-control-settings', 'module' => 'budget-control-settings', 'label' => 'Manage Budget Control Settings (Bursar)'],

            // Budget Performance Report (IPSAS 24)
            ['name' => 'view-budget-execution',      'module' => 'budget-execution', 'label' => 'View Budget Performance Report (IPSAS 24)'],
            ['name' => 'print-budget-execution',     'module' => 'budget-execution', 'label' => 'Export Budget Performance Report (PDF / Excel)'],

            // Budget Amendments (Virement)
            ['name' => 'manage-budget-amendments',   'module' => 'budget-amendments', 'label' => 'Manage Budget Amendments / Virements'],
            ['name' => 'create-budget-amendments',   'module' => 'budget-amendments', 'label' => 'Create Budget Amendments / Virements'],
            ['name' => 'approve-budget-amendments',  'module' => 'budget-amendments', 'label' => 'Approve / Reject Budget Amendments'],
        ];

        $company_role = Role::where('name', 'company')->first();

        foreach ($permission as $perm) {
            $permission_obj = Permission::firstOrCreate(
                ['name' => $perm['name'], 'guard_name' => 'web'],
                [
                    'module'     => $perm['module'],
                    'label'      => $perm['label'],
                    'add_on'     => 'BudgetPlanner',
                    'created_at' => now(),
                    'updated_at' => now(),
                ]
            );

            if ($company_role && !$company_role->hasPermissionTo($permission_obj)) {
                $company_role->givePermissionTo($permission_obj);
            }
        }
    }
}
