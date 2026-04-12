<?php

namespace Workdo\Procurement\Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Workdo\Account\Models\ChartOfAccount;
use Workdo\BudgetPlanner\Models\BudgetPeriod;
use Workdo\BudgetPlanner\Models\VoteCostCentre;
use Workdo\Procurement\Models\ProcurementPlan;
use Workdo\Procurement\Models\ProcurementPlanItem;
use Workdo\Procurement\Models\PurchaseRequisition;
use Workdo\Procurement\Models\PurchaseRequisitionItem;

class DemoPurchaseRequisitionSeeder extends Seeder
{
    public function run($userId): void
    {
        if (PurchaseRequisition::where('created_by', $userId)->exists()) {
            return;
        }

        $costCentres  = VoteCostCentre::where('created_by', $userId)->pluck('id', 'code');
        $budgetPeriod = BudgetPeriod::where('created_by', $userId)
            ->where('financial_year', '2024/2025')
            ->whereRaw("DATE_FORMAT(start_date,'%m-%d') = '07-01'")
            ->first()
            ?? BudgetPeriod::where('created_by', $userId)->first();

        $accounts = ChartOfAccount::where('created_by', $userId)
            ->whereIn('account_code', ['5200', '5210', '5300', '5360', '5600'])
            ->pluck('id', 'account_code');

        $fallbackAccountId = ChartOfAccount::where('created_by', $userId)
            ->whereBetween('account_code', ['5000', '5999'])
            ->value('id');

        $approver = User::where('created_by', $userId)->inRandomOrder()->first()?->id;

        // Fetch a plan item to link (optional)
        $laptopPlanItem = ProcurementPlanItem::whereHas('plan', fn($q) => $q->where('created_by', $userId))
            ->where('item_description', 'like', '%Laptop%')
            ->first();

        $dept003 = $costCentres['VC-003'] ?? null; // School of Business
        $dept004 = $costCentres['VC-004'] ?? null; // Engineering
        $dept005 = $costCentres['VC-005'] ?? null; // Library
        $dept006 = $costCentres['VC-006'] ?? null; // Facilities
        $dept007 = $costCentres['VC-007'] ?? null; // ICT
        $periodId = $budgetPeriod?->id;

        // ─────────────────────────────────────────────────────────────────────
        // REQ-001: Laptops for Academic Staff — FULLY APPROVED
        // Demonstrates the complete 4-stage approval workflow
        // ─────────────────────────────────────────────────────────────────────
        $req1 = PurchaseRequisition::create([
            'requisition_number'       => 'REQ-2025-0001',
            'requisition_date'         => '2025-01-08',
            'requesting_department_id' => $dept003,
            'purpose'                  => 'Procurement of HP EliteBook 840 G10 laptops for academic staff replacing end-of-life machines',
            'justification'            => 'Current staff laptops (purchased 2020) are unable to run modern presentation and statistical software required for teaching. Replacement is necessary to maintain academic quality standards.',
            'category'                 => 'academic',
            'plan_item_id'             => $laptopPlanItem?->id,
            'is_off_plan'              => false,
            'budget_period_id'         => $periodId,
            'subtotal'                 => 90000.00,
            'total_amount'             => 90000.00,
            'status'                   => 'procurement_approved',
            'hod_approved_by'          => $approver,
            'hod_approved_at'          => '2025-01-10 11:30:00',
            'finance_checked_by'       => $approver,
            'finance_checked_at'       => '2025-01-14 09:15:00',
            'finance_notes'            => 'Budget available under Capital Expenditure FY 2024/2025 (Account 5600). Commitment raised.',
            'procurement_approved_by'  => $approver,
            'procurement_approved_at'  => '2025-01-16 14:00:00',
            'creator_id'               => $userId,
            'created_by'               => $userId,
        ]);

        $this->addItems($req1->id, [
            ['description' => 'HP EliteBook 840 G10 Laptop — 14", Intel Core i7, 16GB RAM, 512GB SSD', 'qty' => 15, 'unit' => 'unit', 'unit_cost' => 4500.00, 'code' => '5600'],
            ['description' => 'HP USB-C Laptop Docking Station G5 (for each laptop)', 'qty' => 15, 'unit' => 'unit', 'unit_cost' => 450.00, 'code' => '5600'],
            ['description' => 'HP 24" FHD Monitor (for office use)', 'qty' => 10, 'unit' => 'unit', 'unit_cost' => 375.00, 'code' => '5600'],
        ], $accounts, $fallbackAccountId, $userId);

        // ─────────────────────────────────────────────────────────────────────
        // REQ-002: Office Furniture for New Admin Block — AT FINANCE CHECK
        // Illustrates budget-check bottleneck at the Bursary
        // ─────────────────────────────────────────────────────────────────────
        $req2 = PurchaseRequisition::create([
            'requisition_number'       => 'REQ-2025-0002',
            'requisition_date'         => '2025-02-03',
            'requesting_department_id' => $dept007,
            'purpose'                  => 'Office furniture for ICT Services new wing — 6 workstations and a conference table',
            'justification'            => 'Relocation of ICT Services to the new administrative wing requires furnishing of open-plan workstations and a team meeting room.',
            'category'                 => 'administrative',
            'is_off_plan'              => false,
            'budget_period_id'         => $periodId,
            'subtotal'                 => 22500.00,
            'total_amount'             => 22500.00,
            'status'                   => 'finance_checked',
            'hod_approved_by'          => $approver,
            'hod_approved_at'          => '2025-02-05 10:00:00',
            'finance_checked_by'       => $approver,
            'finance_checked_at'       => '2025-02-10 15:45:00',
            'finance_notes'            => 'Verified against Goods & Services budget. Committed amount updated. Awaiting Procurement Office action.',
            'creator_id'               => $userId,
            'created_by'               => $userId,
        ]);

        $this->addItems($req2->id, [
            ['description' => 'L-Shaped Office Workstation Desk with Cable Management', 'qty' => 6, 'unit' => 'unit', 'unit_cost' => 1200.00, 'code' => '5300'],
            ['description' => 'Ergonomic Mesh Office Chair (high-back)', 'qty' => 6, 'unit' => 'unit', 'unit_cost' => 580.00, 'code' => '5300'],
            ['description' => '10-Seater Conference Table (2.4m × 1.2m, oval)', 'qty' => 1, 'unit' => 'unit', 'unit_cost' => 4500.00, 'code' => '5300'],
            ['description' => 'Conference Chair (padded, chrome base)', 'qty' => 10, 'unit' => 'unit', 'unit_cost' => 320.00, 'code' => '5300'],
        ], $accounts, $fallbackAccountId, $userId);

        // ─────────────────────────────────────────────────────────────────────
        // REQ-003: Library Journal Subscriptions — AT HOD APPROVAL
        // ─────────────────────────────────────────────────────────────────────
        $req3 = PurchaseRequisition::create([
            'requisition_number'       => 'REQ-2025-0003',
            'requisition_date'         => '2025-02-17',
            'requesting_department_id' => $dept005,
            'purpose'                  => 'Renewal of online academic journal subscriptions for the 2025 academic year',
            'justification'            => 'JSTOR, Emerald Insight, and IEEE Xplore subscriptions expire on 31 March 2025. Timely renewal is essential to avoid disruption to student and staff research access.',
            'category'                 => 'academic',
            'is_off_plan'              => false,
            'budget_period_id'         => $periodId,
            'subtotal'                 => 38500.00,
            'total_amount'             => 38500.00,
            'status'                   => 'hod_approved',
            'hod_approved_by'          => $approver,
            'hod_approved_at'          => '2025-02-20 09:30:00',
            'creator_id'               => $userId,
            'created_by'               => $userId,
        ]);

        $this->addItems($req3->id, [
            ['description' => 'JSTOR Multi-Disciplinary Online Access — Annual Subscription 2025', 'qty' => 1, 'unit' => 'subscription', 'unit_cost' => 14000.00, 'code' => '5210'],
            ['description' => 'Emerald Insight — Management & Business Journals (Annual 2025)', 'qty' => 1, 'unit' => 'subscription', 'unit_cost' => 12500.00, 'code' => '5210'],
            ['description' => 'IEEE Xplore Digital Library — Engineering & Technology (Annual 2025)', 'qty' => 1, 'unit' => 'subscription', 'unit_cost' => 12000.00, 'code' => '5210'],
        ], $accounts, $fallbackAccountId, $userId);

        // ─────────────────────────────────────────────────────────────────────
        // REQ-004: Lab Chemicals — SUBMITTED (awaiting HoD)
        // ─────────────────────────────────────────────────────────────────────
        $req4 = PurchaseRequisition::create([
            'requisition_number'       => 'REQ-2025-0004',
            'requisition_date'         => '2025-03-05',
            'requesting_department_id' => $dept004,
            'purpose'                  => 'Procurement of analytical-grade chemicals and laboratory consumables for Q3 practicals',
            'justification'            => 'Chemistry laboratory stocks are critically low. Procurement is required before the second semester practicals commence on 24 March 2025.',
            'category'                 => 'academic',
            'is_off_plan'              => false,
            'budget_period_id'         => $periodId,
            'subtotal'                 => 17200.00,
            'total_amount'             => 17200.00,
            'status'                   => 'submitted',
            'creator_id'               => $userId,
            'created_by'               => $userId,
        ]);

        $this->addItems($req4->id, [
            ['description' => 'Hydrochloric Acid (HCl) — Analytical Grade, 2.5L (10 bottles)', 'qty' => 10, 'unit' => 'bottle', 'unit_cost' => 180.00, 'code' => '5200'],
            ['description' => 'Sodium Hydroxide (NaOH) Pellets — 500g (20 units)', 'qty' => 20, 'unit' => 'unit', 'unit_cost' => 95.00, 'code' => '5200'],
            ['description' => 'Distilled Water — 20L Carboy (15 units)', 'qty' => 15, 'unit' => 'carboy', 'unit_cost' => 45.00, 'code' => '5200'],
            ['description' => 'Laboratory Glassware Set — Beakers, Flasks, Burettes (assorted)', 'qty' => 5, 'unit' => 'set', 'unit_cost' => 680.00, 'code' => '5200'],
            ['description' => 'Nitrile Examination Gloves — Box of 100 (30 boxes)', 'qty' => 30, 'unit' => 'box', 'unit_cost' => 55.00, 'code' => '5200'],
        ], $accounts, $fallbackAccountId, $userId);

        // ─────────────────────────────────────────────────────────────────────
        // REQ-005: Training Workshop Travel — DRAFT (not yet submitted)
        // ─────────────────────────────────────────────────────────────────────
        $req5 = PurchaseRequisition::create([
            'requisition_number'       => 'REQ-2025-0005',
            'requisition_date'         => '2025-03-20',
            'requesting_department_id' => $dept003,
            'purpose'                  => 'Travel and accommodation for staff attending the AAT Ghana Annual Conference 2025 in Accra',
            'justification'            => 'The School of Business has been invited to present research papers at the AAT Ghana Annual Conference. Attendance supports staff CPD and institutional visibility.',
            'category'                 => 'administrative',
            'is_off_plan'              => true,
            'off_plan_justification'   => 'Conference date announced after procurement plan approval. Attendance is time-sensitive and covered by available travel budget provision.',
            'budget_period_id'         => $periodId,
            'subtotal'                 => 8400.00,
            'total_amount'             => 8400.00,
            'status'                   => 'draft',
            'creator_id'               => $userId,
            'created_by'               => $userId,
        ]);

        $this->addItems($req5->id, [
            ['description' => 'Return bus tickets — Cape Coast to Accra (4 staff)', 'qty' => 4, 'unit' => 'ticket', 'unit_cost' => 120.00, 'code' => '5360'],
            ['description' => 'Hotel accommodation — 2 nights × 4 staff at Conference Hotel, Accra', 'qty' => 8, 'unit' => 'room-night', 'unit_cost' => 450.00, 'code' => '5360'],
            ['description' => 'Per diem allowance — GHS 320/day × 3 days × 4 staff', 'qty' => 12, 'unit' => 'day', 'unit_cost' => 320.00, 'code' => '5360'],
            ['description' => 'Conference registration fee (per person)', 'qty' => 4, 'unit' => 'person', 'unit_cost' => 180.00, 'code' => '5360'],
        ], $accounts, $fallbackAccountId, $userId);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helper — create line items for a requisition
    // ─────────────────────────────────────────────────────────────────────────

    private function addItems(int $requisitionId, array $lines, $accounts, ?int $fallback, int $userId): void
    {
        foreach ($lines as $line) {
            PurchaseRequisitionItem::create([
                'requisition_id'          => $requisitionId,
                'description'             => $line['description'],
                'quantity'                => $line['qty'],
                'unit'                    => $line['unit'],
                'estimated_unit_cost'     => $line['unit_cost'],
                'estimated_total_cost'    => $line['qty'] * $line['unit_cost'],
                'account_id'              => $accounts[$line['code']] ?? $fallback,
                'fund_type'               => 'igf',
                'economic_classification' => 'goods_services',
                'creator_id'              => $userId,
                'created_by'              => $userId,
            ]);
        }
    }
}
