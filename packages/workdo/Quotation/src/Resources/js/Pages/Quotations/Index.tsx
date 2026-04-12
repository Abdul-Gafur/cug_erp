import { useState } from 'react';
import { Head, usePage, router } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import { useDeleteHandler } from '@/hooks/useDeleteHandler';
import AuthenticatedLayout from '@/layouts/authenticated-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { SearchInput } from '@/components/ui/search-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Pagination } from '@/components/ui/pagination';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, Eye, Edit as EditIcon, Trash2, Download, Send, Lock, ClipboardList, Award, FileText } from 'lucide-react';
import { formatCurrency, formatDate } from '@/utils/helpers';
import { getStatusBadgeClasses, getStatusLabel } from './utils';
import NoRecordsFound from '@/components/no-records-found';
import { Rfq, QuotationFilters } from './types';

interface IndexProps {
    quotations: { data: Rfq[]; links: any[]; meta: any };
    auth: any;
    filters: QuotationFilters;
    [key: string]: any;
}

export default function Index() {
    const { t } = useTranslation();
    const { quotations, auth, filters: initFilters } = usePage<IndexProps>().props;
    const [filters, setFilters] = useState<QuotationFilters>(initFilters ?? {});

    const { deleteState, openDeleteDialog, closeDeleteDialog, confirmDelete } = useDeleteHandler({
        routeName: 'quotations.destroy',
        defaultMessage: t('Are you sure you want to cancel this RFQ?'),
    });

    const handleFilter = () => {
        router.get(route('quotations.index'), filters as any, { preserveState: true, replace: true });
    };

    const clearFilters = () => {
        setFilters({});
        router.get(route('quotations.index'));
    };

    const permissions = auth?.user?.permissions ?? [];

    const columns = [
        {
            key: 'quotation_number',
            header: t('RFQ Number'),
            sortable: true,
            render: (value: string, rfq: Rfq) =>
                permissions.includes('view-quotations') ? (
                    <span
                        className="text-blue-600 hover:underline cursor-pointer font-medium"
                        onClick={() => router.get(route('quotations.show', rfq.id))}
                    >
                        {value}
                    </span>
                ) : <span>{value}</span>,
        },
        {
            key: 'department',
            header: t('Department'),
            render: (v: string) => v || '-',
        },
        {
            key: 'quotation_date',
            header: t('RFQ Date'),
            sortable: true,
            render: (v: string) => formatDate(v),
        },
        {
            key: 'closing_date',
            header: t('Closing Date'),
            sortable: true,
            render: (v: string) => v ? (
                <span className={new Date(v) < new Date() ? 'text-red-600 font-medium' : ''}>
                    {formatDate(v)}
                </span>
            ) : '-',
        },
        {
            key: 'suppliers',
            header: t('Suppliers'),
            render: (_: any, rfq: Rfq) => {
                const count = rfq.suppliers?.length ?? 0;
                const responded = rfq.suppliers?.filter(s => s.status === 'responded').length ?? 0;
                return count > 0 ? `${responded}/${count} responded` : '-';
            },
        },
        {
            key: 'total_amount',
            header: t('Estimated Value'),
            sortable: true,
            render: (v: number) => formatCurrency(v),
        },
        {
            key: 'status',
            header: t('Status'),
            sortable: true,
            render: (v: string) => (
                <span className={getStatusBadgeClasses(v)}>{t(getStatusLabel(v))}</span>
            ),
        },
        ...(permissions.some((p: string) => ['view-quotations', 'edit-quotations', 'delete-quotations', 'sent-quotations', 'print-quotations', 'approve-quotations'].includes(p)) ? [{
            key: 'actions',
            header: t('Actions'),
            render: (_: any, rfq: Rfq) => (
                <div className="flex gap-1">
                    <TooltipProvider>
                        {permissions.includes('view-quotations') && (
                            <Tooltip delayDuration={0}>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0"
                                        onClick={() => router.get(route('quotations.show', rfq.id))}>
                                        <Eye className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>{t('View')}</p></TooltipContent>
                            </Tooltip>
                        )}

                        {rfq.status === 'draft' && permissions.includes('edit-quotations') && (
                            <Tooltip delayDuration={0}>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-blue-600"
                                        onClick={() => router.get(route('quotations.edit', rfq.id))}>
                                        <EditIcon className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>{t('Edit')}</p></TooltipContent>
                            </Tooltip>
                        )}

                        {rfq.status === 'draft' && permissions.includes('sent-quotations') && (
                            <Tooltip delayDuration={0}>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-purple-600"
                                        onClick={() => router.post(route('quotations.issue', rfq.id))}>
                                        <Send className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>{t('Issue RFQ')}</p></TooltipContent>
                            </Tooltip>
                        )}

                        {rfq.status === 'issued' && permissions.includes('approve-quotations') && (
                            <Tooltip delayDuration={0}>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-yellow-600"
                                        onClick={() => router.post(route('quotations.close', rfq.id))}>
                                        <Lock className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>{t('Close RFQ')}</p></TooltipContent>
                            </Tooltip>
                        )}

                        {['closed', 'under_evaluation'].includes(rfq.status) && permissions.includes('approve-quotations') && (
                            <Tooltip delayDuration={0}>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-indigo-600"
                                        onClick={() => rfq.evaluation
                                            ? router.get(route('rfq.evaluation.show', rfq.id))
                                            : router.post(route('rfq.evaluation.start', rfq.id))
                                        }>
                                        <ClipboardList className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>{rfq.evaluation ? t('View Evaluation') : t('Start Evaluation')}</p></TooltipContent>
                            </Tooltip>
                        )}

                        {rfq.status === 'awarded' && permissions.includes('create-quotations') && !rfq.lpo && (
                            <Tooltip delayDuration={0}>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-teal-600"
                                        onClick={() => router.get(route('lpo.create'), { rfq_id: rfq.id })}>
                                        <FileText className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>{t('Issue Purchase Order')}</p></TooltipContent>
                            </Tooltip>
                        )}

                        {permissions.includes('print-quotations') && (
                            <Tooltip delayDuration={0}>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-orange-600"
                                        onClick={() => window.open(route('quotations.print', rfq.id) + '?download=pdf', '_blank')}>
                                        <Download className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>{t('Download RFQ PDF')}</p></TooltipContent>
                            </Tooltip>
                        )}

                        {['draft', 'issued'].includes(rfq.status) && permissions.includes('delete-quotations') && (
                            <Tooltip delayDuration={0}>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-600"
                                        onClick={() => openDeleteDialog(rfq.id, rfq.quotation_number)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>{t('Delete')}</p></TooltipContent>
                            </Tooltip>
                        )}
                    </TooltipProvider>
                </div>
            ),
        }] : []),
    ];

    return (
        <AuthenticatedLayout
            breadcrumbs={[{ label: t('Requests for Quotations / Tenders') }]}
            pageTitle={t('Requests for Quotations / Tenders (RFQ)')}
        >
            <Head title={t('Requests for Quotations / Tenders')} />

            <div className="space-y-4">
                {/* Toolbar */}
                <div className="flex flex-wrap gap-3 items-center justify-between">
                    <div className="flex gap-2 flex-wrap items-center">
                        <SearchInput
                            value={filters.search ?? ''}
                            onChange={v => setFilters(f => ({ ...f, search: v }))}
                            onSearch={handleFilter}
                            placeholder={t('Search RFQ number...')}
                        />
                        <Select
                            value={filters.status || 'all'}
                            onValueChange={v => setFilters(f => ({ ...f, status: v === 'all' ? '' : v }))}
                        >
                            <SelectTrigger className="w-44">
                                <SelectValue placeholder={t('All Statuses')} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">{t('All Statuses')}</SelectItem>
                                <SelectItem value="draft">{t('Draft')}</SelectItem>
                                <SelectItem value="issued">{t('Issued')}</SelectItem>
                                <SelectItem value="closed">{t('Closed')}</SelectItem>
                                <SelectItem value="under_evaluation">{t('Under Evaluation')}</SelectItem>
                                <SelectItem value="awarded">{t('Awarded')}</SelectItem>
                                <SelectItem value="lpo_issued">{t('PO Issued')}</SelectItem>
                                <SelectItem value="rejected">{t('Rejected / Cancelled')}</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button variant="outline" size="sm" onClick={handleFilter}>{t('Filter')}</Button>
                        {(filters.search || filters.status) && (
                            <Button variant="ghost" size="sm" onClick={clearFilters}>{t('Clear')}</Button>
                        )}
                    </div>

                    {permissions.includes('create-quotations') && (
                        <Button onClick={() => router.get(route('quotations.create'))}>
                            <Plus className="h-4 w-4 mr-2" />
                            {t('New RFQ / Tender')}
                        </Button>
                    )}
                </div>

                <Card>
                    <CardContent className="p-0">
                        {quotations.data.length === 0 ? (
                            <NoRecordsFound
                                icon={FileText}
                                title={t('No RFQs Found')}
                                description={t('Create a Request for Quotations / Tender to begin the supplier selection process.')}
                            />
                        ) : (
                            <>
                                <DataTable
                                    columns={columns}
                                    data={quotations.data}
                                />
                                <div className="p-4 border-t">
                                    <Pagination data={{...quotations, ...quotations.meta}} routeName="quotations.index" filters={filters} />
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>

            <ConfirmationDialog
                open={deleteState.isOpen}
                onOpenChange={closeDeleteDialog}
                onConfirm={confirmDelete}
                title={t('Delete RFQ')}
                description={t('Are you sure you want to delete this RFQ? This action cannot be undone.')}
                confirmText={t('Delete')}
                cancelText={t('Cancel')}
                variant="destructive"
            />
        </AuthenticatedLayout>
    );
}
