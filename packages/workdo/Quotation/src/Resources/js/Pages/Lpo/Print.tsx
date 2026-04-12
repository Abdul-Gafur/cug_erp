import React, { useEffect, useState } from 'react';
import { Head, usePage } from '@inertiajs/react';
import html2pdf from 'html2pdf.js';
import { formatCurrency, formatDate, getCompanySetting } from '@/utils/helpers';
import { Lpo } from '../Quotations/types';

interface PrintProps {
    lpo: Lpo;
    [key: string]: any;
}

export default function Print() {
    const { lpo } = usePage<PrintProps>().props;
    const [isDownloading, setIsDownloading] = useState(false);

    useEffect(() => {
        const p = new URLSearchParams(window.location.search);
        if (p.get('download') === 'pdf') downloadPDF();
    }, []);

    const downloadPDF = async () => {
        setIsDownloading(true);
        const el = document.querySelector('.lpo-container');
        if (el) {
            await html2pdf().set({
                margin: 0.3,
                filename: `lpo-${lpo.lpo_number}.pdf`,
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
            <Head title={`LPO ${lpo.lpo_number}`} />

            {isDownloading && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-lg">
                        <p className="font-semibold">Generating PDF...</p>
                    </div>
                </div>
            )}

            <div className="lpo-container bg-white max-w-4xl mx-auto p-10 text-sm">

                {/* Letterhead */}
                <div className="border-b-4 border-double border-gray-800 pb-4 mb-6">
                    <div className="flex justify-between items-start">
                        <div>
                            <h1 className="text-2xl font-bold uppercase tracking-wide">{institutionName}</h1>
                            <div className="text-xs mt-1 space-y-0.5 text-gray-600">
                                {getCompanySetting('company_address') && <p>{getCompanySetting('company_address')}</p>}
                                {getCompanySetting('company_telephone') && <p>Tel: {getCompanySetting('company_telephone')}</p>}
                                {getCompanySetting('company_email') && <p>Email: {getCompanySetting('company_email')}</p>}
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-xl font-bold border-2 border-gray-800 px-4 py-2 uppercase">
                                Local Purchase Order
                            </div>
                            <div className="mt-2 text-xs space-y-0.5">
                                <p><span className="font-semibold">LPO No.:</span> {lpo.lpo_number}</p>
                                <p><span className="font-semibold">Date:</span> {formatDate(lpo.lpo_date)}</p>
                                {lpo.rfq?.quotation_number && (
                                    <p><span className="font-semibold">RFQ Ref.:</span> {lpo.rfq.quotation_number}</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Supplier / Department block */}
                <div className="grid grid-cols-2 gap-8 mb-6">
                    <div>
                        <p className="font-bold mb-2 border-b border-gray-300 pb-1">SUPPLIER</p>
                        <p className="font-semibold">{lpo.supplier?.name}</p>
                        <p>{lpo.supplier?.email}</p>
                    </div>
                    <div>
                        <p className="font-bold mb-2 border-b border-gray-300 pb-1">ORDER DETAILS</p>
                        <table className="w-full text-xs">
                            <tbody>
                                <tr>
                                    <td className="py-0.5 font-semibold w-1/2">Issuing Department:</td>
                                    <td>{lpo.issuing_department}</td>
                                </tr>
                                {lpo.delivery_date && (
                                    <tr>
                                        <td className="py-0.5 font-semibold">Required By:</td>
                                        <td>{formatDate(lpo.delivery_date)}</td>
                                    </tr>
                                )}
                                {lpo.delivery_location && (
                                    <tr>
                                        <td className="py-0.5 font-semibold">Deliver To:</td>
                                        <td>{lpo.delivery_location}</td>
                                    </tr>
                                )}
                                {lpo.payment_terms && (
                                    <tr>
                                        <td className="py-0.5 font-semibold">Payment Terms:</td>
                                        <td>{lpo.payment_terms}</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Vote / Account info */}
                {(lpo.vote_account || lpo.fund_type) && (
                    <div className="mb-6 p-3 bg-gray-50 border border-gray-300 text-xs">
                        <div className="flex flex-wrap gap-6">
                            {lpo.vote_account && (
                                <div>
                                    <span className="font-semibold">Vote / Account Charged: </span>
                                    {lpo.vote_account.account_code} — {lpo.vote_account.account_name}
                                </div>
                            )}
                            {lpo.fund_type && (
                                <div>
                                    <span className="font-semibold">Fund: </span>
                                    <span className="capitalize">{lpo.fund_type.replace(/_/g, ' ')}</span>
                                </div>
                            )}
                            {lpo.economic_classification && (
                                <div>
                                    <span className="font-semibold">Classification: </span>
                                    <span className="capitalize">{lpo.economic_classification.replace(/_/g, ' ')}</span>
                                </div>
                            )}
                            {lpo.budget_period && (
                                <div>
                                    <span className="font-semibold">Budget Period: </span>
                                    {lpo.budget_period.period_name}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Items */}
                <table className="w-full border-collapse mb-6">
                    <thead>
                        <tr className="bg-gray-800 text-white text-xs">
                            <th className="border border-gray-600 px-2 py-1 text-left">#</th>
                            <th className="border border-gray-600 px-2 py-1 text-left">Description</th>
                            <th className="border border-gray-600 px-2 py-1 text-center">Qty</th>
                            <th className="border border-gray-600 px-2 py-1 text-center">Unit</th>
                            <th className="border border-gray-600 px-2 py-1 text-right">Unit Price</th>
                            <th className="border border-gray-600 px-2 py-1 text-right">Discount</th>
                            <th className="border border-gray-600 px-2 py-1 text-right">Tax</th>
                            <th className="border border-gray-600 px-2 py-1 text-right">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {lpo.items?.map((item, i) => (
                            <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                <td className="border border-gray-300 px-2 py-1 text-xs">{i + 1}</td>
                                <td className="border border-gray-300 px-2 py-1 text-xs">{item.description}</td>
                                <td className="border border-gray-300 px-2 py-1 text-center text-xs">{item.quantity}</td>
                                <td className="border border-gray-300 px-2 py-1 text-center text-xs">{item.unit ?? '-'}</td>
                                <td className="border border-gray-300 px-2 py-1 text-right text-xs">{formatCurrency(item.unit_price)}</td>
                                <td className="border border-gray-300 px-2 py-1 text-right text-xs">
                                    {item.discount_percentage > 0 ? `${item.discount_percentage}%` : '-'}
                                </td>
                                <td className="border border-gray-300 px-2 py-1 text-right text-xs">
                                    {item.tax_percentage > 0 ? `${item.tax_percentage}%` : '-'}
                                </td>
                                <td className="border border-gray-300 px-2 py-1 text-right text-xs font-semibold">
                                    {formatCurrency(item.total_amount)}
                                </td>
                            </tr>
                        ))}
                        {/* Totals */}
                        <tr>
                            <td colSpan={7} className="border border-gray-300 px-2 py-1 text-right text-xs font-semibold">Subtotal</td>
                            <td className="border border-gray-300 px-2 py-1 text-right text-xs">{formatCurrency(lpo.subtotal)}</td>
                        </tr>
                        {lpo.discount_amount > 0 && (
                            <tr>
                                <td colSpan={7} className="border border-gray-300 px-2 py-1 text-right text-xs">Discount</td>
                                <td className="border border-gray-300 px-2 py-1 text-right text-xs">-{formatCurrency(lpo.discount_amount)}</td>
                            </tr>
                        )}
                        {lpo.tax_amount > 0 && (
                            <tr>
                                <td colSpan={7} className="border border-gray-300 px-2 py-1 text-right text-xs">Tax / VAT</td>
                                <td className="border border-gray-300 px-2 py-1 text-right text-xs">{formatCurrency(lpo.tax_amount)}</td>
                            </tr>
                        )}
                        <tr className="font-bold bg-gray-200">
                            <td colSpan={7} className="border border-gray-400 px-2 py-2 text-right">TOTAL AMOUNT</td>
                            <td className="border border-gray-400 px-2 py-2 text-right text-base">{formatCurrency(lpo.total_amount)}</td>
                        </tr>
                    </tbody>
                </table>

                {/* Notes */}
                {lpo.notes && (
                    <div className="mb-6 text-xs border-t pt-3">
                        <p className="font-semibold mb-1">Notes / Special Instructions:</p>
                        <p>{lpo.notes}</p>
                    </div>
                )}

                {/* Authorisation signatures */}
                <div className="mt-8 border-t-2 border-gray-800 pt-6">
                    <p className="font-bold text-xs mb-4 uppercase tracking-wide">Authorisation</p>
                    <div className="grid grid-cols-3 gap-8 text-xs">
                        {[
                            { role: 'Procurement Officer', name: lpo.approved_by_user?.name },
                            { role: 'Finance Officer' },
                            { role: 'Bursar / Authorising Officer' },
                        ].map(({ role, name }) => (
                            <div key={role}>
                                <p className="font-semibold mb-6">{role}</p>
                                <p>Name: {name ? name : '_______________________'}</p>
                                <p className="mt-3">Signature: ____________________</p>
                                <p className="mt-3">Date: {name && lpo.approved_at ? formatDate(lpo.approved_at) : '_____________________'}</p>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="text-center text-xs text-gray-400 mt-8 border-t pt-3">
                    <p>This is an official procurement document of {institutionName}. Any alteration invalidates this order.</p>
                </div>
            </div>

            <style>{`
                @media print { body { background: white; } }
                @page { margin: 0.3in; size: A4; }
            `}</style>
        </div>
    );
}
