import { useState } from 'react';
import { Head, usePage, router, Link } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import { useDeleteHandler } from '@/hooks/useDeleteHandler';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PerPageSelector } from '@/components/ui/per-page-selector';
import AuthenticatedLayout from '@/layouts/authenticated-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { Plus, Trash2, Eye } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { FilterButton } from '@/components/ui/filter-button';
import { Pagination } from '@/components/ui/pagination';
import { SearchInput } from '@/components/ui/search-input';
import NoRecordsFound from '@/components/no-records-found';
import { formatDate, formatCurrency } from '@/utils/helpers';

interface Asset {
    id: number;
    asset_code: string;
    asset_name: string;
    category: { id: number; name: string } | null;
    fund: { id: number; name: string; code: string } | null;
    department: string | null;
    location: string | null;
    purchase_cost: string;
    accumulated_depreciation: string;
    status: 'active' | 'fully_depreciated' | 'disposed';
}

interface Category { id: number; name: string }
interface Fund { id: number; name: string; code: string }

interface Props {
    assets: { data: Asset[]; meta?: any };
    categories: Category[];
    funds: Fund[];
    filters: Record<string, string>;
    auth: any;
}

export default function Index() {
    const { t } = useTranslation();
    const { assets, categories, funds, filters: initialFilters } = usePage<Props>().props;
    const urlParams = new URLSearchParams(window.location.search);

    const [filters, setFilters] = useState({
        search: initialFilters?.search || '',
        category_id: initialFilters?.category_id || '',
        fund_id: initialFilters?.fund_id || '',
        status: initialFilters?.status || '',
    });
    const [showFilters, setShowFilters] = useState(false);

    const { deleteState, openDeleteDialog, closeDeleteDialog, confirmDelete } = useDeleteHandler({
        routeName: 'account.fixed-assets.destroy',
        defaultMessage: t('Are you sure you want to delete this asset?'),
    });

    const handleFilter = () => {
        router.get(route('account.fixed-assets.index'), {
            ...filters,
            per_page: urlParams.get('per_page') || '15',
        }, { preserveState: true, replace: true });
    };

    const clearFilters = () => {
        setFilters({ search: '', category_id: '', fund_id: '', status: '' });
        router.get(route('account.fixed-assets.index'));
    };

    const statusBadge = (status: string) => {
        const cfg: Record<string, string> = {
            active:             'bg-green-100 text-green-800',
            fully_depreciated:  'bg-yellow-100 text-yellow-800',
            disposed:           'bg-gray-100 text-gray-600',
        };
        const labels: Record<string, string> = {
            active:             t('Active'),
            fully_depreciated:  t('Fully Depreciated'),
            disposed:           t('Disposed'),
        };
        return (
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${cfg[status] ?? 'bg-gray-100'}`}>
                {labels[status] ?? status}
            </span>
        );
    };

    const carryingAmount = (asset: Asset) =>
        parseFloat(asset.purchase_cost) - parseFloat(asset.accumulated_depreciation);

    const columns = [
        {
            key: 'asset_code',
            header: t('Asset Code'),
            sortable: true,
            render: (_: any, asset: Asset) => (
                <Link href={route('account.fixed-assets.show', asset.id)}
                      className="text-blue-600 hover:text-blue-700 font-medium">
                    {asset.asset_code}
                </Link>
            ),
        },
        { key: 'asset_name', header: t('Description'), sortable: true },
        {
            key: 'category.name',
            header: t('Category'),
            render: (_: any, a: Asset) => a.category?.name ?? '-',
        },
        {
            key: 'department',
            header: t('Department / Location'),
            render: (_: any, a: Asset) => [a.department, a.location].filter(Boolean).join(' — ') || '-',
        },
        {
            key: 'fund.code',
            header: t('Fund'),
            render: (_: any, a: Asset) => a.fund ? `${a.fund.code}` : '-',
        },
        {
            key: 'purchase_cost',
            header: t('Cost'),
            render: (v: string) => formatCurrency(v),
        },
        {
            key: 'accumulated_depreciation',
            header: t('Acc. Depreciation'),
            render: (v: string) => formatCurrency(v),
        },
        {
            key: 'carrying_amount',
            header: t('Carrying Amount'),
            render: (_: any, a: Asset) => formatCurrency(carryingAmount(a).toFixed(2)),
        },
        {
            key: 'status',
            header: t('Status'),
            render: (v: string) => statusBadge(v),
        },
        {
            key: 'actions',
            header: t('Actions'),
            render: (_: any, asset: Asset) => (
                <div className="flex gap-1">
                    <TooltipProvider>
                        <Tooltip delayDuration={0}>
                            <TooltipTrigger asChild>
                                <Link href={route('account.fixed-assets.show', asset.id)}>
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-green-600 hover:text-green-700">
                                        <Eye className="h-4 w-4" />
                                    </Button>
                                </Link>
                            </TooltipTrigger>
                            <TooltipContent><p>{t('View')}</p></TooltipContent>
                        </Tooltip>
                        {asset.status === 'active' && (
                            <Tooltip delayDuration={0}>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="sm"
                                            onClick={() => openDeleteDialog(asset.id)}
                                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700">
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>{t('Delete')}</p></TooltipContent>
                            </Tooltip>
                        )}
                    </TooltipProvider>
                </div>
            ),
        },
    ];

    return (
        <AuthenticatedLayout
            breadcrumbs={[
                { label: t('Accounting'), url: route('account.index') },
                { label: t('Fixed Assets') },
            ]}
            pageTitle={t('Asset Register')}
            pageActions={
                <div className="flex items-center gap-2">
                    <TooltipProvider>
                        <Tooltip delayDuration={0}>
                            <TooltipTrigger asChild>
                                <Link href={route('account.reports.asset-register.index')}>
                                    <Button variant="outline" size="sm">{t('Asset Register Report')}</Button>
                                </Link>
                            </TooltipTrigger>
                            <TooltipContent><p>{t('Finance Committee Report')}</p></TooltipContent>
                        </Tooltip>
                        <Tooltip delayDuration={0}>
                            <TooltipTrigger asChild>
                                <Link href={route('account.fixed-assets.create')}>
                                    <Button size="sm"><Plus className="h-4 w-4" /></Button>
                                </Link>
                            </TooltipTrigger>
                            <TooltipContent><p>{t('Register Asset')}</p></TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
            }
        >
            <Head title={t('Asset Register')} />

            <Card className="shadow-sm">
                <CardContent className="p-6 border-b bg-gray-50/50">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex-1 max-w-md">
                            <SearchInput
                                value={filters.search}
                                onChange={(v) => setFilters({ ...filters, search: v })}
                                onSearch={handleFilter}
                                placeholder={t('Search assets...')}
                            />
                        </div>
                        <div className="flex items-center gap-3">
                            <PerPageSelector routeName="account.fixed-assets.index" filters={filters} />
                            <div className="relative">
                                <FilterButton showFilters={showFilters} onToggle={() => setShowFilters(!showFilters)} />
                                {(() => {
                                    const active = [filters.category_id, filters.fund_id, filters.status].filter(Boolean).length;
                                    return active > 0 && (
                                        <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center font-medium">
                                            {active}
                                        </span>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>
                </CardContent>

                {showFilters && (
                    <CardContent className="p-6 bg-blue-50/30 border-b">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">{t('Category')}</label>
                                <Select value={filters.category_id} onValueChange={(v) => setFilters({ ...filters, category_id: v })}>
                                    <SelectTrigger><SelectValue placeholder={t('All categories')} /></SelectTrigger>
                                    <SelectContent>
                                        {categories.map((c) => (
                                            <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">{t('Fund')}</label>
                                <Select value={filters.fund_id} onValueChange={(v) => setFilters({ ...filters, fund_id: v })}>
                                    <SelectTrigger><SelectValue placeholder={t('All funds')} /></SelectTrigger>
                                    <SelectContent>
                                        {funds.map((f) => (
                                            <SelectItem key={f.id} value={f.id.toString()}>{f.code} — {f.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">{t('Status')}</label>
                                <Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v })}>
                                    <SelectTrigger><SelectValue placeholder={t('All statuses')} /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="active">{t('Active')}</SelectItem>
                                        <SelectItem value="fully_depreciated">{t('Fully Depreciated')}</SelectItem>
                                        <SelectItem value="disposed">{t('Disposed')}</SelectItem>
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

                <CardContent className="p-0">
                    <div className="overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100 max-h-[70vh] w-full">
                        <div className="min-w-[900px]">
                            <DataTable
                                data={assets.data ?? assets}
                                columns={columns}
                                className="rounded-none"
                                emptyState={
                                    <NoRecordsFound
                                        icon={Plus}
                                        title={t('No assets found')}
                                        description={t('Register your first fixed asset to get started.')}
                                        hasFilters={!!(filters.search || filters.category_id || filters.fund_id || filters.status)}
                                        onClearFilters={clearFilters}
                                    />
                                }
                            />
                        </div>
                    </div>
                </CardContent>

                <CardContent className="px-4 py-2 border-t bg-gray-50/30">
                    <Pagination
                        data={assets}
                        routeName="account.fixed-assets.index"
                        filters={filters}
                    />
                </CardContent>
            </Card>

            <ConfirmationDialog
                open={deleteState.isOpen}
                onOpenChange={closeDeleteDialog}
                title={t('Delete Asset')}
                message={deleteState.message}
                confirmText={t('Delete')}
                onConfirm={confirmDelete}
                variant="destructive"
            />
        </AuthenticatedLayout>
    );
}
