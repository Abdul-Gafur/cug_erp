import { PaginatedData, ModalState, AuthContext } from '@/types/common';

export interface Address {
    name: string;
    address_line_1: string;
    address_line_2?: string;
    city: string;
    state: string;
    country: string;
    zip_code: string;
}

export interface Vendor {
    id: number;
    user_id?: number;
    vendor_code: string;
    company_name: string;
    registration_number?: string;
    tin_number?: string;
    supplier_category?: string;
    contact_person_name: string;
    contact_person_email?: string;
    contact_person_mobile?: string;
    primary_email?: string;
    primary_mobile?: string;
    tax_number?: string;
    payment_terms?: string;
    currency_code: string;
    credit_limit?: number;
    bank_name?: string;
    bank_branch?: string;
    bank_account_number?: string;
    bank_account_name?: string;
    performance_rating?: number;
    billing_address: Address;
    shipping_address: Address;
    same_as_billing: boolean;
    is_active: boolean;
    is_blacklisted: boolean;
    blacklist_reason?: string;
    notes?: string;
    created_at: string;
}

export const SUPPLIER_CATEGORIES: Record<string, string> = {
    academic_laboratory:      'Academic & Laboratory Supplies',
    it_equipment_services:    'IT Equipment & Services',
    construction_maintenance: 'Construction & Maintenance',
    catering_hospitality:     'Catering & Hospitality',
    professional_services:    'Professional Services',
    general_supplies:         'General Supplies & Services',
    books_publications:       'Books & Publications',
};

export interface CreateVendorFormData {
    user_id?: string;
    company_name: string;
    registration_number: string;
    tin_number: string;
    supplier_category: string;
    contact_person_name: string;
    contact_person_email: string;
    contact_person_mobile: string;
    tax_number: string;
    payment_terms: string;
    bank_name: string;
    bank_branch: string;
    bank_account_number: string;
    bank_account_name: string;
    performance_rating: string;
    billing_address: Address;
    shipping_address: Address;
    same_as_billing: boolean;
    is_blacklisted: boolean;
    blacklist_reason: string;
    notes: string;
}

export interface User {
    id: number;
    name: string;
    email: string;
    mobile_no?: string;
}

export interface VendorFilters {
    company_name: string;
    vendor_code: string;
    contact_person_name: string;
}

export type PaginatedVendors = PaginatedData<Vendor>;
export type VendorModalState = ModalState<Vendor>;

export interface VendorsIndexProps {
    vendors: PaginatedVendors;
    users: User[];
    auth: AuthContext;
    [key: string]: unknown;
}

export interface CreateVendorProps {
    onSuccess: () => void;
    users?: User[];
    auth?: any;
}

export interface EditVendorProps {
    vendor: Vendor;
    onSuccess: () => void;
}