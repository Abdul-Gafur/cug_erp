// ── RFQ (Request for Quotation) types ────────────────────────────────────────

export interface Rfq {
    id: number;
    quotation_number: string;
    revision_number: number;
    parent_quotation_id?: number;
    quotation_date: string;
    due_date: string;
    closing_date?: string;
    department?: string;
    pr_id?: number;
    awarded_supplier_id?: number;
    warehouse_id?: number;
    subtotal: number;
    tax_amount: number;
    discount_amount: number;
    total_amount: number;
    status: RfqStatus;
    payment_terms?: string;
    notes?: string;
    creator_id: number;
    created_by: number;
    converted_to_invoice: boolean;
    invoice_id?: number;
    created_at: string;
    updated_at: string;

    // Relations
    awarded_supplier?: User;
    suppliers?: RfqSupplier[];
    items?: RfqItem[];
    warehouse?: Warehouse;
    parent_quotation?: Rfq;
    evaluation?: RfqEvaluation;
    lpo?: Lpo;
}

// Legacy alias used by some components
export type Quotation = Rfq;

export type RfqStatus =
    | 'draft'
    | 'issued'
    | 'closed'
    | 'under_evaluation'
    | 'awarded'
    | 'lpo_issued'
    | 'rejected';

export interface RfqSupplier {
    id: number;
    rfq_id: number;
    supplier_id: number;
    response_received_at?: string;
    quoted_amount?: number;
    delivery_days?: number;
    response_notes?: string;
    status: 'invited' | 'responded' | 'not_responded';
    supplier?: User;
}

export interface RfqItem {
    id?: number;
    quotation_id?: number;
    product_id: number;
    description?: string;
    quantity: number;
    unit_price: number;
    discount_percentage: number;
    discount_amount: number;
    tax_percentage: number;
    tax_amount: number;
    total_amount: number;
    taxes?: Array<{id?: number; tax_name: string; tax_rate: number}>;
    product?: ProductServiceItem;
}

// Legacy alias
export type QuotationItem = RfqItem;

// ── Bid Evaluation types ──────────────────────────────────────────────────────

export interface RfqEvaluation {
    id: number;
    rfq_id: number;
    status: 'draft' | 'finalised' | 'committee_approved';
    recommendation_notes?: string;
    recommended_supplier_id?: number;
    finalised_by?: number;
    finalised_at?: string;
    committee_members?: string;
    committee_approved_by?: number;
    committee_approved_at?: string;
    criteria?: EvaluationCriterion[];
    scores?: EvaluationScore[];
    recommended_supplier?: User;
    finalised_by_user?: User;
    committee_approved_by_user?: User;
}

export interface EvaluationCriterion {
    id: number;
    evaluation_id: number;
    criterion_name: string;
    weight: number;
    sort_order: number;
}

export interface EvaluationScore {
    id: number;
    evaluation_id: number;
    criterion_id: number;
    supplier_id: number;
    score: number;
    weighted_score: number;
    notes?: string;
    supplier?: User;
    criterion?: EvaluationCriterion;
}

// ── Local Purchase Order types ────────────────────────────────────────────────

export interface Lpo {
    id: number;
    lpo_number: string;
    lpo_date: string;
    rfq_id?: number;
    requisition_id?: number;
    supplier_id: number;
    issuing_department: string;
    delivery_location?: string;
    delivery_date?: string;
    payment_terms?: string;
    vote_account_id?: number;
    fund_type?: string;
    economic_classification?: string;
    budget_period_id?: number;
    is_contract?: boolean;
    contract_number?: string;
    contract_terms?: string;
    subtotal: number;
    tax_amount: number;
    discount_amount: number;
    total_amount: number;
    status: 'draft' | 'approved' | 'emailed' | 'completed' | 'cancelled';
    approved_by?: number;
    approved_at?: string;
    emailed_at?: string;
    notes?: string;
    supplier?: User;
    items?: LpoItem[];
    rfq?: Rfq;
    approved_by_user?: User;
    vote_account?: ChartOfAccount;
    budget_period?: BudgetPeriod;
}

export interface LpoItem {
    id?: number;
    lpo_id?: number;
    product_id?: number;
    description: string;
    quantity: number;
    unit?: string;
    unit_price: number;
    discount_percentage: number;
    discount_amount: number;
    tax_percentage: number;
    tax_amount: number;
    total_amount: number;
    product?: ProductServiceItem;
}

// ── Shared types ──────────────────────────────────────────────────────────────

export interface User {
    id: number;
    name: string;
    email: string;
    type?: string;
}

export interface Warehouse {
    id: number;
    name: string;
    address?: string;
}

export interface ProductServiceItem {
    id: number;
    name: string;
    sku?: string;
    description?: string;
    sale_price?: number;
    purchase_price?: number;
    unit?: string;
    type?: string;
}

export interface ChartOfAccount {
    id: number;
    account_code: string;
    account_name: string;
}

export interface BudgetPeriod {
    id: number;
    period_name: string;
}

export interface QuotationFilters {
    status?: string;
    search?: string;
    date_range?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export const RFQ_STATUS_LABELS: Record<RfqStatus, string> = {
    draft:            'Draft',
    issued:           'Issued',
    closed:           'Closed',
    under_evaluation: 'Under Evaluation',
    awarded:          'Awarded',
    lpo_issued:       'LPO Issued',
    rejected:         'Rejected / Cancelled',
};
