import React, { useEffect, useState } from 'react';
import { Head, usePage } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import html2pdf from 'html2pdf.js';
import { formatCurrency, formatDate, getCompanySetting } from '@/utils/helpers';

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
}

export default function Print() {
    const { t } = useTranslation();
    const { profitLoss, financialYear, isAudited } = usePage<Props>().props;
    const [isDownloading, setIsDownloading] = useState(false);

    const priorYear = profitLoss.prior_year;

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('download') === 'pdf') downloadPDF();
    }, []);

    const downloadPDF = async () => {
        setIsDownloading(true);
        const el = document.querySelector('.sfp-print-container');
        if (el) {
            const opt = {
                margin: 0.25,
                filename: `statement-of-financial-performance-${financialYear}.pdf`,
                image: { type: 'jpeg' as const, quality: 0.98 },
                html2canvas: { scale: 2 },
                jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' as const }
            };
            try {
                await html2pdf().set(opt).from(el as HTMLElement).save();
                setTimeout(() => window.close(), 1000);
            } catch (err) {
                console.error('PDF generation failed:', err);
            }
        }
        setIsDownloading(false);
    };

    const renderSection = (
        groups: IpsasGroup[],
        sectionLabel: string,
        sectionTotal: number,
        priorGroups?: IpsasGroup[],
        priorTotal?: number
    ) => {
        const priorByLabel = Object.fromEntries((priorGroups ?? []).map(g => [g.label, g]));

        return (
            <>
                {/* Section heading */}
                <tr>
                    <td colSpan={priorYear ? 3 : 2}
                        className="pt-6 pb-1 font-bold text-xs uppercase tracking-wider border-b-2 border-gray-800">
                        {sectionLabel}
                    </td>
                </tr>

                {groups.length > 0 ? groups.map((group) => {
                    const pg = priorByLabel[group.label];
                    return (
                        <React.Fragment key={group.label}>
                            {/* Group heading */}
                            <tr>
                                <td colSpan={priorYear ? 3 : 2}
                                    className="pt-3 pb-0.5 text-xs font-semibold text-gray-500 pl-4 uppercase">
                                    {group.label}
                                </td>
                            </tr>
                            {group.accounts.map((acc) => (
                                <tr key={acc.id}>
                                    <td className="py-0.5 pl-8 text-xs">{acc.account_code} — {acc.account_name}</td>
                                    <td className="py-0.5 text-right text-xs tabular-nums">{formatCurrency(acc.balance)}</td>
                                    {priorYear && <td className="py-0.5 text-right text-xs text-gray-400 tabular-nums pl-6">—</td>}
                                </tr>
                            ))}
                            {/* Group subtotal */}
                            <tr className="border-t border-gray-300">
                                <td className="py-1 pl-8 text-xs font-semibold">Subtotal: {group.label}</td>
                                <td className="py-1 text-right text-xs font-semibold tabular-nums">{formatCurrency(group.total)}</td>
                                {priorYear && (
                                    <td className="py-1 text-right text-xs font-semibold text-gray-500 tabular-nums pl-6">
                                        {pg ? formatCurrency(pg.total) : '—'}
                                    </td>
                                )}
                            </tr>
                        </React.Fragment>
                    );
                }) : (
                    <tr><td colSpan={priorYear ? 3 : 2} className="py-1 pl-4 text-xs text-gray-400 italic">No accounts in this period</td></tr>
                )}

                {/* Section total */}
                <tr className="border-t-2 border-gray-800">
                    <td className="py-2 font-bold text-sm">Total {sectionLabel}</td>
                    <td className="py-2 text-right font-bold text-sm tabular-nums">{formatCurrency(sectionTotal)}</td>
                    {priorYear && (
                        <td className="py-2 text-right font-bold text-sm text-gray-600 tabular-nums pl-6">
                            {priorTotal !== undefined ? formatCurrency(priorTotal) : '—'}
                        </td>
                    )}
                </tr>
            </>
        );
    };

    return (
        <div className="min-h-screen bg-white">
            <Head title="Statement of Financial Performance" />

            {isDownloading && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-lg shadow-lg flex items-center space-x-3">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
                        <p className="text-lg font-semibold text-gray-700">Generating PDF...</p>
                    </div>
                </div>
            )}

            <div className="sfp-print-container bg-white max-w-4xl mx-auto p-10">

                {/* Document header */}
                <div className="border-b-2 border-gray-800 pb-6 mb-6">
                    <div className="flex justify-between items-start">
                        <div>
                            <h1 className="text-2xl font-bold">{getCompanySetting('company_name') || 'INSTITUTION NAME'}</h1>
                            <div className="text-xs space-y-0.5 mt-1 text-gray-600">
                                {getCompanySetting('company_address') && <p>{getCompanySetting('company_address')}</p>}
                                {(getCompanySetting('company_city') || getCompanySetting('company_country')) && (
                                    <p>{getCompanySetting('company_city')}{getCompanySetting('company_country') && `, ${getCompanySetting('company_country')}`}</p>
                                )}
                            </div>
                        </div>
                        <div className="text-right">
                            <h2 className="text-xl font-bold">STATEMENT OF FINANCIAL PERFORMANCE</h2>
                            <p className="text-xs mt-1">Period: {formatDate(profitLoss.from_date)} — {formatDate(profitLoss.to_date)}</p>
                            <p className="text-xs">Financial Year: {financialYear}</p>
                            <p className="text-xs font-medium text-gray-600">Amounts in GHS</p>
                            {!isAudited && (
                                <p className="text-xs font-bold text-amber-700 mt-1 border border-amber-400 px-2 py-0.5 inline-block rounded">
                                    UNAUDITED
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Prior-year column header */}
                {priorYear && (
                    <div className="flex justify-end gap-0 mb-2 text-xs font-semibold text-gray-500">
                        <span className="w-32 text-right mr-6">{financialYear}</span>
                        <span className="w-32 text-right pl-6">{String(Number(financialYear) - 1)}</span>
                    </div>
                )}

                <table className="w-full border-collapse">
                    <tbody>
                        {renderSection(
                            profitLoss.grouped_revenue  ?? [],
                            'REVENUE',
                            profitLoss.total_revenue,
                            priorYear?.grouped_revenue,
                            priorYear?.total_revenue
                        )}
                        {renderSection(
                            profitLoss.grouped_expenses ?? [],
                            'EXPENSES',
                            profitLoss.total_expenses,
                            priorYear?.grouped_expenses,
                            priorYear?.total_expenses
                        )}

                        {/* Surplus / (Deficit) */}
                        <tr className="border-t-4 border-gray-800">
                            <td className="pt-4 pb-2 font-bold text-sm">
                                {profitLoss.net_surplus >= 0 ? 'SURPLUS FOR THE YEAR' : 'DEFICIT FOR THE YEAR'}
                            </td>
                            <td className={`pt-4 pb-2 text-right font-bold text-sm tabular-nums ${profitLoss.net_surplus >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                                {profitLoss.net_surplus < 0 && '('}
                                {formatCurrency(Math.abs(profitLoss.net_surplus))}
                                {profitLoss.net_surplus < 0 && ')'}
                            </td>
                            {priorYear && (
                                <td className="pt-4 pb-2 text-right font-bold text-sm text-gray-600 tabular-nums pl-6">
                                    {priorYear.net_surplus < 0 && '('}
                                    {formatCurrency(Math.abs(priorYear.net_surplus))}
                                    {priorYear.net_surplus < 0 && ')'}
                                </td>
                            )}
                        </tr>
                    </tbody>
                </table>

                {/* Footer */}
                <div className="mt-8 pt-4 border-t text-center text-xs text-gray-500">
                    <p>Generated on {formatDate(new Date().toISOString())}</p>
                </div>
            </div>

            <style>{`
                body { -webkit-print-color-adjust: exact; color-adjust: exact; font-family: Arial, sans-serif; }
                @page { margin: 0.25in; size: A4; }
                .sfp-print-container { max-width: 100%; margin: 0; box-shadow: none; }
                @media print { body { background: white; } .sfp-print-container { box-shadow: none; } }
            `}</style>
        </div>
    );
}
