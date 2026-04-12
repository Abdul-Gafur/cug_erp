<?php

namespace Workdo\BudgetPlanner\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Workdo\BudgetPlanner\Models\BudgetPeriod;

class StoreBudgetRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'budget_name' => 'required|string|max:255',

            'period_id' => [
                'required',
                'exists:budget_periods,id',
                function ($attribute, $value, $fail) {
                    $period = BudgetPeriod::find($value);
                    if ($period && !in_array($period->status, ['approved', 'active'])) {
                        $fail(__('Budget can only be created in approved or active periods.'));
                    }
                },
            ],

            'budget_type'    => 'required|in:operational,capital,cash_flow',
            'budget_subtype' => 'required|in:original,revised,supplementary',
            'fund_type'      => 'required|in:general_fund,igf,research_grants,donor_endowment,capital_development',

            'vote_cost_centre_id' => 'nullable|exists:vote_cost_centres,id',

            // Revised / supplementary must reference a parent
            'parent_budget_id' => [
                'nullable',
                'exists:budgets,id',
                function ($attribute, $value, $fail) {
                    if (in_array($this->budget_subtype, ['revised', 'supplementary']) && !$value) {
                        $fail(__('Revised and supplementary budgets must reference the original budget.'));
                    }
                },
            ],

            'revision_reason'     => 'nullable|string|max:1000',
            'total_budget_amount' => 'nullable|numeric|min:0',
            'programme_name'      => 'nullable|string|max:200',
            'strategic_objective' => 'nullable|string|max:2000',
            'justification'       => 'nullable|string|max:2000',
            'document'            => 'nullable|file|mimes:pdf,doc,docx|max:10240',
        ];
    }
}
