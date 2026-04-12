import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TrendingUp, TrendingDown, Printer } from 'lucide-react';

const fmt = (n: number) => Number(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface AccountLine {
    account_code: string;
    account_name: string;
    category_type: string;
    net_balance: number;
}

interface StatementData {
    as_of_date: string;
    assets: AccountLine[];
    liabilities: AccountLine[];
    equity: AccountLine[];
    total_assets: number;
    total_liabilities: number;
    total_equity: number;
    net_position: number;
}

export default function StatementOfPosition({ financialYear }: { financialYear?: { year_start_date: string; year_end_date: string } }) {
    const { t } = useTranslation();
    const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);
    const [data, setData] = useState<StatementData | null>(null);
    const [loading, setLoading] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch(route('account.reports.statement-of-position') + `?as_of_date=${asOfDate}`);
            const json = await res.json();
            setData(json);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const Section = ({ title, items, isDebit, total }: { title: string; items: AccountLine[]; isDebit: boolean; total: number }) => (
        <div className="mb-4">
            <div className="bg-gray-800 text-white px-4 py-2 font-bold text-sm rounded-t">{title}</div>
            <table className="w-full text-sm border border-t-0">
                <thead className="bg-gray-100">
                    <tr>
                        <th className="text-left px-4 py-1.5 border-b">{t('Code')}</th>
                        <th className="text-left px-4 py-1.5 border-b">{t('Account')}</th>
                        <th className="text-right px-4 py-1.5 border-b">{t('Balance (GHS)')}</th>
                    </tr>
                </thead>
                <tbody>
                    {items.length === 0
                        ? <tr><td colSpan={3} className="text-center px-4 py-3 text-gray-400">{t('No entries found')}</td></tr>
                        : items.map((a, i) => (
                            <tr key={i} className="border-b hover:bg-gray-50">
                                <td className="px-4 py-1.5 font-mono text-xs text-gray-500">{a.account_code}</td>
                                <td className="px-4 py-1.5">{a.account_name}</td>
                                <td className="px-4 py-1.5 text-right font-mono">{fmt(Math.abs(Number(a.net_balance)))}</td>
                            </tr>
                        ))
                    }
                </tbody>
                <tfoot>
                    <tr className="bg-gray-100 font-bold border-t-2">
                        <td colSpan={2} className="px-4 py-2 text-right">{t('Total')} {title}</td>
                        <td className="px-4 py-2 text-right font-mono">{fmt(Math.abs(total))}</td>
                    </tr>
                </tfoot>
            </table>
        </div>
    );

    return (
        <div className="space-y-4">
            <div className="flex items-end gap-3">
                <div>
                    <Label>{t('As of Date')}</Label>
                    <Input type="date" value={asOfDate} onChange={e => setAsOfDate(e.target.value)} className="w-44" />
                </div>
                <Button onClick={fetchData} disabled={loading}>
                    {loading ? t('Loading...') : t('Generate')}
                </Button>
                {data && (
                    <Button variant="outline" onClick={() => window.open(route('account.reports.statement-of-position.print') + `?as_of_date=${asOfDate}`, '_blank')}>
                        <Printer className="h-4 w-4 mr-1" />{t('Print')}
                    </Button>
                )}
            </div>

            {data && (
                <div>
                    <h2 className="text-center text-lg font-bold mb-1">{t('Statement of Financial Position (Balance Sheet)')}</h2>
                    <p className="text-center text-sm text-gray-500 mb-4">{t('As at')} {data.as_of_date}</p>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div>
                            <Section title={t('ASSETS')} items={data.assets} isDebit={true} total={data.total_assets} />
                        </div>
                        <div>
                            <Section title={t('LIABILITIES')} items={data.liabilities} isDebit={false} total={data.total_liabilities} />
                            <Section title={t('EQUITY / NET ASSETS')} items={data.equity} isDebit={false} total={data.total_equity} />
                            <div className={`rounded p-3 text-sm font-bold flex justify-between ${data.net_position >= 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                <span>{t(data.net_position >= 0 ? 'Net Surplus' : 'Net Deficit')}</span>
                                <span className="font-mono">GHS {fmt(Math.abs(data.net_position))}</span>
                            </div>
                        </div>
                    </div>

                    <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
                        <strong>IPSAS Note:</strong> {t('Assets must equal Liabilities plus Equity (Accounting Equation: A = L + E). Prepared on an accrual basis per IPSAS 1.')}
                    </div>
                </div>
            )}
        </div>
    );
}
