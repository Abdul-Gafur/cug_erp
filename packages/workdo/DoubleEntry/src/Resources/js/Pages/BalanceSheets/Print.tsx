import React, { useEffect, useState } from 'react';
import { Head, usePage } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import html2pdf from 'html2pdf.js';
import { formatCurrency, formatDate, getCompanySetting } from '@/utils/helpers';
import { BalanceSheetViewProps } from './types';

const SUB_SECTION_LABELS: Record<string, string> = {
    current_assets:          'Current Assets',
    non_current_assets:      'Non-Current Assets',
    other_assets:            'Non-Current Assets',
    fixed_assets:            'Non-Current Assets',
    current_liabilities:     'Current Liabilities',
    non_current_liabilities: 'Non-Current Liabilities',
    long_term_liabilities:   'Non-Current Liabilities',
    net_assets:              'Net Assets',
    equity:                  'Net Assets',
};

const normaliseGrouped = (raw: any) => {
    if (!raw) return null;
    const out: Record<string, Record<string, any[]>> = {};
    for (const [sType, subs] of Object.entries(raw as Record<string, any>)) {
        const normSType = sType === 'equity' ? 'net_assets' : sType;
        if (!out[normSType]) out[normSType] = {};
        for (const [sub, items] of Object.entries(subs as Record<string, any[]>)) {
            const normSub =
                sub === 'other_assets' || sub === 'fixed_assets' ? 'non_current_assets'
                : sub === 'long_term_liabilities'                ? 'non_current_liabilities'
                : sub === 'equity'                               ? 'net_assets'
                : sub;
            if (!out[normSType][normSub]) out[normSType][normSub] = [];
            out[normSType][normSub] = [...out[normSType][normSub], ...(items as any[])];
        }
    }
    return out;
};

const sectionSum = (sectionData?: Record<string, any[]>): number => {
    if (!sectionData) return 0;
    return Object.values(sectionData).flat().reduce((s, i) => s + parseFloat(i.amount ?? '0'), 0);
};

export default function Print() {
    const { t } = useTranslation();
    const {
        balanceSheet,
        groupedItems,
        priorYearGroupedItems,
        priorYearTotals,
        isAudited,
        priorYear,
    } = usePage<BalanceSheetViewProps>().props;

    const [isDownloading, setIsDownloading] = useState(false);

    const normGrouped      = normaliseGrouped(groupedItems)      ?? {};
    const normPriorGrouped = normaliseGrouped(priorYearGroupedItems);

    const totalAssets    = sectionSum(normGrouped['assets']);
    const totalLiab      = sectionSum(normGrouped['liabilities']);
    const totalNetAssets = sectionSum(normGrouped['net_assets']);

    const priorTotalAssets    = sectionSum(normPriorGrouped?.['assets']);
    const priorTotalLiab      = sectionSum(normPriorGrouped?.['liabilities']);
    const priorTotalNetAssets = sectionSum(normPriorGrouped?.['net_assets']);

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('download') === 'pdf') downloadPDF();
    }, []);

    const downloadPDF = async () => {
        setIsDownloading(true);
        const el = document.querySelector('.sfp-container');
        if (el) {
            const opt = {
                margin: 0.25,
                filename: `statement-of-financial-position-${balanceSheet.financial_year}.pdf`,
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

    const renderSection = (sType: string, label: string) => {
        const data = normGrouped[sType];
        const prior = normPriorGrouped?.[sType];
        if (!data) return null;

        const total      = sectionSum(data);
        const priorTotal = sectionSum(prior);

        return (
            <>
                <tr>
                    <td colSpan={normPriorGrouped ? 3 : 2} className="pt-6 pb-1 font-bold text-sm uppercase border-b-2 border-gray-800">
                        {label}
                    </td>
                </tr>
                {Object.entries(data).map(([sub, items]) => {
                    const subTotal      = (items as any[]).reduce((s, i) => s + parseFloat(i.amount ?? '0'), 0);
                    const priorSubItems = (prior?.[sub] ?? []) as any[];
                    const priorSubTotal = priorSubItems.reduce((s, i) => s + parseFloat(i.amount ?? '0'), 0);
                    const subLabel      = SUB_SECTION_LABELS[sub] ?? sub.replace(/_/g, ' ');

                    return (
                        <React.Fragment key={sub}>
                            <tr>
                                <td colSpan={normPriorGrouped ? 3 : 2} className="pt-3 pb-1 text-xs font-semibold text-gray-600 uppercase pl-4">
                                    {subLabel}
                                </td>
                            </tr>
                            {(items as any[]).map((item) => (
                                <tr key={item.id ?? item.account_code}>
                                    <td className="py-1 pl-8 text-sm">{item.account?.account_name ?? item.account_name}</td>
                                    <td className="py-1 text-right text-sm tabular-nums">{formatCurrency(item.amount)}</td>
                                    {normPriorGrouped && (
                                        <td className="py-1 text-right text-sm text-gray-500 tabular-nums pl-6">—</td>
                                    )}
                                </tr>
                            ))}
                            <tr className="border-t border-gray-300">
                                <td className="py-1 pl-8 text-sm font-semibold">Total {subLabel}</td>
                                <td className="py-1 text-right text-sm font-semibold tabular-nums">{formatCurrency(subTotal)}</td>
                                {normPriorGrouped && (
                                    <td className="py-1 text-right text-sm font-semibold text-gray-500 tabular-nums pl-6">
                                        {priorSubTotal !== 0 ? formatCurrency(priorSubTotal) : '—'}
                                    </td>
                                )}
                            </tr>
                        </React.Fragment>
                    );
                })}
                <tr className="border-t-2 border-gray-800">
                    <td className="py-2 font-bold text-sm">Total {label}</td>
                    <td className="py-2 text-right font-bold text-sm tabular-nums">{formatCurrency(total)}</td>
                    {normPriorGrouped && (
                        <td className="py-2 text-right font-bold text-sm text-gray-600 tabular-nums pl-6">
                            {priorTotal !== 0 ? formatCurrency(priorTotal) : '—'}
                        </td>
                    )}
                </tr>
            </>
        );
    };

    return (
        <div className="min-h-screen bg-white">
            <Head title={t('Statement of Financial Position')} />

            {isDownloading && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-lg shadow-lg">
                        <div className="flex items-center space-x-3">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
                            <p className="text-lg font-semibold text-gray-700">{t('Generating PDF...')}</p>
                        </div>
                    </div>
                </div>
            )}

            <div className="sfp-container bg-white max-w-4xl mx-auto p-10">
                {/* Document Header */}
                <div className="border-b-2 border-gray-800 pb-6 mb-6">
                    <div className="flex justify-between items-start">
                        <div>
                            <h1 className="text-2xl font-bold">{getCompanySetting('company_name') || 'INSTITUTION NAME'}</h1>
                            <div className="text-sm space-y-0.5 mt-1">
                                {getCompanySetting('company_address') && <p>{getCompanySetting('company_address')}</p>}
                                {(getCompanySetting('company_city') || getCompanySetting('company_country')) && (
                                    <p>{getCompanySetting('company_city')}{getCompanySetting('company_country') && `, ${getCompanySetting('company_country')}`}</p>
                                )}
                            </div>
                        </div>
                        <div className="text-right">
                            <h2 className="text-xl font-bold">STATEMENT OF FINANCIAL POSITION</h2>
                            <p className="text-sm mt-1">{t('As of')}: {formatDate(balanceSheet.balance_sheet_date)}</p>
                            <p className="text-sm">{t('Financial Year')}: {balanceSheet.financial_year}</p>
                            <p className="text-sm font-medium text-gray-600">Amounts in GHS</p>
                            {!isAudited && (
                                <p className="text-sm font-bold text-amber-700 mt-1 border border-amber-400 px-2 py-0.5 inline-block rounded">
                                    UNAUDITED
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Column headers when prior year is available */}
                {normPriorGrouped && (
                    <div className="flex justify-end gap-0 mb-2 text-xs font-semibold text-gray-600">
                        <span className="w-40 text-right pr-0">{balanceSheet.financial_year}</span>
                        <span className="w-40 text-right pl-6">{priorYear}</span>
                    </div>
                )}

                <table className="w-full border-collapse text-sm">
                    <tbody>
                        {renderSection('assets', 'ASSETS')}
                        {renderSection('liabilities', 'LIABILITIES')}
                        {renderSection('net_assets', 'NET ASSETS')}

                        {/* Verification row */}
                        <tr className="border-t-4 border-gray-800 mt-4">
                            <td className="pt-4 pb-1 font-bold">TOTAL LIABILITIES AND NET ASSETS</td>
                            <td className="pt-4 pb-1 text-right font-bold tabular-nums">{formatCurrency(totalLiab + totalNetAssets)}</td>
                            {normPriorGrouped && (
                                <td className="pt-4 pb-1 text-right font-bold text-gray-600 tabular-nums pl-6">
                                    {formatCurrency(priorTotalLiab + priorTotalNetAssets)}
                                </td>
                            )}
                        </tr>
                        <tr className="border-t border-gray-400">
                            <td className="py-1 font-bold">TOTAL ASSETS</td>
                            <td className="py-1 text-right font-bold tabular-nums">{formatCurrency(totalAssets)}</td>
                            {normPriorGrouped && (
                                <td className="py-1 text-right font-bold text-gray-600 tabular-nums pl-6">
                                    {formatCurrency(priorTotalAssets)}
                                </td>
                            )}
                        </tr>
                    </tbody>
                </table>

                {/* Notes */}
                {balanceSheet.notes && balanceSheet.notes.length > 0 && (
                    <div className="mt-8 pt-4 border-t">
                        <h3 className="font-bold text-sm mb-3">Notes to the Financial Statements</h3>
                        {balanceSheet.notes.map((note: any) => (
                            <div key={note.id} className="mb-3">
                                <p className="font-semibold text-xs">Note {note.note_number}: {note.note_title}</p>
                                <p className="text-xs text-gray-700 mt-0.5">{note.note_content}</p>
                            </div>
                        ))}
                    </div>
                )}

                {/* Footer */}
                <div className="mt-8 pt-4 border-t text-center text-xs text-gray-500">
                    <p>Generated on {formatDate(new Date().toISOString())}</p>
                </div>
            </div>

            <style>{`
                body { -webkit-print-color-adjust: exact; color-adjust: exact; font-family: Arial, sans-serif; }
                @page { margin: 0.25in; size: A4; }
                .sfp-container { max-width: 100%; margin: 0; box-shadow: none; }
                @media print { body { background: white; } .sfp-container { box-shadow: none; } }
            `}</style>
        </div>
    );
}
