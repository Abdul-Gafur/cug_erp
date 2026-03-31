<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreBankTransferPaymentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'time_period' => 'required|string|in:Month,Year',
            'payment_receipt' => 'required|file|mimes:jpg,jpeg,png,pdf|max:2048',
            'plan_id' => 'required|exists:plans,id',
            'coupon_code' => 'nullable|string|max:255',
            'user_module_input' => 'nullable|string',
        ];
    }

    public function messages(): array
    {
        return [
            'time_period.required' => __('Time period is required.'),
            'payment_receipt.required' => __('Payment receipt is required.'),
            'plan_id.required' => __('Plan is required.'),
        ];
    }
}