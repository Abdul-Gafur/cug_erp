<?php

namespace Workdo\BudgetPlanner\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreBudgetAmendmentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'budget_id'          => 'required|exists:budgets,id',
            'amendment_type'     => 'required|in:virement,revision,supplementary',
            'from_allocation_id' => 'nullable|exists:budget_allocations,id',
            'to_allocation_id'   => 'nullable|exists:budget_allocations,id',
            'amount'             => 'required|numeric|min:0.01',
            'reason'             => 'required|string|max:1000',
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            if ($this->amendment_type === 'virement') {
                if (!$this->from_allocation_id) {
                    $validator->errors()->add('from_allocation_id',
                        __('A source allocation is required for a virement.'));
                }
                if (!$this->to_allocation_id) {
                    $validator->errors()->add('to_allocation_id',
                        __('A destination allocation is required for a virement.'));
                }
                if ($this->from_allocation_id && $this->to_allocation_id
                    && $this->from_allocation_id === $this->to_allocation_id) {
                    $validator->errors()->add('to_allocation_id',
                        __('Source and destination allocations must be different.'));
                }
            }
        });
    }
}
