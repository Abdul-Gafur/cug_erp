<?php

namespace Workdo\BudgetPlanner\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateBudgetAllocationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'account_id'              => 'required|exists:chart_of_accounts,id',
            'economic_classification' => 'nullable|in:personnel_emoluments,goods_services,capital_expenditure,transfers_grants',
            'allocated_amount'        => 'required|numeric|min:0',
            'q1_amount'               => 'nullable|numeric|min:0',
            'q2_amount'               => 'nullable|numeric|min:0',
            'q3_amount'               => 'nullable|numeric|min:0',
            'q4_amount'               => 'nullable|numeric|min:0',
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            $total     = (float) ($this->q1_amount ?? 0)
                + (float) ($this->q2_amount ?? 0)
                + (float) ($this->q3_amount ?? 0)
                + (float) ($this->q4_amount ?? 0);
            $allocated = (float) ($this->allocated_amount ?? 0);

            if ($total > 0 && abs($total - $allocated) > 0.01) {
                $validator->errors()->add(
                    'q1_amount',
                    __('Quarterly amounts (Q1 + Q2 + Q3 + Q4) must sum to the allocated amount.')
                );
            }
        });
    }
}
