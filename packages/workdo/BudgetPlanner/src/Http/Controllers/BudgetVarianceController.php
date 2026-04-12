<?php

namespace Workdo\BudgetPlanner\Http\Controllers;

use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Workdo\BudgetPlanner\Models\Budget;
use Workdo\BudgetPlanner\Models\BudgetPeriod;
use Workdo\BudgetPlanner\Models\BudgetVariance;
use Workdo\BudgetPlanner\Models\VoteCostCentre;

class BudgetVarianceController extends Controller
{
    public function index()
    {
        if (! Auth::user()->can('view-budget-variances')) {
            return back()->with('error', __('Permission denied'));
        }

        $createdBy = creatorId();

        $variances = BudgetVariance::with([
                'budget.voteCostCentre',
                'budget.budgetPeriod',
                'budgetAllocation',
                'account',
            ])
            ->whereHas('budget', fn($q) => $q->where('created_by', $createdBy))
            ->when(request('budget_id') && request('budget_id') !== '', fn($q) =>
                $q->where('budget_id', request('budget_id')))
            ->when(request('vote_cost_centre_id') && request('vote_cost_centre_id') !== '', fn($q) =>
                $q->whereHas('budget', fn($bq) =>
                    $bq->where('vote_cost_centre_id', request('vote_cost_centre_id'))))
            ->when(request('period_id') && request('period_id') !== '', fn($q) =>
                $q->whereHas('budget', fn($bq) =>
                    $bq->where('period_id', request('period_id'))))
            ->when(request('economic_classification') && request('economic_classification') !== '', fn($q) =>
                $q->where('economic_classification', request('economic_classification')))
            ->when(request('date_from'), fn($q) =>
                $q->whereDate('snapshot_date', '>=', request('date_from')))
            ->when(request('date_to'), fn($q) =>
                $q->whereDate('snapshot_date', '<=', request('date_to')))
            ->orderByDesc('snapshot_date')
            ->paginate(request('per_page', 20))
            ->withQueryString();

        $periods = BudgetPeriod::where('created_by', $createdBy)
            ->orderByDesc('start_date')
            ->get(['id', 'period_name', 'financial_year']);

        $voteCostCentres = VoteCostCentre::where('created_by', $createdBy)
            ->where('is_active', true)
            ->orderBy('code')
            ->get(['id', 'code', 'name']);

        $budgets = Budget::where('created_by', $createdBy)
            ->whereIn('status', ['active', 'closed'])
            ->orderByDesc('id')
            ->get(['id', 'budget_name']);

        return Inertia::render('BudgetPlanner/BudgetVariances/Index', [
            'variances'      => $variances,
            'periods'        => $periods,
            'voteCostCentres'=> $voteCostCentres,
            'budgets'        => $budgets,
        ]);
    }
}
