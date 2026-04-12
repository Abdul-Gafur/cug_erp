<?php

namespace Workdo\BudgetPlanner\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreVoteCostCentreRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $ignoredId = $this->route('voteCostCentre')?->id;

        return [
            'code' => [
                'required',
                'string',
                'max:20',
                Rule::unique('vote_cost_centres')
                    ->where('created_by', creatorId())
                    ->ignore($ignoredId),
            ],
            'name'        => 'required|string|max:255',
            'description' => 'nullable|string|max:1000',
            'is_active'   => 'nullable|boolean',
        ];
    }
}
