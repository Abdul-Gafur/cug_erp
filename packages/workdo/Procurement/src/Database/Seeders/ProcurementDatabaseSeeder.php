<?php

namespace Workdo\Procurement\Database\Seeders;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Seeder;
use Workdo\Procurement\Models\ProcurementPlan;
use Workdo\Procurement\Models\PurchaseRequisition;

class ProcurementDatabaseSeeder extends Seeder
{
    public function run(): void
    {
        Model::unguard();

        if (config('app.run_demo_seeder')) {
            $user = User::where('email', 'company@example.com')->first();
            if (!$user) {
                return;
            }

            $userId = $user->id;

            if (ProcurementPlan::where('created_by', $userId)->doesntExist()) {
                (new DemoProcurementPlanSeeder())->run($userId);
            }

            if (PurchaseRequisition::where('created_by', $userId)->doesntExist()) {
                (new DemoPurchaseRequisitionSeeder())->run($userId);
            }
        }
    }
}
