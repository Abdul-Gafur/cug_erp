import React, { useEffect, useState } from 'react';
import { Head, usePage } from '@inertiajs/react';
import html2pdf from 'html2pdf.js';
import { formatCurrency, formatDate, getCompanySetting } from '@/utils/helpers';
import { Rfq, RfqEvaluation, EvaluationScore } from '../Quotations/types';

interface PrintProps {
    quotation: Rfq;
    evaluation: RfqEvaluation;
    totals: Record<number, number>;
    [key: string]: any;
}

export default function Print() {
    const { quotation, evaluation, totals } = usePage<PrintProps>().props;
    const [isDownloading, setIsDownloading] = useState(false);
    const containerRef = React.useRef<HTMLDivElement>(null);

    useEffect(() => {
        const p = new URLSearchParams(window.location.search);
        if (p.get('download') === 'pdf') {
            // Small delay to ensure render is complete
            setTimeout(downloadPDF, 1000);
        }
    }, []);

    const downloadPDF = async () => {
        if (isDownloading) return;
        
        setIsDownloading(true);
        const el = containerRef.current;
        
        if (el) {
            try {
                // Configure html2pdf options
                const opt = {
                    margin: [0.3, 0.3],
                    filename: `bid-evaluation-${quotation.quotation_number}.pdf`,
                    image: { type: 'jpeg', quality: 0.98 },
                    html2canvas: { 
                        scale: 2, 
                        useCORS: true,
                        logging: false,
                        letterRendering: true
                    },
                    jsPDF: { unit: 'in', format: 'a4', orientation: 'landscape' },
                    pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
                };
                
                // Initialize and save
                const worker = html2pdf().set(opt).from(el);
                await worker.save();
                
                // We no longer auto-close as it can interrupt the browser's save process
            } catch (err: any) {
                console.error('PDF Generation Error:', err);
                alert('An error occurred while generating the PDF. Error: ' + (err.message || 'Unknown error'));
            }
        } else {
            alert('Could not find report content container.');
        }
        setIsDownloading(false);
    };

    const handlePrint = () => {
        window.print();
    };

    const handleClose = () => {
        window.close();
    };

    const criteria = evaluation.criteria ?? [];
    const respondedSuppliers = quotation.suppliers?.filter(s => s.status === 'responded') ?? [];

    // Build score matrix
    const matrix: Record<number, Record<number, EvaluationScore>> = {};
    evaluation.scores?.forEach(score => {
        if (!matrix[score.criterion_id]) matrix[score.criterion_id] = {};
        matrix[score.criterion_id][score.supplier_id] = score;
    });

    const ranked = Object.entries(totals)
        .map(([sid, score]) => ({ supplierId: parseInt(sid), score: score as number }))
        .sort((a, b) => b.score - a.score);

    const institutionName = getCompanySetting('company_name') || 'THE UNIVERSITY';

    return (
        <div className="min-h-screen bg-slate-100 print:bg-white pb-20">
            <Head title={`Evaluation Report - ${quotation.quotation_number}`} />

            {/* Action Bar (Hidden on Print/Download) */}
            <div className="sticky top-0 z-50 bg-white border-b shadow-sm p-4 mb-6 print:hidden">
                <div className="max-w-6xl mx-auto flex justify-between items-center">
                    <div>
                        <h3 className="font-bold text-lg">Report Preview: {quotation.quotation_number}</h3>
                        <p className="text-xs text-muted-foreground">Select an option below to save or print the evaluation report.</p>
                    </div>
                    <div className="flex gap-3">
                        <button 
                            onClick={handleClose}
                            className="px-4 py-2 border border-slate-300 hover:bg-slate-100 rounded font-semibold text-sm transition-colors"
                        >
                            Close Preview
                        </button>
                        <button 
                            onClick={handlePrint}
                            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 rounded font-semibold text-sm transition-colors"
                        >
                            Print (Browser)
                        </button>
                        <button 
                            onClick={downloadPDF}
                            disabled={isDownloading}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold text-sm transition-colors disabled:opacity-50"
                        >
                            {isDownloading ? 'Generating PDF...' : 'Download PDF Document'}
                        </button>
                    </div>
                </div>
            </div>

            {isDownloading && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] print:hidden">
                    <div className="bg-white p-8 rounded-xl shadow-2xl flex flex-col items-center gap-4">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                        <p className="font-bold text-blue-900 tracking-tight">Generating Bid Evaluation PDF...</p>
                        <p className="text-sm text-gray-500">This may take a few moments for large reports.</p>
                    </div>
                </div>
            )}

            <div ref={containerRef} className="eval-container bg-white max-w-6xl mx-auto p-10 shadow-lg print:shadow-none text-sm">
                {/* Letterhead */}
                <div className="border-b-4 border-double border-gray-800 pb-4 mb-6">
                    <div className="flex justify-between items-start">
                        <div>
                            <h1 className="text-xl font-bold uppercase">{institutionName}</h1>
                            <div className="text-xs text-gray-600 mt-1">
                                {getCompanySetting('company_address') && <p>{getCompanySetting('company_address')}</p>}
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-lg font-bold border-2 border-gray-800 px-3 py-1 uppercase">
                                Bid Evaluation Report
                            </div>
                            <div className="mt-1 text-xs space-y-0.5">
                                <p><span className="font-semibold">RFQ No.:</span> {quotation.quotation_number}</p>
                                <p><span className="font-semibold">Department:</span> {quotation.department ?? '-'}</p>
                                <p><span className="font-semibold">Evaluation Date:</span> {evaluation.finalised_at ? formatDate(evaluation.finalised_at) : 'Draft'}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Criteria weights */}
                <div className="mb-6">
                    <h2 className="font-bold mb-2">Evaluation Criteria & Weights</h2>
                    <table className="border-collapse text-xs">
                        <thead>
                            <tr className="bg-gray-200">
                                <th className="border border-gray-400 px-3 py-1 text-left">Criterion</th>
                                <th className="border border-gray-400 px-3 py-1 text-center">Weight</th>
                            </tr>
                        </thead>
                        <tbody>
                            {criteria.map(c => (
                                <tr key={c.id}>
                                    <td className="border border-gray-400 px-3 py-1">{c.criterion_name}</td>
                                    <td className="border border-gray-400 px-3 py-1 text-center">{c.weight}%</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Scorecard matrix */}
                <div className="mb-6">
                    <h2 className="font-bold mb-2">Evaluation Scorecard</h2>
                    <table className="w-full border-collapse text-xs">
                        <thead>
                            <tr className="bg-gray-800 text-white">
                                <th className="border border-gray-600 px-2 py-1 text-left">Criterion</th>
                                <th className="border border-gray-600 px-2 py-1 text-center">Wt%</th>
                                {respondedSuppliers.map(s => (
                                    <th key={s.supplier_id} className="border border-gray-600 px-2 py-1 text-center" colSpan={2}>
                                        <div>{s.supplier?.name}</div>
                                        <div className="font-normal text-gray-300">{formatCurrency(s.quoted_amount ?? 0)}</div>
                                    </th>
                                ))}
                            </tr>
                            <tr className="bg-gray-200">
                                <th className="border border-gray-400 px-2 py-1"></th>
                                <th className="border border-gray-400 px-2 py-1"></th>
                                {respondedSuppliers.map(s => (
                                    <React.Fragment key={s.supplier_id}>
                                        <th className="border border-gray-400 px-2 py-1 text-center">Score/100</th>
                                        <th className="border border-gray-400 px-2 py-1 text-center">Wtd</th>
                                    </React.Fragment>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {criteria.map(c => (
                                <tr key={c.id}>
                                    <td className="border border-gray-400 px-2 py-1 font-medium">{c.criterion_name}</td>
                                    <td className="border border-gray-400 px-2 py-1 text-center">{c.weight}%</td>
                                    {respondedSuppliers.map(s => {
                                        const score = matrix[c.id]?.[s.supplier_id];
                                        return (
                                            <React.Fragment key={s.supplier_id}>
                                                <td className="border border-gray-400 px-2 py-1 text-center">{score?.score ?? '—'}</td>
                                                <td className="border border-gray-400 px-2 py-1 text-center">{score ? Number(score.weighted_score).toFixed(2) : '—'}</td>
                                            </React.Fragment>
                                        );
                                    })}
                                </tr>
                            ))}
                            <tr className="font-bold bg-gray-100">
                                <td className="border border-gray-400 px-2 py-1" colSpan={2}>TOTAL WEIGHTED SCORE</td>
                                {respondedSuppliers.map(s => (
                                    <td key={s.supplier_id} className="border border-gray-400 px-2 py-1 text-center" colSpan={2}>
                                        {(totals[s.supplier_id] ?? 0).toFixed(2)}
                                        {ranked[0]?.supplierId === s.supplier_id && ranked[0].score > 0 && ' ★'}
                                    </td>
                                ))}
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* Ranking */}
                <div className="mb-6">
                    <h2 className="font-bold mb-2">Ranking Summary</h2>
                    <table className="border-collapse text-xs">
                        <thead>
                            <tr className="bg-gray-200">
                                <th className="border border-gray-400 px-3 py-1">Rank</th>
                                <th className="border border-gray-400 px-3 py-1">Supplier</th>
                                <th className="border border-gray-400 px-3 py-1">Quoted Amount</th>
                                <th className="border border-gray-400 px-3 py-1">Delivery (days)</th>
                                <th className="border border-gray-400 px-3 py-1">Total Score</th>
                            </tr>
                        </thead>
                        <tbody>
                            {ranked.map((r, i) => {
                                const rfqSup = respondedSuppliers.find(s => s.supplier_id === r.supplierId);
                                return (
                                    <tr key={r.supplierId} className={i === 0 ? 'bg-green-50 font-semibold' : ''}>
                                        <td className="border border-gray-400 px-3 py-1 text-center">#{i + 1}</td>
                                        <td className="border border-gray-400 px-3 py-1">{rfqSup?.supplier?.name}</td>
                                        <td className="border border-gray-400 px-3 py-1">{formatCurrency(rfqSup?.quoted_amount ?? 0)}</td>
                                        <td className="border border-gray-400 px-3 py-1 text-center">{rfqSup?.delivery_days ?? '-'}</td>
                                        <td className="border border-gray-400 px-3 py-1 text-center">{r.score.toFixed(2)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Recommendation */}
                {evaluation.recommended_supplier && (
                    <div className="mb-6 p-4 border-2 border-green-600">
                        <h2 className="font-bold mb-2">Evaluation Committee Recommendation</h2>
                        <p>
                            The Evaluation Committee recommends the award to:{' '}
                            <strong>{evaluation.recommended_supplier.name}</strong>{' '}
                            with a total weighted score of{' '}
                            <strong>{(totals[evaluation.recommended_supplier_id!] ?? 0).toFixed(2)}</strong> points.
                        </p>
                        {evaluation.recommendation_notes && (
                            <p className="mt-2 italic">{evaluation.recommendation_notes}</p>
                        )}
                    </div>
                )}

                {/* Signature block */}
                <div className="mt-8 border-t pt-6">
                    <h2 className="font-bold mb-4">Authorisation</h2>
                    <div className="grid grid-cols-3 gap-8 text-xs">
                        {['Procurement Officer', 'Finance Officer', 'Head of Procurement'].map(role => (
                            <div key={role}>
                                <p className="font-semibold mb-6">{role}</p>
                                <p>Name: _______________________</p>
                                <p className="mt-2">Signature: ____________________</p>
                                <p className="mt-2">Date: _________________________</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <style>{`
                @media print { body { background: white; } }
                @page { margin: 0.3in; size: A4 landscape; }
            `}</style>
        </div>
    );
}
