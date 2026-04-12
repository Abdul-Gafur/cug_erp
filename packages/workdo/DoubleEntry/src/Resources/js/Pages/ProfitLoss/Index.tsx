import { useState } from 'react';
import { Head, usePage, router } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import AuthenticatedLayout from "@/layouts/authenticated-layout";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Search, Printer } from "lucide-react";
import { DatePicker } from '@/components/ui/date-picker';
import { formatDate, formatCurrency } from '@/utils/helpers';

interface Account {
    id: number;
    account_code: string;
    account_name: string;
    balance: number;
}

interface IpsasGroup {
    label: string;
    accounts: Account[];
    total: number;
}

interface PeriodData {
    revenue: Account[];
    expenses: Account[];
    total_revenue: number;
    total_expenses: number;
    net_profit: number;
    net_surplus: number;
    grouped_revenue: IpsasGroup[];
    grouped_expenses: IpsasGroup[];
    from_date: string;
    to_date: string;
}

interface Props {
    profitLoss: PeriodData & { prior_year: PeriodData | null };
    financialYear: string;
    isAudited: boolean;
    auth: { user: { permissions: string[] } };
}

// Build a list of selectable fiscal years (current year ± 5)
function fiscalYearOptions(): string[] {
    const current = new Date().getFullYear();
    const years: string[] = [];
    for (let y = current + 1; y >= current - 5; y--) {
        years.push(String(y));
    }
    return years;
}

export default function Index() {
    const { t } = useTranslation();
    const { profitLoss, financialYear, isAudited, auth } = usePage<Props>().props;

    const urlParams    = new URLSearchParams(window.location.search);
    const [fromDate, setFromDate] = useState(urlParams.get('from_date') || profitLoss.from_date);
    const [toDate,   setToDate]   = useState(urlParams.get('to_date')   || profitLoss.to_date);
    const [selYear,  setSelYear]  = useState(urlParams.get('financial_year') || financialYear || String(new Date().getFullYear()));

    const handleGenerateByYear = (year: string) => {
        setSelYear(year);
        router.get(route('double-entry.profit-loss.index'), { financial_year: year }, {
            preserveState: true, replace: true
        });
    };

    const handleGenerateByDates = () => {
        if (!fromDate || !toDate) return;
        router.get(route('double-entry.profit-loss.index'), {
            from_date: fromDate, to_date: toDate
        }, { preserveState: true, replace: true });
    };

    const priorYear = profitLoss.prior_year;

    // Render a single IPSAS section (Revenue or Expenses) with optional prior-year column
    const renderIpsasSection = (
        groups: IpsasGroup[],
        sectionLabel: string,
        sectionTotal: number,
        priorGroups?: IpsasGroup[],
        priorTotal?: number
    ) => {
        const priorByLabel = Object.fromEntries((priorGroups ?? []).map(g => [g.label, g]));

        return (
            <div>
                <h3 className="text-lg font-bold text-gray-800 mb-3 uppercase tracking-wide border-b-2 border-gray-300 pb-1">
                    {sectionLabel}
                </h3>

                {groups.length > 0 ? (
                    groups.map((group) => {
                        const prior = priorByLabel[group.label];
                        return (
                            <div key={group.label} className="mb-4">
                                <p className="text-xs font-semibold text-gray-500 uppercase mb-1">{t(group.label)}</p>
                                {group.accounts.map((acc) => (
                                    <div key={acc.id} className="flex justify-between items-center py-1 border-b border-gray-100 text-sm pl-3">
                                        <span className="text-gray-700">
                                            <span className="text-green-600 mr-1">{acc.account_code}</span>
                                            {acc.account_name}
                                        </span>
                                        <div className="flex gap-8 tabular-nums">
                                            <span className="font-medium w-28 text-right">{formatCurrency(acc.balance)}</span>
                                            {priorYear && (
                                                <span className="text-gray-400 w-28 text-right">—</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                <div className="flex justify-between py-1.5 font-semibold text-sm pl-3 border-b border-gray-300">
                                    <span className="text-gray-600">{t('Subtotal')}: {t(group.label)}</span>
                                    <div className="flex gap-8 tabular-nums">
                                        <span className="w-28 text-right">{formatCurrency(group.total)}</span>
                                        {priorYear && (
                                            <span className="text-gray-400 w-28 text-right">
                                                {prior ? formatCurrency(prior.total) : '—'}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <p className="text-center text-muted-foreground py-4 text-sm">{t('No accounts in this period')}</p>
                )}

                <div className="flex justify-between items-center pt-3 mt-2 border-t-2 border-gray-700 font-bold text-sm">
                    <span>{t('Total')} {sectionLabel}</span>
                    <div className="flex gap-8 tabular-nums">
                        <span className="w-28 text-right">{formatCurrency(sectionTotal)}</span>
                        {priorYear && (
                            <span className="text-gray-500 w-28 text-right">
                                {priorTotal !== undefined ? formatCurrency(priorTotal) : '—'}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <AuthenticatedLayout
            breadcrumbs={[
                { label: t('Double Entry') },
                { label: t('Statement of Financial Performance') }
            ]}
            pageTitle={t('Statement of Financial Performance')}
        >
            <Head title={t('Statement of Financial Performance')} />

            <div className="max-w-7xl mx-auto space-y-6">

                {/* Filter / Header Card */}
                <Card className="shadow-lg border-0 bg-gradient-to-r from-white to-gray-50">
                    <CardHeader className="pb-4">
                        <div className="flex items-center justify-between flex-wrap gap-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-blue-50 rounded-lg border flex items-center justify-center">
                                    <FileText className="w-5 h-5 text-blue-600" />
                                </div>
                                <div>
                                    <CardTitle className="text-xl">{t('Statement of Financial Performance')}</CardTitle>
                                    <p className="text-sm text-gray-600">
                                        {formatDate(profitLoss.from_date)} — {formatDate(profitLoss.to_date)}
                                        &nbsp;·&nbsp;
                                        <span className="text-gray-400">{t('Amounts in GHS')}</span>
                                        {!isAudited && (
                                            <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-800 border border-amber-300 font-semibold">
                                                {t('Unaudited')}
                                            </span>
                                        )}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-end gap-3 flex-wrap">
                                {/* Fiscal-year quick select */}
                                <div>
                                    <Label className="text-xs">{t('Fiscal Year')}</Label>
                                    <Select value={selYear} onValueChange={handleGenerateByYear}>
                                        <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {fiscalYearOptions().map(y => (
                                                <SelectItem key={y} value={y}>{y}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Custom date range */}
                                <div>
                                    <Label className="text-xs">{t('From Date')}</Label>
                                    <DatePicker value={fromDate} onChange={setFromDate} placeholder={t('Select from date')} />
                                </div>
                                <div>
                                    <Label className="text-xs">{t('To Date')}</Label>
                                    <DatePicker value={toDate} onChange={setToDate} placeholder={t('Select to date')} />
                                </div>
                                <Button onClick={handleGenerateByDates} disabled={!fromDate || !toDate} size="sm">
                                    <Search className="h-4 w-4 mr-2" />{t('Generate')}
                                </Button>

                                {auth.user?.permissions?.includes('print-profit-loss') && (
                                    <Button variant="outline" size="sm" onClick={() => {
                                        const url = route('double-entry.profit-loss.print')
                                            + `?financial_year=${selYear}&download=pdf`;
                                        window.open(url, '_blank');
                                    }}>
                                        <Printer className="h-4 w-4 mr-2" />{t('Download PDF')}
                                    </Button>
                                )}
                            </div>
                        </div>
                    </CardHeader>

                    {/* Summary tiles */}
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="text-center p-6 bg-gradient-to-br from-green-50 to-green-100 rounded-xl border border-green-200 shadow-sm">
                                <h4 className="font-semibold text-green-700 mb-2">{t('Total Revenue')}</h4>
                                <p className="text-3xl font-bold text-green-900 tabular-nums">
                                    {formatCurrency(profitLoss.total_revenue)}
                                </p>
                                {priorYear && (
                                    <p className="text-xs text-gray-500 mt-1">
                                        {t('Prior year')}: {formatCurrency(priorYear.total_revenue)}
                                    </p>
                                )}
                            </div>
                            <div className="text-center p-6 bg-gradient-to-br from-red-50 to-red-100 rounded-xl border border-red-200 shadow-sm">
                                <h4 className="font-semibold text-red-700 mb-2">{t('Total Expenses')}</h4>
                                <p className="text-3xl font-bold text-red-900 tabular-nums">
                                    {formatCurrency(profitLoss.total_expenses)}
                                </p>
                                {priorYear && (
                                    <p className="text-xs text-gray-500 mt-1">
                                        {t('Prior year')}: {formatCurrency(priorYear.total_expenses)}
                                    </p>
                                )}
                            </div>
                            <div className={`text-center p-6 rounded-xl border shadow-sm ${
                                profitLoss.net_surplus >= 0
                                    ? 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200'
                                    : 'bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200'
                            }`}>
                                <h4 className={`font-semibold mb-2 ${profitLoss.net_surplus >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
                                    {profitLoss.net_surplus >= 0 ? t('Surplus for the Year') : t('Deficit for the Year')}
                                </h4>
                                <p className={`text-3xl font-bold tabular-nums ${profitLoss.net_surplus >= 0 ? 'text-blue-900' : 'text-orange-900'}`}>
                                    {formatCurrency(Math.abs(profitLoss.net_surplus))}
                                </p>
                                {priorYear && (
                                    <p className="text-xs text-gray-500 mt-1">
                                        {t('Prior year')}: {formatCurrency(Math.abs(priorYear.net_surplus))}
                                    </p>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Statement Body */}
                <Card className="shadow-lg border-0">
                    <CardContent className="p-8">
                        {/* Column headers when prior year available */}
                        {priorYear && (
                            <div className="flex justify-end gap-0 mb-4 text-xs font-semibold text-gray-500">
                                <span className="w-28 text-right mr-8">{t('Current Year')}</span>
                                <span className="w-28 text-right">{t('Prior Year')}</span>
                            </div>
                        )}

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                            {/* Revenue */}
                            {renderIpsasSection(
                                profitLoss.grouped_revenue ?? [],
                                t('REVENUE'),
                                profitLoss.total_revenue,
                                priorYear?.grouped_revenue,
                                priorYear?.total_revenue
                            )}

                            {/* Expenses */}
                            {renderIpsasSection(
                                profitLoss.grouped_expenses ?? [],
                                t('EXPENSES'),
                                profitLoss.total_expenses,
                                priorYear?.grouped_expenses,
                                priorYear?.total_expenses
                            )}
                        </div>

                        {/* Surplus / (Deficit) for the Year */}
                        <div className="mt-8 pt-6 border-t-4 border-gray-800">
                            <div className="flex justify-between items-center font-bold text-base">
                                <h3>
                                    {profitLoss.net_surplus >= 0
                                        ? t('Surplus for the Year')
                                        : t('(Deficit) for the Year)')}
                                </h3>
                                <div className="flex gap-8 tabular-nums">
                                    <span className={`w-28 text-right text-lg ${profitLoss.net_surplus >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                                        {profitLoss.net_surplus < 0 && '('}
                                        {formatCurrency(Math.abs(profitLoss.net_surplus))}
                                        {profitLoss.net_surplus < 0 && ')'}
                                    </span>
                                    {priorYear && (
                                        <span className={`w-28 text-right text-lg text-gray-500`}>
                                            {priorYear.net_surplus < 0 && '('}
                                            {formatCurrency(Math.abs(priorYear.net_surplus))}
                                            {priorYear.net_surplus < 0 && ')'}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </AuthenticatedLayout>
    );
}
