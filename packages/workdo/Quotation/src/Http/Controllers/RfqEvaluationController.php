<?php

namespace Workdo\Quotation\Http\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Workdo\Quotation\Models\SalesQuotation;
use Workdo\Quotation\Models\RfqEvaluation;
use Workdo\Quotation\Models\RfqEvaluationCriterion;
use Workdo\Quotation\Models\RfqEvaluationScore;

class RfqEvaluationController extends Controller
{
    public function show(SalesQuotation $quotation)
    {
        if (!Auth::user()->can('approve-quotations')) {
            return redirect()->route('quotations.index')->with('error', __('Permission denied'));
        }
        if ($quotation->created_by != creatorId()) {
            return redirect()->route('quotations.index')->with('error', __('Access denied'));
        }

        $quotation->load(['suppliers.supplier', 'awardedSupplier']);

        $evaluation = $quotation->evaluation()->with([
            'criteria',
            'scores.supplier',
            'scores.criterion',
            'recommendedSupplier',
            'finalisedBy',
        ])->firstOrFail();

        // Build score matrix: [criterion_id][supplier_id] => score row
        $matrix = [];
        foreach ($evaluation->scores as $score) {
            $matrix[$score->criterion_id][$score->supplier_id] = $score;
        }

        // Supplier totals
        $totals = $evaluation->supplierTotals();

        return Inertia::render('Quotation/Evaluation/Scorecard', [
            'quotation'  => $quotation,
            'evaluation' => $evaluation,
            'matrix'     => $matrix,
            'totals'     => $totals,
        ]);
    }

    /**
     * Update criteria weights for this evaluation.
     */
    public function updateCriteria(Request $request, SalesQuotation $quotation)
    {
        if (!Auth::user()->can('approve-quotations') || $quotation->created_by != creatorId()) {
            return back()->with('error', __('Permission denied'));
        }

        $evaluation = $quotation->evaluation;
        if (!$evaluation || $evaluation->status === 'finalised') {
            return back()->with('error', __('Cannot modify a finalised evaluation.'));
        }

        $request->validate([
            'criteria'              => 'required|array|min:1',
            'criteria.*.id'         => 'required|exists:rfq_evaluation_criteria,id',
            'criteria.*.criterion_name' => 'required|string|max:200',
            'criteria.*.weight'     => 'required|numeric|min:0|max:100',
            'criteria.*.sort_order' => 'nullable|integer',
        ]);

        $totalWeight = collect($request->criteria)->sum('weight');
        if (abs($totalWeight - 100) > 0.01) {
            return back()->with('error', __('Criteria weights must sum to 100%.'));
        }

        foreach ($request->criteria as $c) {
            RfqEvaluationCriterion::where('id', $c['id'])
                ->where('evaluation_id', $evaluation->id)
                ->update([
                    'criterion_name' => $c['criterion_name'],
                    'weight'         => $c['weight'],
                    'sort_order'     => $c['sort_order'] ?? 0,
                ]);
        }

        return back()->with('success', __('Criteria updated.'));
    }

    /**
     * Save scores for one supplier (all criteria in one POST).
     */
    public function saveScores(Request $request, SalesQuotation $quotation)
    {
        if (!Auth::user()->can('approve-quotations') || $quotation->created_by != creatorId()) {
            return back()->with('error', __('Permission denied'));
        }

        $evaluation = $quotation->evaluation;
        if (!$evaluation || $evaluation->status === 'finalised') {
            return back()->with('error', __('Cannot modify a finalised evaluation.'));
        }

        $request->validate([
            'supplier_id'             => 'required|exists:users,id',
            'scores'                  => 'required|array',
            'scores.*.criterion_id'   => 'required|exists:rfq_evaluation_criteria,id',
            'scores.*.score'          => 'required|numeric|min:0|max:100',
            'scores.*.notes'          => 'nullable|string|max:500',
        ]);

        foreach ($request->scores as $s) {
            $criterion = RfqEvaluationCriterion::where('id', $s['criterion_id'])
                ->where('evaluation_id', $evaluation->id)
                ->firstOrFail();

            $weighted = round(($s['score'] / 100) * $criterion->weight, 4);

            RfqEvaluationScore::updateOrCreate(
                [
                    'evaluation_id' => $evaluation->id,
                    'criterion_id'  => $criterion->id,
                    'supplier_id'   => $request->supplier_id,
                ],
                [
                    'score'         => $s['score'],
                    'weighted_score' => $weighted,
                    'notes'         => $s['notes'] ?? null,
                    'creator_id'    => Auth::id(),
                    'created_by'    => creatorId(),
                ]
            );
        }

        return back()->with('success', __('Scores saved.'));
    }

    /**
     * Finalise the evaluation and set the recommended supplier.
     */
    public function finalise(Request $request, SalesQuotation $quotation)
    {
        if (!Auth::user()->can('approve-quotations') || $quotation->created_by != creatorId()) {
            return back()->with('error', __('Permission denied'));
        }

        $evaluation = $quotation->evaluation;
        if (!$evaluation || $evaluation->status === 'finalised') {
            return back()->with('error', __('Evaluation already finalised.'));
        }

        $request->validate([
            'recommended_supplier_id' => 'required|exists:users,id',
            'recommendation_notes'    => 'nullable|string|max:2000',
        ]);

        $evaluation->update([
            'recommended_supplier_id' => $request->recommended_supplier_id,
            'recommendation_notes'    => $request->recommendation_notes,
            'status'                  => 'finalised',
            'finalised_by'            => Auth::id(),
            'finalised_at'            => now(),
        ]);

        return back()->with('success', __('Evaluation finalised. Awaiting committee approval.'));
    }

    /**
     * Committee Approval.
     */
    public function committeeApprove(Request $request, SalesQuotation $quotation)
    {
        if (!Auth::user()->can('approve-quotations') || $quotation->created_by != creatorId()) {
            return back()->with('error', __('Permission denied'));
        }

        $evaluation = $quotation->evaluation;
        if (!$evaluation || $evaluation->status !== 'finalised') {
            return back()->with('error', __('Evaluation must be finalised before committee approval.'));
        }

        $request->validate([
            'committee_members' => 'required',
            'signed_document'   => 'nullable|file|mimes:pdf,jpg,png,jpeg|max:20480',
        ]);

        $members = $request->committee_members;
        if (is_string($members)) {
            $members = array_map('trim', explode(',', $members));
            $members = array_filter($members);
        }

        $data = [
            'status'                => 'committee_approved',
            'committee_members'     => $members,
            'committee_approved_by' => Auth::id(),
            'committee_approved_at' => now(),
        ];

        if ($request->hasFile('signed_document')) {
            $file = $request->file('signed_document');
            $fileName = time() . '_' . $file->getClientOriginalName();
            $path = $file->storeAs('rfq_evaluations', $fileName, 'public');
            $data['signed_document'] = $path;
        }

        $evaluation->update($data);

        return back()->with('success', __('Evaluation approved by Tender Committee. Proceed to award the RFQ.'));
    }

    /**
     * Print / PDF the evaluation report.
     */
    public function print(SalesQuotation $quotation)
    {
        if (!Auth::user()->can('print-quotations')) {
            return back()->with('error', __('Permission denied'));
        }

        $quotation->load(['suppliers.supplier', 'awardedSupplier']);

        $evaluation = $quotation->evaluation()->with([
            'criteria',
            'scores.supplier',
            'scores.criterion',
            'recommendedSupplier',
            'finalisedBy',
        ])->firstOrFail();

        $totals = $evaluation->supplierTotals();

        return Inertia::render('Quotation/Evaluation/Print', [
            'quotation'  => $quotation,
            'evaluation' => $evaluation,
            'totals'     => $totals,
        ]);
    }
}
