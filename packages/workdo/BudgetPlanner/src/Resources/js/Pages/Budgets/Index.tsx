import { useState } from 'react';
import { Head, usePage, router } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import { useDeleteHandler } from '@/hooks/useDeleteHandler';
import AuthenticatedLayout from "@/layouts/authenticated-layout";
import { Button } from '@/components/ui/button';
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Dialog } from "@/components/ui/dialog";
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import {
    Plus, Edit as EditIcon, Trash2, DollarSign,
    CheckCircle, X, ClipboardCheck, Users, Crown, Lock,
    FileText, Search, PieChart, ShieldCheck, Upload, Eye
} from "lucide-react";
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

interface Budget {
    id: number;
    budget_name: string;
    budget_type: string;
    budget_subtype: string;
    fund_type: string;
    total_budget_amount: number;
    status: string;
    locked_at: string | null;
    budget_period?: { period_name: string; };
    vote_cost_centre?: { code: string; name: string; };
    approved_by?: { name: string; };
    vc_authorised_by?: { name: string; };
}

interface StageCounts {
    preparation: number;
    review: number;
    consolidation: number;
    approval: number;
    active: number;
    closed: number;
}

const STATUS_COLORS: Record<string, string> = {
    draft:              'bg-gray-100 text-gray-800',
    dept_approved:      'bg-yellow-100 text-yellow-800',
    finance_reviewed:   'bg-blue-100 text-blue-800',
    committee_approved: 'bg-indigo-100 text-indigo-800',
    vc_authorised:      'bg-emerald-100 text-emerald-800',
    approved:           'bg-green-100 text-green-800',
    active:             'bg-green-100 text-green-900',
    closed:             'bg-red-100 text-red-800',
};

const STATUS_LABELS: Record<string, string> = {
    draft:              'Draft (Preparation)',
    dept_approved:      'Dept. Submitted',
    finance_reviewed:   'Finance Reviewed',
    committee_approved: 'Committee Consolidated',
    vc_authorised:      'VC Authorised',
    approved:           'Approved',
    active:             'Active (In System)',
    closed:             'Closed',
};

const FUND_LABELS: Record<string, string> = {
    general_fund:       'General Fund',
    igf:                'IGF',
    research_grants:    'Research & Grants',
    donor_endowment:    'Donor/Endowment',
    capital_development:'Capital Dev.',
};

// ── Workflow pipeline stages ──────────────────────────────────────────────────

interface StageItem {
    key: keyof StageCounts;
    label: string;
    sublabel: string;
    icon: React.ElementType;
    color: string;
    filterStatus: string;
}

const PIPELINE_STAGES: StageItem[] = [
    {
        key: 'preparation',
        label: 'Preparation',
        sublabel: 'Step 2',
        icon: FileText,
        color: 'text-gray-600 bg-gray-50 border-gray-200',
        filterStatus: 'draft',
    },
    {
        key: 'review',
        label: 'Review',
        sublabel: 'Step 3',
        icon: Search,
        color: 'text-yellow-700 bg-yellow-50 border-yellow-200',
        filterStatus: 'dept_approved',
    },
    {
        key: 'consolidation',
        label: 'Consolidation',
        sublabel: 'Step 4',
        icon: PieChart,
        color: 'text-indigo-700 bg-indigo-50 border-indigo-200',
        filterStatus: 'committee_approved',
    },
    {
        key: 'approval',
        label: 'Approval',
        sublabel: 'Step 5',
        icon: ShieldCheck,
        color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
        filterStatus: 'vc_authorised',
    },
    {
        key: 'active',
        label: 'In System',
        sublabel: 'Step 6',
        icon: Upload,
        color: 'text-green-700 bg-green-50 border-green-200',
        filterStatus: 'active',
    },
];

function WorkflowPipeline({ counts, onFilter }: { counts: StageCounts; onFilter: (status: string) => void }) {
    const { t } = useTranslation();
    return (
        <div className="px-6 py-4 border-b bg-white">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{t('Budget Planning Workflow')}</p>
            <div className="flex items-stretch gap-0">
                {PIPELINE_STAGES.map((stage, idx) => {
                    const Icon = stage.icon;
                    const count = counts[stage.key] ?? 0;
                    return (
                        <div key={stage.key} className="flex items-stretch flex-1">
                            <button
                                onClick={() => onFilter(stage.filterStatus)}
                                className={`flex-1 flex flex-col items-center justify-center gap-1 px-3 py-3 border rounded-lg cursor-pointer transition-all hover:shadow-sm ${stage.color} ${count > 0 ? 'ring-2 ring-offset-1 ring-current/20' : 'opacity-70'}`}
                            >
                                <Icon className="h-4 w-4" />
                                <span className="text-[10px] font-medium uppercase tracking-wide">{t(stage.sublabel)}</span>
                                <span className="text-sm font-bold">{t(stage.label)}</span>
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${count > 0 ? 'bg-white/80' : 'bg-white/40'}`}>
                                    {count} {t('budget', { count })}
                                </span>
                            </button>
                            {idx < PIPELINE_STAGES.length - 1 && (
                                <div className="flex items-center px-1">
                                    <svg className="h-4 w-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default function Index() {
    const { t } = useTranslation();
    const { props } = usePage<any>();
    const budgets = props.budgets || { data: [] };
    const budgetPeriods = props.budgetPeriods || [];
    const voteCostCentres = props.voteCostCentres || [];
    const auth = props.auth || { user: { permissions: [] } };
    const stageCounts = props.stageCounts || null;
    
    const urlParams = new URLSearchParams(window.location.search);
    const perms: string[] = auth.user?.permissions || [];

    const [filters, setFilters] = useState({
        budget_name:          urlParams.get('budget_name') || '',
        budget_type:          urlParams.get('budget_type') || '',
        budget_subtype:       urlParams.get('budget_subtype') || '',
        fund_type:            urlParams.get('fund_type') || '',
        vote_cost_centre_id:  urlParams.get('vote_cost_centre_id') || '',
        status:               urlParams.get('status') || '',
        period_id:            urlParams.get('period_id') || '',
    });

    const [perPage] = useState(urlParams.get('per_page') || '10');
    const [sortField, setSortField] = useState(urlParams.get('sort') || '');
    const [sortDirection, setSortDirection] = useState(urlParams.get('direction') || 'asc');
    const [showFilters, setShowFilters] = useState(false);
    const [modalState, setModalState] = useState({ isOpen: false, mode: '', data: null as Budget | null });

    const { deleteState, openDeleteDialog, closeDeleteDialog, confirmDelete } = useDeleteHandler({
        routeName: 'budget-planner.budgets.destroy',
        defaultMessage: t('Are you sure you want to delete this budget?')
    });

    const go = (extra: object = {}) => router.get(
        route('budget-planner.budgets.index'),
        { ...filters, per_page: perPage, sort: sortField, direction: sortDirection, ...extra },
        { preserveState: true, replace: true }
    );

    const handleSort = (field: string) => {
        const dir = sortField === field && sortDirection === 'asc' ? 'desc' : 'asc';
        setSortField(field); setSortDirection(dir);
        go({ sort: field, direction: dir });
    };

    const clearFilters = () => {
        const empty = { budget_name:'', budget_type:'', budget_subtype:'', fund_type:'', vote_cost_centre_id:'', status:'', period_id:'' };
        setFilters(empty);
        router.get(route('budget-planner.budgets.index'), { per_page: perPage });
    };

    const filterByStatus = (status: string) => {
        const updated = { ...filters, status };
        setFilters(updated);
        router.get(route('budget-planner.budgets.index'), { ...updated, per_page: perPage }, { preserveState: true, replace: true });
    };

    const openModal = (mode: 'add' | 'edit', data: Budget | null = null) =>
        setModalState({ isOpen: true, mode, data });
    const closeModal = () => setModalState({ isOpen: false, mode: '', data: null });

    const post = (routeName: string, id: number) =>
        router.post(route(routeName, id));

    const tableColumns = [
        { key: 'budget_name', header: t('Budget Name'), sortable: true },
        {
            key: 'vote_cost_centre',
            header: t('Vote'),
            sortable: false,
            render: (_: any, row: Budget) =>
                row.vote_cost_centre
                    ? <span title={row.vote_cost_centre.name} className="font-mono text-xs">{row.vote_cost_centre.code}</span>
                    : '-'
        },
        {
            key: 'fund_type',
            header: t('Fund'),
            sortable: false,
            render: (v: string) => FUND_LABELS[v] ?? v ?? '-'
        },
        {
            key: 'budget_subtype',
            header: t('Subtype'),
            sortable: false,
            render: (v: string) => (
                <span className={`px-2 py-0.5 rounded-full text-xs capitalize ${
                    v === 'revised' ? 'bg-orange-100 text-orange-800' :
                    v === 'supplementary' ? 'bg-purple-100 text-purple-800' :
                    'bg-gray-100 text-gray-700'}`}>
                    {v}
                </span>
            )
        },
        {
            key: 'budget_period',
            header: t('Period'),
            sortable: false,
            render: (_: any, row: Budget) => row.budget_period?.period_name || '-'
        },
        {
            key: 'total_budget_amount',
            header: t('Amount'),
            sortable: false,
            render: (v: number) => formatCurrency(v)
        },
        {
            key: 'status',
            header: t('Status'),
            sortable: false,
            render: (v: string, row: Budget) => (
                <div className="flex items-center gap-1">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_COLORS[v] ?? 'bg-gray-100 text-gray-800'}`}>
                        {STATUS_LABELS[v] ?? v}
                    </span>
                    {row.locked_at && <Lock className="h-3 w-3 text-amber-600" title={t('Locked')} />}
                </div>
            )
        },
        {
            key: 'actions',
            header: t('Actions'),
            render: (_: any, budget: Budget) => (
                <div className="flex gap-1 flex-wrap">
                    <TooltipProvider>
                        {/* View / Review */}
                        <Tooltip delayDuration={0}>
                            <TooltipTrigger asChild>
                                <a href={route('budget-planner.budgets.show', budget.id)}>
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-gray-600 hover:text-gray-800">
                                        <Eye className="h-4 w-4" />
                                    </Button>
                                </a>
                            </TooltipTrigger>
                            <TooltipContent><p>{t('View / Review')}</p></TooltipContent>
                        </Tooltip>
                        {/* Step 3a — Dept Head submits to Finance Office */}
                        {budget.status === 'draft' && perms.includes('approve-budgets') && (
                            <Tooltip delayDuration={0}>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-yellow-600 hover:text-yellow-700"
                                        onClick={() => post('budget-planner.budgets.approve', budget.id)}>
                                        <CheckCircle className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>{t('Step 3: Submit for Finance Review')}</p></TooltipContent>
                            </Tooltip>
                        )}
                        {/* Step 3b — Finance Office reviews */}
                        {budget.status === 'dept_approved' && perms.includes('finance-review-budgets') && (
                            <Tooltip delayDuration={0}>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700"
                                        onClick={() => post('budget-planner.budgets.finance-review', budget.id)}>
                                        <ClipboardCheck className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>{t('Step 3: Finance Office Review')}</p></TooltipContent>
                            </Tooltip>
                        )}
                        {/* Step 4 — Finance Committee consolidates & approves */}
                        {budget.status === 'finance_reviewed' && perms.includes('committee-approve-budgets') && (
                            <Tooltip delayDuration={0}>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-indigo-600 hover:text-indigo-700"
                                        onClick={() => post('budget-planner.budgets.committee-approve', budget.id)}>
                                        <Users className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>{t('Step 4: Finance Committee Consolidation & Approval')}</p></TooltipContent>
                            </Tooltip>
                        )}
                        {/* Step 5 — VC / Management Board authorises */}
                        {budget.status === 'committee_approved' && perms.includes('vc-authorise-budgets') && (
                            <Tooltip delayDuration={0}>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-emerald-600 hover:text-emerald-700"
                                        onClick={() => post('budget-planner.budgets.vc-authorise', budget.id)}>
                                        <Crown className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>{t('Step 5: VC / Management Board Authorisation')}</p></TooltipContent>
                            </Tooltip>
                        )}
                        {/* Step 6 — Upload to Financial System (Activate) */}
                        {(['vc_authorised','approved'].includes(budget.status)) && perms.includes('active-budgets') && (
                            <Tooltip delayDuration={0}>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-green-600 hover:text-green-700"
                                        onClick={() => post('budget-planner.budgets.active', budget.id)}>
                                        <Upload className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>{t('Step 6: Upload to Financial System')}</p></TooltipContent>
                            </Tooltip>
                        )}
                        {/* Close */}
                        {budget.status === 'active' && perms.includes('close-budgets') && (
                            <Tooltip delayDuration={0}>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                                        onClick={() => post('budget-planner.budgets.close', budget.id)}>
                                        <X className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>{t('Close Budget')}</p></TooltipContent>
                            </Tooltip>
                        )}
                        {/* Edit — only draft, only unlocked */}
                        {budget.status === 'draft' && !budget.locked_at && perms.includes('edit-budgets') && (
                            <Tooltip delayDuration={0}>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700"
                                        onClick={() => openModal('edit', budget)}>
                                        <EditIcon className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>{t('Edit')}</p></TooltipContent>
                            </Tooltip>
                        )}
                        {/* Delete */}
                        {budget.status === 'draft' && perms.includes('delete-budgets') && (
                            <Tooltip delayDuration={0}>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                        onClick={() => openDeleteDialog(budget.id)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>{t('Delete')}</p></TooltipContent>
                            </Tooltip>
                        )}
                    </TooltipProvider>
                </div>
            )
        },
    ];

    return (
        <AuthenticatedLayout
            breadcrumbs={[{label: t('Budget Planner')}, {label: t('Budgets')}]}
            pageTitle={t('Manage Budget')}
            pageActions={
                perms.includes('create-budgets') ? (
                    <TooltipProvider>
                        <Tooltip delayDuration={0}>
                            <TooltipTrigger asChild>
                                <Button size="sm" onClick={() => openModal('add')}>
                                    <Plus className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>{t('Create Budget (Step 2: Preparation)')}</p></TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                ) : undefined
            }
        >
            <Head title={t('Budgets')} />

            <Card className="shadow-sm">
                {/* Workflow Pipeline */}
                {stageCounts && (
                    <WorkflowPipeline counts={stageCounts} onFilter={filterByStatus} />
                )}

                <CardContent className="p-6 border-b bg-gray-50/50">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex-1 max-w-md">
                            <SearchInput
                                value={filters.budget_name}
                                onChange={(v) => setFilters({...filters, budget_name: v})}
                                onSearch={() => go()}
                                placeholder={t('Search Budgets...')}
                            />
                        </div>
                        <div className="flex items-center gap-3">
                            <PerPageSelector routeName="budget-planner.budgets.index" filters={filters} />
                            <div className="relative">
                                <FilterButton showFilters={showFilters} onToggle={() => setShowFilters(!showFilters)} />
                                {(() => {
                                    const n = [filters.budget_type, filters.budget_subtype, filters.fund_type, filters.vote_cost_centre_id, filters.status, filters.period_id].filter(Boolean).length;
                                    return n > 0 && (
                                        <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center font-medium">{n}</span>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>
                </CardContent>

                {showFilters && (
                    <CardContent className="p-6 bg-blue-50/30 border-b">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">{t('Vote \/ Cost Centre')}</label>
                                <Select value={filters.vote_cost_centre_id} onValueChange={(v) => setFilters({...filters, vote_cost_centre_id: v})}>
                                    <SelectTrigger><SelectValue placeholder={t('Filter by Vote')} /></SelectTrigger>
                                    <SelectContent>
                                        {voteCostCentres?.map((v: any) => (
                                            <SelectItem key={v.id} value={v.id.toString()}>{v.code} — {v.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">{t('Fund Type')}</label>
                                <Select value={filters.fund_type} onValueChange={(v) => setFilters({...filters, fund_type: v})}>
                                    <SelectTrigger><SelectValue placeholder={t('Filter by Fund')} /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="general_fund">{t('General Fund')}</SelectItem>
                                        <SelectItem value="igf">{t('IGF')}</SelectItem>
                                        <SelectItem value="research_grants">{t('Research & Grants')}</SelectItem>
                                        <SelectItem value="donor_endowment">{t('Donor / Endowment')}</SelectItem>
                                        <SelectItem value="capital_development">{t('Capital Development')}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">{t('Budget Subtype')}</label>
                                <Select value={filters.budget_subtype} onValueChange={(v) => setFilters({...filters, budget_subtype: v})}>
                                    <SelectTrigger><SelectValue placeholder={t('Filter by Type')} /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="original">{t('Original')}</SelectItem>
                                        <SelectItem value="revised">{t('Revised')}</SelectItem>
                                        <SelectItem value="supplementary">{t('Supplementary')}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">{t('Status')}</label>
                                <Select value={filters.status} onValueChange={(v) => setFilters({...filters, status: v})}>
                                    <SelectTrigger><SelectValue placeholder={t('Filter by Status')} /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="draft">{t('Draft (Preparation)')}</SelectItem>
                                        <SelectItem value="dept_approved">{t('Dept. Submitted (Review)')}</SelectItem>
                                        <SelectItem value="finance_reviewed">{t('Finance Reviewed (Review)')}</SelectItem>
                                        <SelectItem value="committee_approved">{t('Committee Consolidated')}</SelectItem>
                                        <SelectItem value="vc_authorised">{t('VC Authorised (Approval)')}</SelectItem>
                                        <SelectItem value="active">{t('Active (In System)')}</SelectItem>
                                        <SelectItem value="closed">{t('Closed')}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex items-end gap-2 col-span-full justify-end">
                                <Button onClick={() => go()} size="sm">{t('Apply')}</Button>
                                <Button variant="outline" onClick={clearFilters} size="sm">{t('Clear')}</Button>
                            </div>
                        </div>
                    </CardContent>
                )}

                <CardContent className="p-0">
                    <div className="overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100 max-h-[70vh] rounded-none w-full">
                        <div className="min-w-[900px]">
                            <DataTable
                                data={budgets?.data || []}
                                columns={tableColumns}
                                onSort={handleSort}
                                sortKey={sortField}
                                sortDirection={sortDirection as 'asc' | 'desc'}
                                className="rounded-none"
                                emptyState={
                                    <NoRecordsFound
                                        icon={DollarSign}
                                        title={t('No Budgets found')}
                                        description={t('Get started by creating your first Budget.')}
                                        hasFilters={Object.values(filters).some(Boolean)}
                                        onClearFilters={clearFilters}
                                        createPermission="create-budgets"
                                        onCreateClick={() => openModal('add')}
                                        createButtonText={t('Create Budget')}
                                        className="h-auto"
                                    />
                                }
                            />
                        </div>
                    </div>
                </CardContent>

                <CardContent className="px-4 py-2 border-t bg-gray-50/30">
                    <Pagination
                        data={budgets || { data: [], links: [], meta: {} }}
                        routeName="budget-planner.budgets.index"
                        filters={{...filters, per_page: perPage}}
                    />
                </CardContent>
            </Card>

            <Dialog open={modalState.isOpen} onOpenChange={closeModal}>
                {modalState.mode === 'add' && <Create onSuccess={closeModal} />}
                {modalState.mode === 'edit' && modalState.data && (
                    <Edit budget={modalState.data} onSuccess={closeModal} />
                )}
            </Dialog>

            <ConfirmationDialog
                open={deleteState.isOpen}
                onOpenChange={closeDeleteDialog}
                title={t('Delete Budget')}
                message={deleteState.message}
                confirmText={t('Delete')}
                onConfirm={confirmDelete}
                variant="destructive"
            />
        </AuthenticatedLayout>
    );
}
