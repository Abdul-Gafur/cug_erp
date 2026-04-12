import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Printer, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';

const fmt = (n: number) => Number(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface Transaction {
    transaction_type: string;
    amount: number;
    description: string;
    transaction_date: string;
    reference_type: string;
    account_name: string;
}

interface CashFlowData {
    from_date: string;
    to_date: string;
    inflows: Transaction[];
    outflows: Transaction[];
    total_inflows: number;
    total_outflows: number;
    net_cash_flow: number;
}

export default function CashFlow({ financialYear }: { financialYear?: { year_start_date: string; year_end_date: string } }) {
    const { t } = useTranslation();
    const [fromDate, setFromDate] = useState(financialYear?.year_start_date || new Date().getFullYear() + '-01-01');
    const [toDate, setToDate]     = useState(financialYear?.year_end_date   || new Date().getFullYear() + '-12-31');
    const [data, setData]         = useState<CashFlowData | null>(null);
    const [loading, setLoading]   = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res  = await fetch(route('account.reports.cash-flow') + `?from_date=${fromDate}&to_date=${toDate}`);
            const json = await res.json();
            setData(json);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const FlowTable = ({ title, items, total, type }: { title: string; items: Transaction[]; total: number; type: 'in' | 'out' }) => (
        <div className="mb-4">
            <div className={`flex items-center gap-2 px-4 py-2 font-bold text-sm rounded-t text-white ${type === 'in' ? 'bg-green-700' : 'bg-red-700'}`}>
                {type === 'in' ? <ArrowUpCircle className="h-4 w-4" /> : <ArrowDownCircle className="h-4 w-4" />}
                {title}
            </div>
            <table className="w-full text-sm border border-t-0">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="text-left px-4 py-1.5 border-b">{t('Date')}</th>
                        <th className="text-left px-4 py-1.5 border-b">{t('Description')}</th>
                        <th className="text-left px-4 py-1.5 border-b">{t('Account')}</th>
                        <th className="text-right px-4 py-1.5 border-b">{t('GHS')}</th>
                    </tr>
                </thead>
                <tbody>
                    {items.length === 0
                        ? <tr><td colSpan={4} className="text-center py-3 text-gray-400">{t('No transactions')}</td></tr>
                        : items.map((tx, i) => (
                            <tr key={i} className="border-b hover:bg-gray-50">
                                <td className="px-4 py-1.5 text-xs text-gray-500">{tx.transaction_date}</td>
                                <td className="px-4 py-1.5">{tx.description || tx.reference_type}</td>
                                <td className="px-4 py-1.5 text-xs text-gray-500">{tx.account_name}</td>
                                <td className="px-4 py-1.5 text-right font-mono">{fmt(Number(tx.amount))}</td>
                            </tr>
                        ))
                    }
                </tbody>
                <tfoot>
                    <tr className="bg-gray-100 font-bold border-t-2">
                        <td colSpan={3} className="px-4 py-2 text-right">{t('Total')} {title}</td>
                        <td className="px-4 py-2 text-right font-mono">{fmt(total)}</td>
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
                    <Button variant="outline" onClick={() => window.open(route('account.reports.cash-flow.print') + `?from_date=${fromDate}&to_date=${toDate}`, '_blank')}>
                        <Printer className="h-4 w-4 mr-1" />{t('Print')}
                    </Button>
                )}
            </div>

            {data && (
                <div>
                    <h2 className="text-center text-lg font-bold mb-1">{t('Cash Flow Statement')}</h2>
                    <p className="text-center text-sm text-gray-500 mb-4">{data.from_date} — {data.to_date}</p>

                    <FlowTable title={t('Cash Inflows')} items={data.inflows} total={data.total_inflows} type="in" />
                    <FlowTable title={t('Cash Outflows')} items={data.outflows} total={data.total_outflows} type="out" />

                    <div className={`rounded-lg p-4 flex justify-between items-center font-bold text-base border ${data.net_cash_flow >= 0 ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'}`}>
                        <span className={data.net_cash_flow >= 0 ? 'text-green-800' : 'text-red-800'}>
                            {t('Net Cash')} {data.net_cash_flow >= 0 ? t('Inflow') : t('Outflow')}
                        </span>
                        <span className={`font-mono text-lg ${data.net_cash_flow >= 0 ? 'text-green-800' : 'text-red-800'}`}>
                            {data.net_cash_flow < 0 && '('}GHS {fmt(Math.abs(data.net_cash_flow))}{data.net_cash_flow < 0 && ')'}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}
