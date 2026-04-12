import { useState } from 'react';
import { Head, usePage, router, useForm } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import AuthenticatedLayout from '@/layouts/authenticated-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import InputError from '@/components/ui/input-error';
import { Pagination } from '@/components/ui/pagination';
import { SearchInput } from '@/components/ui/search-input';
import NoRecordsFound from '@/components/no-records-found';
import { formatCurrency } from '@/utils/helpers';
import { Plus, Eye, Trash2, CheckCircle, Play, X, ClipboardList } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useDeleteHandler } from '@/hooks/useDeleteHandler';

interface VoteCostCentre { id: number; code: string; name: string; }

interface ProcurementPlan {
    id: number;
    plan_number: string;
    financial_year: string;
    title: string;
    status: string;
    approved_at: string | null;
    vote_cost_centre?: VoteCostCentre;
    approved_by?: { name: string };
}

const STATUS_COLORS: Record<string, string> = {
    draft:    'bg-gray-100 text-gray-700',
    approved: 'bg-blue-100 text-blue-800',
    active:   'bg-green-100 text-green-800',
    closed:   'bg-red-100 text-red-800',
};

export default function PlansIndex() {
    const { props } = usePage<any>();
    const plans = props.plans || { data: [] };
    const voteCostCentres = props.voteCostCentres || [];
    const filters = props.filters || {};
    
    const { t } = useTranslation();
    const [creating, setCreating] = useState(false);
    const { deleteState, openDeleteDialog, closeDeleteDialog, confirmDelete } = useDeleteHandler({
        routeName: 'procurement.plans.destroy'
    });

    const { data, setData, post, processing, errors, reset } = useForm({
        financial_year: '',
        title: '',
        vote_cost_centre_id: '',
        notes: '',
    });

    const submitCreate = (e: React.FormEvent) => {
        e.preventDefault();
        post(route('procurement.plans.store'), {
            onSuccess: () => { setCreating(false); reset(); },
        });
    };

    const handleSearch = (value: string) => {
        router.get(route('procurement.plans.index'), { ...filters, search: value }, { preserveState: true });
    };

    const handleFilter = (key: string, value: string) => {
        router.get(route('procurement.plans.index'), { ...filters, [key]: value }, { preserveState: true });
    };

    const columns = [
        { key: 'plan_number', header: t('Plan No.') },
        { key: 'financial_year', header: t('Financial Year') },
        { key: 'title', header: t('Title') },
        {
            key: 'vote_cost_centre',
            header: t('Vote / Department'),
            render: (_: any, row: ProcurementPlan) => row.vote_cost_centre
                ? `${row.vote_cost_centre.code} — ${row.vote_cost_centre.name}` : '—',
        },
        {
            key: 'status',
            header: t('Status'),
            render: (_: any, row: ProcurementPlan) => (
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${row.status ? (STATUS_COLORS[row.status] ?? 'bg-gray-100') : 'bg-gray-100'}`}>
                    {row.status ? t(row.status.charAt(0).toUpperCase() + row.status.slice(1)) : '—'}
                </span>
            ),
        },
        {
            key: 'actions',
            header: '',
            render: (_: any, row: ProcurementPlan) => (
                <TooltipProvider>
                    <div className="flex gap-1 justify-end">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button size="icon" variant="ghost"
                                    onClick={() => router.visit(route('procurement.plans.show', row.id))}>
                                    <Eye className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>{t('View')}</TooltipContent>
                        </Tooltip>

                        {row.status === 'draft' && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button size="icon" variant="ghost"
                                        onClick={() => router.post(route('procurement.plans.approve', row.id))}>
                                        <CheckCircle className="h-4 w-4 text-blue-600" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>{t('Approve')}</TooltipContent>
                            </Tooltip>
                        )}

                        {row.status === 'approved' && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button size="icon" variant="ghost"
                                        onClick={() => router.post(route('procurement.plans.activate', row.id))}>
                                        <Play className="h-4 w-4 text-green-600" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>{t('Activate')}</TooltipContent>
                            </Tooltip>
                        )}

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
            <Head title={t('Annual Procurement Plans')} />

            <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <ClipboardList className="h-6 w-6 text-primary" />
                        <h1 className="text-2xl font-semibold">{t('Annual Procurement Plans')}</h1>
                    </div>
                    <Button onClick={() => setCreating(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        {t('New Plan')}
                    </Button>
                </div>

                {/* Filters */}
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex flex-wrap gap-3">
                            <SearchInput
                                value={filters.search ?? ''}
                                onSearch={handleSearch}
                                placeholder={t('Search plan number or title…')}
                                className="w-64"
                            />
                            <Select value={filters.status || 'all'} onValueChange={(v) => handleFilter('status', v === 'all' ? '' : v)}>
                                <SelectTrigger className="w-40">
                                    <SelectValue placeholder={t('All Statuses')} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">{t('All Statuses')}</SelectItem>
                                    {['draft', 'approved', 'active', 'closed'].map(s => (
                                        <SelectItem key={s} value={s}>{t(s.charAt(0).toUpperCase() + s.slice(1))}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select value={filters.vote_id || 'all'} onValueChange={(v) => handleFilter('vote_id', v === 'all' ? '' : v)}>
                                <SelectTrigger className="w-56">
                                    <SelectValue placeholder={t('All Departments')} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">{t('All Departments')}</SelectItem>
                                    {voteCostCentres.map((v: VoteCostCentre) => (
                                        <SelectItem key={v.id} value={String(v.id)}>{v.code} — {v.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </CardContent>
                </Card>

                {/* Table */}
                <Card>
                    <CardContent className="pt-4">
                        {plans.data.length === 0
                            ? <NoRecordsFound 
                                icon={ClipboardList} 
                                title={t('No Plans Found')} 
                                description={t('Create an annual procurement plan to start the budget year.')}
                              />
                            : <DataTable columns={columns} data={plans.data} />
                        }
                        <div className="mt-4">
                            <Pagination data={{...plans, ...plans.meta}} routeName="procurement.plans.index" filters={filters} />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Create Dialog */}
            <Dialog open={creating} onOpenChange={setCreating}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{t('New Annual Procurement Plan')}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={submitCreate} className="space-y-4">
                        <div>
                            <Label required>{t('Financial Year')}</Label>
                            <Input
                                value={data.financial_year}
                                onChange={(e) => setData('financial_year', e.target.value)}
                                placeholder="2025/2026"
                                required
                            />
                            <InputError message={errors.financial_year} />
                        </div>
                        <div>
                            <Label required>{t('Plan Title')}</Label>
                            <Input
                                value={data.title}
                                onChange={(e) => setData('title', e.target.value)}
                                placeholder={t('e.g. Annual Procurement Plan 2025/2026')}
                                required
                            />
                            <InputError message={errors.title} />
                        </div>
                        <div>
                            <Label required>{t('Vote / Department')}</Label>
                            <Select value={data.vote_cost_centre_id} onValueChange={(v) => setData('vote_cost_centre_id', v)}>
                                <SelectTrigger>
                                    <SelectValue placeholder={t('Select department…')} />
                                </SelectTrigger>
                                <SelectContent>
                                    {voteCostCentres.map((v: VoteCostCentre) => (
                                        <SelectItem key={v.id} value={String(v.id)}>{v.code} — {v.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <InputError message={errors.vote_cost_centre_id} />
                        </div>
                        <div>
                            <Label>{t('Notes')}</Label>
                            <Textarea
                                value={data.notes}
                                onChange={(e) => setData('notes', e.target.value)}
                                rows={3}
                            />
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <Button type="button" variant="outline" onClick={() => { setCreating(false); reset(); }}>
                                {t('Cancel')}
                            </Button>
                            <Button type="submit" disabled={processing}>{t('Create Plan')}</Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            <ConfirmationDialog
                open={deleteState.isOpen}
                onOpenChange={closeDeleteDialog}
                onConfirm={confirmDelete}
                title={t('Delete Plan')}
                message={deleteState.message}
                variant="destructive"
            />
        </AuthenticatedLayout>
    );
}
