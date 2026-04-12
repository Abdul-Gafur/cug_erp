import React, { useEffect, useState } from 'react';
import { Head, usePage } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import html2pdf from 'html2pdf.js';
import { formatCurrency, formatDate, getCompanySetting } from '@/utils/helpers';
import { Rfq } from './types';

interface PrintProps {
    quotation: Rfq;
    [key: string]: any;
}

export default function Print() {
    const { t } = useTranslation();
    const { quotation } = usePage<PrintProps>().props;
    const [isDownloading, setIsDownloading] = useState(false);

    useEffect(() => {
        const p = new URLSearchParams(window.location.search);
        if (p.get('download') === 'pdf') downloadPDF();
    }, []);

    const downloadPDF = async () => {
        setIsDownloading(true);
        const el = document.querySelector('.rfq-container');
        if (el) {
            await html2pdf().set({
                margin: 0.3,
                filename: `rfq-${quotation.quotation_number}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2 },
                jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' },
            }).from(el as HTMLElement).save();
            setTimeout(() => window.close(), 1000);
        }
        setIsDownloading(false);
    };

    const institutionName = getCompanySetting('company_name') || 'THE UNIVERSITY';

    return (
        <div className="min-h-screen bg-white">
            <Head title={`RFQ ${quotation.quotation_number}`} />

            {isDownloading && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-lg shadow-lg">
                        <p className="font-semibold">{t('Generating PDF...')}</p>
                    </div>
                </div>
            )}

            <div className="rfq-container bg-white max-w-4xl mx-auto p-10">

                {/* University letterhead */}
                <div className="border-b-4 border-double border-gray-800 pb-4 mb-6">
                    <div className="flex justify-between items-start">
                        <div>
                            <h1 className="text-2xl font-bold uppercase tracking-wide">{institutionName}</h1>
                            <div className="text-sm mt-1 space-y-0.5 text-gray-600">
                                {getCompanySetting('company_address') && <p>{getCompanySetting('company_address')}</p>}
                                {getCompanySetting('company_telephone') && <p>Tel: {getCompanySetting('company_telephone')}</p>}
                                {getCompanySetting('company_email') && <p>Email: {getCompanySetting('company_email')}</p>}
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-xl font-bold border-2 border-gray-800 px-4 py-2 uppercase">
                                Request for Quotation
                            </div>
                            <div className="mt-2 text-sm space-y-1">
                                <p><span className="font-semibold">RFQ No.:</span> {quotation.quotation_number}</p>
                                <p><span className="font-semibold">Date:</span> {formatDate(quotation.quotation_date)}</p>
                                {quotation.closing_date && (
                                    <p><span className="font-semibold">Closing Date:</span> {formatDate(quotation.closing_date)}</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Department & Reference */}
                <div className="grid grid-cols-2 gap-6 mb-6 text-sm">
                    <div>
                        <p><span className="font-semibold">Requesting Department:</span> {quotation.department ?? '-'}</p>
                        {quotation.warehouse && (
                            <p><span className="font-semibold">Delivery Location:</span> {quotation.warehouse.name}</p>
                        )}
                        {quotation.due_date && (
                            <p><span className="font-semibold">Required By:</span> {formatDate(quotation.due_date)}</p>
                        )}
                    </div>
                    <div>
                        {quotation.payment_terms && (
                            <p><span className="font-semibold">Payment Terms:</span> {quotation.payment_terms}</p>
                        )}
                    </div>
                </div>

                {/* Invited suppliers */}
                {quotation.suppliers && quotation.suppliers.length > 0 && (
                    <div className="mb-6 p-3 bg-gray-50 border border-gray-300 text-sm">
                        <p className="font-semibold mb-1">Invited Suppliers:</p>
                        <ul className="list-disc list-inside space-y-0.5">
                            {quotation.suppliers.map(s => (
                                <li key={s.id}>{s.supplier?.name} — {s.supplier?.email}</li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Invitation text */}
                <div className="mb-6 text-sm">
                    <p>
                        You are hereby invited to submit your best quotation for the supply of the items/services
                        listed below. Quotations must be received by <strong>{quotation.closing_date ? formatDate(quotation.closing_date) : '_______________'}</strong>.
                    </p>
                </div>

                {/* Items table */}
                <table className="w-full text-sm mb-8 border-collapse">
                    <thead>
                        <tr className="bg-gray-800 text-white">
                            <th className="border border-gray-600 px-3 py-2 text-left">#</th>
                            <th className="border border-gray-600 px-3 py-2 text-left">Item / Description</th>
                            <th className="border border-gray-600 px-3 py-2 text-center">Qty</th>
                            <th className="border border-gray-600 px-3 py-2 text-right">Unit Price (GHS)</th>
                            <th className="border border-gray-600 px-3 py-2 text-right">Total (GHS)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {quotation.items?.map((item, i) => (
                            <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                <td className="border border-gray-300 px-3 py-2">{i + 1}</td>
                                <td className="border border-gray-300 px-3 py-2">
                                    <div className="font-medium">{item.product?.name}</div>
                                    {item.product?.sku && <div className="text-xs text-gray-500">SKU: {item.product.sku}</div>}
                                </td>
                                <td className="border border-gray-300 px-3 py-2 text-center">{item.quantity}</td>
                                <td className="border border-gray-300 px-3 py-2 text-right">
                                    {item.unit_price > 0 ? formatCurrency(item.unit_price) : '___________'}
                                </td>
                                <td className="border border-gray-300 px-3 py-2 text-right">
                                    {item.total_amount > 0 ? formatCurrency(item.total_amount) : '___________'}
                                </td>
                            </tr>
                        ))}
                        <tr className="font-bold bg-gray-100">
                            <td colSpan={4} className="border border-gray-300 px-3 py-2 text-right">TOTAL:</td>
                            <td className="border border-gray-300 px-3 py-2 text-right">
                                {quotation.total_amount > 0 ? formatCurrency(quotation.total_amount) : '___________'}
                            </td>
                        </tr>
                    </tbody>
                </table>

                {/* Notes */}
                {quotation.notes && (
                    <div className="mb-6 text-sm border-t pt-3">
                        <p className="font-semibold mb-1">Special Requirements / Notes:</p>
                        <p>{quotation.notes}</p>
                    </div>
                )}

                {/* Quotation return section */}
                <div className="border border-gray-400 p-4 text-sm mb-8">
                    <p className="font-semibold mb-2">SUPPLIER QUOTATION RETURN SECTION</p>
                    <p>Please complete and return this section with your quotation:</p>
                    <div className="mt-3 grid grid-cols-2 gap-4">
                        <div>
                            <p>Company Name: ________________________________</p>
                            <p className="mt-2">Total Amount Quoted: __________________</p>
                            <p className="mt-2">Delivery Period (days): ________________</p>
                        </div>
                        <div>
                            <p>VAT Registration No.: ________________________</p>
                            <p className="mt-2">Validity of Offer (days): ______________</p>
                            <p className="mt-2">Payment Terms: ________________________</p>
                        </div>
                    </div>
                    <p className="mt-4">Authorised Signature: _______________________________ Date: _______________</p>
                </div>

                {/* Footer */}
                <div className="text-center text-xs text-gray-500 border-t pt-3">
                    <p>This RFQ does not constitute a commitment to purchase. {institutionName} reserves the right to accept or reject any quotation.</p>
                </div>
            </div>

            <style>{`
                @media print { body { background: white; } }
                @page { margin: 0.3in; size: A4; }
            `}</style>
        </div>
    );
}
