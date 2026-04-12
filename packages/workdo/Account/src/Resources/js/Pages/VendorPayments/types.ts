import { PaginatedData, ModalState, AuthContext } from '@/types/common';

export interface Vendor {
    id: number;
    name: string;
    email: string;
}

export interface BankAccount {
    id: number;
    account_name: string;
    account_number: string;
    bank_name: string;
}

export interface PurchaseInvoice {
    id: number;
    invoice_number: string;
    invoice_date: string;
    total_amount: number;
    balance_amount: number;
    status: string;
}

export interface DebitNote {
    id: number;
    debit_note_number: string;
    debit_note_date: string;
    total_amount: number;
    balance_amount: number;
    status: string;
}

export interface VendorPaymentAllocation {
    id: number;
    invoice_id: number;
    allocated_amount: number;
    invoice: PurchaseInvoice;
}

export interface InvoiceSubmission {
    id: number;
    invoice_number: string;
    invoice_date: string;
    po_reference?: string;
    delivery_note_number?: string;
    submission_date: string;
    supplier_type: 'resident' | 'non_resident';
    goods_or_services: 'goods' | 'services';
    base_amount: number;
    nhil_amount: number;
    getfund_amount: number;
    chrl_amount: number;
    vat_base_amount: number;
    vat_amount: number;
    gross_amount: number;
    wht_rate: number;
    wht_amount: number;
    net_payable: number;
    verification_status: 'pending' | 'verified' | 'rejected';
    three_way_match_status: 'not_checked' | 'matched' | 'discrepancy';
    match_notes?: string;
    rejection_reason?: string;
    submitted_by?: { id: number; name: string };
    verified_by?: { id: number; name: string };
    verified_at?: string;
}

export interface VendorPayment {
    id: number;
    payment_number: string;
    pv_number?: string;
    payment_date: string;
    vendor_id: number;
    bank_account_id: number;
    reference_number?: string;
    payment_method?: 'bank_transfer' | 'cheque' | 'electronic';
    cheque_number?: string;
    narration?: string;
    payment_amount: number;
    status: 'pending' | 'cleared' | 'cancelled';
    approval_stage: 'pending' | 'hod_approved' | 'finance_approved' | 'cfo_approved';
    hod_approved_by?: { id: number; name: string };
    hod_approved_at?: string;
    finance_approved_by?: { id: number; name: string };
    finance_approved_at?: string;
    cfo_approved_by?: { id: number; name: string };
    cfo_approved_at?: string;
    notes?: string;
    vendor: Vendor;
    bank_account: BankAccount;
    allocations: VendorPaymentAllocation[];
    invoice_submission?: InvoiceSubmission;
    created_at: string;
}

export interface CreateVendorPaymentFormData {
    payment_date: string;
    vendor_id: string;
    bank_account_id: string;
    reference_number: string;
    payment_method: string;
    cheque_number: string;
    narration: string;
    payment_amount: string;
    notes: string;
    allocations: {
        invoice_id: number;
        amount: number;
    }[];
    debit_notes: {
        debit_note_id: number;
        amount: number;
    }[];
}

export interface VendorPaymentFilters {
    vendor_id: string;
    status: string;
    approval_stage: string;
    search: string;
    bank_account_id: string;
}

export type PaginatedVendorPayments = PaginatedData<VendorPayment>;
export type VendorPaymentModalState = ModalState<VendorPayment>;

export interface VendorPaymentsIndexProps {
    payments: PaginatedVendorPayments;
    vendors: Vendor[];
    bankAccounts: BankAccount[];
    filters: VendorPaymentFilters;
    auth: AuthContext;
}

export interface CreateVendorPaymentProps {
    vendors: Vendor[];
    bankAccounts: BankAccount[];
    onSuccess: () => void;
}

export interface VendorPaymentViewProps {
    payment: VendorPayment;
}