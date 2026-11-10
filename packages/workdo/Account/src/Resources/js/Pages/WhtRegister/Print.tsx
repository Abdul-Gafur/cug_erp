import { Head } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import { formatCurrency, formatDate } from '@/utils/helpers';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';

export default function WhtRegisterPrint({ entries, summary, from_date, to_date, companySettings }: any) {
    const { t } = useTranslation();

    return (
        <div className="p-8 max-w-5xl mx-auto bg-white min-h-screen text-black">
            <Head title={t('WHT Register Print')} />

            <div className="flex justify-between items-center mb-6 print:hidden">
                <Button variant="outline" onClick={() => window.close()}>{t('Close')}</Button>
                <Button onClick={() => window.print()}>
                    <Printer className="h-4 w-4 mr-2" />
                    {t('Print Report')}
                </Button>
            </div>

            <div className="text-center mb-8 border-b pb-4">
                <h1 className="text-2xl font-bold uppercase">{companySettings?.company_name || t('Company Name')}</h1>
                <h2 className="text-xl font-semibold mt-1">{t('WITHHOLDING TAX (WHT) REGISTER')}</h2>
                <p className="text-sm text-gray-600 mt-2">
                    {t('For the period:')} {formatDate(from_date)} {t('to')} {formatDate(to_date)}
                </p>
            </div>

            <div className="grid grid-cols-2 gap-8 mb-8">
                <div>
                    <h3 className="font-bold underline mb-2">{t('Summary by Payment Nature')}</h3>
                    <table className="w-full text-sm">
                        <tbody>
                            <tr><td>{t('Goods')}</td><td className="text-right font-mono">{formatCurrency(summary.goods_wht)}</td></tr>
                            <tr><td>{t('Services')}</td><td className="text-right font-mono">{formatCurrency(summary.services_wht)}</td></tr>
                            <tr className="font-bold border-t"><td>{t('Total')}</td><td className="text-right font-mono">{formatCurrency(summary.total_wht)}</td></tr>
                        </tbody>
                    </table>
                </div>
                <div>
                    <h3 className="font-bold underline mb-2">{t('Remittance Status')}</h3>
                    <table className="w-full text-sm">
                        <tbody>
                            <tr><td>{t('Remitted to GRA')}</td><td className="text-right font-mono">{formatCurrency(summary.remitted_wht)}</td></tr>
                            <tr><td>{t('Pending Remittance')}</td><td className="text-right font-mono">{formatCurrency(summary.pending_wht)}</td></tr>
                            <tr className="font-bold border-t"><td>{t('Total')}</td><td className="text-right font-mono">{formatCurrency(summary.total_wht)}</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <table className="w-full text-sm border-collapse border border-gray-300">
                <thead>
                    <tr className="bg-gray-100">
                        <th className="border border-gray-300 px-2 py-2 text-left">{t('Date')}</th>
                        <th className="border border-gray-300 px-2 py-2 text-left">{t('PV Number')}</th>
                        <th className="border border-gray-300 px-2 py-2 text-left">{t('Supplier')}</th>
                        <th className="border border-gray-300 px-2 py-2 text-left">{t('TIN')}</th>
                        <th className="border border-gray-300 px-2 py-2 text-right">{t('Gross Value')}</th>
                        <th className="border border-gray-300 px-2 py-2 text-right">{t('WHT Rate')}</th>
                        <th className="border border-gray-300 px-2 py-2 text-right">{t('WHT Amount')}</th>
                        <th className="border border-gray-300 px-2 py-2 text-center">{t('Status')}</th>
                    </tr>
                </thead>
                <tbody>
                    {entries?.map((entry: any) => (
                        <tr key={entry.id}>
                            <td className="border border-gray-300 px-2 py-1">{formatDate(entry.payment_date)}</td>
                            <td className="border border-gray-300 px-2 py-1">{entry.pv_number}</td>
                            <td className="border border-gray-300 px-2 py-1">{entry.vendor_name}</td>
                            <td className="border border-gray-300 px-2 py-1 font-mono">{entry.vendor_tin}</td>
                            <td className="border border-gray-300 px-2 py-1 text-right font-mono">{formatCurrency(entry.gross_amount)}</td>
                            <td className="border border-gray-300 px-2 py-1 text-right">{entry.wht_rate}%</td>
                            <td className="border border-gray-300 px-2 py-1 text-right font-mono font-semibold">{formatCurrency(entry.wht_amount)}</td>
                            <td className="border border-gray-300 px-2 py-1 text-center text-xs uppercase">{entry.remittance_status}</td>
                        </tr>
                    ))}
                    {(!entries || entries.length === 0) && (
                        <tr>
                            <td colSpan={8} className="border border-gray-300 px-2 py-4 text-center text-gray-500">
                                {t('No records found for the selected period.')}
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}
