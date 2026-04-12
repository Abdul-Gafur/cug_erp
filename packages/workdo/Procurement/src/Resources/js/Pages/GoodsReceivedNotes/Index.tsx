import { Head, usePage, router } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import AuthenticatedLayout from '@/layouts/authenticated-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { Pagination } from '@/components/ui/pagination';
import { SearchInput } from '@/components/ui/search-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import NoRecordsFound from '@/components/no-records-found';
import { Plus, Eye, Package } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface Grn {
    id: number;
    grn_number: string;
    grn_date: string;
    status: string;
    lpo?: { lpo_number: string };
    receiving_officer?: { name: string };
    receiving_department?: string;
}

const STATUS_COLORS: Record<string, string> = {
    draft:  'bg-yellow-100 text-yellow-800',
    posted: 'bg-green-100 text-green-800',
};

export default function GrnIndex() {
    const { props } = usePage<any>();
    const grns = props.grns || { data: [] };
    const filters = props.filters || {};
    
    const { t } = useTranslation();

    const handleFilter = (key: string, value: string) => {
        router.get(route('procurement.grns.index'), { ...filters, [key]: value }, { preserveState: true });
    };

    const columns = [
        { key: 'grn_number', header: t('GRN No.') },
        { key: 'grn_date', header: t('Date') },
        {
            key: 'lpo',
            header: t('PO Reference'),
            render: (_: any, row: Grn) => row.lpo?.lpo_number ?? '—',
        },
        {
            key: 'receiving_department',
            header: t('Receiving Department'),
            render: (_: any, row: Grn) => row.receiving_department ?? '—',
        },
        {
            key: 'receiving_officer',
            header: t('Receiving Officer'),
            render: (_: any, row: Grn) => row.receiving_officer?.name ?? '—',
        },
        {
            key: 'status',
            header: t('Status'),
            render: (_: any, row: Grn) => (
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${row.status ? (STATUS_COLORS[row.status] ?? 'bg-gray-100 text-gray-700') : 'bg-gray-100 text-gray-700'}`}>
                    {row.status ? t(row.status) : '—'}
                </span>
            ),
        },
        {
            key: 'actions',
            header: t('Actions'),
            render: (_: any, row: Grn) => (
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon"
                                onClick={() => router.visit(route('procurement.grns.show', row.id))}>
                                <Eye className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t('View')}</TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            ),
        },
    ];

    return (
        <AuthenticatedLayout>
            <Head title={t('Goods Received Notes')} />

            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold">{t('Goods Received Notes')}</h1>
                    <p className="text-sm text-gray-500 mt-1">{t('Record goods and services received against approved Purchase Orders')}</p>
                </div>
                <Button onClick={() => router.visit(route('procurement.grns.create'))}>
                    <Plus className="h-4 w-4 mr-2" />
                    {t('New GRN')}
                </Button>
            </div>

            {/* Filters */}
            <Card className="mb-4">
                <CardContent className="pt-4">
                    <div className="flex flex-wrap gap-3">
                        <SearchInput
                            placeholder={t('Search GRN No. or PO No.')}
                            defaultValue={filters?.search ?? ''}
                            onSearch={(v) => handleFilter('search', v)}
                            className="w-64"
                        />
                        <Select
                            value={filters?.status || 'all'}
                            onValueChange={(v) => handleFilter('status', v === 'all' ? '' : v)}
                        >
                            <SelectTrigger className="w-40">
                                <SelectValue placeholder={t('All Statuses')} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">{t('All Statuses')}</SelectItem>
                                <SelectItem value="draft">{t('Draft')}</SelectItem>
                                <SelectItem value="posted">{t('Posted')}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Table */}
            {grns.data.length === 0 ? (
                <NoRecordsFound
                    icon={Package}
                    title={t('No GRNs found')}
                    description={t('Create a GRN to record goods or services received against a Purchase Order.')}
                />
            ) : (
                <>
                    <DataTable columns={columns} data={grns.data} />
                    <div className="mt-4">
                        <Pagination data={{...grns, ...grns.meta}} routeName="procurement.grns.index" filters={filters} />
                    </div>
                </>
            )}
        </AuthenticatedLayout>
    );
}
