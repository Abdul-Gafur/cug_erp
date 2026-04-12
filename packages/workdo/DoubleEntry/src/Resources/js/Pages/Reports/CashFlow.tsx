import { useState, useEffect } from 'react';
import { usePage } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { Printer, FileText } from 'lucide-react';
import { formatCurrency } from '@/utils/helpers';
import NoRecordsFound from '@/components/no-records-found';
import axios from 'axios';

interface CashFlowData {
    // IPSAS 2 direct-method fields
    opening_cash:        number;
    operating_receipts:  number;
    operating_payments:  number;
    net_operating:       number;
    investing_inflows:   number;
    investing_outflows:  number;
    net_investing:       number;
    financing_inflows:   number;
    financing_outflows:  number;
    net_financing:       number;
    net_movement:        number;
    closing_cash:        number;
    from_date:           string;
    to_date:             string;
    financial_year?:     string;
    is_audited?:         boolean;
    prior_year?:         CashFlowData | null;
}

interface CashFlowProps {
    financialYear?: { year_start_date: string; year_end_date: string };
}

function fiscalYearOptions(): string[] {
    const current = new Date().getFullYear();
    const years: string[] = [];
    for (let y = current + 1; y >= current - 5; y--) years.push(String(y));
    return years;
}

// A single row with optional prior-year column
function Row({ label, value, priorValue, indent = false, bold = false, borderTop = false }: {
    label: string; value: number; priorValue?: number;
    indent?: boolean; bold?: boolean; borderTop?: boolean;
}) {
    const cls = `flex justify-between py-${bold ? 3 : 1.5} ${borderTop ? 'border-t-2 border-gray-700' : 'border-b border-gray-100'} text-sm`;
    const labelCls = `${bold ? 'font-bold' : 'font-medium'} ${indent ? 'pl-6' : ''}`;
    return (
        <div className={cls}>
            <span className={labelCls}>{label}</span>
            <div className="flex gap-8 tabular-nums">
                <span className={`w-32 text-right ${bold ? 'font-bold' : ''}`}>{formatCurrency(value)}</span>
                {priorValue !== undefined && (
                    <span className="w-32 text-right text-gray-400">{formatCurrency(priorValue)}</span>
                )}
            </div>
        </div>
    );
}

export default function CashFlow({ financialYear }: CashFlowProps) {
    const { t }  = useTranslation();
    const { auth } = usePage<any>().props;

    const currentYear = String(new Date().getFullYear());
    const [selYear,  setSelYear]  = useState(currentYear);
    const [fromDate, setFromDate] = useState(financialYear?.year_start_date || `${currentYear}-01-01`);
    const [toDate,   setToDate]   = useState(financialYear?.year_end_date   || `${currentYear}-12-31`);
    const [data,    setData]    = useState<CashFlowData | null>(null);
    const [loading, setLoading] = useState(false);

    const fetchByYear = async (year: string) => {
        setLoading(true);
        try {
            const res = await axios.get(route('double-entry.reports.cash-flow'), {
                params: { financial_year: year }
            });
            setData(res.data);
        } catch (e) {
            console.error('Error fetching cash flow:', e);
        } finally {
            setLoading(false);
        }
    };

    const fetchByDates = async () => {
        setLoading(true);
        try {
            const res = await axios.get(route('double-entry.reports.cash-flow'), {
                params: { from_date: fromDate, to_date: toDate }
            });
            setData(res.data);
        } catch (e) {
            console.error('Error fetching cash flow:', e);
        } finally {
            setLoading(false);
        }
    };

    const handleYearChange = (year: string) => {
        setSelYear(year);
        setFromDate(`${year}-01-01`);
        setToDate(`${year}-12-31`);
        fetchByYear(year);
    };

    useEffect(() => { fetchByYear(currentYear); }, []);

    const handleDownloadPDF = () => {
        const url = route('double-entry.reports.cash-flow.print') +
            `?financial_year=${selYear}&download=pdf`;
        window.open(url, '_blank');
    };

    const prior = data?.prior_year ?? null;

    return (
        <Card className="shadow-sm">
            {/* Filters */}
            <CardContent className="p-6 border-b bg-gray-50/50">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">{t('Fiscal Year')}</label>
                        <Select value={selYear} onValueChange={handleYearChange}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {fiscalYearOptions().map(y => (
                                    <SelectItem key={y} value={y}>{y}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">{t('From Date')}</label>
                        <DatePicker value={fromDate} onChange={setFromDate} placeholder={t('Select from date')} />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">{t('To Date')}</label>
                        <DatePicker value={toDate} onChange={setToDate} placeholder={t('Select to date')} />
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={fetchByDates} disabled={loading} size="sm">
                            {loading ? t('Loading…') : t('Generate')}
                        </Button>
                        {data && auth.user?.permissions?.includes('print-cash-flow') && (
                            <Button variant="outline" size="sm" onClick={handleDownloadPDF} className="gap-1">
                                <Printer className="h-4 w-4" />{t('PDF')}
                            </Button>
                        )}
                    </div>
                </div>
            </CardContent>

            <CardContent className="p-0">
                {data ? (
                    <>
                        {/* Summary tiles */}
                        <div className="p-4 bg-gray-50 border-b">
                            <div className="grid grid-cols-3 gap-4">
                                <div className="text-center p-4 bg-white rounded-lg border">
                                    <p className="text-xs font-medium text-gray-600 mb-1">{t('Opening Cash Balance')}</p>
                                    <p className="text-lg font-bold tabular-nums">{formatCurrency(data.opening_cash)}</p>
                                    {prior && <p className="text-xs text-gray-400 mt-1">{t('Prior')}: {formatCurrency(prior.opening_cash)}</p>}
                                </div>
                                <div className="text-center p-4 bg-white rounded-lg border">
                                    <p className="text-xs font-medium text-gray-600 mb-1">{t('Net Movement in Cash')}</p>
                                    <p className={`text-lg font-bold tabular-nums ${data.net_movement >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                                        {formatCurrency(data.net_movement)}
                                    </p>
                                    {prior && <p className="text-xs text-gray-400 mt-1">{t('Prior')}: {formatCurrency(prior.net_movement)}</p>}
                                </div>
                                <div className="text-center p-4 bg-white rounded-lg border">
                                    <p className="text-xs font-medium text-gray-600 mb-1">{t('Closing Cash Balance')}</p>
                                    <p className="text-lg font-bold tabular-nums">{formatCurrency(data.closing_cash)}</p>
                                    {prior && <p className="text-xs text-gray-400 mt-1">{t('Prior')}: {formatCurrency(prior.closing_cash)}</p>}
                                </div>
                            </div>

                            {/* Unaudited badge */}
                            {data.is_audited === false && (
                                <div className="mt-3 flex justify-end">
                                    <span className="px-2 py-0.5 text-xs rounded border border-amber-400 text-amber-700 bg-amber-50 font-semibold">
                                        {t('Unaudited')}
                                    </span>
                                </div>
                            )}

                            {/* Prior-year column header */}
                            {prior && (
                                <div className="flex justify-end mt-3 text-xs font-semibold text-gray-500 gap-8 pr-4">
                                    <span className="w-32 text-right">{data.financial_year ?? selYear}</span>
                                    <span className="w-32 text-right">{String(Number(selYear) - 1)}</span>
                                </div>
                            )}
                        </div>

                        {/* Statement body */}
                        <div className="p-6 space-y-6">

                            {/* Opening balance */}
                            <Row label={t('Opening Cash & Bank Balances')} value={data.opening_cash}
                                priorValue={prior?.opening_cash} bold borderTop />

                            {/* Operating Activities */}
                            <div>
                                <h4 className="font-bold text-sm mb-2 uppercase tracking-wide text-gray-700">
                                    {t('Cash Flows from Operating Activities')}
                                </h4>
                                <Row label={t('Receipts from government grants, fees & other income')}
                                    value={data.operating_receipts} priorValue={prior?.operating_receipts} indent />
                                <Row label={t('Payments to employees, suppliers & other operating costs')}
                                    value={-data.operating_payments}
                                    priorValue={prior ? -prior.operating_payments : undefined} indent />
                                <Row label={t('Net Cash from Operating Activities')}
                                    value={data.net_operating} priorValue={prior?.net_operating} bold borderTop />
                            </div>

                            {/* Investing Activities */}
                            <div>
                                <h4 className="font-bold text-sm mb-2 uppercase tracking-wide text-gray-700">
                                    {t('Cash Flows from Investing Activities')}
                                </h4>
                                <Row label={t('Proceeds from disposal of assets / investments')}
                                    value={data.investing_inflows} priorValue={prior?.investing_inflows} indent />
                                <Row label={t('Purchase of property, plant, equipment & investments')}
                                    value={-data.investing_outflows}
                                    priorValue={prior ? -prior.investing_outflows : undefined} indent />
                                <Row label={t('Net Cash from Investing Activities')}
                                    value={data.net_investing} priorValue={prior?.net_investing} bold borderTop />
                            </div>

                            {/* Financing Activities */}
                            <div>
                                <h4 className="font-bold text-sm mb-2 uppercase tracking-wide text-gray-700">
                                    {t('Cash Flows from Financing Activities')}
                                </h4>
                                <Row label={t('Proceeds from borrowings / endowments received')}
                                    value={data.financing_inflows} priorValue={prior?.financing_inflows} indent />
                                <Row label={t('Repayment of borrowings / other financing outflows')}
                                    value={-data.financing_outflows}
                                    priorValue={prior ? -prior.financing_outflows : undefined} indent />
                                <Row label={t('Net Cash from Financing Activities')}
                                    value={data.net_financing} priorValue={prior?.net_financing} bold borderTop />
                            </div>

                            {/* Net movement */}
                            <Row label={t('Net Increase / (Decrease) in Cash & Cash Equivalents')}
                                value={data.net_movement} priorValue={prior?.net_movement} bold borderTop />

                            {/* Opening + Net = Closing */}
                            <Row label={t('Cash & Cash Equivalents at Beginning of Period')}
                                value={data.opening_cash} priorValue={prior?.opening_cash} />

                            <div className={`flex justify-between py-3 border-t-4 border-gray-800 font-bold text-base`}>
                                <span>{t('Cash & Cash Equivalents at End of Period')}</span>
                                <div className="flex gap-8 tabular-nums">
                                    <span className="w-32 text-right">{formatCurrency(data.closing_cash)}</span>
                                    {prior && (
                                        <span className="w-32 text-right text-gray-500">{formatCurrency(prior.closing_cash)}</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    <NoRecordsFound
                        icon={FileText}
                        title={t('Cash Flow Statement')}
                        description={t('Select fiscal year or date range to generate the report')}
                        className="h-auto py-12"
                    />
                )}
            </CardContent>
        </Card>
    );
}
