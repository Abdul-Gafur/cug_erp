<?php

namespace Workdo\Recruitment\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreJobPostingRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'title' => 'required|max:100',
            'position' => 'required|integer|min:1',
            'priority' => 'required|in:0,1,2',
            'job_application' => 'required|in:existing,custom',
            'application_url' => 'required_if:job_application,custom|nullable|url',
            'branch_id' => 'required|exists:branches,id',
            'applicant' => 'nullable|array',
            'applicant.*' => 'string|in:gender,date_of_birth,country',
            'visibility' => 'nullable|array',
            'visibility.*' => 'string|in:profile_image,resume,cover_letter',
            'min_experience' => 'required|min:0',
            'max_experience' => 'nullable|min:0',
            'min_salary' => 'nullable|numeric|min:0',
            'max_salary' => 'nullable|numeric|min:0',
            'description' => 'nullable',
            'requirements' => 'nullable',
            'benefits' => 'nullable',
            'terms_condition' => 'required',
            'show_terms_condition' => 'nullable|boolean',
            'application_deadline' => 'nullable|date|after_or_equal:today',
            'is_published' => 'nullable',
            'publish_date' => 'nullable',
            'is_featured' => 'nullable',
            'status' => 'required',
            'job_type_id' => 'required|exists:job_types,id',
            'location_id' => 'required|exists:job_locations,id',
            'custom_questions' => 'nullable|array',
            'custom_questions.*' => 'integer|exists:custom_questions,id',
            'skills' => 'required|array',
            'skills.*' => 'string|max:50'
        ];
    }
}