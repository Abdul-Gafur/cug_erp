import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Printer } from 'lucide-react';

const fmt = (n: number) => Number(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface LineItem {
    account_code: string;
    account_name: string;
    category_type: string;
    net_amount: number;
}

interface PerformanceData {
    from_date: string;
    to_date: string;
    revenues: LineItem[];
    expenses: LineItem[];
    total_revenue: number;
    total_expenses: number;
    surplus_deficit: number;
}

export default function StatementOfPerformance({ financialYear }: { financialYear?: { year_start_date: string; year_end_date: string } }) {
    const { t } = useTranslation();
    const [fromDate, setFromDate] = useState(financialYear?.year_start_date || new Date().getFullYear() + '-01-01');
    const [toDate, setToDate]     = useState(financialYear?.year_end_date   || new Date().getFullYear() + '-12-31');
    const [data, setData]         = useState<PerformanceData | null>(null);
    const [loading, setLoading]   = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res  = await fetch(route('account.reports.statement-of-performance') + `?from_date=${fromDate}&to_date=${toDate}`);
            const json = await res.json();
            setData(json);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const Table = ({ title, items, total, color }: { title: string; items: LineItem[]; total: number; color: string }) => (
        <div className="mb-4">
            <div className={`${color} text-white px-4 py-2 font-bold text-sm rounded-t`}>{title}</div>
            <table className="w-full text-sm border border-t-0">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="text-left px-4 py-1.5 border-b">{t('Account')}</th>
                        <th className="text-right px-4 py-1.5 border-b">{t('GHS')}</th>
                    </tr>
                </thead>
                <tbody>
                    {items.length === 0
                        ? <tr><td colSpan={2} className="text-center py-3 text-gray-400">{t('No entries')}</td></tr>
                        : items.map((item, i) => (
                            <tr key={i} className="border-b hover:bg-gray-50">
                                <td className="px-4 py-1.5">{item.account_name}</td>
                                <td className="px-4 py-1.5 text-right font-mono">{fmt(Math.abs(Number(item.net_amount)))}</td>
                            </tr>
                        ))
                    }
                </tbody>
                <tfoot>
                    <tr className="bg-gray-100 font-bold border-t-2">
                        <td className="px-4 py-2">{t('Total')} {title}</td>
                        <td className="px-4 py-2 text-right font-mono">{fmt(Math.abs(total))}</td>
                    </tr>
                </tfoot>
            </table>
        </div>
    );

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
                    <Button variant="outline" onClick={() => window.open(route('account.reports.statement-of-performance.print') + `?from_date=${fromDate}&to_date=${toDate}`, '_blank')}>
                        <Printer className="h-4 w-4 mr-1" />{t('Print')}
                    </Button>
                )}
            </div>

            {data && (
                <div>
                    <h2 className="text-center text-lg font-bold mb-1">{t('Statement of Financial Performance')}</h2>
                    <p className="text-center text-sm text-gray-500 mb-4">{t('For the period')} {data.from_date} {t('to')} {data.to_date}</p>

                    <Table title={t('REVENUE')} items={data.revenues} total={data.total_revenue} color="bg-green-700" />
                    <Table title={t('EXPENDITURE')} items={data.expenses} total={data.total_expenses} color="bg-red-700" />

                    <div className={`rounded-lg p-4 flex justify-between items-center font-bold text-base ${data.surplus_deficit >= 0 ? 'bg-green-100 border border-green-300' : 'bg-red-100 border border-red-300'}`}>
                        <span className={data.surplus_deficit >= 0 ? 'text-green-800' : 'text-red-800'}>
                            {data.surplus_deficit >= 0 ? '📈 ' + t('Surplus for the Period') : '📉 ' + t('Deficit for the Period')}
                        </span>
                        <span className={`font-mono text-lg ${data.surplus_deficit >= 0 ? 'text-green-800' : 'text-red-800'}`}>
                            GHS {fmt(Math.abs(data.surplus_deficit))}
                        </span>
                    </div>

                    <p className="text-xs text-blue-600 mt-2">
                        <strong>IPSAS 1 Note:</strong> {t('Surplus/deficit represents the net change in net assets excluding transactions with owners. Prepared on accrual basis.')}
                    </p>
                </div>
            )}
        </div>
    );
}
