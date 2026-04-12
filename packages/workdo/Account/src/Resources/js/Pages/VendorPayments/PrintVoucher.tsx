import { Head, usePage } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import { formatDate } from '@/utils/helpers';

/**
 * Payment Voucher — Ghana Public Sector Standard
 *
 * Complies with Ghana Revenue Authority (GRA) requirements:
 *   - Full GRA tax breakdown: NHIL / GETFund / CHRL / VAT / WHT
 *   - Separate PV number from internal payment number
 *   - Supplier TIN displayed
 *   - 3-signature block: Accountant / Finance Officer / CFO
 *   - IPSAS accrual note
 */

interface InvoiceSubmission {
    invoice_number: string;
    invoice_date: string;
    po_reference?: string;
    delivery_note_number?: string;
    supplier_type: string;
    goods_or_services: string;
    base_amount: number;
    nhil_amount: number;
    getfund_amount: number;
    chrl_amount: number;
    vat_base_amount: number;
    vat_amount: number;
    gross_amount: number;
    wht_rate: number;
    wht_amount: number;
    net_payable: number;
}

interface Allocation {
    invoice?: { invoice_number: string; total_amount: number };
    allocated_amount: number;
}

interface ApprovalUser {
    name: string;
}

interface Payment {
    id: number;
    payment_number: string;
    pv_number?: string;
    payment_date: string;
    payment_amount: number;
    payment_method?: string;
    cheque_number?: string;
    narration?: string;
    reference_number?: string;
    status: string;
    approval_stage: string;
    hod_approved_by?: ApprovalUser;
    hod_approved_at?: string;
    finance_approved_by?: ApprovalUser;
    finance_approved_at?: string;
    cfo_approved_by?: ApprovalUser;
    cfo_approved_at?: string;
    vendor?: { name: string; email?: string };
    bank_account?: {
        account_name: string;
        account_number: string;
        bank_name: string;
        gl_account?: { account_code: string; account_name: string };
    };
    allocations?: Allocation[];
    invoice_submission?: InvoiceSubmission;
}

interface VendorProfile {
    bank_name?: string;
    account_number?: string;
    account_name?: string;
    tax_id?: string;
    tin?: string;
    registration_number?: string;
}

interface CompanySettings {
    company_name?: string;
    company_address?: string;
    company_phone?: string;
    company_email?: string;
    company_logo?: string;
}

/** Convert a number to English words (handles 0–999,999,999) */
function numberToWords(n: number): string {
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight',
                  'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen',
                  'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    const toWords = (num: number): string => {
        if (num === 0) return '';
        if (num < 20) return ones[num];
        if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? ' ' + ones[num % 10] : '');
        return ones[Math.floor(num / 100)] + ' Hundred' + (num % 100 ? ' ' + toWords(num % 100) : '');
    };

    const intPart = Math.floor(n);
    const decPart = Math.round((n - intPart) * 100);
    let result = '';
    if (intPart >= 1_000_000) result += toWords(Math.floor(intPart / 1_000_000)) + ' Million ';
    if (intPart >= 1_000)     result += toWords(Math.floor((intPart % 1_000_000) / 1_000)) + ' Thousand ';
    result += toWords(intPart % 1_000);
    result = result.trim() + ' Ghana Cedis';
    if (decPart > 0) result += ' and ' + toWords(decPart) + ' Pesewas';
    return result + ' Only';
}

const fmt = (n: number) => Number(n).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const Row = ({ label, value, bold, className = '' }: { label: string; value: React.ReactNode; bold?: boolean; className?: string }) => (
    <tr>
        <td style={{ border: '1px solid #000', padding: '6px 10px', fontWeight: bold ? 700 : 600, width: '40%', backgroundColor: '#f5f5f5', fontSize: '10pt' }}>{label}</td>
        <td style={{ border: '1px solid #000', padding: '6px 10px', fontWeight: bold ? 700 : 400, fontSize: bold ? '11pt' : '10pt' }} className={className}>{value}</td>
    </tr>
);

const TaxRow = ({ label, rate, amount, highlight, negative }: { label: string; rate?: string; amount: number; highlight?: string; negative?: boolean }) => (
    <tr style={{ backgroundColor: highlight || 'transparent' }}>
        <td style={{ border: '1px solid #aaa', padding: '4px 8px', fontSize: '9pt' }}>{label}</td>
        <td style={{ border: '1px solid #aaa', padding: '4px 8px', textAlign: 'right', fontSize: '9pt', color: '#2563eb' }}>{rate ?? ''}</td>
        <td style={{ border: '1px solid #aaa', padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace', fontSize: '9pt', color: negative ? '#dc2626' : undefined }}>
            {negative ? `(${fmt(amount)})` : fmt(amount)}
        </td>
    </tr>
);

export default function PrintVoucher() {
    const { payment, vendorProfile, companySettings } = usePage<{
        payment: Payment;
        vendorProfile: VendorProfile | null;
        companySettings: CompanySettings | null;
    }>().props;
    const { t } = useTranslation();

    const institutionName = companySettings?.company_name ?? 'University';
    const sub   = payment.invoice_submission;
    const pvNum = payment.pv_number || payment.payment_number;
    const tin   = vendorProfile?.tax_id || vendorProfile?.tin || '—';

    // Determine net payable from submission or payment amount
    const netPayable = sub ? Number(sub.net_payable) : Number(payment.payment_amount);

    return (
        <>
            <Head title={`PV — ${pvNum}`} />

            <style>{`
                @media print {
                    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    .no-print { display: none !important; }
                }
                body { font-family: 'Times New Roman', Times, serif; font-size: 11pt; color: #000; background: #fff; }
                @page { size: A4; margin: 1cm; }
            `}</style>

            {/* Print controls */}
            <div className="no-print fixed top-4 right-4 flex gap-2 z-50">
                <button onClick={() => window.print()}
                    style={{ background: '#1d4ed8', color: '#fff', padding: '8px 16px', borderRadius: 6, cursor: 'pointer', fontSize: '13px' }}>
                    🖨️ {t('Print Voucher')}
                </button>
                <button onClick={() => window.history.back()}
                    style={{ background: '#f3f4f6', color: '#374151', padding: '8px 16px', borderRadius: 6, cursor: 'pointer', fontSize: '13px' }}>
                    ← {t('Back')}
                </button>
            </div>

            <div style={{ maxWidth: '800px', margin: '0 auto', padding: '30px', background: '#fff' }}>

                {/* ── HEADER ─────────────────────────────────────────────── */}
                <div style={{ textAlign: 'center', borderBottom: '3px solid #000', paddingBottom: '16px', marginBottom: '16px' }}>
                    <h1 style={{ fontSize: '16pt', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>
                        {institutionName}
                    </h1>
                    {companySettings?.company_address && (
                        <p style={{ fontSize: '10pt', margin: '4px 0' }}>{companySettings.company_address}</p>
                    )}
                    {(companySettings?.company_phone || companySettings?.company_email) && (
                        <p style={{ fontSize: '9pt', color: '#555', margin: '2px 0' }}>
                            {companySettings.company_phone} {companySettings.company_email && `| ${companySettings.company_email}`}
                        </p>
                    )}
                    <h2 style={{ fontSize: '14pt', fontWeight: 700, textTransform: 'uppercase', border: '2px solid #000', display: 'inline-block', padding: '4px 24px', marginTop: '12px' }}>
                        PAYMENT VOUCHER
                    </h2>
                </div>

                {/* ── VOUCHER REF / DATE ─────────────────────────────────── */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '10pt' }}>
                    <div>
                        <strong>{t('PV Number')}:</strong>
                        <span style={{ fontFamily: 'monospace', marginLeft: '8px', fontWeight: 700, color: '#7c3aed' }}>{pvNum}</span>
                    </div>
                    <div>
                        <strong>{t('Date')}:</strong>
                        <span style={{ marginLeft: '8px' }}>{formatDate(payment.payment_date)}</span>
                    </div>
                    <div>
                        <strong>{t('Internal Ref')}:</strong>
                        <span style={{ fontFamily: 'monospace', marginLeft: '8px', color: '#555' }}>{payment.payment_number}</span>
                    </div>
                </div>

                {/* ── MAIN DETAILS TABLE ────────────────────────────────────── */}
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px' }}>
                    <tbody>
                        <Row label={t('Pay To (Payee)')} value={<strong>{payment.vendor?.name ?? '—'}</strong>} bold />
                        <Row label={t('Supplier TIN')} value={<span style={{ fontFamily: 'monospace' }}>{tin}</span>} />
                        {vendorProfile?.bank_name && (
                            <Row
                                label={t("Payee's Bank")}
                                value={`${vendorProfile.bank_name} — A/C ${vendorProfile.account_number ?? ''}${vendorProfile.account_name ? ` (${vendorProfile.account_name})` : ''}`}
                            />
                        )}
                        {sub && (
                            <>
                                <Row label={t('Invoice Reference')} value={<span style={{ fontFamily: 'monospace' }}>{sub.invoice_number}</span>} />
                                <Row label={t('Invoice Date')}      value={formatDate(sub.invoice_date)} />
                                {sub.po_reference && <Row label={t('Purchase Order Ref')} value={<span style={{ fontFamily: 'monospace' }}>{sub.po_reference}</span>} />}
                                {sub.delivery_note_number && <Row label={t('Delivery Note / GRN')} value={<span style={{ fontFamily: 'monospace' }}>{sub.delivery_note_number}</span>} />}
                            </>
                        )}
                        <Row label={t('Purpose / Narration')} value={payment.narration || payment.reference_number || '—'} />
                        <Row
                            label={t('Vote / Account Charged')}
                            value={payment.bank_account?.gl_account
                                ? `${payment.bank_account.gl_account.account_code} — ${payment.bank_account.gl_account.account_name}`
                                : payment.bank_account?.account_name ?? '—'}
                        />
                        <Row
                            label={t('Bank / Fund')}
                            value={`${payment.bank_account?.account_name ?? '—'}${payment.bank_account?.bank_name ? ` (${payment.bank_account.bank_name})` : ''}`}
                        />
                        <Row
                            label={t('Payment Method')}
                            value={
                                <span style={{ textTransform: 'capitalize' }}>
                                    {payment.payment_method?.replace('_', ' ') ?? '—'}
                                    {payment.cheque_number && (
                                        <span style={{ marginLeft: '12px', color: '#555' }}>
                                            {t('Cheque No.')}: <span style={{ fontFamily: 'monospace' }}>{payment.cheque_number}</span>
                                        </span>
                                    )}
                                </span>
                            }
                        />
                        {payment.allocations && payment.allocations.length > 0 && (
                            <Row
                                label={t('Invoice(s) Settled')}
                                value={
                                    <div>
                                        {payment.allocations.map((a, i) => (
                                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <span>{a.invoice?.invoice_number ?? `Invoice ${i + 1}`}</span>
                                                <span style={{ fontFamily: 'monospace' }}>GHS {fmt(Number(a.allocated_amount))}</span>
                                            </div>
                                        ))}
                                    </div>
                                }
                            />
                        )}
                    </tbody>
                </table>

                {/* ── GRA TAX BREAKDOWN ──────────────────────────────────────── */}
                {sub && (
                    <div style={{ marginBottom: '16px' }}>
                        <h3 style={{ fontSize: '11pt', fontWeight: 700, borderBottom: '1px solid #000', paddingBottom: '4px', marginBottom: '8px' }}>
                            {t('GRA Tax Breakdown (Ghana Revenue Authority)')}
                        </h3>
                        <table style={{ width: '60%', marginLeft: 'auto', borderCollapse: 'collapse', fontSize: '9pt' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#e5e7eb' }}>
                                    <th style={{ border: '1px solid #aaa', padding: '4px 8px', textAlign: 'left' }}>{t('Component')}</th>
                                    <th style={{ border: '1px solid #aaa', padding: '4px 8px', textAlign: 'right' }}>{t('Rate')}</th>
                                    <th style={{ border: '1px solid #aaa', padding: '4px 8px', textAlign: 'right' }}>{t('GHS')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                <TaxRow label={t('Base Amount')}            amount={Number(sub.base_amount)} />
                                <TaxRow label={t('NHIL')}                   rate="2.5%" amount={Number(sub.nhil_amount)} highlight="#eff6ff" />
                                <TaxRow label={t('GETFund Levy')}           rate="2.5%" amount={Number(sub.getfund_amount)} highlight="#eff6ff" />
                                <TaxRow label={t('CHRL')}                   rate="1.0%" amount={Number(sub.chrl_amount)} highlight="#eff6ff" />
                                <TaxRow label={t('VAT (on augmented base)')} rate="15%"  amount={Number(sub.vat_amount)} highlight="#eff6ff" />
                                <TaxRow label={t('Gross Amount')}           amount={Number(sub.gross_amount)} highlight="#dcfce7" />
                                <TaxRow label={`${t('Withholding Tax (WHT)')} — ${sub.wht_rate}%`}
                                    rate={`${sub.wht_rate}%`}
                                    amount={Number(sub.wht_amount)} highlight="#fef2f2" negative />
                            </tbody>
                            <tfoot>
                                <tr style={{ backgroundColor: '#111827', color: '#fff' }}>
                                    <td style={{ border: '1px solid #333', padding: '6px 8px', fontWeight: 700, fontSize: '11pt' }}>{t('Net Payable')}</td>
                                    <td style={{ border: '1px solid #333', padding: '6px 8px' }}></td>
                                    <td style={{ border: '1px solid #333', padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, fontSize: '12pt', color: '#4ade80' }}>
                                        GHS {fmt(Number(sub.net_payable))}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                        <p style={{ fontSize: '8pt', color: '#92400e', backgroundColor: '#fef3c7', padding: '4px 8px', marginTop: '6px', borderRadius: '4px' }}>
                            ⚠️ WHT of GHS {fmt(Number(sub.wht_amount))} must be remitted to Ghana Revenue Authority. Issue WHT Certificate to supplier.
                        </p>
                    </div>
                )}

                {/* ── AMOUNT IN FIGURES & WORDS ──────────────────────────────── */}
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px' }}>
                    <tbody>
                        <Row
                            label={t('Net Amount Payable (Figures)')}
                            value={<span style={{ fontFamily: 'monospace', fontSize: '14pt', fontWeight: 700, color: '#15803d' }}>GHS {fmt(netPayable)}</span>}
                            bold
                        />
                        <Row
                            label={t('Amount in Words')}
                            value={<em>{numberToWords(netPayable)}</em>}
                        />
                    </tbody>
                </table>

                {/* ── IPSAS CERTIFICATION STATEMENT ──────────────────────────── */}
                <p style={{ fontSize: '9pt', fontStyle: 'italic', border: '1px dashed #9ca3af', borderRadius: '4px', padding: '8px 12px', textAlign: 'center', marginBottom: '24px', color: '#374151' }}>
                    I certify that the above payment is correct and in accordance with the financial regulations of {institutionName},
                    and that the goods/services have been duly received and verified per IPSAS accrual accounting principles.
                    The 3-Way Match (PO / GRN / Invoice) has been completed and the payment is hereby approved for disbursement.
                </p>

                {/* ── IPSAS ACCOUNTING ENTRIES NOTE ──────────────────────────── */}
                <div style={{ border: '1px solid #d1d5db', borderRadius: '6px', padding: '10px 14px', marginBottom: '24px', backgroundColor: '#f9fafb', fontSize: '9pt' }}>
                    <strong style={{ display: 'block', marginBottom: '6px' }}>{t('IPSAS Accrual Accounting Entries:')}</strong>
                    <div style={{ fontFamily: 'monospace' }}>
                        <div>{t('When goods/services received:')}</div>
                        <div style={{ paddingLeft: '16px' }}>Dr {t('Expense / Asset')}</div>
                        <div style={{ paddingLeft: '32px' }}>Cr {t('Accounts Payable')}</div>
                        <div style={{ marginTop: '4px' }}>{t('When this payment is made:')}</div>
                        <div style={{ paddingLeft: '16px' }}>Dr {t('Accounts Payable')}</div>
                        <div style={{ paddingLeft: '32px' }}>Cr {t('Bank / Cash')}</div>
                    </div>
                </div>

                {/* ── APPROVAL CHAIN SUMMARY ─────────────────────────────────── */}
                {(payment.hod_approved_by || payment.finance_approved_by || payment.cfo_approved_by) && (
                    <div style={{ border: '1px solid #d1d5db', borderRadius: '6px', padding: '10px 14px', marginBottom: '24px', fontSize: '9pt' }}>
                        <strong style={{ display: 'block', marginBottom: '6px' }}>{t('Approval Chain:')}</strong>
                        {payment.hod_approved_by && (
                            <div>✓ {t('HoD Approved')}: {payment.hod_approved_by.name} — {formatDate(payment.hod_approved_at)}</div>
                        )}
                        {payment.finance_approved_by && (
                            <div>✓ {t('Finance Approved')}: {payment.finance_approved_by.name} — {formatDate(payment.finance_approved_at)}</div>
                        )}
                        {payment.cfo_approved_by && (
                            <div>✓ {t('CFO Approved')}: {payment.cfo_approved_by.name} — {formatDate(payment.cfo_approved_at)}</div>
                        )}
                    </div>
                )}

                {/* ── SIGNATURE BLOCK ────────────────────────────────────────── */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '24px', textAlign: 'center', fontSize: '10pt', marginTop: '32px' }}>
                    {[
                        { title: t('Prepared By'), role: t('Accountant') },
                        { title: t('Checked By'), role: t('Finance Officer') },
                        { title: t('Approved By'), role: t('Chief Finance Officer') },
                    ].map((sig, i) => (
                        <div key={i} style={{ borderTop: '2px solid #000', paddingTop: '10px' }}>
                            <strong>{sig.title}</strong>
                            <p style={{ color: '#6b7280', fontSize: '9pt', margin: '2px 0 28px' }}>{sig.role}</p>
                            <div style={{ borderTop: '1px solid #9ca3af', paddingTop: '4px' }}>
                                <span style={{ fontSize: '9pt', color: '#6b7280' }}>{t('Signature & Date')}</span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* ── FOOTER ─────────────────────────────────────────────────── */}
                <div style={{ marginTop: '32px', paddingTop: '12px', borderTop: '1px solid #d1d5db', textAlign: 'center', fontSize: '8pt', color: '#6b7280' }}>
                    <p>{t('This is a computer-generated Payment Voucher.')} {institutionName}</p>
                    <p style={{ marginTop: '2px' }}>PV Ref: {pvNum} | {t('Printed')}: {new Date().toLocaleDateString('en-GH')} {new Date().toLocaleTimeString('en-GH')}</p>
                </div>
            </div>
        </>
    );
}
