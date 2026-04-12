import { useState } from 'react';
import { Head, usePage, router } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import AuthenticatedLayout from "@/layouts/authenticated-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/utils/helpers';
import { FileText, Download, FileSpreadsheet } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ExecutionRow {
    vote_id: number;
    vote_code: string;
    vote_name: string;
    fund_type: string;
    economic_classification: string;
    account_code: string | null;
    account_name: string | null;
    q1_budget: number;
    q2_budget: number;
    q3_budget: number;
    q4_budget: number;
    q1_actual: number;
    q2_actual: number;
    q3_actual: number;
    q4_actual: number;
    original_budget: number;
    revised_budget: number | null;
    final_budget: number;
    committed: number;
    full_year_actual: number;
    variance: number;
    variance_pct: number;
}

interface Totals {
    original_budget: number;
    revised_budget: number;
    final_budget: number;
    q1_budget: number; q1_actual: number;
    q2_budget: number; q2_actual: number;
    q3_budget: number; q3_actual: number;
    q4_budget: number; q4_actual: number;
    committed: number;
    full_year_actual: number;
    variance: number;
}

// ── Label maps ────────────────────────────────────────────────────────────────

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

// ── Row-flag helpers ──────────────────────────────────────────────────────────

/** Row exceeds its approved budget → red */
const isOverBudget = (row: ExecutionRow) =>
    row.final_budget > 0 && row.full_year_actual > row.final_budget;

/** Q1+Q2 actual below 50 % of approved budget → amber mid-year risk */
const isUnderUtilised = (row: ExecutionRow) =>
    row.final_budget > 0 &&
    (row.q1_actual + row.q2_actual) < 0.5 * row.final_budget;

const rowBg = (row: ExecutionRow) => {
    if (isOverBudget(row))    return 'bg-red-50';
    if (isUnderUtilised(row)) return 'bg-amber-50';
    return '';
};

// ── YTD helpers (Quarter filter) ─────────────────────────────────────────────

const ytdActual = (row: ExecutionRow, qf: number): number => {
    if (qf === 1) return row.q1_actual;
    if (qf === 2) return row.q1_actual + row.q2_actual;
    if (qf === 3) return row.q1_actual + row.q2_actual + row.q3_actual;
    return row.full_year_actual;
};

const ytdVariance = (row: ExecutionRow, qf: number): number =>
    row.final_budget - ytdActual(row, qf);

// ── Grouping ─────────────────────────────────────────────────────────────────

type EconGroup = { label: string; rows: ExecutionRow[] };
type FundGroup = { label: string; econs: Map<string, EconGroup> };
type VoteGroup = { code: string; name: string; funds: Map<string, FundGroup> };

function buildGroups(rows: ExecutionRow[]): Map<string, VoteGroup> {
    const votes = new Map<string, VoteGroup>();

    for (const row of rows) {
        const vKey = row.vote_code;
        if (!votes.has(vKey)) {
            votes.set(vKey, { code: row.vote_code, name: row.vote_name, funds: new Map() });
        }
        const vg = votes.get(vKey)!;

        const fKey = row.fund_type;
        if (!vg.funds.has(fKey)) {
            vg.funds.set(fKey, { label: FUND_LABELS[fKey] ?? fKey, econs: new Map() });
        }
        const fg = vg.funds.get(fKey)!;

        const eKey = row.economic_classification;
        if (!fg.econs.has(eKey)) {
            fg.econs.set(eKey, { label: ECON_LABELS[eKey] ?? eKey, rows: [] });
        }
        fg.econs.get(eKey)!.rows.push(row);
    }

    return votes;
}

function sumRows(rows: ExecutionRow[], qf: number) {
    const ytd = rows.reduce((s, r) => s + ytdActual(r, qf), 0);
    return {
        original_budget:  rows.reduce((s, r) => s + r.original_budget, 0),
        revised_budget:   rows.reduce((s, r) => s + (r.revised_budget ?? r.original_budget), 0),
        final_budget:     rows.reduce((s, r) => s + r.final_budget, 0),
        q1_budget:        rows.reduce((s, r) => s + r.q1_budget, 0),
        q1_actual:        rows.reduce((s, r) => s + r.q1_actual, 0),
        q2_budget:        rows.reduce((s, r) => s + r.q2_budget, 0),
        q2_actual:        rows.reduce((s, r) => s + r.q2_actual, 0),
        q3_budget:        rows.reduce((s, r) => s + r.q3_budget, 0),
        q3_actual:        rows.reduce((s, r) => s + r.q3_actual, 0),
        q4_budget:        rows.reduce((s, r) => s + r.q4_budget, 0),
        q4_actual:        rows.reduce((s, r) => s + r.q4_actual, 0),
        ytd_actual:       ytd,
        variance:         rows.reduce((s, r) => s + r.final_budget, 0) - ytd,
    };
}

// ── Cell helpers ──────────────────────────────────────────────────────────────

const Num = ({ v, cls = '' }: { v: number; cls?: string }) => (
    <td className={`px-2 py-1.5 text-right tabular-nums text-xs ${cls}`}>
        {formatCurrency(v)}
    </td>
);

const SubTotalNum = ({ v, cls = '' }: { v: number; cls?: string }) => (
    <td className={`px-2 py-1 text-right tabular-nums text-xs font-semibold bg-gray-100 ${cls}`}>
        {formatCurrency(v)}
    </td>
);

const GrandNum = ({ v, cls = '' }: { v: number; cls?: string }) => (
    <td className={`px-2 py-2 text-right tabular-nums text-sm font-bold bg-gray-200 ${cls}`}>
        {formatCurrency(v)}
    </td>
);

// ── Main component ────────────────────────────────────────────────────────────

export default function Index() {
    const { t } = useTranslation();
    const { rows, totals, periods, voteCostCentres, selectedPeriod, selectedPeriodObj, filters } =
        usePage<any>().props;

    const [localFilters, setLocalFilters] = useState({
        period_id:                filters?.period_id ?? selectedPeriod?.toString() ?? '',
        vote_cost_centre_id:      filters?.vote_cost_centre_id ?? '',
        fund_type:                filters?.fund_type ?? '',
        economic_classification:  filters?.economic_classification ?? '',
        quarter:                  filters?.quarter ?? '',
    });

    const quarterFilter = parseInt(localFilters.quarter) || 0; // 0 = full year

    const apply = () =>
        router.get(route('budget-planner.budget-execution.index'), localFilters, {
            preserveState: true,
            replace: true,
        });

    const clear = () => {
        const reset = {
            period_id: localFilters.period_id,
            vote_cost_centre_id: '', fund_type: '',
            economic_classification: '', quarter: '',
        };
        setLocalFilters(reset);
        router.get(route('budget-planner.budget-execution.index'), { period_id: localFilters.period_id });
    };

    const openPdf = () => {
        const url = route('budget-planner.budget-execution.print') +
            '?' + new URLSearchParams(
                Object.fromEntries(Object.entries(localFilters).filter(([, v]) => v !== ''))
            ).toString() + '&download=pdf';
        window.open(url, '_blank');
    };

    const downloadExcel = () => {
        const url = route('budget-planner.budget-execution.export-excel') +
            '?' + new URLSearchParams(
                Object.fromEntries(Object.entries(localFilters).filter(([, v]) => v !== ''))
            ).toString();
        window.location.href = url;
    };

    const groups     = buildGroups(rows as ExecutionRow[]);
    const allRows    = rows as ExecutionRow[];
    const grandTotals = (totals as Totals);

    const ytdActualTotal = allRows.reduce((s, r) => s + ytdActual(r, quarterFilter), 0);
    const ytdLabel = quarterFilter > 0
        ? `YTD Actual (Q1–Q${quarterFilter})`
        : t('Full Year Actual');

    const isUnaudited = selectedPeriodObj && selectedPeriodObj.status !== 'closed';

    // ── Column count (for colSpan) ──
    const COL_COUNT = 17;

    return (
        <AuthenticatedLayout
            breadcrumbs={[
                { label: t('Budget Planner') },
                { label: t('Budget Performance Report') },
            ]}
            pageTitle={t('Budget Performance Report')}
        >
            <Head title={t('Budget Performance Report')} />

            {/* ── Filters ──────────────────────────────────────────────────── */}
            <Card className="shadow-sm mb-4">
                <CardContent className="p-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">

                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                                {t('Fiscal Year / Period')} <span className="text-red-500">*</span>
                            </label>
                            <Select
                                value={localFilters.period_id?.toString()}
                                onValueChange={v => setLocalFilters({ ...localFilters, period_id: v })}
                            >
                                <SelectTrigger><SelectValue placeholder={t('Select Period')} /></SelectTrigger>
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
                            <label className="block text-xs font-medium text-gray-600 mb-1">{t('Quarter')}</label>
                            <Select
                                value={localFilters.quarter}
                                onValueChange={v => setLocalFilters({ ...localFilters, quarter: v })}
                            >
                                <SelectTrigger><SelectValue placeholder={t('Full Year')} /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="1">{t('Q1 (Jan–Mar)')}</SelectItem>
                                    <SelectItem value="2">{t('Q2 (Apr–Jun)')}</SelectItem>
                                    <SelectItem value="3">{t('Q3 (Jul–Sep)')}</SelectItem>
                                    <SelectItem value="4">{t('Q4 (Oct–Dec)')}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">{t('Vote / Dept')}</label>
                            <Select
                                value={localFilters.vote_cost_centre_id}
                                onValueChange={v => setLocalFilters({ ...localFilters, vote_cost_centre_id: v })}
                            >
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
                            <label className="block text-xs font-medium text-gray-600 mb-1">{t('Fund')}</label>
                            <Select
                                value={localFilters.fund_type}
                                onValueChange={v => setLocalFilters({ ...localFilters, fund_type: v })}
                            >
                                <SelectTrigger><SelectValue placeholder={t('All Funds')} /></SelectTrigger>
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
                            <label className="block text-xs font-medium text-gray-600 mb-1">{t('Economic Classification')}</label>
                            <Select
                                value={localFilters.economic_classification}
                                onValueChange={v => setLocalFilters({ ...localFilters, economic_classification: v })}
                            >
                                <SelectTrigger><SelectValue placeholder={t('All')} /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="personnel_emoluments">{t('Personnel Emoluments')}</SelectItem>
                                    <SelectItem value="goods_services">{t('Goods & Services')}</SelectItem>
                                    <SelectItem value="capital_expenditure">{t('Capital Expenditure')}</SelectItem>
                                    <SelectItem value="transfers_grants">{t('Transfers & Grants')}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex items-end gap-1.5">
                            <Button onClick={apply} size="sm" className="flex-1">{t('Apply')}</Button>
                            <Button variant="outline" onClick={clear} size="sm">{t('Clear')}</Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* ── Report card ──────────────────────────────────────────────── */}
            <Card className="shadow-sm">
                <CardHeader className="border-b py-3 px-4">
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-primary" />
                            <CardTitle className="text-sm font-semibold">
                                {t('Budget Performance Report')} — IPSAS 24
                                {selectedPeriodObj && (
                                    <span className="ml-2 text-gray-500 font-normal">
                                        {selectedPeriodObj.period_name} ({selectedPeriodObj.financial_year})
                                    </span>
                                )}
                                {isUnaudited && (
                                    <span className="ml-2 text-xs font-semibold text-amber-700 border border-amber-400 rounded px-1.5 py-0.5">
                                        {t('UNAUDITED')}
                                    </span>
                                )}
                            </CardTitle>
                        </div>
                        <div className="flex items-center gap-2">
                            {/* Legend */}
                            <span className="flex items-center gap-1 text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-0.5">
                                <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
                                {t('Over-budget')}
                            </span>
                            <span className="flex items-center gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-0.5">
                                <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                                {t('Under-utilised at mid-year')}
                            </span>
                            {/* Export buttons */}
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={openPdf}
                                className="gap-1.5 text-xs"
                            >
                                <Download className="h-3 w-3" />
                                {t('PDF')}
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={downloadExcel}
                                className="gap-1.5 text-xs"
                            >
                                <FileSpreadsheet className="h-3 w-3" />
                                {t('Excel')}
                            </Button>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs border-collapse" style={{ minWidth: '1400px' }}>
                            <thead className="bg-gray-100 text-gray-600 uppercase sticky top-0 z-10">
                                <tr>
                                    <th rowSpan={2} className="px-3 py-2 text-left border border-gray-200 min-w-[160px]">{t('Vote / Dept')}</th>
                                    <th rowSpan={2} className="px-2 py-2 text-left border border-gray-200 min-w-[100px]">{t('Fund')}</th>
                                    <th rowSpan={2} className="px-2 py-2 text-left border border-gray-200 min-w-[130px]">{t('Econ. Class.')}</th>
                                    <th rowSpan={2} className="px-2 py-2 text-left border border-gray-200 w-16">{t('Code')}</th>
                                    <th rowSpan={2} className="px-2 py-2 text-left border border-gray-200 min-w-[140px]">{t('Account Name')}</th>
                                    <th rowSpan={2} className="px-2 py-2 text-right border border-gray-200 min-w-[90px]">{t('Orig. Budget')}</th>
                                    <th rowSpan={2} className="px-2 py-2 text-right border border-gray-200 min-w-[90px]">{t('Revised Budget')}</th>
                                    <th colSpan={2} className="px-2 py-1 text-center border border-gray-200">{t('Q1')}</th>
                                    <th colSpan={2} className="px-2 py-1 text-center border border-gray-200">{t('Q2')}</th>
                                    <th colSpan={2} className="px-2 py-1 text-center border border-gray-200">{t('Q3')}</th>
                                    <th colSpan={2} className="px-2 py-1 text-center border border-gray-200">{t('Q4')}</th>
                                    <th rowSpan={2} className="px-2 py-2 text-right border border-gray-200 min-w-[100px]">{ytdLabel}</th>
                                    <th rowSpan={2} className="px-2 py-2 text-right border border-gray-200 min-w-[80px]">{t('Variance')}</th>
                                    <th rowSpan={2} className="px-2 py-2 text-right border border-gray-200 w-14">{t('Var %')}</th>
                                </tr>
                                <tr>
                                    {['Q1', 'Q2', 'Q3', 'Q4'].map(q => (
                                        <>
                                            <th key={`${q}b`} className="px-2 py-1 text-right border border-gray-200 min-w-[80px] font-medium">{t('Budgt')}</th>
                                            <th key={`${q}a`} className="px-2 py-1 text-right border border-gray-200 min-w-[80px] font-medium">{t('Actual')}</th>
                                        </>
                                    ))}
                                </tr>
                            </thead>

                            <tbody className="divide-y divide-gray-100">
                                {allRows.length === 0 ? (
                                    <tr>
                                        <td colSpan={COL_COUNT} className="px-4 py-12 text-center text-gray-400">
                                            {t('No data found for the selected filters.')}
                                        </td>
                                    </tr>
                                ) : (
                                    Array.from(groups.entries()).map(([vKey, vg]) => {
                                        const voteRows = Array.from(vg.funds.values())
                                            .flatMap(fg => Array.from(fg.econs.values()).flatMap(eg => eg.rows));
                                        const vSub = sumRows(voteRows, quarterFilter);

                                        return (
                                            <>
                                                {/* ── Vote header ── */}
                                                <tr key={`vh-${vKey}`} className="bg-blue-50 border-t-2 border-blue-200">
                                                    <td colSpan={COL_COUNT} className="px-3 py-1.5 font-semibold text-blue-800 text-xs">
                                                        {vg.code} — {vg.name}
                                                    </td>
                                                </tr>

                                                {Array.from(vg.funds.entries()).map(([fKey, fg]) => {
                                                    const fundRows = Array.from(fg.econs.values()).flatMap(eg => eg.rows);
                                                    const fSub = sumRows(fundRows, quarterFilter);

                                                    return (
                                                        <>
                                                            {/* ── Fund header ── */}
                                                            <tr key={`fh-${vKey}-${fKey}`} className="bg-gray-50 border-t border-gray-200">
                                                                <td className="px-4 py-1" />
                                                                <td colSpan={COL_COUNT - 1} className="px-2 py-1 font-medium text-gray-700 text-xs">
                                                                    {fg.label}
                                                                </td>
                                                            </tr>

                                                            {Array.from(fg.econs.entries()).map(([eKey, eg]) => {
                                                                const eSub = sumRows(eg.rows, quarterFilter);

                                                                return (
                                                                    <>
                                                                        {/* ── Econ header ── */}
                                                                        <tr key={`eh-${vKey}-${fKey}-${eKey}`} className="bg-gray-50/50">
                                                                            <td className="px-4 py-1" />
                                                                            <td className="px-2 py-1" />
                                                                            <td colSpan={COL_COUNT - 2} className="px-2 py-1 italic text-gray-500 text-xs">
                                                                                {eg.label}
                                                                            </td>
                                                                        </tr>

                                                                        {/* ── Account rows ── */}
                                                                        {eg.rows.map((row, i) => {
                                                                            const ytd = ytdActual(row, quarterFilter);
                                                                            const vari = ytdVariance(row, quarterFilter);
                                                                            const variPct = row.final_budget > 0
                                                                                ? ((vari / row.final_budget) * 100).toFixed(1)
                                                                                : '—';
                                                                            const overBudget  = isOverBudget(row);
                                                                            const underUtil   = isUnderUtilised(row);

                                                                            return (
                                                                                <tr
                                                                                    key={`row-${row.allocation_id}-${i}`}
                                                                                    className={`border-b border-gray-100 hover:brightness-95 ${rowBg(row)}`}
                                                                                >
                                                                                    <td className="px-3 py-1.5 border-r border-gray-100" />
                                                                                    <td className="px-2 py-1.5 border-r border-gray-100" />
                                                                                    <td className="px-2 py-1.5 border-r border-gray-100" />
                                                                                    <td className="px-2 py-1.5 font-mono text-xs border-r border-gray-100">
                                                                                        {row.account_code}
                                                                                    </td>
                                                                                    <td className="px-2 py-1.5 border-r border-gray-100 max-w-[160px] truncate" title={row.account_name ?? ''}>
                                                                                        {row.account_name}
                                                                                    </td>
                                                                                    <Num v={row.original_budget} />
                                                                                    <td className="px-2 py-1.5 text-right tabular-nums text-xs">
                                                                                        {row.revised_budget !== null
                                                                                            ? formatCurrency(row.revised_budget)
                                                                                            : <span className="text-gray-400">—</span>
                                                                                        }
                                                                                    </td>
                                                                                    <Num v={row.q1_budget} />
                                                                                    <Num v={row.q1_actual} />
                                                                                    <Num v={row.q2_budget} />
                                                                                    <Num v={row.q2_actual} />
                                                                                    <Num v={row.q3_budget} />
                                                                                    <Num v={row.q3_actual} />
                                                                                    <Num v={row.q4_budget} />
                                                                                    <Num v={row.q4_actual} />
                                                                                    <Num v={ytd} cls={overBudget ? 'text-red-700 font-semibold' : ''} />
                                                                                    <Num v={vari} cls={vari < 0 ? 'text-red-600 font-medium' : 'text-green-700'} />
                                                                                    <td className={`px-2 py-1.5 text-right tabular-nums text-xs ${vari < 0 ? 'text-red-600' : 'text-green-700'}`}>
                                                                                        {variPct}%
                                                                                    </td>
                                                                                </tr>
                                                                            );
                                                                        })}

                                                                        {/* ── Econ subtotal ── */}
                                                                        <tr key={`es-${vKey}-${fKey}-${eKey}`} className="border-t border-gray-200">
                                                                            <td colSpan={5} className="px-3 py-1 text-right text-xs font-semibold text-gray-600 bg-gray-100 italic">
                                                                                {eg.label} {t('Total')}
                                                                            </td>
                                                                            <SubTotalNum v={eSub.original_budget} />
                                                                            <SubTotalNum v={eSub.revised_budget} />
                                                                            <SubTotalNum v={eSub.q1_budget} />
                                                                            <SubTotalNum v={eSub.q1_actual} />
                                                                            <SubTotalNum v={eSub.q2_budget} />
                                                                            <SubTotalNum v={eSub.q2_actual} />
                                                                            <SubTotalNum v={eSub.q3_budget} />
                                                                            <SubTotalNum v={eSub.q3_actual} />
                                                                            <SubTotalNum v={eSub.q4_budget} />
                                                                            <SubTotalNum v={eSub.q4_actual} />
                                                                            <SubTotalNum v={eSub.ytd_actual} />
                                                                            <SubTotalNum v={eSub.variance} cls={eSub.variance < 0 ? 'text-red-600' : 'text-green-700'} />
                                                                            <td className="px-2 py-1 text-right text-xs font-semibold bg-gray-100" />
                                                                        </tr>
                                                                    </>
                                                                );
                                                            })}

                                                            {/* ── Fund subtotal ── */}
                                                            <tr key={`fs-${vKey}-${fKey}`} className="border-t-2 border-gray-300">
                                                                <td colSpan={5} className="px-3 py-1.5 text-right text-xs font-bold text-gray-700 bg-gray-200">
                                                                    {fg.label} {t('Total')}
                                                                </td>
                                                                <SubTotalNum v={fSub.original_budget} />
                                                                <SubTotalNum v={fSub.revised_budget} />
                                                                <SubTotalNum v={fSub.q1_budget} />
                                                                <SubTotalNum v={fSub.q1_actual} />
                                                                <SubTotalNum v={fSub.q2_budget} />
                                                                <SubTotalNum v={fSub.q2_actual} />
                                                                <SubTotalNum v={fSub.q3_budget} />
                                                                <SubTotalNum v={fSub.q3_actual} />
                                                                <SubTotalNum v={fSub.q4_budget} />
                                                                <SubTotalNum v={fSub.q4_actual} />
                                                                <SubTotalNum v={fSub.ytd_actual} />
                                                                <SubTotalNum v={fSub.variance} cls={fSub.variance < 0 ? 'text-red-600' : 'text-green-700'} />
                                                                <td className="px-2 py-1.5 bg-gray-200" />
                                                            </tr>
                                                        </>
                                                    );
                                                })}

                                                {/* ── Vote subtotal ── */}
                                                <tr key={`vs-${vKey}`} className="border-t-2 border-blue-300">
                                                    <td colSpan={5} className="px-3 py-1.5 text-right text-xs font-bold text-blue-800 bg-blue-100">
                                                        {vg.code} — {vg.name} {t('Total')}
                                                    </td>
                                                    <SubTotalNum v={vSub.original_budget} cls="bg-blue-100" />
                                                    <SubTotalNum v={vSub.revised_budget}  cls="bg-blue-100" />
                                                    <SubTotalNum v={vSub.q1_budget}       cls="bg-blue-100" />
                                                    <SubTotalNum v={vSub.q1_actual}       cls="bg-blue-100" />
                                                    <SubTotalNum v={vSub.q2_budget}       cls="bg-blue-100" />
                                                    <SubTotalNum v={vSub.q2_actual}       cls="bg-blue-100" />
                                                    <SubTotalNum v={vSub.q3_budget}       cls="bg-blue-100" />
                                                    <SubTotalNum v={vSub.q3_actual}       cls="bg-blue-100" />
                                                    <SubTotalNum v={vSub.q4_budget}       cls="bg-blue-100" />
                                                    <SubTotalNum v={vSub.q4_actual}       cls="bg-blue-100" />
                                                    <SubTotalNum v={vSub.ytd_actual}      cls="bg-blue-100" />
                                                    <SubTotalNum v={vSub.variance} cls={`bg-blue-100 ${vSub.variance < 0 ? 'text-red-600' : 'text-green-700'}`} />
                                                    <td className="px-2 py-1.5 bg-blue-100" />
                                                </tr>
                                            </>
                                        );
                                    })
                                )}
                            </tbody>

                            {/* ── Grand total ── */}
                            {allRows.length > 0 && (
                                <tfoot className="border-t-4 border-gray-400">
                                    <tr>
                                        <td colSpan={5} className="px-3 py-2 text-right text-sm font-bold text-gray-800 bg-gray-200 uppercase tracking-wide">
                                            {t('Grand Total')}
                                        </td>
                                        <GrandNum v={grandTotals.original_budget} />
                                        <GrandNum v={grandTotals.revised_budget} />
                                        <GrandNum v={grandTotals.q1_budget} />
                                        <GrandNum v={grandTotals.q1_actual} />
                                        <GrandNum v={grandTotals.q2_budget} />
                                        <GrandNum v={grandTotals.q2_actual} />
                                        <GrandNum v={grandTotals.q3_budget} />
                                        <GrandNum v={grandTotals.q3_actual} />
                                        <GrandNum v={grandTotals.q4_budget} />
                                        <GrandNum v={grandTotals.q4_actual} />
                                        <GrandNum v={ytdActualTotal} />
                                        <GrandNum
                                            v={grandTotals.final_budget - ytdActualTotal}
                                            cls={(grandTotals.final_budget - ytdActualTotal) < 0 ? 'text-red-700' : 'text-green-800'}
                                        />
                                        <td className="px-2 py-2 bg-gray-200" />
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                </CardContent>
            </Card>
        </AuthenticatedLayout>
    );
}
