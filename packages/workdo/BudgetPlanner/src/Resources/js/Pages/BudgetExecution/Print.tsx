import React, { useEffect, useState } from 'react';
import { Head, usePage } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import html2pdf from 'html2pdf.js';
import { formatCurrency, getCompanySetting } from '@/utils/helpers';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ExecutionRow {
    vote_id: number;
    vote_code: string;
    vote_name: string;
    fund_type: string;
    economic_classification: string;
    account_code: string | null;
    account_name: string | null;
    q1_budget: number; q1_actual: number;
    q2_budget: number; q2_actual: number;
    q3_budget: number; q3_actual: number;
    q4_budget: number; q4_actual: number;
    original_budget: number;
    revised_budget: number | null;
    final_budget: number;
    committed: number;
    full_year_actual: number;
    variance: number;
    variance_pct: number;
}

interface Totals {
    original_budget: number; revised_budget: number; final_budget: number;
    q1_budget: number; q1_actual: number;
    q2_budget: number; q2_actual: number;
    q3_budget: number; q3_actual: number;
    q4_budget: number; q4_actual: number;
    committed: number; full_year_actual: number; variance: number;
}

interface Period {
    period_name: string;
    financial_year: string;
    start_date: string;
    end_date: string;
    status: string;
}

// ── Label maps ────────────────────────────────────────────────────────────────

const ECON_LABELS: Record<string, string> = {
    personnel_emoluments: 'Personnel Emoluments',
    goods_services:       'Goods & Services',
    capital_expenditure:  'Capital Expenditure',
    transfers_grants:     'Transfers & Grants',
};

const FUND_LABELS: Record<string, string> = {
    general_fund:        'General Fund',
    igf:                 'IGF',
    research_grants:     'Research & Grants',
    donor_endowment:     'Donor / Endowment',
    capital_development: 'Capital Development',
};

// ── Grouping ─────────────────────────────────────────────────────────────────

type EconGroup = { label: string; rows: ExecutionRow[] };
type FundGroup = { label: string; econs: Map<string, EconGroup> };
type VoteGroup = { code: string; name: string; funds: Map<string, FundGroup> };

function buildGroups(rows: ExecutionRow[]): Map<string, VoteGroup> {
    const votes = new Map<string, VoteGroup>();
    for (const row of rows) {
        const vKey = row.vote_code;
        if (!votes.has(vKey)) votes.set(vKey, { code: row.vote_code, name: row.vote_name, funds: new Map() });
        const vg = votes.get(vKey)!;
        if (!vg.funds.has(row.fund_type)) vg.funds.set(row.fund_type, { label: FUND_LABELS[row.fund_type] ?? row.fund_type, econs: new Map() });
        const fg = vg.funds.get(row.fund_type)!;
        if (!fg.econs.has(row.economic_classification)) fg.econs.set(row.economic_classification, { label: ECON_LABELS[row.economic_classification] ?? row.economic_classification, rows: [] });
        fg.econs.get(row.economic_classification)!.rows.push(row);
    }
    return votes;
}

function sumRows(rows: ExecutionRow[]) {
    return {
        original_budget:  rows.reduce((s, r) => s + r.original_budget, 0),
        revised_budget:   rows.reduce((s, r) => s + (r.revised_budget ?? r.original_budget), 0),
        committed:        rows.reduce((s, r) => s + r.committed, 0),
        q1_budget: rows.reduce((s, r) => s + r.q1_budget, 0), q1_actual: rows.reduce((s, r) => s + r.q1_actual, 0),
        q2_budget: rows.reduce((s, r) => s + r.q2_budget, 0), q2_actual: rows.reduce((s, r) => s + r.q2_actual, 0),
        q3_budget: rows.reduce((s, r) => s + r.q3_budget, 0), q3_actual: rows.reduce((s, r) => s + r.q3_actual, 0),
        q4_budget: rows.reduce((s, r) => s + r.q4_budget, 0), q4_actual: rows.reduce((s, r) => s + r.q4_actual, 0),
        full_year_actual: rows.reduce((s, r) => s + r.full_year_actual, 0),
        variance:         rows.reduce((s, r) => s + r.variance, 0),
    };
}

// ── Small cell components ─────────────────────────────────────────────────────

const N = ({ v, bold = false, color = '' }: { v: number; bold?: boolean; color?: string }) => (
    <td style={{ textAlign: 'right', padding: '2px 4px', whiteSpace: 'nowrap', fontWeight: bold ? 600 : 400, color: color || 'inherit' }}>
        {formatCurrency(v)}
    </td>
);

// ── Main component ────────────────────────────────────────────────────────────

export default function Print() {
    const { t } = useTranslation();
    const { rows, totals, period, filters } = usePage<any>().props;
    const [isGenerating, setIsGenerating] = useState(false);

    const quarterFilter = parseInt(filters?.quarter) || 0;
    const ytdLabel = quarterFilter > 0 ? `YTD Actual (Q1–Q${quarterFilter})` : 'Full Year Actual';

    const groups  = buildGroups(rows as ExecutionRow[]);
    const allRows = rows as ExecutionRow[];
    const T       = totals as Totals;
    const P       = period as Period | null;
    const isUnaudited = P && P.status !== 'closed';

    const ytdForRow = (row: ExecutionRow): number => {
        if (quarterFilter === 1) return row.q1_actual;
        if (quarterFilter === 2) return row.q1_actual + row.q2_actual;
        if (quarterFilter === 3) return row.q1_actual + row.q2_actual + row.q3_actual;
        return row.full_year_actual;
    };
    const ytdTotal = allRows.reduce((s, r) => s + ytdForRow(r), 0);

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('download') === 'pdf') {
            downloadPDF();
        }
    }, []);

    const downloadPDF = async () => {
        setIsGenerating(true);
        const el = document.querySelector('.bpr-container') as HTMLElement | null;
        if (el) {
            const opt = {
                margin: [0.2, 0.15],
                filename: `budget-performance-report-${P?.financial_year ?? 'report'}.pdf`,
                image: { type: 'jpeg' as const, quality: 0.97 },
                html2canvas: { scale: 1.5, useCORS: true },
                jsPDF: { unit: 'in', format: 'a4', orientation: 'landscape' as const },
            };
            try {
                await (html2pdf as any)().set(opt).from(el).save();
                setTimeout(() => window.close(), 1200);
            } catch (e) {
                console.error('PDF generation failed', e);
            }
        }
        setIsGenerating(false);
    };

    const tdH: React.CSSProperties = {
        padding: '3px 4px', border: '1px solid #ccc',
        background: '#dce6f1', fontWeight: 700, textAlign: 'right',
        fontSize: '7.5px', textTransform: 'uppercase', whiteSpace: 'nowrap',
    };
    const tdHL: React.CSSProperties = { ...tdH, textAlign: 'left' };
    const tdSub: React.CSSProperties = { padding: '2px 4px', background: '#e8ecf0', fontWeight: 600, fontSize: '7px' };
    const tdVote: React.CSSProperties = { padding: '2px 6px', background: '#dbeafe', fontWeight: 700, fontSize: '7.5px' };

    return (
        <div style={{ background: '#fff', minHeight: '100vh' }}>
            <Head title={t('Budget Performance Report')} />

            {isGenerating && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
                    <div style={{ background: '#fff', padding: '24px 32px', borderRadius: '8px', boxShadow: '0 4px 20px rgba(0,0,0,.15)' }}>
                        <p style={{ fontSize: '16px', fontWeight: 600 }}>Generating PDF…</p>
                    </div>
                </div>
            )}

            {/* Download button — visible on screen, hidden in PDF */}
            <div className="print:hidden" style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', gap: '8px' }}>
                <button
                    onClick={downloadPDF}
                    style={{ padding: '6px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
                >
                    {t('Download PDF')}
                </button>
                <button
                    onClick={() => window.close()}
                    style={{ padding: '6px 16px', background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}
                >
                    {t('Close')}
                </button>
            </div>

            <div className="bpr-container" style={{ background: '#fff', padding: '16px 20px', fontFamily: 'Arial, sans-serif' }}>

                {/* ── Report header ─────────────────────────────────────────── */}
                <table style={{ width: '100%', marginBottom: '10px', borderCollapse: 'collapse' }}>
                    <tbody>
                        <tr>
                            <td style={{ verticalAlign: 'top', width: '60%' }}>
                                <div style={{ fontSize: '13px', fontWeight: 700 }}>
                                    {getCompanySetting('company_name') || 'University'}
                                </div>
                                {getCompanySetting('company_address') && (
                                    <div style={{ fontSize: '9px', color: '#555' }}>{getCompanySetting('company_address')}</div>
                                )}
                            </td>
                            <td style={{ verticalAlign: 'top', textAlign: 'right' }}>
                                <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    Budget Performance Report
                                    {isUnaudited && (
                                        <span style={{ marginLeft: '8px', fontSize: '8px', fontWeight: 700, color: '#b45309', border: '1px solid #f59e0b', padding: '1px 5px', borderRadius: '3px' }}>
                                            UNAUDITED
                                        </span>
                                    )}
                                </div>
                                <div style={{ fontSize: '8px', color: '#555', marginTop: '2px' }}>IPSAS 24 — Statement of Comparison of Budget and Actual Amounts</div>
                                {P && (
                                    <div style={{ fontSize: '8px', color: '#333', marginTop: '3px' }}>
                                        Fiscal Year: <strong>{P.financial_year}</strong> &nbsp;|&nbsp;
                                        Period: <strong>{P.period_name}</strong>
                                        {quarterFilter > 0 && <> &nbsp;|&nbsp; As at: <strong>Q{quarterFilter}</strong></>}
                                    </div>
                                )}
                                <div style={{ fontSize: '8px', color: '#555', marginTop: '2px' }}>
                                    Amounts in GHS &nbsp;|&nbsp; Generated: {new Date().toLocaleDateString('en-GB')}
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>

                {/* ── Table ────────────────────────────────────────────────── */}
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '7px' }}>
                    <thead>
                        <tr>
                            <th style={{ ...tdHL, minWidth: '90px' }} rowSpan={2}>Vote / Dept</th>
                            <th style={{ ...tdHL, minWidth: '70px' }} rowSpan={2}>Fund</th>
                            <th style={{ ...tdHL, minWidth: '90px' }} rowSpan={2}>Econ. Class.</th>
                            <th style={{ ...tdH, width: '45px' }} rowSpan={2}>Code</th>
                            <th style={{ ...tdHL, minWidth: '100px' }} rowSpan={2}>Account Name</th>
                            <th style={{ ...tdH, minWidth: '65px' }} rowSpan={2}>Orig. Budget</th>
                            <th style={{ ...tdH, minWidth: '65px' }} rowSpan={2}>Revised Budget</th>
                            <th style={{ ...tdH, minWidth: '65px' }} rowSpan={2}>Committed</th>
                            <th style={{ ...tdH, minWidth: '120px' }} colSpan={2}>Q1</th>
                            <th style={{ ...tdH, minWidth: '120px' }} colSpan={2}>Q2</th>
                            <th style={{ ...tdH, minWidth: '120px' }} colSpan={2}>Q3</th>
                            <th style={{ ...tdH, minWidth: '120px' }} colSpan={2}>Q4</th>
                            <th style={{ ...tdH, minWidth: '70px' }} rowSpan={2}>{ytdLabel}</th>
                            <th style={{ ...tdH, minWidth: '65px' }} rowSpan={2}>Variance</th>
                            <th style={{ ...tdH, width: '40px' }} rowSpan={2}>Var %</th>
                        </tr>
                        <tr>
                            {(['Q1', 'Q2', 'Q3', 'Q4'] as const).map(q => (
                                <React.Fragment key={q}>
                                    <th style={{ ...tdH }}>Budgt</th>
                                    <th style={{ ...tdH }}>Actual</th>
                                </React.Fragment>
                            ))}
                        </tr>
                    </thead>

                    <tbody>
                        {allRows.length === 0 ? (
                            <tr>
                                <td colSpan={20} style={{ padding: '20px', textAlign: 'center', color: '#999', fontSize: '9px' }}>
                                    No data for selected filters.
                                </td>
                            </tr>
                        ) : (
                            Array.from(groups.entries()).map(([vKey, vg]) => {
                                const voteRows = Array.from(vg.funds.values())
                                    .flatMap(fg => Array.from(fg.econs.values()).flatMap(eg => eg.rows));
                                const vSub = sumRows(voteRows);

                                return (
                                    <React.Fragment key={`v-${vKey}`}>
                                        {/* Vote header */}
                                        <tr style={{ background: '#dbeafe' }}>
                                            <td colSpan={20} style={{ ...tdVote, borderBottom: '1px solid #93c5fd' }}>
                                                {vg.code} — {vg.name}
                                            </td>
                                        </tr>

                                        {Array.from(vg.funds.entries()).map(([fKey, fg]) => {
                                            const fundRows = Array.from(fg.econs.values()).flatMap(eg => eg.rows);
                                            const fSub = sumRows(fundRows);

                                            return (
                                                <React.Fragment key={`f-${vKey}-${fKey}`}>
                                                    {/* Fund header */}
                                                    <tr style={{ background: '#f3f4f6' }}>
                                                        <td style={{ padding: '2px 6px' }} />
                                                        <td colSpan={19} style={{ padding: '2px 4px', fontWeight: 600, fontSize: '7px', borderBottom: '1px solid #e5e7eb' }}>
                                                            {fg.label}
                                                        </td>
                                                    </tr>

                                                    {Array.from(fg.econs.entries()).map(([eKey, eg]) => {
                                                        const eSub = sumRows(eg.rows);
                                                        return (
                                                            <React.Fragment key={`e-${vKey}-${fKey}-${eKey}`}>
                                                                {/* Econ header */}
                                                                <tr>
                                                                    <td style={{ padding: '1px 6px' }} colSpan={2} />
                                                                    <td colSpan={18} style={{ padding: '1px 4px', fontStyle: 'italic', color: '#6b7280', fontSize: '7px' }}>
                                                                        {eg.label}
                                                                    </td>
                                                                </tr>

                                                                {/* Data rows */}
                                                                {eg.rows.map((row, i) => {
                                                                    const ytd  = ytdForRow(row);
                                                                    const vari = row.final_budget - ytd;
                                                                    const variPct = row.final_budget > 0
                                                                        ? ((vari / row.final_budget) * 100).toFixed(1)
                                                                        : '—';
                                                                    const overBudget  = row.final_budget > 0 && row.full_year_actual > row.final_budget;
                                                                    const underUtil   = row.final_budget > 0 && (row.q1_actual + row.q2_actual) < 0.5 * row.final_budget;
                                                                    const rowStyle: React.CSSProperties = {
                                                                        background: overBudget ? '#fee2e2' : underUtil ? '#fef3c7' : i % 2 === 0 ? '#fff' : '#f9fafb',
                                                                        borderBottom: '1px solid #e5e7eb',
                                                                    };
                                                                    const td: React.CSSProperties = { padding: '2px 4px', whiteSpace: 'nowrap', verticalAlign: 'middle' };

                                                                    return (
                                                                        <tr key={row.allocation_id} style={rowStyle}>
                                                                            <td style={td} /><td style={td} /><td style={td} />
                                                                            <td style={{ ...td, fontFamily: 'monospace', fontSize: '7px' }}>{row.account_code}</td>
                                                                            <td style={{ ...td, maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.account_name}</td>
                                                                            <N v={row.original_budget} />
                                                                            <td style={{ ...td, textAlign: 'right' }}>
                                                                                {row.revised_budget !== null ? formatCurrency(row.revised_budget) : '—'}
                                                                            </td>
                                                                            <N v={row.committed} color="#92400e" />
                                                                            <N v={row.q1_budget} /><N v={row.q1_actual} />
                                                                            <N v={row.q2_budget} /><N v={row.q2_actual} />
                                                                            <N v={row.q3_budget} /><N v={row.q3_actual} />
                                                                            <N v={row.q4_budget} /><N v={row.q4_actual} />
                                                                            <N v={ytd} bold={overBudget} color={overBudget ? '#b91c1c' : ''} />
                                                                            <N v={vari} color={vari < 0 ? '#b91c1c' : '#166534'} />
                                                                            <td style={{ ...td, textAlign: 'right', color: vari < 0 ? '#b91c1c' : '#166534' }}>
                                                                                {variPct}%
                                                                            </td>
                                                                        </tr>
                                                                    );
                                                                })}

                                                                {/* Econ subtotal */}
                                                                <tr style={{ background: '#e5e7eb', borderTop: '1px solid #9ca3af' }}>
                                                                    <td colSpan={5} style={{ ...tdSub, textAlign: 'right', fontStyle: 'italic' }}>{eg.label} Total</td>
                                                                    <N v={eSub.original_budget} bold /><N v={eSub.revised_budget} bold /><N v={eSub.committed} bold color="#92400e" />
                                                                    <N v={eSub.q1_budget} bold /><N v={eSub.q1_actual} bold />
                                                                    <N v={eSub.q2_budget} bold /><N v={eSub.q2_actual} bold />
                                                                    <N v={eSub.q3_budget} bold /><N v={eSub.q3_actual} bold />
                                                                    <N v={eSub.q4_budget} bold /><N v={eSub.q4_actual} bold />
                                                                    <N v={eSub.full_year_actual} bold />
                                                                    <N v={eSub.variance} bold color={eSub.variance < 0 ? '#b91c1c' : '#166534'} />
                                                                    <td />
                                                                </tr>
                                                            </React.Fragment>
                                                        );
                                                    })}

                                                    {/* Fund subtotal */}
                                                    <tr style={{ background: '#d1d5db', borderTop: '2px solid #9ca3af' }}>
                                                        <td colSpan={5} style={{ ...tdSub, textAlign: 'right', fontSize: '7.5px' }}>{fg.label} Total</td>
                                                        <N v={fSub.original_budget} bold /><N v={fSub.revised_budget} bold /><N v={fSub.committed} bold color="#92400e" />
                                                        <N v={fSub.q1_budget} bold /><N v={fSub.q1_actual} bold />
                                                        <N v={fSub.q2_budget} bold /><N v={fSub.q2_actual} bold />
                                                        <N v={fSub.q3_budget} bold /><N v={fSub.q3_actual} bold />
                                                        <N v={fSub.q4_budget} bold /><N v={fSub.q4_actual} bold />
                                                        <N v={fSub.full_year_actual} bold />
                                                        <N v={fSub.variance} bold color={fSub.variance < 0 ? '#b91c1c' : '#166534'} />
                                                        <td />
                                                    </tr>
                                                </React.Fragment>
                                            );
                                        })}

                                        {/* Vote subtotal */}
                                        <tr style={{ background: '#bfdbfe', borderTop: '2px solid #3b82f6' }}>
                                            <td colSpan={5} style={{ ...tdVote, textAlign: 'right' }}>{vg.code} — {vg.name} Total</td>
                                            <N v={vSub.original_budget} bold /><N v={vSub.revised_budget} bold /><N v={vSub.committed} bold color="#92400e" />
                                            <N v={vSub.q1_budget} bold /><N v={vSub.q1_actual} bold />
                                            <N v={vSub.q2_budget} bold /><N v={vSub.q2_actual} bold />
                                            <N v={vSub.q3_budget} bold /><N v={vSub.q3_actual} bold />
                                            <N v={vSub.q4_budget} bold /><N v={vSub.q4_actual} bold />
                                            <N v={vSub.full_year_actual} bold />
                                            <N v={vSub.variance} bold color={vSub.variance < 0 ? '#b91c1c' : '#166534'} />
                                            <td />
                                        </tr>
                                    </React.Fragment>
                                );
                            })
                        )}
                    </tbody>

                    {/* Grand total */}
                    {allRows.length > 0 && (
                        <tfoot>
                            <tr style={{ background: '#1e3a5f', color: '#fff', borderTop: '3px solid #1e40af' }}>
                                <td colSpan={5} style={{ padding: '3px 6px', fontWeight: 700, fontSize: '8px', textTransform: 'uppercase', textAlign: 'right' }}>
                                    Grand Total
                                </td>
                                {[
                                    T.original_budget, T.revised_budget, T.committed,
                                    T.q1_budget, T.q1_actual,
                                    T.q2_budget, T.q2_actual,
                                    T.q3_budget, T.q3_actual,
                                    T.q4_budget, T.q4_actual,
                                    ytdTotal,
                                    T.final_budget - ytdTotal,
                                ].map((v, i) => (
                                    <td key={i} style={{ padding: '3px 4px', textAlign: 'right', fontWeight: 700, fontSize: '7.5px', whiteSpace: 'nowrap' }}>
                                        {formatCurrency(v)}
                                    </td>
                                ))}
                                <td />
                            </tr>
                        </tfoot>
                    )}
                </table>

                {/* ── Footer ────────────────────────────────────────────────── */}
                <div style={{ marginTop: '12px', paddingTop: '6px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', fontSize: '7px', color: '#6b7280' }}>
                    <span>Prepared by Finance Office</span>
                    <span>
                        {isUnaudited ? 'UNAUDITED — Subject to external audit' : 'Audited'}
                    </span>
                    <span>Page 1</span>
                </div>
            </div>

            <style>{`
                @page { size: A4 landscape; margin: 0.2in 0.15in; }
                @media print {
                    body { background: white; }
                    .print\\:hidden { display: none !important; }
                    .bpr-container { padding: 0; }
                }
                body { -webkit-print-color-adjust: exact; color-adjust: exact; }
            `}</style>
        </div>
    );
}
