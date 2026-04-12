import { useState } from 'react';
import { Head, usePage, router } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import AuthenticatedLayout from '@/layouts/authenticated-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { SearchInput } from '@/components/ui/search-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Pagination } from '@/components/ui/pagination';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, Eye, Download, CheckCircle, Mail, FileText } from 'lucide-react';
import { formatCurrency, formatDate } from '@/utils/helpers';
import NoRecordsFound from '@/components/no-records-found';
import { Lpo } from '../Quotations/types';

const STATUS_COLORS: Record<string, string> = {
    draft:     'bg-gray-100 text-gray-800',
    approved:  'bg-green-100 text-green-800',
    emailed:   'bg-blue-100 text-blue-800',
    completed: 'bg-teal-100 text-teal-800',
    cancelled: 'bg-red-100 text-red-800',
};

interface IndexProps {
    lpos: { data: Lpo[]; links: any[]; meta: any };
    auth: any;
    filters: { status?: string; search?: string };
    [key: string]: any;
}

export default function Index() {
    const { t } = useTranslation();
    const { lpos, auth, filters: initFilters } = usePage<IndexProps>().props;
    const [filters, setFilters] = useState(initFilters ?? {});
    const permissions: string[] = auth?.user?.permissions ?? [];

    const handleFilter = () => {
        router.get(route('lpo.index'), filters as any, { preserveState: true, replace: true });
    };

    const columns = [
        {
            key: 'lpo_number',
            header: t('PO Number'),
            render: (v: string, lpo: Lpo) =>
                permissions.includes('view-quotations') ? (
                    <span className="text-blue-600 cursor-pointer font-medium hover:underline"
                        onClick={() => router.get(route('lpo.show', lpo.id))}>{v}</span>
                ) : <span>{v}</span>,
        },
        {
            key: 'supplier',
            header: t('Supplier'),
            render: (v: any) => v?.name ?? '-',
        },
        {
            key: 'issuing_department',
            header: t('Department'),
        },
        {
            key: 'lpo_date',
            header: t('Date'),
            render: (v: string) => formatDate(v),
        },
        {
            key: 'total_amount',
            header: t('Total Value'),
            render: (v: number) => formatCurrency(v),
        },
        {
            key: 'status',
            header: t('Status'),
            sortable: true,
            render: (v: string) => (
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${v ? (STATUS_COLORS[v] ?? 'bg-gray-100 text-gray-800') : 'bg-gray-100 text-gray-800'}`}>
                    {v ? t(v.charAt(0).toUpperCase() + v.slice(1)) : '—'}
                </span>
            ),
        },
        {
            key: 'actions',
            header: t('Actions'),
            render: (_: any, lpo: Lpo) => (
                <div className="flex gap-1">
                    <TooltipProvider>
                        {permissions.includes('view-quotations') && (
                            <Tooltip delayDuration={0}>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0"
                                        onClick={() => router.get(route('lpo.show', lpo.id))}>
                                        <Eye className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>{t('View')}</p></TooltipContent>
                            </Tooltip>
                        )}
                        {lpo.status === 'draft' && permissions.includes('approve-quotations') && (
                            <Tooltip delayDuration={0}>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-green-600"
                                        onClick={() => router.post(route('lpo.approve', lpo.id))}>
                                        <CheckCircle className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>{t('Approve')}</p></TooltipContent>
                            </Tooltip>
                        )}
                        {lpo.status === 'approved' && permissions.includes('sent-quotations') && (
                            <Tooltip delayDuration={0}>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-blue-600"
                                        onClick={() => router.post(route('lpo.email', lpo.id))}>
                                        <Mail className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>{t('Email to Supplier')}</p></TooltipContent>
                            </Tooltip>
                        )}
                        {permissions.includes('print-quotations') && (
                            <Tooltip delayDuration={0}>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-orange-600"
                                        onClick={() => window.open(route('lpo.print', lpo.id) + '?download=pdf', '_blank')}>
                                        <Download className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>{t('Download PDF')}</p></TooltipContent>
                            </Tooltip>
                        )}
                    </TooltipProvider>
                </div>
            ),
        },
    ];

    return (
        <AuthenticatedLayout
            breadcrumbs={[{ label: t('Purchase Orders / Contracts') }]}
            pageTitle={t('Purchase Orders / Contracts')}
        >
            <Head title={t('Purchase Orders / Contracts')} />

            <div className="space-y-4">
                <div className="flex flex-wrap gap-3 items-center justify-between">
                    <div className="flex gap-2 flex-wrap items-center">
                        <SearchInput
                            value={filters.search ?? ''}
                            onChange={v => setFilters((f: any) => ({ ...f, search: v }))}
                            onSearch={handleFilter}
                            placeholder={t('Search PO number...')}
                        />
                        <Select value={filters.status || 'all'} onValueChange={v => setFilters((f: any) => ({ ...f, status: v === 'all' ? '' : v }))}>
                            <SelectTrigger className="w-36">
                                <SelectValue placeholder={t('All')} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">{t('All')}</SelectItem>
                                <SelectItem value="draft">{t('Draft')}</SelectItem>
                                <SelectItem value="approved">{t('Approved')}</SelectItem>
                                <SelectItem value="emailed">{t('Emailed')}</SelectItem>
                                <SelectItem value="completed">{t('Completed')}</SelectItem>
                                <SelectItem value="cancelled">{t('Cancelled')}</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button variant="outline" size="sm" onClick={handleFilter}>{t('Filter')}</Button>
                    </div>

                    {permissions.includes('create-quotations') && (
                        <Button onClick={() => router.get(route('lpo.create'))}>
                            <Plus className="h-4 w-4 mr-2" />
                            {t('New Purchase Order')}
                        </Button>
                    )}
                </div>

                <Card>
                    <CardContent className="p-0">
                        {lpos.data.length === 0 ? (
                            <NoRecordsFound 
                                icon={FileText}
                                title={t('No Purchase Orders Found')} 
                                description={t('Create a Purchase Order from an awarded RFQ or directly.')} 
                            />
                        ) : (
                            <>
                                <DataTable columns={columns} data={lpos.data} />
                                <div className="p-4 border-t">
                                    <Pagination data={{...lpos, ...lpos.meta}} routeName="lpo.index" filters={filters} />
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>
        </AuthenticatedLayout>
    );
}
