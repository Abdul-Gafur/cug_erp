import { useEffect, useState } from 'react';
import { Head, usePage } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import html2pdf from 'html2pdf.js';
import { formatCurrency, formatDate, getCompanySetting } from '@/utils/helpers';

interface CashFlowData {
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
}

interface PrintProps {
    data:      CashFlowData;
    priorData: CashFlowData | null;
    filters: {
        from_date:      string;
        to_date:        string;
        financial_year: string;
    };
    isAudited: boolean;
}

export default function Print() {
    const { t } = useTranslation();
    const { data, priorData, filters, isAudited } = usePage<PrintProps>().props;
    const [isDownloading, setIsDownloading] = useState(false);

    const prior = priorData ?? null;
    const priorYear = prior ? String(Number(filters.financial_year) - 1) : null;

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('download') === 'pdf') downloadPDF();
    }, []);

    const downloadPDF = async () => {
        setIsDownloading(true);
        const el = document.querySelector('.cash-flow-container');
        if (el) {
            const opt = {
                margin: 0.25,
                filename: `cash-flow-statement-${filters.financial_year}.pdf`,
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

    // Table row helper
    const Row = ({
        label, value, priorValue,
        indent = false, bold = false, topBorder = 1
    }: {
        label: string; value: number; priorValue?: number | null;
        indent?: boolean; bold?: boolean; topBorder?: 0 | 1 | 2 | 4;
    }) => {
        const borderCls =
            topBorder === 4 ? 'border-t-4 border-gray-800'
            : topBorder === 2 ? 'border-t-2 border-gray-600'
            : topBorder === 1 ? 'border-t border-gray-300'
            : '';

        return (
            <tr className={`${borderCls} page-break-inside-avoid`}>
                <td className={`py-1.5 text-xs ${bold ? 'font-bold' : ''} ${indent ? 'pl-8' : 'pl-2'}`}>
                    {label}
                </td>
                <td className={`py-1.5 text-right text-xs tabular-nums ${bold ? 'font-bold' : ''} w-36`}>
                    {formatCurrency(value)}
                </td>
                {prior && (
                    <td className={`py-1.5 text-right text-xs tabular-nums text-gray-500 pl-6 ${bold ? 'font-bold' : ''} w-36`}>
                        {priorValue !== null && priorValue !== undefined
                            ? formatCurrency(priorValue)
                            : '—'}
                    </td>
                )}
            </tr>
        );
    };

    const SectionHead = ({ label }: { label: string }) => (
        <tr className="page-break-inside-avoid">
            <td colSpan={prior ? 3 : 2}
                className="pt-5 pb-1 text-xs font-bold uppercase tracking-wider border-b-2 border-gray-700">
                {label}
            </td>
        </tr>
    );

    return (
        <div className="min-h-screen bg-white">
            <Head title="Cash Flow Statement" />

            {isDownloading && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-lg shadow-lg flex items-center space-x-3">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
                        <p className="text-lg font-semibold text-gray-700">Generating PDF…</p>
                    </div>
                </div>
            )}

            <div className="cash-flow-container bg-white max-w-4xl mx-auto p-10">

                {/* Document header */}
                <div className="border-b-2 border-gray-800 pb-6 mb-6">
                    <div className="flex justify-between items-start">
                        <div>
                            <h1 className="text-2xl font-bold">{getCompanySetting('company_name') || 'INSTITUTION NAME'}</h1>
                            <div className="text-xs space-y-0.5 mt-1 text-gray-600">
                                {getCompanySetting('company_address') && <p>{getCompanySetting('company_address')}</p>}
                                {(getCompanySetting('company_city') || getCompanySetting('company_country')) && (
                                    <p>
                                        {getCompanySetting('company_city')}
                                        {getCompanySetting('company_country') && `, ${getCompanySetting('company_country')}`}
                                    </p>
                                )}
                            </div>
                        </div>
                        <div className="text-right">
                            <h2 className="text-xl font-bold">STATEMENT OF CASH FLOWS</h2>
                            <p className="text-xs mt-1">(Direct Method — IPSAS 2)</p>
                            <p className="text-xs">
                                Period: {formatDate(filters.from_date)} — {formatDate(filters.to_date)}
                            </p>
                            <p className="text-xs">Financial Year: {filters.financial_year}</p>
                            <p className="text-xs font-medium text-gray-600">Amounts in GHS</p>
                            {!isAudited && (
                                <p className="text-xs font-bold text-amber-700 mt-1 border border-amber-400 px-2 py-0.5 inline-block rounded">
                                    UNAUDITED
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Column headers */}
                {prior && (
                    <div className="flex justify-end gap-0 mb-2 text-xs font-semibold text-gray-500">
                        <span className="w-36 text-right">{filters.financial_year}</span>
                        <span className="w-36 text-right pl-6">{priorYear}</span>
                    </div>
                )}

                <table className="w-full border-collapse">
                    <tbody>
                        {/* Opening balance */}
                        <Row label="Cash and Cash Equivalents at Beginning of Period"
                            value={data.opening_cash} priorValue={prior?.opening_cash}
                            bold topBorder={0} />

                        {/* Operating */}
                        <SectionHead label="Cash Flows from Operating Activities" />
                        <Row label="Receipts from government grants, fees and other income"
                            value={data.operating_receipts} priorValue={prior?.operating_receipts} indent />
                        <Row label="Payments to employees, suppliers and other operating costs"
                            value={-data.operating_payments}
                            priorValue={prior ? -prior.operating_payments : null} indent />
                        <Row label="Net Cash from Operating Activities"
                            value={data.net_operating} priorValue={prior?.net_operating}
                            bold topBorder={2} />

                        {/* Investing */}
                        <SectionHead label="Cash Flows from Investing Activities" />
                        <Row label="Proceeds from disposal of assets and investments"
                            value={data.investing_inflows} priorValue={prior?.investing_inflows} indent />
                        <Row label="Purchase of property, plant, equipment and investments"
                            value={-data.investing_outflows}
                            priorValue={prior ? -prior.investing_outflows : null} indent />
                        <Row label="Net Cash from Investing Activities"
                            value={data.net_investing} priorValue={prior?.net_investing}
                            bold topBorder={2} />

                        {/* Financing */}
                        <SectionHead label="Cash Flows from Financing Activities" />
                        <Row label="Proceeds from borrowings and endowments received"
                            value={data.financing_inflows} priorValue={prior?.financing_inflows} indent />
                        <Row label="Repayment of borrowings and other financing outflows"
                            value={-data.financing_outflows}
                            priorValue={prior ? -prior.financing_outflows : null} indent />
                        <Row label="Net Cash from Financing Activities"
                            value={data.net_financing} priorValue={prior?.net_financing}
                            bold topBorder={2} />

                        {/* Net movement */}
                        <Row label="Net Increase / (Decrease) in Cash and Cash Equivalents"
                            value={data.net_movement} priorValue={prior?.net_movement}
                            bold topBorder={4} />

                        {/* Reconciliation */}
                        <Row label="Cash and Cash Equivalents at Beginning of Period"
                            value={data.opening_cash} priorValue={prior?.opening_cash} topBorder={1} />

                        <tr className="border-t-4 border-gray-800 page-break-inside-avoid">
                            <td className="pt-3 pb-2 font-bold text-sm">
                                Cash and Cash Equivalents at End of Period
                            </td>
                            <td className="pt-3 pb-2 text-right font-bold text-sm tabular-nums w-36">
                                {formatCurrency(data.closing_cash)}
                            </td>
                            {prior && (
                                <td className="pt-3 pb-2 text-right font-bold text-sm text-gray-600 tabular-nums pl-6 w-36">
                                    {formatCurrency(prior.closing_cash)}
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
                .cash-flow-container { max-width: 100%; margin: 0; box-shadow: none; }
                .page-break-inside-avoid { page-break-inside: avoid; break-inside: avoid; }
                @media print {
                    body { background: white; }
                    .cash-flow-container { box-shadow: none; }
                }
            `}</style>
        </div>
    );
}
