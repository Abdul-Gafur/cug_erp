import { Head, usePage } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import { formatCurrency, formatDate } from '@/utils/helpers';

interface Asset {
    id: number;
    asset_code: string;
    asset_name: string;
    category: { name: string } | null;
    fund: { code: string; name: string } | null;
    department: string | null;
    location: string | null;
    purchase_cost: string;
    accumulated_depreciation: string;
    status: string;
}

interface Totals {
    total_cost: number;
    total_accumulated_depreciation: number;
    total_carrying_amount: number;
}

interface Props {
    assets: Asset[];
    totals: Totals;
    generatedAt: string;
}

const statusLabel = (s: string) => {
    const m: Record<string, string> = {
        active: 'Active',
        fully_depreciated: 'Fully Depreciated',
        disposed: 'Disposed',
    };
    return m[s] ?? s;
};

export default function AssetRegisterPrint() {
    const { t } = useTranslation();
    const { assets, totals, generatedAt } = usePage<Props>().props;

    return (
        <>
            <Head title="Asset Register — Finance Committee Report" />

            <style>{`
                @media print {
                    body { margin: 0; }
                    .no-print { display: none !important; }
                    table { page-break-inside: auto; }
                    tr { page-break-inside: avoid; }
                }
                body { font-family: 'Arial', sans-serif; font-size: 11px; color: #1a1a1a; margin: 20px; }
                h1 { font-size: 16px; font-weight: bold; margin-bottom: 2px; }
                h2 { font-size: 12px; font-weight: normal; color: #555; margin-bottom: 16px; }
                table { width: 100%; border-collapse: collapse; margin-top: 12px; }
                th { background: #f3f4f6; border: 1px solid #d1d5db; padding: 5px 8px; text-align: left; font-size: 10px; text-transform: uppercase; }
                td { border: 1px solid #e5e7eb; padding: 5px 8px; }
                .text-right { text-align: right; }
                tfoot td { background: #f9fafb; font-weight: bold; border-top: 2px solid #374151; }
                .print-btn { position: fixed; top: 16px; right: 16px; background: #2563eb; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 13px; }
            `}</style>

            <button className="print-btn no-print" onClick={() => window.print()}>
                {t('Print / Save PDF')}
            </button>

            <h1>Asset Register</h1>
            <h2>
                University Fixed Asset Portfolio — IPSAS 17 Statement<br />
                For submission to the Finance Committee &nbsp;·&nbsp; Generated: {generatedAt}
            </h2>

            <table>
                <thead>
                    <tr>
                        <th>{t('Asset Code')}</th>
                        <th>{t('Description')}</th>
                        <th>{t('Category')}</th>
                        <th>{t('Department / Location')}</th>
                        <th>{t('Fund')}</th>
                        <th className="text-right">{t('Cost')}</th>
                        <th className="text-right">{t('Acc. Depreciation')}</th>
                        <th className="text-right">{t('Carrying Amount')}</th>
                        <th>{t('Status')}</th>
                    </tr>
                </thead>
                <tbody>
                    {assets.map((a) => {
                        const carrying = parseFloat(a.purchase_cost) - parseFloat(a.accumulated_depreciation);
                        return (
                            <tr key={a.id}>
                                <td style={{ fontFamily: 'monospace' }}>{a.asset_code}</td>
                                <td>{a.asset_name}</td>
                                <td>{a.category?.name ?? '-'}</td>
                                <td>{[a.department, a.location].filter(Boolean).join(' / ') || '-'}</td>
                                <td>{a.fund?.code ?? '-'}</td>
                                <td className="text-right">{formatCurrency(a.purchase_cost)}</td>
                                <td className="text-right">{formatCurrency(a.accumulated_depreciation)}</td>
                                <td className="text-right">{formatCurrency(carrying.toFixed(2))}</td>
                                <td>{statusLabel(a.status)}</td>
                            </tr>
                        );
                    })}
                </tbody>
                <tfoot>
                    <tr>
                        <td colSpan={5}>TOTALS — {assets.length} asset(s)</td>
                        <td className="text-right">{formatCurrency(totals.total_cost.toFixed(2))}</td>
                        <td className="text-right">{formatCurrency(totals.total_accumulated_depreciation.toFixed(2))}</td>
                        <td className="text-right">{formatCurrency(totals.total_carrying_amount.toFixed(2))}</td>
                        <td></td>
                    </tr>
                </tfoot>
            </table>

            <p style={{ marginTop: 24, fontSize: 10, color: '#6b7280' }}>
                This report was generated from the university ERP system. Prepared in accordance with IPSAS 17 — Property, Plant and Equipment.
                Depreciation method: Straight-Line. Carrying Amount = Cost − Accumulated Depreciation.
            </p>
        </>
    );
}
