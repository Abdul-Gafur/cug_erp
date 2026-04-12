import { Head, usePage, router } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import AuthenticatedLayout from '@/layouts/authenticated-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Pagination } from '@/components/ui/pagination';
import { SearchInput } from '@/components/ui/search-input';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import NoRecordsFound from '@/components/no-records-found';
import { formatCurrency } from '@/utils/helpers';
import { Plus, Eye, Trash2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useDeleteHandler } from '@/hooks/useDeleteHandler';

interface Requisition {
    id: number;
    requisition_number: string;
    requisition_date: string;
    purpose: string;
    total_amount: number;
    status: string;
    is_off_plan: boolean;
    requesting_department?: { code: string; name: string };
    budget_period?: { period_name: string };
    requester?: { name: string };
}

const STATUS_COLORS: Record<string, string> = {
    draft:                'bg-gray-100 text-gray-700',
    submitted:            'bg-yellow-100 text-yellow-800',
    hod_approved:         'bg-blue-100 text-blue-800',
    finance_checked:      'bg-indigo-100 text-indigo-800',
    procurement_approved: 'bg-green-100 text-green-800',
    rejected:             'bg-red-100 text-red-800',
    cancelled:            'bg-gray-100 text-gray-500',
};

export default function RequisitionsIndex() {
    const { props } = usePage<any>();
    const requisitions = props.requisitions || { data: [] };
    const departments = props.departments || [];
    const budgetPeriods = props.budgetPeriods || [];
    const filters = props.filters || {};
    const statusLabels = props.statusLabels || {};
    
    const { t } = useTranslation();
    const { deleteState, openDeleteDialog, closeDeleteDialog, confirmDelete } = useDeleteHandler({
        routeName: 'procurement.requisitions.destroy'
    });

    const handleFilter = (key: string, value: string) => {
        router.get(route('procurement.requisitions.index'), { ...filters, [key]: value }, { preserveState: true });
    };

    const columns = [
        { key: 'requisition_number', header: t('Req. No.') },
        { key: 'requisition_date', header: t('Date') },
        {
            key: 'requesting_department',
            header: t('Department'),
            render: (_: any, row: Requisition) => row.requesting_department
                ? `${row.requesting_department.code} — ${row.requesting_department.name}` : '—',
        },
        {
            key: 'purpose',
            header: t('Purpose'),
            render: (_: any, row: Requisition) => (
                <span className="block max-w-xs truncate" title={row.purpose}>{row.purpose}</span>
            ),
        },
        {
            key: 'total_amount',
            header: t('Amount'),
            render: (v: number) => formatCurrency(v),
        },
        {
            key: 'status',
            header: t('Status'),
            render: (_: any, row: Requisition) => (
                <div className="flex items-center gap-1">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${row.status ? (STATUS_COLORS[row.status] ?? 'bg-gray-100') : 'bg-gray-100'}`}>
                        {row.status ? (statusLabels[row.status] ?? row.status) : '—'}
                    </span>
                    {row.is_off_plan && (
                        <span className="px-1.5 py-0.5 rounded text-xs bg-orange-100 text-orange-700">Off-Plan</span>
                    )}
                </div>
            ),
        },
        {
            key: 'requester',
            header: t('Raised By'),
            render: (_: any, row: Requisition) => row.requester?.name ?? '—',
        },
        {
            key: 'actions',
            header: '',
            render: (_: any, row: Requisition) => (
                <TooltipProvider>
                    <div className="flex gap-1 justify-end">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button size="icon" variant="ghost"
                                    onClick={() => router.visit(route('procurement.requisitions.show', row.id))}>
                                    <Eye className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>{t('View')}</TooltipContent>
                        </Tooltip>
                        {row.status === 'draft' && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button size="icon" variant="ghost"
                                        onClick={() => openDeleteDialog(row.id)}>
                                        <Trash2 className="h-4 w-4 text-red-500" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>{t('Delete')}</TooltipContent>
                            </Tooltip>
                        )}
                    </div>
                </TooltipProvider>
            ),
        },
    ];

    return (
        <AuthenticatedLayout>
            <Head title={t('Purchase Requisitions')} />

            <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-semibold">{t('Purchase Requisitions')}</h1>
                    <Button onClick={() => router.visit(route('procurement.requisitions.create'))}>
                        <Plus className="h-4 w-4 mr-2" /> {t('New Requisition')}
                    </Button>
                </div>

                {/* Filters */}
                <Card>
                    <CardContent className="pt-4 flex flex-wrap gap-3">
                        <SearchInput
                            value={filters.search ?? ''}
                            onSearch={(v) => handleFilter('search', v)}
                            placeholder={t('Search number or purpose…')}
                            className="w-64"
                        />
                        <Select value={filters.status || 'all'} onValueChange={(v) => handleFilter('status', v === 'all' ? '' : v)}>
                            <SelectTrigger className="w-44">
                                <SelectValue placeholder={t('All Statuses')} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">{t('All Statuses')}</SelectItem>
                                {statusLabels && Object.entries(statusLabels).map(([k, v]) => (
                                    <SelectItem key={k} value={k}>{v as string}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={filters.department_id || 'all'} onValueChange={(v) => handleFilter('department_id', v === 'all' ? '' : v)}>
                            <SelectTrigger className="w-56">
                                <SelectValue placeholder={t('All Departments')} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">{t('All Departments')}</SelectItem>
                                {departments?.map((d: any) => (
                                    <SelectItem key={d.id} value={String(d.id)}>{d.code} — {d.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={filters.period_id || 'all'} onValueChange={(v) => handleFilter('period_id', v === 'all' ? '' : v)}>
                            <SelectTrigger className="w-44">
                                <SelectValue placeholder={t('All Periods')} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">{t('All Periods')}</SelectItem>
                                {budgetPeriods?.map((p: any) => (
                                    <SelectItem key={p.id} value={String(p.id)}>{p.period_name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </CardContent>
                </Card>

                {/* Table */}
                <Card>
                    <CardContent className="pt-4">
                        {requisitions.data.length === 0
                            ? <NoRecordsFound 
                                icon={Plus} 
                                title={t('No Requisitions Found')} 
                                description={t('Create your first purchase requisition to start the procurement process.')}
                              />
                            : <DataTable columns={columns} data={requisitions.data} />
                        }
                        <div className="mt-4">
                            <Pagination data={{...requisitions, ...requisitions.meta}} routeName="procurement.requisitions.index" filters={filters} />
                        </div>
                    </CardContent>
                </Card>
            </div>

            <ConfirmationDialog
                open={deleteState.isOpen}
                onOpenChange={closeDeleteDialog}
                onConfirm={confirmDelete}
                title={t('Delete Requisition')}
                message={deleteState.message}
                variant="destructive"
            />
        </AuthenticatedLayout>
    );
}
