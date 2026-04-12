import { Head } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import AuthenticatedLayout from '@/layouts/authenticated-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Landmark, Wallet, ShoppingCart, AlertTriangle, Clock,
    TrendingUp, TrendingDown, Building2, CheckCircle,
} from 'lucide-react';
import { formatCurrency } from '@/utils/helpers';

// ── Types ─────────────────────────────────────────────────────────────────────

interface FundRow {
    fund: string;
    approved: number;
    committed: number;
    actual: number;
    available: number;
}

interface BudgetPosition {
    approved: number;
    committed: number;
    actual: number;
    available: number;
    by_fund: FundRow[];
}

interface BankRow {
    account_name: string;
    bank_name: string;
    account_number: string;
    balance: number;
}

interface ProcStatus {
    count: number;
    value: number;
}

interface ProcurementStatus {
    open_lpos: ProcStatus;
    pending_match: ProcStatus;
    awaiting_payment: ProcStatus;
    overdue_payments: ProcStatus;
}

interface Performance {
    revenue_ytd: number;
    revenue_prior_ytd: number;
    expenditure_ytd: number;
    approved_budget: number;
    surplus_deficit: number;
}

interface FiscalPeriod {
    name: string;
    start_date: string;
    end_date: string;
}

interface Props {
    budgetPosition: BudgetPosition;
    bankAccounts: BankRow[];
    totalCashAndBank: number;
    procurementStatus: ProcurementStatus;
    performance: Performance;
    fiscalPeriod: FiscalPeriod | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function pct(part: number, whole: number): string {
    if (!whole) return '0%';
    return ((part / whole) * 100).toFixed(1) + '%';
}

function SurplusDeficitBadge({ value }: { value: number }) {
    const positive = value >= 0;
    return (
        <span className={`inline-flex items-center gap-1 text-sm font-semibold ${positive ? 'text-emerald-700' : 'text-red-700'}`}>
            {positive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            {positive ? '' : '('}
            {formatCurrency(Math.abs(value))}
            {positive ? '' : ')'}
        </span>
    );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function CompanyDashboard({
    budgetPosition,
    bankAccounts,
    totalCashAndBank,
    procurementStatus,
    performance,
    fiscalPeriod,
}: Props) {
    const { t } = useTranslation();

    const budgetUtilisationPct = budgetPosition.approved
        ? ((budgetPosition.actual / budgetPosition.approved) * 100).toFixed(1)
        : '0';

    const revenueGrowth = performance.revenue_prior_ytd
        ? (((performance.revenue_ytd - performance.revenue_prior_ytd) / performance.revenue_prior_ytd) * 100).toFixed(1)
        : null;

    return (
        <AuthenticatedLayout
            breadcrumbs={[{ label: t('Finance Dashboard') }]}
            pageTitle={t('University Finance Dashboard')}
            pageTitleClass="text-lg"
        >
            <Head title={t('Finance Dashboard')} />

            {/* ── Fiscal period banner ─────────────────────────────────────── */}
            {fiscalPeriod && (
                <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-800">
                    {t('Active Fiscal Period')}: <strong>{fiscalPeriod.name}</strong>
                    &nbsp;({fiscalPeriod.start_date} – {fiscalPeriod.end_date})
                </div>
            )}
            {!fiscalPeriod && (
                <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
                    {t('No active fiscal period. Budget data will be zero until a period is activated.')}
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════ */}
            {/* SECTION 1 — BUDGET POSITION                                   */}
            {/* ══════════════════════════════════════════════════════════════ */}
            <div className="mb-2 mt-4 text-xs font-semibold uppercase tracking-widest text-gray-500">
                {t('Budget Position — Current Fiscal Year')}
            </div>

            {/* Summary KPI row */}
            <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4">
                <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-blue-100">
                    <CardHeader className="flex flex-row items-center justify-between pb-1">
                        <CardTitle className="text-xs font-medium text-blue-700">{t('Approved Budget')}</CardTitle>
                        <Landmark className="h-5 w-5 text-blue-600 opacity-70" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-xl font-bold text-blue-800">{formatCurrency(budgetPosition.approved)}</div>
                    </CardContent>
                </Card>

                <Card className="border-amber-200 bg-gradient-to-r from-amber-50 to-amber-100">
                    <CardHeader className="flex flex-row items-center justify-between pb-1">
                        <CardTitle className="text-xs font-medium text-amber-700">{t('Total Committed')}</CardTitle>
                        <ShoppingCart className="h-5 w-5 text-amber-600 opacity-70" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-xl font-bold text-amber-800">{formatCurrency(budgetPosition.committed)}</div>
                        <p className="text-xs text-amber-700 opacity-80">{pct(budgetPosition.committed, budgetPosition.approved)} {t('of budget')}</p>
                    </CardContent>
                </Card>

                <Card className="border-rose-200 bg-gradient-to-r from-rose-50 to-rose-100">
                    <CardHeader className="flex flex-row items-center justify-between pb-1">
                        <CardTitle className="text-xs font-medium text-rose-700">{t('Total Actual Expenditure')}</CardTitle>
                        <TrendingDown className="h-5 w-5 text-rose-600 opacity-70" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-xl font-bold text-rose-800">{formatCurrency(budgetPosition.actual)}</div>
                        <p className="text-xs text-rose-700 opacity-80">{budgetUtilisationPct}% {t('utilised')}</p>
                    </CardContent>
                </Card>

                <Card className="border-emerald-200 bg-gradient-to-r from-emerald-50 to-emerald-100">
                    <CardHeader className="flex flex-row items-center justify-between pb-1">
                        <CardTitle className="text-xs font-medium text-emerald-700">{t('Available Balance')}</CardTitle>
                        <CheckCircle className="h-5 w-5 text-emerald-600 opacity-70" />
                    </CardHeader>
                    <CardContent>
                        <div className={`text-xl font-bold ${budgetPosition.available < 0 ? 'text-red-700' : 'text-emerald-800'}`}>
                            {formatCurrency(budgetPosition.available)}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* By-Fund breakdown */}
            {budgetPosition.by_fund.length > 0 && (
                <Card className="mb-6">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm">{t('Budget by Fund')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b text-xs text-gray-500 uppercase">
                                        <th className="pb-2 text-left">{t('Fund')}</th>
                                        <th className="pb-2 text-right">{t('Approved')}</th>
                                        <th className="pb-2 text-right">{t('Committed')}</th>
                                        <th className="pb-2 text-right">{t('Actual')}</th>
                                        <th className="pb-2 text-right">{t('Available')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {budgetPosition.by_fund.map((row) => (
                                        <tr key={row.fund} className="border-b last:border-0">
                                            <td className="py-2 font-medium">{row.fund}</td>
                                            <td className="py-2 text-right">{formatCurrency(row.approved)}</td>
                                            <td className="py-2 text-right text-amber-700">{formatCurrency(row.committed)}</td>
                                            <td className="py-2 text-right text-rose-700">{formatCurrency(row.actual)}</td>
                                            <td className={`py-2 text-right font-semibold ${row.available < 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                                                {formatCurrency(row.available)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* ══════════════════════════════════════════════════════════════ */}
            {/* SECTIONS 2 & 3 — CASH/BANK + PROCUREMENT (two-col)           */}
            {/* ══════════════════════════════════════════════════════════════ */}
            <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">

                {/* CASH & BANK */}
                <div>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-500">
                        {t('Cash & Bank')}
                    </div>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm">{t('Bank Account Balances')}</CardTitle>
                            <Wallet className="h-5 w-5 text-gray-400" />
                        </CardHeader>
                        <CardContent>
                            {bankAccounts.length === 0 ? (
                                <p className="text-sm text-gray-500">{t('No bank accounts configured.')}</p>
                            ) : (
                                <div className="space-y-3">
                                    {bankAccounts.map((b, i) => (
                                        <div key={i} className="flex items-center justify-between rounded-md border px-3 py-2">
                                            <div>
                                                <p className="text-sm font-medium">{b.account_name}</p>
                                                <p className="text-xs text-gray-500">{b.bank_name} · {b.account_number}</p>
                                            </div>
                                            <span className={`text-sm font-bold ${b.balance < 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                                                {formatCurrency(b.balance)}
                                            </span>
                                        </div>
                                    ))}
                                    <div className="flex items-center justify-between border-t pt-3">
                                        <span className="text-sm font-semibold">{t('Total Cash & Bank')}</span>
                                        <span className={`text-base font-bold ${totalCashAndBank < 0 ? 'text-red-700' : 'text-blue-700'}`}>
                                            {formatCurrency(totalCashAndBank)}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* PROCUREMENT STATUS */}
                <div>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-500">
                        {t('Procurement Status')}
                    </div>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm">{t('Open Items')}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {/* Open LPOs awaiting GRN */}
                            <div className="flex items-start justify-between rounded-md border px-3 py-2">
                                <div className="flex items-center gap-2">
                                    <Building2 className="h-4 w-4 text-blue-600" />
                                    <div>
                                        <p className="text-sm font-medium">{t('Open LPOs Awaiting GRN')}</p>
                                        <p className="text-xs text-gray-500">{procurementStatus.open_lpos.count} {t('orders')}</p>
                                    </div>
                                </div>
                                <span className="text-sm font-bold text-blue-700">
                                    {formatCurrency(procurementStatus.open_lpos.value)}
                                </span>
                            </div>

                            {/* Pending match */}
                            <div className="flex items-start justify-between rounded-md border px-3 py-2">
                                <div className="flex items-center gap-2">
                                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                                    <div>
                                        <p className="text-sm font-medium">{t('Invoices Pending Three-Way Match')}</p>
                                        <p className="text-xs text-gray-500">{procurementStatus.pending_match.count} {t('invoices')}</p>
                                    </div>
                                </div>
                                <span className="text-sm font-bold text-amber-700">
                                    {formatCurrency(procurementStatus.pending_match.value)}
                                </span>
                            </div>

                            {/* Awaiting payment */}
                            <div className="flex items-start justify-between rounded-md border px-3 py-2">
                                <div className="flex items-center gap-2">
                                    <Clock className="h-4 w-4 text-gray-500" />
                                    <div>
                                        <p className="text-sm font-medium">{t('Approved Invoices Awaiting Payment')}</p>
                                        <p className="text-xs text-gray-500">{procurementStatus.awaiting_payment.count} {t('invoices')} ({t('AP outstanding')})</p>
                                    </div>
                                </div>
                                <span className="text-sm font-bold text-gray-700">
                                    {formatCurrency(procurementStatus.awaiting_payment.value)}
                                </span>
                            </div>

                            {/* Overdue */}
                            <div className={`flex items-start justify-between rounded-md border px-3 py-2 ${procurementStatus.overdue_payments.count > 0 ? 'border-red-300 bg-red-50' : ''}`}>
                                <div className="flex items-center gap-2">
                                    <AlertTriangle className={`h-4 w-4 ${procurementStatus.overdue_payments.count > 0 ? 'text-red-600' : 'text-gray-400'}`} />
                                    <div>
                                        <p className="text-sm font-medium">{t('Overdue Payments')}</p>
                                        <p className="text-xs text-gray-500">{procurementStatus.overdue_payments.count} {t('past due date')}</p>
                                    </div>
                                </div>
                                <span className={`text-sm font-bold ${procurementStatus.overdue_payments.count > 0 ? 'text-red-700' : 'text-gray-500'}`}>
                                    {formatCurrency(procurementStatus.overdue_payments.value)}
                                </span>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* ══════════════════════════════════════════════════════════════ */}
            {/* SECTION 4 — FINANCIAL PERFORMANCE YTD                        */}
            {/* ══════════════════════════════════════════════════════════════ */}
            <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-500">
                {t('Financial Performance — Year to Date')}
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">

                {/* Revenue */}
                <Card className="border-green-200 bg-gradient-to-r from-green-50 to-green-100">
                    <CardHeader className="flex flex-row items-center justify-between pb-1">
                        <CardTitle className="text-xs font-medium text-green-700">{t('Total Income Recognised')}</CardTitle>
                        <TrendingUp className="h-5 w-5 text-green-600 opacity-70" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-xl font-bold text-green-800">{formatCurrency(performance.revenue_ytd)}</div>
                        {revenueGrowth !== null && (
                            <p className={`text-xs mt-1 ${parseFloat(revenueGrowth) >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                                {parseFloat(revenueGrowth) >= 0 ? '+' : ''}{revenueGrowth}% {t('vs same period last year')}
                            </p>
                        )}
                        {revenueGrowth === null && (
                            <p className="text-xs mt-1 text-gray-500">{t('No prior-year data')}</p>
                        )}
                    </CardContent>
                </Card>

                {/* Expenditure vs Budget */}
                <Card className="border-rose-200 bg-gradient-to-r from-rose-50 to-rose-100">
                    <CardHeader className="flex flex-row items-center justify-between pb-1">
                        <CardTitle className="text-xs font-medium text-rose-700">{t('Total Expenditure')}</CardTitle>
                        <TrendingDown className="h-5 w-5 text-rose-600 opacity-70" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-xl font-bold text-rose-800">{formatCurrency(performance.expenditure_ytd)}</div>
                        {performance.approved_budget > 0 && (
                            <p className="text-xs mt-1 text-rose-700">
                                {pct(performance.expenditure_ytd, performance.approved_budget)} {t('of approved budget')}
                            </p>
                        )}
                    </CardContent>
                </Card>

                {/* Surplus / (Deficit) */}
                <Card className={`border ${performance.surplus_deficit >= 0 ? 'border-emerald-200 bg-gradient-to-r from-emerald-50 to-emerald-100' : 'border-red-200 bg-gradient-to-r from-red-50 to-red-100'}`}>
                    <CardHeader className="flex flex-row items-center justify-between pb-1">
                        <CardTitle className={`text-xs font-medium ${performance.surplus_deficit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                            {performance.surplus_deficit >= 0 ? t('Surplus') : t('Deficit')} {t('Year to Date')}
                        </CardTitle>
                        {performance.surplus_deficit >= 0
                            ? <TrendingUp className="h-5 w-5 text-emerald-600 opacity-70" />
                            : <TrendingDown className="h-5 w-5 text-red-600 opacity-70" />
                        }
                    </CardHeader>
                    <CardContent>
                        <div className="text-xl font-bold">
                            <SurplusDeficitBadge value={performance.surplus_deficit} />
                        </div>
                        <p className="text-xs mt-1 text-gray-500">{t('Income − Expenditure')}</p>
                    </CardContent>
                </Card>
            </div>
        </AuthenticatedLayout>
    );
}
