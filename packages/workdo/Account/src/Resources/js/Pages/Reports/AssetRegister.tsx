import { useState } from 'react';
import { Head, usePage, router, Link } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import AuthenticatedLayout from '@/layouts/authenticated-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { formatCurrency, formatDate } from '@/utils/helpers';
import { Printer } from 'lucide-react';

interface Asset {
    id: number;
    asset_code: string;
    asset_name: string;
    category: { name: string } | null;
    fund: { code: string; name: string } | null;
    department: string | null;
    location: string | null;
    purchase_cost: string;
    accumulated_depreciation: string;
    status: string;
}

interface Totals {
    total_cost: number;
    total_accumulated_depreciation: number;
    total_carrying_amount: number;
}

interface Category { id: number; name: string }
interface Fund { id: number; name: string; code: string }

interface Props {
    assets: Asset[];
    totals: Totals;
    categories: Category[];
    funds: Fund[];
    filters: Record<string, string>;
}

export default function AssetRegister() {
    const { t } = useTranslation();
    const { assets, totals, categories, funds, filters: initialFilters } = usePage<Props>().props;

    const [filters, setFilters] = useState({
        category_id: initialFilters?.category_id || '',
        fund_id: initialFilters?.fund_id || '',
        status: initialFilters?.status || '',
        department: initialFilters?.department || '',
    });

    const applyFilters = () => {
        router.get(route('account.reports.asset-register.index'), filters, { preserveState: true, replace: true });
    };

    const clearFilters = () => {
        setFilters({ category_id: '', fund_id: '', status: '', department: '' });
        router.get(route('account.reports.asset-register.index'));
    };

    const printUrl = () => {
        const params = new URLSearchParams(filters as Record<string, string>);
        return route('account.reports.asset-register.print') + '?' + params.toString();
    };

    const statusBadge = (status: string) => {
        const cfg: Record<string, string> = {
            active: 'bg-green-100 text-green-800',
            fully_depreciated: 'bg-yellow-100 text-yellow-800',
            disposed: 'bg-gray-100 text-gray-600',
        };
        const labels: Record<string, string> = {
            active: t('Active'),
            fully_depreciated: t('Fully Depreciated'),
            disposed: t('Disposed'),
        };
        return (
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg[status] ?? 'bg-gray-100'}`}>
                {labels[status] ?? status}
            </span>
        );
    };

    return (
        <AuthenticatedLayout
            breadcrumbs={[
                { label: t('Accounting'), url: route('account.index') },
                { label: t('Asset Register'), url: route('account.fixed-assets.index') },
                { label: t('Asset Register Report') },
            ]}
            pageTitle={t('Asset Register Report')}
            pageActions={
                <Link href={printUrl()} target="_blank">
                    <Button variant="outline" size="sm"><Printer className="h-4 w-4 mr-1" />{t('Print / PDF')}</Button>
                </Link>
            }
        >
            <Head title={t('Asset Register Report')} />

            {/* Filters */}
            <Card className="mb-6">
                <CardContent className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('Category')}</label>
                            <Select value={filters.category_id} onValueChange={(v) => setFilters({ ...filters, category_id: v })}>
                                <SelectTrigger><SelectValue placeholder={t('All')} /></SelectTrigger>
                                <SelectContent>
                                    {categories.map((c) => (
                                        <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('Fund')}</label>
                            <Select value={filters.fund_id} onValueChange={(v) => setFilters({ ...filters, fund_id: v })}>
                                <SelectTrigger><SelectValue placeholder={t('All')} /></SelectTrigger>
                                <SelectContent>
                                    {funds.map((f) => (
                                        <SelectItem key={f.id} value={f.id.toString()}>{f.code} — {f.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('Status')}</label>
                            <Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v })}>
                                <SelectTrigger><SelectValue placeholder={t('All')} /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="active">{t('Active')}</SelectItem>
                                    <SelectItem value="fully_depreciated">{t('Fully Depreciated')}</SelectItem>
                                    <SelectItem value="disposed">{t('Disposed')}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('Department')}</label>
                            <Input value={filters.department} onChange={(e) => setFilters({ ...filters, department: e.target.value })}
                                   placeholder={t('Filter by department')} />
                        </div>
                        <div className="flex gap-2">
                            <Button onClick={applyFilters} size="sm">{t('Apply')}</Button>
                            <Button variant="outline" onClick={clearFilters} size="sm">{t('Clear')}</Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Summary totals */}
            <div className="grid grid-cols-3 gap-4 mb-6">
                <Card>
                    <CardContent className="p-4">
                        <p className="text-xs text-gray-500 mb-1">{t('Total Cost')}</p>
                        <p className="text-xl font-bold text-blue-700">{formatCurrency(totals.total_cost.toFixed(2))}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <p className="text-xs text-gray-500 mb-1">{t('Total Accumulated Depreciation')}</p>
                        <p className="text-xl font-bold text-orange-700">{formatCurrency(totals.total_accumulated_depreciation.toFixed(2))}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <p className="text-xs text-gray-500 mb-1">{t('Total Carrying Amount')}</p>
                        <p className="text-xl font-bold text-green-700">{formatCurrency(totals.total_carrying_amount.toFixed(2))}</p>
                    </CardContent>
                </Card>
            </div>

            {/* Register table */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-sm font-medium text-gray-700">
                        {t('Asset Register')} — {assets.length} {t('assets')}
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 border-b">
                                <tr>
                                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('Asset Code')}</th>
                                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('Description')}</th>
                                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('Category')}</th>
                                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('Dept / Location')}</th>
                                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('Fund')}</th>
                                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('Cost')}</th>
                                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('Acc. Depr.')}</th>
                                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('Carrying Amount')}</th>
                                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('Status')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {assets.map((a) => {
                                    const carrying = parseFloat(a.purchase_cost) - parseFloat(a.accumulated_depreciation);
                                    return (
                                        <tr key={a.id} className="hover:bg-gray-50">
                                            <td className="px-3 py-2 font-mono text-xs font-medium text-blue-600">
                                                <Link href={route('account.fixed-assets.show', a.id)} className="hover:underline">{a.asset_code}</Link>
                                            </td>
                                            <td className="px-3 py-2">{a.asset_name}</td>
                                            <td className="px-3 py-2 text-gray-600">{a.category?.name ?? '-'}</td>
                                            <td className="px-3 py-2 text-gray-600 text-xs">
                                                {[a.department, a.location].filter(Boolean).join(' / ') || '-'}
                                            </td>
                                            <td className="px-3 py-2 text-gray-600">{a.fund?.code ?? '-'}</td>
                                            <td className="px-3 py-2 text-right">{formatCurrency(a.purchase_cost)}</td>
                                            <td className="px-3 py-2 text-right text-orange-700">{formatCurrency(a.accumulated_depreciation)}</td>
                                            <td className="px-3 py-2 text-right font-medium text-green-700">{formatCurrency(carrying.toFixed(2))}</td>
                                            <td className="px-3 py-2">{statusBadge(a.status)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot className="bg-gray-50 border-t-2 border-gray-300 font-semibold">
                                <tr>
                                    <td colSpan={5} className="px-3 py-3 text-sm">{t('TOTALS')}</td>
                                    <td className="px-3 py-3 text-right">{formatCurrency(totals.total_cost.toFixed(2))}</td>
                                    <td className="px-3 py-3 text-right text-orange-700">{formatCurrency(totals.total_accumulated_depreciation.toFixed(2))}</td>
                                    <td className="px-3 py-3 text-right text-green-700">{formatCurrency(totals.total_carrying_amount.toFixed(2))}</td>
                                    <td></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </AuthenticatedLayout>
    );
}
