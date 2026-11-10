import { Head } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Printer, X } from 'lucide-react';

const fmt = (n: number) => Number(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function BudgetVsActualPrint({ data }: { data: any }) {
    const { t } = useTranslation();

    if (!data) return <div className="p-8 text-center">{t('No data available')}</div>;

    const { from_date, to_date, report, total_budget, total_committed, total_actual, total_variance } = data;

    return (
        <div className="p-8 bg-white min-h-screen text-black max-w-5xl mx-auto font-sans">
            <Head title={t('Budget vs Actual Report')} />

            <div className="flex justify-between items-center mb-8 print:hidden bg-gray-50 p-4 rounded-lg border">
                <div className="text-sm text-gray-600">
                    {t('Printing Report for:')} <span className="font-bold">{from_date} — {to_date}</span>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" className="text-gray-600" onClick={() => window.close()}>
                        <X className="h-4 w-4 mr-2" />
                        {t('Close')}
                    </Button>
                    <Button onClick={() => window.print()} className="bg-blue-600 text-white">
                        <Printer className="h-4 w-4 mr-2" />
                        {t('Print Page')}
                    </Button>
                </div>
            </div>

            <div className="text-center mb-10 border-b-2 border-black pb-6">
                <h1 className="text-3xl font-black uppercase tracking-tight mb-2">
                    {t('IPSAS BUDGET VS ACTUAL REPORT')}
                </h1>
                <div className="h-1 w-24 bg-blue-600 mx-auto mb-4"></div>
                <p className="text-lg font-medium text-gray-700">
                    {t('Reporting Period:')} <span className="underline">{from_date}</span> {t('to')} <span className="underline">{to_date}</span>
                </p>
            </div>

            <div className="grid grid-cols-4 gap-4 mb-8">
                <div className="p-4 bg-gray-50 border rounded text-center">
                    <p className="text-xs uppercase text-gray-500 font-bold mb-1">{t('Total Budget')}</p>
                    <p className="text-xl font-mono font-bold">{fmt(total_budget)}</p>
                </div>
                <div className="p-4 bg-orange-50 border border-orange-200 rounded text-center">
                    <p className="text-xs uppercase text-orange-600 font-bold mb-1">{t('Total Committed')}</p>
                    <p className="text-xl font-mono font-bold text-orange-700">{fmt(total_committed)}</p>
                </div>
                <div className="p-4 bg-blue-50 border border-blue-200 rounded text-center">
                    <p className="text-xs uppercase text-blue-600 font-bold mb-1">{t('Total Actual')}</p>
                    <p className="text-xl font-mono font-bold text-blue-700">{fmt(total_actual)}</p>
                </div>
                <div className="p-4 bg-gray-50 border rounded text-center">
                    <p className="text-xs uppercase text-gray-500 font-bold mb-1">{t('Total Variance')}</p>
                    <p className={`text-xl font-mono font-bold ${total_variance >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        {fmt(total_variance)}
                    </p>
                </div>
            </div>

            <table className="w-full text-sm border-collapse border border-gray-400">
                <thead>
                    <tr className="bg-gray-100">
                        <th className="border border-gray-400 px-3 py-3 text-left w-1/4">{t('Category / Vote')}</th>
                        <th className="border border-gray-400 px-3 py-3 text-left w-1/4">{t('Description')}</th>
                        <th className="border border-gray-400 px-3 py-3 text-right">{t('Budget')}</th>
                        <th className="border border-gray-400 px-3 py-3 text-right text-orange-700">{t('Committed')}</th>
                        <th className="border border-gray-400 px-3 py-3 text-right">{t('Actual')}</th>
                        <th className="border border-gray-400 px-3 py-3 text-right">{t('Variance')}</th>
                    </tr>
                </thead>
                <tbody>
                    {report.map((row: any, i: number) => (
                        <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="border border-gray-400 px-3 py-2 font-bold">{row.category}</td>
                            <td className="border border-gray-400 px-3 py-2 text-xs text-gray-600">{row.budget_name}</td>
                            <td className="border border-gray-400 px-3 py-2 text-right font-mono">{fmt(row.budget_amount)}</td>
                            <td className="border border-gray-400 px-3 py-2 text-right font-mono text-orange-700 font-semibold">{fmt(row.committed_amount)}</td>
                            <td className="border border-gray-400 px-3 py-2 text-right font-mono">{fmt(row.actual_amount)}</td>
                            <td className={`border border-gray-400 px-3 py-2 text-right font-mono font-bold ${row.variance >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                                {row.variance < 0 ? '(' + fmt(Math.abs(row.variance)) + ')' : fmt(row.variance)}
                            </td>
                        </tr>
                    ))}
                </tbody>
                <tfoot className="bg-gray-200 font-black">
                    <tr>
                        <td colSpan={2} className="border border-gray-400 px-3 py-3 uppercase">{t('Grand Totals')}</td>
                        <td className="border border-gray-400 px-3 py-3 text-right font-mono">{fmt(total_budget)}</td>
                        <td className="border border-gray-400 px-3 py-3 text-right font-mono text-orange-700">{fmt(total_committed)}</td>
                        <td className="border border-gray-400 px-3 py-3 text-right font-mono">{fmt(total_actual)}</td>
                        <td className="border border-gray-400 px-3 py-3 text-right font-mono">{fmt(total_variance)}</td>
                    </tr>
                </tfoot>
            </table>

            <div className="mt-12 grid grid-cols-3 gap-8">
                <div className="text-center pt-8 border-t border-gray-300">
                    <p className="text-sm font-bold">{t('Prepared By')}</p>
                    <p className="text-xs text-gray-500 mt-1">{t('Accounts Officer')}</p>
                </div>
                <div className="text-center pt-8 border-t border-gray-300">
                    <p className="text-sm font-bold">{t('Verified By')}</p>
                    <p className="text-xs text-gray-500 mt-1">{t('Director of Finance')}</p>
                </div>
                <div className="text-center pt-8 border-t border-gray-300">
                    <p className="text-sm font-bold">{t('Approved By')}</p>
                    <p className="text-xs text-gray-500 mt-1">{t('Chief Rector / CEO')}</p>
                </div>
            </div>

            <div className="mt-8 text-[10px] text-gray-400 text-center italic">
                {t('Generated on')} {new Date().toLocaleString()} - {t('CUG ERP IPSAS Financial Module')}
            </div>
        </div>
    );
}
