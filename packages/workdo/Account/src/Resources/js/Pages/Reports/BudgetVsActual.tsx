import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Printer } from 'lucide-react';

const fmt = (n: number) => Number(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface BudgetLine {
    category: string;
    budget_name: string;
    description: string;
    budget_amount: number;
    actual_amount: number;
    variance: number;
    variance_pct: number | null;
    rag: 'green' | 'amber' | 'red' | 'grey';
}

interface BudgetData {
    from_date: string;
    to_date: string;
    report: BudgetLine[];
    total_budget: number;
    total_actual: number;
    total_variance: number;
}

const RAGBadge = ({ rag }: { rag: string }) => {
    const styles: Record<string, string> = {
        green: 'bg-green-100 text-green-800',
        amber: 'bg-amber-100 text-amber-800',
        red:   'bg-red-100 text-red-800',
        grey:  'bg-gray-100 text-gray-600',
    };
    const labels: Record<string, string> = { green: '✓ On Track', amber: '⚠ Slight Overrun', red: '✗ Overrun', grey: '— N/A' };
    return <span className={`text-xs px-2 py-0.5 rounded-full ${styles[rag] || styles.grey}`}>{labels[rag] || '—'}</span>;
};

export default function BudgetVsActual({ financialYear }: { financialYear?: { year_start_date: string; year_end_date: string } }) {
    const { t } = useTranslation();
    const [fromDate, setFromDate] = useState(financialYear?.year_start_date || new Date().getFullYear() + '-01-01');
    const [toDate, setToDate]     = useState(financialYear?.year_end_date   || new Date().getFullYear() + '-12-31');
    const [data, setData]         = useState<BudgetData | null>(null);
    const [loading, setLoading]   = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res  = await fetch(route('account.reports.budget-vs-actual') + `?from_date=${fromDate}&to_date=${toDate}`);
            const json = await res.json();
            setData(json);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-end gap-3">
                <div>
                    <Label>{t('From')}</Label>
                    <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="w-40" />
                </div>
                <div>
                    <Label>{t('To')}</Label>
                    <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="w-40" />
                </div>
                <Button onClick={fetchData} disabled={loading}>{loading ? t('Loading...') : t('Generate')}</Button>
                {data && (
                    <Button variant="outline" onClick={() => window.open(route('account.reports.budget-vs-actual.print') + `?from_date=${fromDate}&to_date=${toDate}`, '_blank')}>
                        <Printer className="h-4 w-4 mr-1" />{t('Print')}
                    </Button>
                )}
            </div>

            {data && (
                <div>
                    <h2 className="text-center text-lg font-bold mb-1">{t('Budget vs Actual Report')}</h2>
                    <p className="text-center text-sm text-gray-500 mb-4">{data.from_date} — {data.to_date}</p>

                    <div className="overflow-x-auto rounded border">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-800 text-white">
                                <tr>
                                    <th className="text-left px-4 py-2">{t('Category')}</th>
                                    <th className="text-left px-4 py-2">{t('Budget')}</th>
                                    <th className="text-right px-4 py-2">{t('Budget (GHS)')}</th>
                                    <th className="text-right px-4 py-2">{t('Actual (GHS)')}</th>
                                    <th className="text-right px-4 py-2">{t('Variance (GHS)')}</th>
                                    <th className="text-right px-4 py-2">{t('Var %')}</th>
                                    <th className="text-center px-4 py-2">{t('Status')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.report.length === 0 ? (
                                    <tr><td colSpan={7} className="text-center py-6 text-gray-400">{t('No budget data found. Ensure Budget Planner module has data.')}</td></tr>
                                ) : data.report.map((row: BudgetLine, i: number) => (
                                    <tr key={i} className={`border-b hover:bg-gray-50 ${row.rag === 'red' ? 'bg-red-50/30' : row.rag === 'amber' ? 'bg-amber-50/30' : ''}`}>
                                        <td className="px-4 py-2 font-medium">{row.category}</td>
                                        <td className="px-4 py-2 text-xs text-gray-500">{row.budget_name}</td>
                                        <td className="px-4 py-2 text-right font-mono">{fmt(row.budget_amount)}</td>
                                        <td className="px-4 py-2 text-right font-mono">{fmt(row.actual_amount)}</td>
                                        <td className={`px-4 py-2 text-right font-mono font-semibold ${row.variance >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                                            {row.variance >= 0 ? '' : '('}{fmt(Math.abs(row.variance))}{row.variance < 0 ? ')' : ''}
                                        </td>
                                        <td className={`px-4 py-2 text-right ${row.variance_pct !== null && row.variance_pct < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                            {row.variance_pct !== null ? `${row.variance_pct}%` : '—'}
                                        </td>
                                        <td className="px-4 py-2 text-center"><RAGBadge rag={row.rag} /></td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-gray-100 font-bold border-t-2">
                                <tr>
                                    <td colSpan={2} className="px-4 py-2">{t('TOTALS')}</td>
                                    <td className="px-4 py-2 text-right font-mono">{fmt(data.total_budget)}</td>
                                    <td className="px-4 py-2 text-right font-mono">{fmt(data.total_actual)}</td>
                                    <td className={`px-4 py-2 text-right font-mono ${data.total_variance >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                                        {data.total_variance >= 0 ? '' : '('}{fmt(Math.abs(data.total_variance))}{data.total_variance < 0 ? ')' : ''}
                                    </td>
                                    <td colSpan={2}></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    <div className="flex gap-4 mt-3 text-xs text-gray-600">
                        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-green-400" />{t('On Track (variance ≥ 0)')}</span>
                        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-amber-400" />{t('Slight Overrun (−10% to 0%)')}</span>
                        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-red-400" />{t('Overrun (< −10%)')}</span>
                    </div>
                </div>
            )}
        </div>
    );
}
