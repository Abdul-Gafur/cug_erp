import { useState } from 'react';
import { Head, usePage, router } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import AuthenticatedLayout from "@/layouts/authenticated-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { FilterButton } from '@/components/ui/filter-button';
import { Pagination } from "@/components/ui/pagination";
import { PerPageSelector } from '@/components/ui/per-page-selector';
import NoRecordsFound from '@/components/no-records-found';
import { formatCurrency } from '@/utils/helpers';
import { BarChart3 } from 'lucide-react';

interface VarianceRow {
    id: number;
    snapshot_date: string;
    economic_classification: string | null;
    budgeted_amount: number;
    committed_amount: number;
    actual_amount: number;
    variance: number;
    variance_percentage: number;
    budget?: {
        budget_name: string;
        fund_type: string;
        vote_cost_centre?: { code: string; name: string };
        budget_period?: { period_name: string; financial_year: string };
    };
    account?: { account_code: string; account_name: string };
}

const ECON_LABELS: Record<string, string> = {
    personnel_emoluments: 'Personnel Emoluments',
    goods_services:       'Goods & Services',
    capital_expenditure:  'Capital Expenditure',
    transfers_grants:     'Transfers & Grants',
};

const FUND_LABELS: Record<string, string> = {
    general_fund:        'General Fund',
    igf:                 'IGF',
    research_grants:     'Research & Grants',
    donor_endowment:     'Donor / Endowment',
    capital_development: 'Capital Development',
};

function rowStyle(row: VarianceRow): string {
    if (row.actual_amount > row.budgeted_amount) return 'bg-red-50';
    if (row.budgeted_amount > 0 && row.actual_amount < row.budgeted_amount * 0.5) return 'bg-amber-50';
    return '';
}

export default function Index() {
    const { t } = useTranslation();
    const { variances, periods, voteCostCentres, budgets } = usePage<any>().props;
    const urlParams = new URLSearchParams(window.location.search);

    const [filters, setFilters] = useState({
        period_id:               urlParams.get('period_id') || '',
        budget_id:               urlParams.get('budget_id') || '',
        vote_cost_centre_id:     urlParams.get('vote_cost_centre_id') || '',
        economic_classification: urlParams.get('economic_classification') || '',
        date_from:               urlParams.get('date_from') || '',
        date_to:                 urlParams.get('date_to') || '',
    });

    const [perPage]      = useState(urlParams.get('per_page') || '20');
    const [showFilters, setShowFilters] = useState(false);

    const go = (extra: object = {}) =>
        router.get(
            route('budget-planner.budget-variances.index'),
            { ...filters, per_page: perPage, ...extra },
            { preserveState: true, replace: true }
        );

    const clearFilters = () => {
        const empty = { period_id: '', budget_id: '', vote_cost_centre_id: '', economic_classification: '', date_from: '', date_to: '' };
        setFilters(empty);
        router.get(route('budget-planner.budget-variances.index'), { per_page: perPage });
    };

    const rows: VarianceRow[] = variances?.data || [];
    const activeFilterCount = Object.values(filters).filter(Boolean).length;

    return (
        <AuthenticatedLayout
            breadcrumbs={[{ label: t('Budget Planner') }, { label: t('Budget Variance Analysis') }]}
            pageTitle={t('Budget Variance Analysis')}
        >
            <Head title={t('Budget Variance Analysis')} />

            {/* Filters */}
            <Card className="shadow-sm mb-4">
                <CardContent className="p-4 border-b bg-gray-50/50">
                    <div className="flex items-center justify-between gap-4">
                        <p className="text-sm text-gray-500">
                            {t('Per-allocation variance snapshots — auto-recorded on each spending update.')}
                        </p>
                        <div className="flex items-center gap-3">
                            <PerPageSelector
                                routeName="budget-planner.budget-variances.index"
                                filters={filters}
                            />
                            <div className="relative">
                                <FilterButton showFilters={showFilters} onToggle={() => setShowFilters(!showFilters)} />
                                {activeFilterCount > 0 && (
                                    <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center font-medium">
                                        {activeFilterCount}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </CardContent>

                {showFilters && (
                    <CardContent className="p-4 bg-blue-50/30 border-b">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">{t('Fiscal Period')}</label>
                                <Select value={filters.period_id} onValueChange={(v) => setFilters({ ...filters, period_id: v })}>
                                    <SelectTrigger><SelectValue placeholder={t('All Periods')} /></SelectTrigger>
                                    <SelectContent>
                                        {(periods ?? []).map((p: any) => (
                                            <SelectItem key={p.id} value={p.id.toString()}>
                                                {p.period_name} ({p.financial_year})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">{t('Vote / Cost Centre')}</label>
                                <Select value={filters.vote_cost_centre_id} onValueChange={(v) => setFilters({ ...filters, vote_cost_centre_id: v })}>
                                    <SelectTrigger><SelectValue placeholder={t('All Votes')} /></SelectTrigger>
                                    <SelectContent>
                                        {(voteCostCentres ?? []).map((v: any) => (
                                            <SelectItem key={v.id} value={v.id.toString()}>
                                                {v.code} — {v.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">{t('Budget')}</label>
                                <Select value={filters.budget_id} onValueChange={(v) => setFilters({ ...filters, budget_id: v })}>
                                    <SelectTrigger><SelectValue placeholder={t('All Budgets')} /></SelectTrigger>
                                    <SelectContent>
                                        {(budgets ?? []).map((b: any) => (
                                            <SelectItem key={b.id} value={b.id.toString()}>{b.budget_name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">{t('Economic Classification')}</label>
                                <Select value={filters.economic_classification} onValueChange={(v) => setFilters({ ...filters, economic_classification: v })}>
                                    <SelectTrigger><SelectValue placeholder={t('All')} /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="personnel_emoluments">{t('Personnel Emoluments')}</SelectItem>
                                        <SelectItem value="goods_services">{t('Goods & Services')}</SelectItem>
                                        <SelectItem value="capital_expenditure">{t('Capital Expenditure')}</SelectItem>
                                        <SelectItem value="transfers_grants">{t('Transfers & Grants')}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">{t('Date From')}</label>
                                <Input type="date" value={filters.date_from} onChange={(e) => setFilters({ ...filters, date_from: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">{t('Date To')}</label>
                                <Input type="date" value={filters.date_to} onChange={(e) => setFilters({ ...filters, date_to: e.target.value })} />
                            </div>
                            <div className="flex items-end gap-2 col-span-full justify-end">
                                <Button onClick={() => go()} size="sm">{t('Apply')}</Button>
                                <Button variant="outline" onClick={clearFilters} size="sm">{t('Clear')}</Button>
                            </div>
                        </div>
                    </CardContent>
                )}
            </Card>

            {/* Legend */}
            <div className="flex items-center gap-3 mb-2 px-1">
                <span className="flex items-center gap-1 text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-0.5">
                    <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
                    {t('Over-budget')}
                </span>
                <span className="flex items-center gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-0.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                    {t('Under-utilised (< 50%)')}
                </span>
            </div>

            {/* Table */}
            <Card className="shadow-sm">
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs border-collapse" style={{ minWidth: '1100px' }}>
                            <thead className="bg-gray-100 text-gray-600 uppercase sticky top-0 z-10">
                                <tr>
                                    <th className="px-3 py-2 text-left border border-gray-200">{t('Date')}</th>
                                    <th className="px-3 py-2 text-left border border-gray-200">{t('Period')}</th>
                                    <th className="px-3 py-2 text-left border border-gray-200">{t('Vote / Dept')}</th>
                                    <th className="px-3 py-2 text-left border border-gray-200">{t('Fund')}</th>
                                    <th className="px-2 py-2 text-left border border-gray-200 w-16">{t('Code')}</th>
                                    <th className="px-2 py-2 text-left border border-gray-200 min-w-[140px]">{t('Account Name')}</th>
                                    <th className="px-2 py-2 text-left border border-gray-200 min-w-[120px]">{t('Econ. Class.')}</th>
                                    <th className="px-2 py-2 text-right border border-gray-200 min-w-[90px]">{t('Budgeted')}</th>
                                    <th className="px-2 py-2 text-right border border-gray-200 min-w-[90px]">{t('Committed')}</th>
                                    <th className="px-2 py-2 text-right border border-gray-200 min-w-[90px]">{t('Actual')}</th>
                                    <th className="px-2 py-2 text-right border border-gray-200 min-w-[90px]">{t('Variance')}</th>
                                    <th className="px-2 py-2 text-right border border-gray-200 w-16">{t('Var %')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {rows.length === 0 ? (
                                    <tr>
                                        <td colSpan={12} className="px-4 py-12 text-center">
                                            <NoRecordsFound
                                                icon={BarChart3}
                                                title={t('No variance records found')}
                                                description={t('Variance snapshots are auto-created when journal entries are posted to accounts with active budget allocations.')}
                                                hasFilters={activeFilterCount > 0}
                                                onClearFilters={clearFilters}
                                                className="h-auto"
                                            />
                                        </td>
                                    </tr>
                                ) : (
                                    rows.map((row) => {
                                        const overBudget = row.actual_amount > row.budgeted_amount;
                                        const varCls = overBudget ? 'text-red-700 font-semibold' : row.variance > 0 ? 'text-green-700' : '';
                                        return (
                                            <tr key={row.id} className={`hover:brightness-95 ${rowStyle(row)}`}>
                                                <td className="px-3 py-2 border-r border-gray-100 whitespace-nowrap">
                                                    {row.snapshot_date}
                                                </td>
                                                <td className="px-3 py-2 border-r border-gray-100 whitespace-nowrap text-gray-600">
                                                    {row.budget?.budget_period
                                                        ? `${row.budget.budget_period.period_name} (${row.budget.budget_period.financial_year})`
                                                        : '—'}
                                                </td>
                                                <td className="px-3 py-2 border-r border-gray-100">
                                                    {row.budget?.vote_cost_centre
                                                        ? <span title={row.budget.vote_cost_centre.name} className="font-mono">{row.budget.vote_cost_centre.code}</span>
                                                        : <span className="text-gray-400">—</span>
                                                    }
                                                </td>
                                                <td className="px-2 py-2 border-r border-gray-100 text-gray-600">
                                                    {row.budget?.fund_type ? (FUND_LABELS[row.budget.fund_type] ?? row.budget.fund_type) : '—'}
                                                </td>
                                                <td className="px-2 py-2 border-r border-gray-100 font-mono">
                                                    {row.account?.account_code ?? '—'}
                                                </td>
                                                <td className="px-2 py-2 border-r border-gray-100 max-w-[180px] truncate" title={row.account?.account_name}>
                                                    {row.account?.account_name ?? '—'}
                                                </td>
                                                <td className="px-2 py-2 border-r border-gray-100 text-gray-600">
                                                    {row.economic_classification
                                                        ? (ECON_LABELS[row.economic_classification] ?? row.economic_classification)
                                                        : '—'}
                                                </td>
                                                <td className="px-2 py-2 text-right tabular-nums border-r border-gray-100">
                                                    {formatCurrency(row.budgeted_amount)}
                                                </td>
                                                <td className="px-2 py-2 text-right tabular-nums border-r border-gray-100 text-orange-700">
                                                    {formatCurrency(row.committed_amount)}
                                                </td>
                                                <td className={`px-2 py-2 text-right tabular-nums border-r border-gray-100 ${overBudget ? 'text-red-700 font-semibold' : ''}`}>
                                                    {formatCurrency(row.actual_amount)}
                                                </td>
                                                <td className={`px-2 py-2 text-right tabular-nums border-r border-gray-100 ${varCls}`}>
                                                    {formatCurrency(row.variance)}
                                                </td>
                                                <td className={`px-2 py-2 text-right tabular-nums ${varCls}`}>
                                                    {row.variance_percentage.toFixed(1)}%
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>

                <CardContent className="px-4 py-2 border-t bg-gray-50/30">
                    <Pagination
                        data={variances || { data: [], links: [], meta: {} }}
                        routeName="budget-planner.budget-variances.index"
                        filters={{ ...filters, per_page: perPage }}
                    />
                </CardContent>
            </Card>
        </AuthenticatedLayout>
    );
}
