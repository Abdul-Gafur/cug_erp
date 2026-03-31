import { PaginatedData, ModalState, AuthContext, CreateProps, EditProps } from '@/types/common';

export interface JobCategory {
    id: number;
    name: string;
    description?: string;
    is_active: boolean;
    created_at: string;
}

export interface JobCategoryFormData {
    name: string;
    description: string;
    is_active: boolean;
}

export interface CreateJobCategoryProps extends CreateProps {
}

export interface EditJobCategoryProps extends EditProps<JobCategory> {
}

export type PaginatedJobCategories = PaginatedData<JobCategory>;
export type JobCategoryModalState = ModalState<JobCategory>;

export interface JobCategoriesIndexProps {
    jobcategories: PaginatedJobCategories;
    auth: AuthContext;
    [key: string]: unknown;
}