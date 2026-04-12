import { PaginatedData, ModalState, AuthContext } from '@/types/common';

export interface JobType {
    id: number;
    name: string;
}

export interface JobLocation {
    id: number;
    name: string;
}

export interface JobPosting {
    id: number;
    title: string;
    description?: string;
    requirements?: string;
    benefits?: string;
    terms_condition?: string;
    show_terms_condition?: boolean;
    application_deadline?: any;
    is_published?: boolean;
    publish_date?: any;
    is_featured?: boolean;
    status?: any;
    department_id?: any;
    department_name?: string;
    job_type_id?: any;
    jobType?: JobType;
    location_id?: any;
    location?: JobLocation;
    skills?: any;
    position?: any;
    priority?: any;
    job_application?: string;
    application_url?: string;
    branch_id?: any;
    applicant?: string[];
    visibility?: string[];
    min_experience?: any;
    max_experience?: any;
    min_salary?: any;
    max_salary?: any;
    custom_questions?: any;
    created_at?: string;
}

export interface CreateJobPostingFormData {
    title: string;
    position?: string;
    priority?: string;
    job_application?: string;
    application_url?: string;
    branch_id?: string;
    applicant?: string[];
    visibility?: string[];
    min_experience?: string;
    max_experience?: string;
    min_salary?: string;
    max_salary?: string;
    description?: string;
    requirements?: string;
    benefits?: string;
    terms_condition?: string;
    show_terms_condition?: boolean;
    application_deadline?: any;
    is_published?: boolean;
    publish_date?: any;
    is_featured?: boolean;
    status?: string;
    department_id?: string;
    job_type_id?: string;
    location_id?: string;
    custom_questions?: number[];
    skills?: string[];
}

export interface EditJobPostingFormData extends Partial<CreateJobPostingFormData> {}

export interface JobPostingFilters {
    title?: string;
    description?: string;
    job_type_id?: string;
    location_id?: string;
    branch_id?: string;
    status?: string;
}

export type PaginatedJobPostings = PaginatedData<JobPosting>;
export type JobPostingModalState = ModalState<JobPosting>;

export interface JobPostingsIndexProps {
    jobpostings: PaginatedJobPostings;
    auth: AuthContext;
    jobtypes: any[];
    joblocations: any[];
    branches: any[];
    customquestions?: any[];
    departments?: any[];
    [key: string]: unknown;
}

export interface CreateJobPostingProps {
    onSuccess: () => void;
}

export interface EditJobPostingProps {
    jobposting: JobPosting;
    onSuccess: () => void;
}

export interface JobPostingShowProps {
    jobposting: JobPosting;
    [key: string]: unknown;
}
