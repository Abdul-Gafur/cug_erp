<?php

namespace Workdo\BudgetPlanner\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateBudgetPeriodRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'period_name'    => 'required|max:100',
            'financial_year' => 'required|max:4',
            'start_date'     => 'required|date',
            'end_date'       => 'required|date|after:start_date',
            // status is intentionally excluded — transitions must use the dedicated
            // approve / active / close endpoints to enforce IPSAS governance workflow.
        ];
    }
}