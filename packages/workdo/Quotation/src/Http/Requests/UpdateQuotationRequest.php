<?php

namespace Workdo\Quotation\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateQuotationRequest extends FormRequest
{
    public function authorize()
    {
        return true;
    }

    public function rules()
    {
        return [
            'invoice_date' => 'required|date',
            'due_date' => 'required|date|after_or_equal:invoice_date',
            'closing_date' => 'nullable|date',
            'department' => 'nullable|string|max:255',
            'pr_id' => 'nullable|exists:purchase_requisitions,id',
            'warehouse_id' => 'required|exists:warehouses,id',
            'payment_terms' => 'nullable|string|max:255',
            'notes' => 'nullable|string',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'nullable|numeric|min:0',
            'items.*.description' => 'required_if:items.*.product_id,0|nullable|string',
            'items.*.quantity' => 'required|numeric|min:1',
            'items.*.unit_price' => 'required|numeric|min:0',
            'items.*.discount_percentage' => 'nullable|numeric|min:0|max:100',
            'items.*.tax_percentage' => 'nullable|numeric|min:0',
            'items.*.taxes' => 'nullable|array',
            'items.*.taxes.*.tax_name' => 'required_with:items.*.taxes|string',
            'items.*.taxes.*.tax_rate' => 'required_with:items.*.taxes|numeric|min:0',
            'invited_supplier_ids' => 'nullable|array',
            'invited_supplier_ids.*' => 'exists:users,id'
        ];
    }

    public function messages(): array
    {
        return [
            'customer_id.exists' => __('Selected customer does not exist.'),
            'items.required' => __('At least one item is required.'),
            'items.*.description.required_if' => __('Description is required for non-product items.'),
            'items.*.quantity.min' => __('Quantity must be at least 1.'),
            'items.*.unit_price.min' => __('Unit price must be 0 or greater.')
        ];
    }
}