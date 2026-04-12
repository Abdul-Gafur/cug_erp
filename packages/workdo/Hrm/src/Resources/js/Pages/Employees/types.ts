import { PaginatedData, ModalState, AuthContext } from '@/types/common';

export interface Branch {
    id: number;
    name: string;
}

export interface Department {
    id: number;
    name: string;
}

export interface User {
    id: number;
    name: string;
}

export interface Designation {
    id: number;
    name: string;
}

export interface Employee {
    id: number;
    employee_id?: string;
    date_of_birth?: string;
    gender?: string;
    shift_id?: any;
    shift?: { id: number; shift_name: string; };
    date_of_joining?: string;
    employment_type?: string;
    address_line_1?: string;
    address_line_2?: string;
    city?: string;
    state?: string;
    country?: string;
    postal_code?: string;
    emergency_contact_name?: string;
    emergency_contact_relationship?: string;
    emergency_contact_number?: string;
    bank_name?: string;
    account_holder_name?: string;
    account_number?: string;
    bank_identifier_code?: string;
    bank_branch?: string;
    tax_payer_id?: string;
    basic_salary?: any;
    hours_per_day?: any;
    days_per_week?: any;
    rate_per_hour?: any;
    user_id?: any;
    user?: User;
    branch_id?: any;
    branch?: Branch;
    department_id?: any;
    department?: Department;
    designation_id?: any;
    designation?: Designation;
    created_at?: string;
    [key: string]: any;
}

export interface CreateEmployeeFormData {
    employee_id?: string;
    date_of_birth?: string;
    gender?: string;
    shift_id?: string;
    date_of_joining?: string;
    employment_type?: string;
    address_line_1?: string;
    address_line_2?: string;
    city?: string;
    state?: string;
    country?: string;
    postal_code?: string;
    emergency_contact_name?: string;
    emergency_contact_relationship?: string;
    emergency_contact_number?: string;
    bank_name?: string;
    account_holder_name?: string;
    account_number?: string;
    bank_identifier_code?: string;
    bank_branch?: string;
    tax_payer_id?: string;
    basic_salary?: string;
    hours_per_day?: string;
    days_per_week?: string;
    rate_per_hour?: string;
    user_id?: string;
    branch_id?: string;
    department_id?: string;
    designation_id?: string;
    [key: string]: any;
}

export interface EditEmployeeFormData extends Partial<CreateEmployeeFormData> {}

export interface EmployeeFilters {
    employee_id?: string;
    'user.name'?: string;
    branch_id?: string;
    department_id?: string;
    employment_type?: string;
    gender?: string;
}

export type PaginatedEmployees = PaginatedData<Employee>;
export type EmployeeModalState = ModalState<Employee>;

export interface EmployeesIndexProps {
    employees: PaginatedEmployees;
    auth: AuthContext;
    users?: any[];
    branches?: any[];
    departments?: any[];
    designations?: any[];
    [key: string]: unknown;
}

export interface CreateEmployeeProps {
    onSuccess: () => void;
}

export interface EditEmployeeProps {
    employee: Employee;
    onSuccess: () => void;
}

export interface EmployeeShowProps {
    employee: Employee;
    [key: string]: unknown;
}