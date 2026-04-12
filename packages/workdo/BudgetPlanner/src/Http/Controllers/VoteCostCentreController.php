<?php

namespace Workdo\BudgetPlanner\Http\Controllers;

use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Workdo\BudgetPlanner\Http\Requests\StoreVoteCostCentreRequest;
use Workdo\BudgetPlanner\Models\VoteCostCentre;

class VoteCostCentreController extends Controller
{
    public function index()
    {
        if (Auth::user()->can('manage-vote-cost-centres')) {
            $voteCostCentres = VoteCostCentre::where('created_by', creatorId())
                ->when(request('search'), fn($q) =>
                    $q->where(function ($query) {
                        $query->where('code', 'like', '%' . request('search') . '%')
                              ->orWhere('name', 'like', '%' . request('search') . '%');
                    }))
                ->when(request('is_active') !== null && request('is_active') !== '', fn($q) =>
                    $q->where('is_active', (bool) request('is_active')))
                ->when(request('sort'),
                    fn($q) => $q->orderBy(request('sort'), request('direction', 'asc')),
                    fn($q) => $q->orderBy('code'))
                ->paginate(request('per_page', 15))
                ->withQueryString();

            return Inertia::render('BudgetPlanner/VoteCostCentres/Index', [
                'voteCostCentres' => $voteCostCentres,
            ]);
        }

        return back()->with('error', __('Permission denied'));
    }

    public function store(StoreVoteCostCentreRequest $request)
    {
        if (Auth::user()->can('create-vote-cost-centres')) {
            $validated = $request->validated();

            VoteCostCentre::create([
                'code'        => strtoupper(trim($validated['code'])),
                'name'        => $validated['name'],
                'description' => $validated['description'] ?? null,
                'is_active'   => true,
                'creator_id'  => Auth::id(),
                'created_by'  => creatorId(),
            ]);

            return redirect()->route('budget-planner.vote-cost-centres.index')
                ->with('success', __('Vote / Cost Centre created successfully.'));
        }

        return redirect()->route('budget-planner.vote-cost-centres.index')
            ->with('error', __('Permission denied'));
    }

    public function update(StoreVoteCostCentreRequest $request, VoteCostCentre $voteCostCentre)
    {
        if (Auth::user()->can('edit-vote-cost-centres')) {
            $validated = $request->validated();

            $voteCostCentre->update([
                'code'        => strtoupper(trim($validated['code'])),
                'name'        => $validated['name'],
                'description' => $validated['description'] ?? null,
                'is_active'   => $validated['is_active'] ?? $voteCostCentre->is_active,
            ]);

            return back()->with('success', __('Vote / Cost Centre updated successfully.'));
        }

        return back()->with('error', __('Permission denied'));
    }

    public function destroy(VoteCostCentre $voteCostCentre)
    {
        if (Auth::user()->can('delete-vote-cost-centres')) {
            if ($voteCostCentre->budgets()->exists()) {
                return back()->with('error', __(
                    'This Vote / Cost Centre has budgets linked to it and cannot be deleted.'
                ));
            }

            $voteCostCentre->delete();

            return back()->with('success', __('Vote / Cost Centre deleted successfully.'));
        }

        return back()->with('error', __('Permission denied'));
    }
}
