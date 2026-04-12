<?php

namespace Workdo\Procurement\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StorePurchaseRequisitionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'requisition_date'         => 'required|date',
            'requesting_department_id' => 'required|exists:vote_cost_centres,id',
            'purpose'                  => 'required|string|max:1000',
            'justification'            => 'required|string|max:2000',
            'category'                 => 'required|in:academic,administrative',
            'plan_item_id'             => 'nullable|exists:procurement_plan_items,id',
            'is_off_plan'              => 'boolean',
            'off_plan_justification'   => 'required_if:is_off_plan,true|nullable|string|max:2000',
            'budget_period_id'         => 'required|exists:budget_periods,id',

            'items'                           => 'required|array|min:1',
            'items.*.description'             => 'required|string|max:500',
            'items.*.quantity'                => 'required|numeric|min:0.001',
            'items.*.unit'                    => 'nullable|string|max:30',
            'items.*.estimated_unit_cost'     => 'required|numeric|min:0',
            'items.*.account_id'              => 'required|exists:chart_of_accounts,id',
            'items.*.fund_type'               => 'required|string|max:50',
            'items.*.economic_classification' => 'required|string|max:50',
            'items.*.notes'                   => 'nullable|string|max:500',
        ];
    }

    public function messages(): array
    {
        return [
            'off_plan_justification.required_if' =>
                'A written justification is required for off-plan requisitions.',
            'items.required'  => 'At least one line item is required.',
            'items.min'       => 'At least one line item is required.',
        ];
    }
}
