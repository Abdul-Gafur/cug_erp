<?php

namespace Workdo\Account\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreVendorPaymentRequest extends FormRequest
{
    public function authorize()
    {
        return true;
    }

    public function rules()
    {
        return [
            'payment_date'    => 'required|date|before_or_equal:today',
            'vendor_id'       => 'required|exists:users,id',
            'bank_account_id' => 'required|exists:bank_accounts,id',
            'reference_number'=> 'nullable|string|max:100',
            'payment_method'  => 'nullable|in:bank_transfer,cheque,electronic',
            'cheque_number'   => 'nullable|required_if:payment_method,cheque|string|max:100',
            'narration'       => 'nullable|string',
            'payment_amount'  => 'required|numeric|min:0',
            'notes'           => 'nullable|string',
            'allocations'              => 'nullable|array',
            'allocations.*.invoice_id' => 'required|exists:purchase_invoices,id',
            'allocations.*.amount'     => 'required|numeric|min:0.01',
            'debit_notes'                  => 'nullable|array',
            'debit_notes.*.debit_note_id'  => 'required|exists:debit_notes,id',
            'debit_notes.*.amount'         => 'required|numeric|min:0.01',
            'invoice_number'               => 'nullable|string|max:100',
            'invoice_date'                 => 'nullable|date',
            'po_reference'                 => 'nullable|string|max:100',
            'delivery_note_number'         => 'nullable|string|max:100',
            'supplier_type'                => 'nullable|in:resident,non_resident',
            'goods_or_services'            => 'nullable|in:goods,services',
            'base_amount'                  => 'nullable|numeric|min:0',
        ];
    }

    public function messages()
    {
        return [
            'payment_date.before_or_equal' => __('Payment date cannot be in the future.'),
            'allocations.*.amount.min'     => __('Allocation amount must be greater than 0.'),
            'debit_notes.*.amount.min'     => __('Debit note amount must be greater than 0.'),
            'cheque_number.required_if'    => __('Cheque number is required when payment method is cheque.'),
        ];
    }

    public function withValidator($validator)
    {
        $validator->after(function ($validator) {
            $allocations = $this->input('allocations', []);
            $debitNotes  = $this->input('debit_notes', []);

            if (empty($allocations) && empty($debitNotes) && empty($this->input('invoice_number'))) {
                $validator->errors()->add('allocations', 'At least one invoice allocation or direct invoice submission is required.');
            }
        });
    }
}
