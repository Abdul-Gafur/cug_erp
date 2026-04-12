<?php

namespace Workdo\BudgetPlanner\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateBudgetRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'budget_name'         => 'required|string|max:255',
            'period_id'           => 'required|exists:budget_periods,id',
            'budget_type'         => 'required|in:operational,capital,cash_flow',
            'budget_subtype'      => 'nullable|in:original,revised,supplementary',
            'fund_type'           => 'nullable|in:general_fund,igf,research_grants,donor_endowment,capital_development',
            'vote_cost_centre_id' => 'nullable|exists:vote_cost_centres,id',
            'revision_reason'     => 'nullable|string|max:1000',
            'total_budget_amount' => 'nullable|numeric|min:0',
            'programme_name'      => 'nullable|string|max:200',
            'strategic_objective' => 'nullable|string|max:2000',
            'justification'       => 'nullable|string|max:2000',
            'document'            => 'nullable|file|mimes:pdf,doc,docx|max:10240',
        ];
    }
}
