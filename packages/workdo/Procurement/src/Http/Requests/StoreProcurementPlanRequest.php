<?php

namespace Workdo\Procurement\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreProcurementPlanRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'financial_year'       => 'required|string|max:20',
            'title'                => 'required|string|max:255',
            'vote_cost_centre_id'  => 'required|exists:vote_cost_centres,id',
            'notes'                => 'nullable|string|max:2000',
        ];
    }
}
