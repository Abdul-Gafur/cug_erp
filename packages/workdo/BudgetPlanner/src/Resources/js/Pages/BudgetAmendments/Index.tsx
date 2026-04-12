import * as React from 'react';
import { useState } from 'react';
import { Head, usePage, router, useForm } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import AuthenticatedLayout from "@/layouts/authenticated-layout";
import { Button } from '@/components/ui/button';
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, CheckCircle, X, GitBranch } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FilterButton } from '@/components/ui/filter-button';
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { PerPageSelector } from '@/components/ui/per-page-selector';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input as UIInput } from '@/components/ui/input';
import InputError from '@/components/ui/input-error';
import { Textarea } from '@/components/ui/textarea';
import { CurrencyInput } from '@/components/ui/currency-input';
import NoRecordsFound from '@/components/no-records-found';
import { formatCurrency, formatDate } from '@/utils/helpers';

interface Amendment {
    id: number;
    budget?: { budget_name: string; };
    amendment_type: string;
    from_allocation?: { account?: { account_code: string; account_name: string; }; };
    to_allocation?: { account?: { account_code: string; account_name: string; }; };
    amount: number;
    reason: string;
    status: string;
    approved_by?: { name: string; };
    created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
    draft:    'bg-gray-100 text-gray-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
};

const TYPE_COLORS: Record<string, string> = {
    virement:      'bg-blue-100 text-blue-800',
    revision:      'bg-orange-100 text-orange-800',
    supplementary: 'bg-purple-100 text-purple-800',
};

function CreateAmendmentForm({ budgets, allocations, onSuccess }: { budgets: any[]; allocations: any[]; onSuccess: () => void }) {
    const { t } = useTranslation();
    const { data, setData, post, processing, errors } = useForm({
        budget_id:           '',
        amendment_type:      'virement',
        from_allocation_id:  '',
        to_allocation_id:    '',
        amount:              '',
        reason:              '',
        document:            null as File | null,
    });

    const isVirement = data.amendment_type === 'virement';

    // Filter allocations by selected budget
    const budgetAllocations = allocations.filter((a: any) => a.budget_id?.toString() === data.budget_id);

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        post(route('budget-planner.budget-amendments.store'), {
            onSuccess,
            forceFormData: true
        });
    };

    return (
        <form onSubmit={submit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            <div>
                <Label required>{t('Budget')}</Label>
                <Select value={data.budget_id} onValueChange={v => setData('budget_id', v)}>
                    <SelectTrigger><SelectValue placeholder={t('Select Budget')} /></SelectTrigger>
                    <SelectContent>
                        {budgets.map((b: any) => (
                            <SelectItem key={b.id} value={b.id.toString()}>{b.budget_name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <InputError message={errors.budget_id} />
            </div>

            <div>
                <Label required>{t('Amendment Type')}</Label>
                <Select value={data.amendment_type} onValueChange={v => setData('amendment_type', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="virement">{t('Virement')} (inter-allocation transfer)</SelectItem>
                        <SelectItem value="revision">{t('Revision')} (mid-year)</SelectItem>
                        <SelectItem value="supplementary">{t('Supplementary')}</SelectItem>
                    </SelectContent>
                </Select>
                <InputError message={errors.amendment_type} />
            </div>

            {isVirement && (
                <>
                    <div>
                        <Label required>{t('From Allocation')}</Label>
                        <Select value={data.from_allocation_id} onValueChange={v => setData('from_allocation_id', v)}>
                            <SelectTrigger><SelectValue placeholder="Source allocation..." /></SelectTrigger>
                            <SelectContent>
                                {budgetAllocations.map((a: any) => (
                                    <SelectItem key={a.id} value={a.id.toString()}>
                                        {a.account?.account_code} — {a.account?.account_name} ({a.economic_classification?.replace('_', ' ')})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <InputError message={errors.from_allocation_id} />
                    </div>
                    <div>
                        <Label required>{t('To Allocation')}</Label>
                        <Select value={data.to_allocation_id} onValueChange={v => setData('to_allocation_id', v)}>
                            <SelectTrigger><SelectValue placeholder="Destination allocation..." /></SelectTrigger>
                            <SelectContent>
                                {budgetAllocations
                                    .filter((a: any) => a.id.toString() !== data.from_allocation_id)
                                    .map((a: any) => (
                                        <SelectItem key={a.id} value={a.id.toString()}>
                                            {a.account?.account_code} — {a.account?.account_name} ({a.economic_classification?.replace('_', ' ')})
                                        </SelectItem>
                                    ))}
                            </SelectContent>
                        </Select>
                        <InputError message={errors.to_allocation_id} />
                    </div>
                </>
            )}

            <div>
                <CurrencyInput label={t('Amount')} value={data.amount} onChange={v => setData('amount', v)} error={errors.amount} required />
            </div>

            <div>
                <Label required>{t('Reason')}</Label>
                <Textarea value={data.reason} onChange={e => setData('reason', e.target.value)} rows={3}
                    placeholder="Explain the justification for this amendment..." />
                <InputError message={errors.reason} />
            </div>

            <div>
                <Label htmlFor="document">{t('Supporting Document (PDF, Word)')}</Label>
                <UIInput
                    id="document"
                    type="file"
                    accept=".pdf,.doc,.docx"
                    className="mt-1"
                    onChange={(e) => setData('document', e.target.files ? e.target.files[0] : null)}
                />
                <InputError message={errors.document} />
            </div>

            <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={onSuccess}>{t('Cancel')}</Button>
                <Button type="submit" disabled={processing}>
                    {processing ? t('Creating...') : t('Create')}
                </Button>
            </div>
        </form>
    );
}

export default function Index() {
    const { t } = useTranslation();
    const { amendments, budgets, allocations, auth } = usePage<any>().props;
    const perms: string[] = auth.user?.permissions || [];
    const urlParams = new URLSearchParams(window.location.search);

    const [filters, setFilters] = useState({
        budget_id:       urlParams.get('budget_id') || '',
        amendment_type:  urlParams.get('amendment_type') || '',
        status:          urlParams.get('status') || '',
    });
    const [perPage] = useState(urlParams.get('per_page') || '10');
    const [showFilters, setShowFilters] = useState(false);
    const [createOpen, setCreateOpen] = useState(false);
    const [rejectId, setRejectId] = useState<number | null>(null);
    const [rejectReason, setRejectReason] = useState('');

    const go = (extra: object = {}) => router.get(
        route('budget-planner.budget-amendments.index'),
        { ...filters, per_page: perPage, ...extra },
        { preserveState: true, replace: true }
    );

    const clearFilters = () => {
        setFilters({ budget_id: '', amendment_type: '', status: '' });
        router.get(route('budget-planner.budget-amendments.index'));
    };

    const doApprove = (id: number) =>
        router.post(route('budget-planner.budget-amendments.approve', id));

    const doReject = () => {
        if (!rejectId) return;
        router.post(route('budget-planner.budget-amendments.reject', rejectId), { rejection_reason: rejectReason }, {
            onSuccess: () => { setRejectId(null); setRejectReason(''); }
        });
    };

    const tableColumns = [
        {
            key: 'budget',
            header: t('Budget'),
            sortable: false,
            render: (_: any, row: Amendment) => row.budget?.budget_name || '-'
        },
        {
            key: 'amendment_type',
            header: t('Amendment Type'),
            sortable: false,
            render: (v: string) => (
                <span className={`px-2 py-0.5 rounded-full text-xs capitalize ${TYPE_COLORS[v] ?? 'bg-gray-100 text-gray-800'}`}>
                    {v}
                </span>
            )
        },
        {
            key: 'from_to',
            header: 'From → To',
            sortable: false,
            render: (_: any, row: Amendment) => {
                if (!row.from_allocation && !row.to_allocation) return '-';
                const from = row.from_allocation?.account ? `${row.from_allocation.account.account_code}` : '-';
                const to   = row.to_allocation?.account   ? `${row.to_allocation.account.account_code}`   : '-';
                return <span className="font-mono text-xs">{from} → {to}</span>;
            }
        },
        {
            key: 'amount',
            header: t('Amount'),
            sortable: false,
            render: (v: number) => formatCurrency(v)
        },
        {
            key: 'status',
            header: t('Status'),
            sortable: false,
            render: (v: string) => (
                <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_COLORS[v] ?? 'bg-gray-100 text-gray-800'}`}>
                    {v.charAt(0).toUpperCase() + v.slice(1)}
                </span>
            )
        },
        {
            key: 'created_at',
            header: t('Date'),
            sortable: true,
            render: (v: string) => formatDate(v)
        },
        {
            key: 'actions',
            header: t('Actions'),
            render: (_: any, row: Amendment) => row.status !== 'draft' ? null : (
                <div className="flex gap-1">
                    <TooltipProvider>
                        {perms.includes('approve-budget-amendments') && (
                            <>
                                <Tooltip delayDuration={0}>
                                    <TooltipTrigger asChild>
                                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-green-600"
                                            onClick={() => doApprove(row.id)}>
                                            <CheckCircle className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent><p>{t('Approve Amendment')}</p></TooltipContent>
                                </Tooltip>
                                <Tooltip delayDuration={0}>
                                    <TooltipTrigger asChild>
                                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-600"
                                            onClick={() => { setRejectId(row.id); setRejectReason(''); }}>
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent><p>{t('Reject Amendment')}</p></TooltipContent>
                                </Tooltip>
                            </>
                        )}
                    </TooltipProvider>
                </div>
            )
        },
    ];

    return (
        <AuthenticatedLayout
            breadcrumbs={[{label: t('Budget Planner')}, {label: t('Budget Amendments')}]}
            pageTitle={t('Budget Amendments')}
            pageActions={
                perms.includes('create-budget-amendments') ? (
                    <TooltipProvider>
                        <Tooltip delayDuration={0}>
                            <TooltipTrigger asChild>
                                <Button size="sm" onClick={() => setCreateOpen(true)}>
                                    <Plus className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>{t('Create Budget Amendment')}</p></TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                ) : undefined
            }
        >
            <Head title={t('Budget Amendments')} />

            <Card className="shadow-sm">
                <CardContent className="p-6 border-b bg-gray-50/50">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <PerPageSelector routeName="budget-planner.budget-amendments.index" filters={filters} />
                            <div className="relative">
                                <FilterButton showFilters={showFilters} onToggle={() => setShowFilters(!showFilters)} />
                                {Object.values(filters).some(Boolean) && (
                                    <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center font-medium">
                                        {Object.values(filters).filter(Boolean).length}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </CardContent>

                {showFilters && (
                    <CardContent className="p-6 bg-blue-50/30 border-b">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">{t('Budget')}</label>
                                <Select value={filters.budget_id} onValueChange={v => setFilters({...filters, budget_id: v})}>
                                    <SelectTrigger><SelectValue placeholder={t('Filter by Budget')} /></SelectTrigger>
                                    <SelectContent>
                                        {budgets?.map((b: any) => (
                                            <SelectItem key={b.id} value={b.id.toString()}>{b.budget_name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">{t('Amendment Type')}</label>
                                <Select value={filters.amendment_type} onValueChange={v => setFilters({...filters, amendment_type: v})}>
                                    <SelectTrigger><SelectValue placeholder="All types" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="virement">{t('Virement')}</SelectItem>
                                        <SelectItem value="revision">{t('Revision')}</SelectItem>
                                        <SelectItem value="supplementary">{t('Supplementary')}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">{t('Status')}</label>
                                <Select value={filters.status} onValueChange={v => setFilters({...filters, status: v})}>
                                    <SelectTrigger><SelectValue placeholder={t('Filter by Status')} /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="draft">{t('Draft')}</SelectItem>
                                        <SelectItem value="approved">{t('Approved')}</SelectItem>
                                        <SelectItem value="rejected">{t('Rejected')}</SelectItem>
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
                    <div className="overflow-y-auto max-h-[70vh]">
                        <DataTable
                            data={amendments?.data || []}
                            columns={tableColumns}
                            className="rounded-none"
                            emptyState={
                                <NoRecordsFound
                                    icon={GitBranch}
                                    title={t('No Budget Amendments found')}
                                    description={t('Get started by creating your first Budget Amendment.')}
                                    hasFilters={Object.values(filters).some(Boolean)}
                                    onClearFilters={clearFilters}
                                    createPermission="create-budget-amendments"
                                    onCreateClick={() => setCreateOpen(true)}
                                    createButtonText={t('Create Budget Amendment')}
                                    className="h-auto"
                                />
                            }
                        />
                    </div>
                </CardContent>

                <CardContent className="px-4 py-2 border-t bg-gray-50/30">
                    <Pagination
                        data={amendments || {}}
                        routeName="budget-planner.budget-amendments.index"
                        filters={{...filters, per_page: perPage}}
                    />
                </CardContent>
            </Card>

            {/* Create Amendment Dialog */}
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{t('Create Budget Amendment')}</DialogTitle>
                    </DialogHeader>
                    <CreateAmendmentForm
                        budgets={budgets ?? []}
                        allocations={allocations ?? []}
                        onSuccess={() => { setCreateOpen(false); router.reload(); }}
                    />
                </DialogContent>
            </Dialog>

            {/* Reject Reason Dialog */}
            <Dialog open={rejectId !== null} onOpenChange={() => setRejectId(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>{t('Reject Amendment')}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label>{t('Rejection Reason')}</Label>
                            <Textarea
                                value={rejectReason}
                                onChange={e => setRejectReason(e.target.value)}
                                rows={3}
                                placeholder="State the reason for rejection..."
                            />
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setRejectId(null)}>{t('Cancel')}</Button>
                            <Button variant="destructive" onClick={doReject}>{t('Reject')}</Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </AuthenticatedLayout>
    );
}
