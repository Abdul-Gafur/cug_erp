<?php

namespace Workdo\Account\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreInvoiceSubmissionRequest extends FormRequest
{
    public function authorize()
    {
        return true;
    }

    public function rules()
    {
        return [
            'invoice_number'        => 'required|string|max:100',
            'invoice_date'          => 'required|date|before_or_equal:today',
            'po_reference'          => 'nullable|string|max:100',
            'delivery_note_number'  => 'nullable|string|max:100',
            'supplier_type'         => 'required|in:resident,non_resident',
            'goods_or_services'     => 'required|in:goods,services',
            'base_amount'           => 'required|numeric|min:0',
        ];
    }

    public function messages()
    {
        return [
            'invoice_date.before_or_equal' => __('Invoice date cannot be in the future.'),
            'base_amount.min'              => __('Base amount must be zero or greater.'),
        ];
    }
}
