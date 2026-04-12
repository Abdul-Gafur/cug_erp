import { useState } from 'react';
import { Head, usePage, router } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import { useDeleteHandler } from '@/hooks/useDeleteHandler';
import AuthenticatedLayout from "@/layouts/authenticated-layout";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Dialog } from "@/components/ui/dialog";
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { Plus, Edit as EditIcon, Trash2, DollarSign } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FilterButton } from '@/components/ui/filter-button';
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { PerPageSelector } from '@/components/ui/per-page-selector';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import NoRecordsFound from '@/components/no-records-found';
import { formatCurrency } from '@/utils/helpers';
import Create from './Create';
import Edit from './Edit';

interface BudgetAllocation {
    id: number;
    budget?: { budget_name: string; vote_cost_centre?: { code: string; }; };
    account?: { account_name: string; account_code: string; };
    economic_classification: string;
    allocated_amount: number;
    committed_amount: number;
    spent_amount: number;
    remaining_amount: number;
}

const ECON_LABELS: Record<string, string> = {
    personnel_emoluments: 'Personnel Emoluments',
    goods_services:       'Goods & Services',
    capital_expenditure:  'Capital Expenditure',
    transfers_grants:     'Transfers & Grants',
};

export default function Index() {
    const { t } = useTranslation();
    const { props } = usePage<any>();
    const budgetAllocations = props.budgetAllocations || { data: [] };
    const budgets = props.budgets || [];
    const accounts = props.accounts || [];
    const auth = props.auth || { user: { permissions: [] } };
    
    const urlParams = new URLSearchParams(window.location.search);

    const [filters, setFilters] = useState({
        search: urlParams.get('search') || '',
        budget_id: urlParams.get('budget_id') || '',
        account_id: urlParams.get('account_id') || '',
        economic_classification: urlParams.get('economic_classification') || '',
    });

    const [perPage] = useState(urlParams.get('per_page') || '10');
    const [sortField, setSortField] = useState(urlParams.get('sort') || '');
    const [sortDirection, setSortDirection] = useState(urlParams.get('direction') || 'asc');
    const [showFilters, setShowFilters] = useState(false);
    const [modalState, setModalState] = useState<{
        isOpen: boolean;
        mode: 'add' | 'edit' | '';
        data: BudgetAllocation | null;
    }>({
        isOpen: false,
        mode: '',
        data: null
    });


    const { deleteState, openDeleteDialog, closeDeleteDialog, confirmDelete } = useDeleteHandler({
        routeName: 'budget-planner.budget-allocations.destroy',
        defaultMessage: t('Are you sure you want to delete this budget allocation?')
    });

    const handleFilter = () => {
        router.get(route('budget-planner.budget-allocations.index'), {...filters, per_page: perPage, sort: sortField, direction: sortDirection}, {
            preserveState: true,
            replace: true
        });
    };

    const handleSort = (field: string) => {
        const direction = sortField === field && sortDirection === 'asc' ? 'desc' : 'asc';
        setSortField(field);
        setSortDirection(direction);
        router.get(route('budget-planner.budget-allocations.index'), {...filters, per_page: perPage, sort: field, direction}, {
            preserveState: true,
            replace: true
        });
    };

    const clearFilters = () => {
        setFilters({
            search: '',
            budget_id: '',
            account_id: '',
            economic_classification: '',
        });
        router.get(route('budget-planner.budget-allocations.index'), {per_page: perPage});
    };

    const openModal = (mode: 'add' | 'edit', data: BudgetAllocation | null = null) => {
        setModalState({ isOpen: true, mode, data });
    };

    const closeModal = () => {
        setModalState({ isOpen: false, mode: '', data: null });
    };

    const tableColumns = [
        {
            key: 'budget',
            header: t('Budget'),
            sortable: false,
            render: (_: any, row: BudgetAllocation) => row.budget?.budget_name || '-'
        },
        {
            key: 'account',
            header: t('Account'),
            sortable: false,
            render: (_: any, row: BudgetAllocation) =>
                row.account ? `${row.account.account_code} — ${row.account.account_name}` : '-'
        },
        {
            key: 'economic_classification',
            header: t('Economic Classification'),
            sortable: false,
            render: (v: string) => ECON_LABELS[v] ?? v ?? '-'
        },
        {
            key: 'allocated_amount',
            header: t('Allocated'),
            sortable: false,
            render: (v: number) => formatCurrency(v)
        },
        {
            key: 'committed_amount',
            header: t('Committed'),
            sortable: false,
            render: (v: number) => <span className="text-amber-700">{formatCurrency(v)}</span>
        },
        {
            key: 'spent_amount',
            header: t('Spent'),
            sortable: false,
            render: (v: number) => formatCurrency(v)
        },
        {
            key: 'remaining_amount',
            header: t('Remaining'),
            sortable: false,
            render: (_: any, row: BudgetAllocation) => {
                const available = (row.allocated_amount || 0) - (row.committed_amount || 0) - (row.spent_amount || 0);
                return <span className={available < 0 ? 'text-red-600 font-medium' : 'text-green-700'}>{formatCurrency(available)}</span>;
            }
        },
        {
            key: 'actions',
            header: t('Actions'),
            render: (_: any, budgetAllocation: BudgetAllocation) => (
                <div className="flex gap-1">
                    <TooltipProvider>
                        {auth.user?.permissions?.includes('edit-budget-allocations') && (
                            <Tooltip delayDuration={0}>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => openModal('edit', budgetAllocation)}
                                        className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700"
                                    >
                                        <EditIcon className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>{t('Edit')}</p>
                                </TooltipContent>
                            </Tooltip>
                        )}
                        {auth.user?.permissions?.includes('delete-budget-allocations') && (
                            <Tooltip delayDuration={0}>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => openDeleteDialog(budgetAllocation.id)}
                                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>{t('Delete')}</p>
                                </TooltipContent>
                            </Tooltip>
                        )}
                    </TooltipProvider>
                </div>
            )
        }
    ];

    return (
        <AuthenticatedLayout
            breadcrumbs={[
                {label: t('Budget Planner')},
                {label: t('Budget Allocations')}
            ]}
            pageTitle={t('Manage Budget Allocations')}
            pageActions={
                <TooltipProvider>
                    {auth.user?.permissions?.includes('create-budget-allocations') && (
                        <Tooltip delayDuration={0}>
                            <TooltipTrigger asChild>
                                <Button size="sm" onClick={() => openModal('add')}>
                                    <Plus className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>{t('Create')}</p>
                            </TooltipContent>
                        </Tooltip>
                    )}
                </TooltipProvider>
            }
        >
            <Head title={t('Budget Allocations')} />

            {/* Main Content Card */}
            <Card className="shadow-sm">
                {/* Search & Controls Header */}
                <CardContent className="p-6 border-b bg-gray-50/50">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex-1 max-w-md">
                            <SearchInput
                                value={filters.search}
                                onChange={(value) => setFilters({...filters, search: value})}
                                onSearch={handleFilter}
                                placeholder={t('Search Budget Allocations...')}
                            />
                        </div>
                        <div className="flex items-center gap-3">
                            <PerPageSelector
                                routeName="budget-planner.budget-allocations.index"
                                filters={{...filters}}
                            />
                            <div className="relative">
                                <FilterButton
                                    showFilters={showFilters}
                                    onToggle={() => setShowFilters(!showFilters)}
                                />
                                {(() => {
                                    const activeFilters = [filters.budget_id, filters.account_id, filters.economic_classification].filter(f => f !== '' && f !== null && f !== undefined).length;
                                    return activeFilters > 0 && (
                                        <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center font-medium">
                                            {activeFilters}
                                        </span>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>
                </CardContent>

                {/* Advanced Filters */}
                {showFilters && (
                    <CardContent className="p-6 bg-blue-50/30 border-b">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">{t('Budget')}</label>
                                <Select value={filters.budget_id} onValueChange={(value) => setFilters({...filters, budget_id: value})}>
                                    <SelectTrigger>
                                        <SelectValue placeholder={t('Filter by Budget')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {budgets?.map((budget: any) => (
                                            <SelectItem key={budget.id} value={budget.id.toString()}>
                                                {budget.budget_name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">{t('Account')}</label>
                                <Select value={filters.account_id} onValueChange={(value) => setFilters({...filters, account_id: value})}>
                                    <SelectTrigger>
                                        <SelectValue placeholder={t('Filter by Account')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {accounts?.map((account: any) => (
                                            <SelectItem key={account.id} value={account.id.toString()}>
                                                {account.account_name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">{t('Economic Classification')}</label>
                                <Select value={filters.economic_classification} onValueChange={(value) => setFilters({...filters, economic_classification: value})}>
                                    <SelectTrigger>
                                        <SelectValue placeholder={t('Filter by Classification')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="personnel_emoluments">{t('Personnel Emoluments')}</SelectItem>
                                        <SelectItem value="goods_services">{t('Goods & Services')}</SelectItem>
                                        <SelectItem value="capital_expenditure">{t('Capital Expenditure')}</SelectItem>
                                        <SelectItem value="transfers_grants">{t('Transfers & Grants')}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex items-end gap-2">
                                <Button onClick={handleFilter} size="sm">{t('Apply')}</Button>
                                <Button variant="outline" onClick={clearFilters} size="sm">{t('Clear')}</Button>
                            </div>
                        </div>
                    </CardContent>
                )}

                {/* Table Content */}
                <CardContent className="p-0">
                    <div className="overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100 max-h-[70vh] rounded-none w-full">
                        <div className="min-w-[800px]">
                            <DataTable
                                data={budgetAllocations?.data || []}
                                columns={tableColumns}
                                onSort={handleSort}
                                sortKey={sortField}
                                sortDirection={sortDirection as 'asc' | 'desc'}
                                className="rounded-none"
                                emptyState={
                                    <NoRecordsFound
                                        icon={DollarSign}
                                        title={t('No Budget Allocations found')}
                                        description={t('Get started by creating your first Budget Allocation.')}
                                        hasFilters={!!(filters.search || filters.budget_id || filters.account_id || filters.economic_classification)}
                                        onClearFilters={clearFilters}
                                        createPermission="create-budget-allocations"
                                        onCreateClick={() => openModal('add')}
                                        createButtonText={t('Create Budget Allocation')}
                                        className="h-auto"
                                    />
                                }
                            />
                        </div>
                    </div>
                </CardContent>

                {/* Pagination Footer */}
                <CardContent className="px-4 py-2 border-t bg-gray-50/30">
                    <Pagination
                        data={budgetAllocations || { data: [], links: [], meta: {} }}
                        routeName="budget-planner.budget-allocations.index"
                        filters={{...filters, per_page: perPage}}
                    />
                </CardContent>
            </Card>

            <Dialog open={modalState.isOpen} onOpenChange={closeModal}>
                {modalState.mode === 'add' && (
                    <Create onSuccess={closeModal} />
                )}
                {modalState.mode === 'edit' && modalState.data && (
                    <Edit
                        budgetAllocation={modalState.data}
                        onSuccess={closeModal}
                    />
                )}
            </Dialog>

            <ConfirmationDialog
                open={deleteState.isOpen}
                onOpenChange={closeDeleteDialog}
                title={t('Delete Budget Allocation')}
                message={deleteState.message}
                confirmText={t('Delete')}
                onConfirm={confirmDelete}
                variant="destructive"
            />
        </AuthenticatedLayout>
    );
}
