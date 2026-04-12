<?php

namespace Workdo\BudgetPlanner\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Auth;
use Workdo\BudgetPlanner\Models\BudgetPeriod;
use Workdo\BudgetPlanner\Services\CommitmentService;

/**
 * Budget Position Widget Endpoint
 *
 * Returns the real-time budget position for a given combination of
 * Vote / Fund / Economic Classification / Period.
 *
 * Called via fetch() from any transaction screen (PR, LPO, journal entry)
 * to show: Approved | Committed | Actual | Available
 *
 * GET /budget-planner/budget-position
 *   ?vote_cost_centre_id=1
 *   &fund_type=general_fund
 *   &economic_classification=goods_services
 *   &period_id=2
 */
class BudgetPositionController extends Controller
{
    public function __construct(private CommitmentService $commitmentService) {}

    public function show(): JsonResponse
    {
        if (!Auth::check()) {
            return response()->json(['error' => 'Unauthenticated'], 401);
        }

        $voteCostCentreId     = (int) request('vote_cost_centre_id');
        $fundType             = request('fund_type', '');
        $economicClass        = request('economic_classification', '');
        $periodId             = request('period_id');

        // If no period specified, use the active one for this tenant
        if (!$periodId) {
            $activePeriod = BudgetPeriod::where('created_by', creatorId())
                ->where('status', 'active')
                ->first();
            $periodId = $activePeriod?->id;
        }

        if (!$periodId || !$voteCostCentreId || !$fundType || !$economicClass) {
            return response()->json([
                'approved'      => 0,
                'committed'     => 0,
                'actual'        => 0,
                'available'     => 0,
                'allocation_id' => null,
                'control_mode'  => 'hard_block',
                'message'       => 'Insufficient parameters to determine budget position.',
            ]);
        }

        $position = $this->commitmentService->getBudgetPosition(
            $voteCostCentreId,
            $fundType,
            $economicClass,
            (int) $periodId,
            creatorId()
        );

        return response()->json($position);
    }
}
