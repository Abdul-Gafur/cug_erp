import { useTranslation } from 'react-i18next';
import { router } from '@inertiajs/react';
import { DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { VendorPaymentViewProps } from './types';
import { formatDate, formatCurrency } from '@/utils/helpers';
import { CheckCircle2, Clock, XCircle, FileText, Package, AlertTriangle, CheckCircle } from 'lucide-react';

const fmt = (n: number) => n.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const ApprovalStep = ({
    label, role, approver, approvedAt, done, active
}: { label: string; role: string; approver?: { name: string } | null; approvedAt?: string | null; done: boolean; active: boolean }) => {
    return (
        <div className={`flex items-start gap-3 p-3 rounded-lg border ${done ? 'bg-green-50 border-green-200' : active ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}`}>
            <div className="mt-0.5">
                {done
                    ? <CheckCircle2 className="h-5 w-5 text-green-600" />
                    : active
                    ? <Clock className="h-5 w-5 text-blue-500 animate-pulse" />
                    : <div className="h-5 w-5 rounded-full border-2 border-gray-300" />}
            </div>
            <div className="flex-1">
                <div className="flex items-center gap-2">
                    <span className={`font-semibold text-sm ${done ? 'text-green-700' : active ? 'text-blue-700' : 'text-gray-500'}`}>{label}</span>
                    {done && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">✓ Approved</span>}
                    {active && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full animate-pulse">Awaiting</span>}
                </div>
                <p className="text-xs text-gray-500">{role}</p>
                {done && approver && (
                    <p className="text-xs text-gray-600 mt-1">
                        By: <span className="font-medium">{approver.name}</span>
                        {approvedAt && <span className="ml-2 text-gray-400">— {formatDate(approvedAt)}</span>}
                    </p>
                )}
            </div>
        </div>
    );
};

export default function View({ payment }: VendorPaymentViewProps) {
    const { t } = useTranslation();

    const stage = payment.approval_stage;
    const isHodDone     = ['hod_approved', 'finance_approved', 'cfo_approved'].includes(stage);
    const isFinanceDone = ['finance_approved', 'cfo_approved'].includes(stage);
    const isCfoDone     = stage === 'cfo_approved';

    const sub = payment.invoice_submission;

    const matchBadge = {
        not_checked: { label: 'Not Checked', cls: 'bg-gray-100 text-gray-600' },
        matched:     { label: '✓ Matched',   cls: 'bg-green-100 text-green-700' },
        discrepancy: { label: '⚠ Discrepancy', cls: 'bg-red-100 text-red-700' },
    };

    const verifyBadge = {
        pending:  { label: 'Pending',  cls: 'bg-yellow-100 text-yellow-700' },
        verified: { label: 'Verified', cls: 'bg-green-100 text-green-700' },
        rejected: { label: 'Rejected', cls: 'bg-red-100 text-red-700' },
    };

    return (
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-blue-600" />
                    <div>
                        <span>{t('Payment Details')}</span>
                        <span className="ml-2 font-mono text-blue-700">{payment.payment_number}</span>
                        {payment.pv_number && (
                            <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-mono">
                                PV: {payment.pv_number}
                            </span>
                        )}
                    </div>
                </DialogTitle>
            </DialogHeader>

            <div className="space-y-5 mt-2">

                {/* ── Payment Overview ─────────────────────────────────────── */}
                <Card>
                    <CardHeader className="py-3 px-4 border-b"><CardTitle className="text-sm">{t('Payment Overview')}</CardTitle></CardHeader>
                    <CardContent className="p-4">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                            <div>
                                <p className="font-semibold text-gray-600">{t('Date')}</p>
                                <p>{formatDate(payment.payment_date)}</p>
                            </div>
                            <div>
                                <p className="font-semibold text-gray-600">{t('Vendor')}</p>
                                <p>{payment.vendor?.name || '—'}</p>
                            </div>
                            <div>
                                <p className="font-semibold text-gray-600">{t('Bank Account')}</p>
                                <p>{payment.bank_account?.account_name || '—'}</p>
                            </div>
                            <div>
                                <p className="font-semibold text-gray-600">{t('Method')}</p>
                                <p className="capitalize">{payment.payment_method?.replace('_', ' ') || '—'}</p>
                            </div>
                            {payment.cheque_number && (
                                <div>
                                    <p className="font-semibold text-gray-600">{t('Cheque No.')}</p>
                                    <p className="font-mono">{payment.cheque_number}</p>
                                </div>
                            )}
                            <div>
                                <p className="font-semibold text-gray-600">{t('Amount')}</p>
                                <p className="text-xl font-bold text-green-600">{formatCurrency(payment.payment_amount)}</p>
                            </div>
                            <div>
                                <p className="font-semibold text-gray-600">{t('Status')}</p>
                                <span className={`px-2 py-1 rounded-full text-xs ${
                                    payment.status === 'cleared' ? 'bg-green-100 text-green-800' :
                                    payment.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-red-100 text-red-800'}`}>{t(payment.status)}</span>
                            </div>
                        </div>
                        {payment.narration && (
                            <div className="mt-3">
                                <p className="font-semibold text-gray-600 text-sm">{t('Narration')}</p>
                                <p className="mt-1 p-2 bg-gray-50 rounded text-sm">{payment.narration}</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* ── Approval Workflow Timeline ────────────────────────────── */}
                <Card>
                    <CardHeader className="py-3 px-4 border-b bg-blue-50/50">
                        <CardTitle className="text-sm text-blue-700 flex items-center gap-2">
                            <CheckCircle className="h-4 w-4" />
                            {t('Approval Workflow (Step 3 — Payment Authorization)')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 space-y-3">
                        <ApprovalStep
                            label={t('Head of Department')}
                            role={t('First-level authorization')}
                            approver={payment.hod_approved_by}
                            approvedAt={payment.hod_approved_at}
                            done={isHodDone}
                            active={!isHodDone && stage === 'pending'}
                        />
                        <ApprovalStep
                            label={t('Finance Officer')}
                            role={t('Second-level authorization')}
                            approver={payment.finance_approved_by}
                            approvedAt={payment.finance_approved_at}
                            done={isFinanceDone}
                            active={isHodDone && !isFinanceDone}
                        />
                        <ApprovalStep
                            label={t('Chief Finance Officer (CFO)')}
                            role={t('Final authorization — generates PV')}
                            approver={payment.cfo_approved_by}
                            approvedAt={payment.cfo_approved_at}
                            done={isCfoDone}
                            active={isFinanceDone && !isCfoDone}
                        />
                        {isCfoDone && payment.pv_number && (
                            <div className="mt-2 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                                <p className="text-sm font-semibold text-purple-700">
                                    🎫 {t('Payment Voucher (PV) Generated')}: <span className="font-mono">{payment.pv_number}</span>
                                </p>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="mt-2 text-purple-700 border-purple-300"
                                    onClick={() => window.open(route('account.vendor-payments.print-voucher', payment.id), '_blank')}
                                >
                                    <FileText className="h-3.5 w-3.5 mr-1" />
                                    {t('Print Payment Voucher')}
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* ── Invoice Submission + 3-Way Match ─────────────────────── */}
                {sub && (
                    <Card>
                        <CardHeader className="py-3 px-4 border-b bg-amber-50/50">
                            <CardTitle className="text-sm text-amber-700 flex items-center gap-2">
                                <Package className="h-4 w-4" />
                                {t('Invoice Submission & 3-Way Match Verification')}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4">
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm mb-4">
                                <div>
                                    <p className="font-semibold text-gray-600">{t('Invoice No.')}</p>
                                    <p className="font-mono">{sub.invoice_number}</p>
                                </div>
                                <div>
                                    <p className="font-semibold text-gray-600">{t('Invoice Date')}</p>
                                    <p>{formatDate(sub.invoice_date)}</p>
                                </div>
                                <div>
                                    <p className="font-semibold text-gray-600">{t('PO Reference')}</p>
                                    <p className="font-mono">{sub.po_reference || '—'}</p>
                                </div>
                                <div>
                                    <p className="font-semibold text-gray-600">{t('Delivery Note / GRN')}</p>
                                    <p className="font-mono">{sub.delivery_note_number || '—'}</p>
                                </div>
                                <div>
                                    <p className="font-semibold text-gray-600">{t('Verification')}</p>
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${verifyBadge[sub.verification_status]?.cls}`}>
                                        {verifyBadge[sub.verification_status]?.label}
                                    </span>
                                </div>
                                <div>
                                    <p className="font-semibold text-gray-600">{t('3-Way Match')}</p>
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${matchBadge[sub.three_way_match_status]?.cls}`}>
                                        {matchBadge[sub.three_way_match_status]?.label}
                                    </span>
                                </div>
                            </div>

                            {/* GRA Tax Breakdown */}
                            <div className="rounded-lg border overflow-hidden">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="bg-gray-100">
                                            <th className="text-left px-3 py-1.5">{t('Tax Component')}</th>
                                            <th className="text-right px-3 py-1.5">{t('Rate')}</th>
                                            <th className="text-right px-3 py-1.5">{t('GHS')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr className="border-t"><td className="px-3 py-1.5">{t('Base Amount')}</td><td className="px-3 py-1.5 text-right">—</td><td className="px-3 py-1.5 text-right font-mono">{fmt(Number(sub.base_amount))}</td></tr>
                                        <tr className="border-t bg-blue-50/30"><td className="px-3 py-1.5">{t('NHIL')}</td><td className="px-3 py-1.5 text-right text-blue-600">2.5%</td><td className="px-3 py-1.5 text-right font-mono">{fmt(Number(sub.nhil_amount))}</td></tr>
                                        <tr className="border-t bg-blue-50/30"><td className="px-3 py-1.5">{t('GETFund Levy')}</td><td className="px-3 py-1.5 text-right text-blue-600">2.5%</td><td className="px-3 py-1.5 text-right font-mono">{fmt(Number(sub.getfund_amount))}</td></tr>
                                        <tr className="border-t bg-blue-50/30"><td className="px-3 py-1.5">{t('CHRL')}</td><td className="px-3 py-1.5 text-right text-blue-600">1.0%</td><td className="px-3 py-1.5 text-right font-mono">{fmt(Number(sub.chrl_amount))}</td></tr>
                                        <tr className="border-t bg-blue-50/30"><td className="px-3 py-1.5">{t('VAT')}</td><td className="px-3 py-1.5 text-right text-blue-600">15%</td><td className="px-3 py-1.5 text-right font-mono">{fmt(Number(sub.vat_amount))}</td></tr>
                                        <tr className="border-t bg-green-100 font-semibold"><td className="px-3 py-1.5">{t('Gross Amount')}</td><td></td><td className="px-3 py-1.5 text-right font-mono text-green-800">{fmt(Number(sub.gross_amount))}</td></tr>
                                        <tr className="border-t bg-red-50"><td className="px-3 py-1.5 text-red-700">{t('WHT')} ({sub.wht_rate}%)</td><td className="px-3 py-1.5 text-right text-red-600"></td><td className="px-3 py-1.5 text-right font-mono text-red-700">({fmt(Number(sub.wht_amount))})</td></tr>
                                        <tr className="border-t-2 bg-gray-900 text-white font-bold"><td className="px-3 py-2">{t('Net Payable')}</td><td></td><td className="px-3 py-2 text-right font-mono text-green-400">GHS {fmt(Number(sub.net_payable))}</td></tr>
                                    </tbody>
                                </table>
                            </div>

                            {sub.rejection_reason && (
                                <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                                    <AlertTriangle className="inline h-4 w-4 mr-1" />
                                    <strong>{t('Rejection Reason')}:</strong> {sub.rejection_reason}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

    // Actions moved to footer
                {/* ── Invoice Allocations ───────────────────────────────────── */}
                {payment.allocations && payment.allocations.length > 0 && (
                    <Card>
                        <CardHeader className="py-3 px-4 border-b"><CardTitle className="text-sm">{t('Invoice Allocations')}</CardTitle></CardHeader>
                        <CardContent className="p-4">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b">
                                        <th className="text-left py-2">{t('Invoice No.')}</th>
                                        <th className="text-left py-2">{t('Date')}</th>
                                        <th className="text-right py-2">{t('Invoice Total')}</th>
                                        <th className="text-right py-2">{t('Allocated')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {payment.allocations.map(a => (
                                        <tr key={a.id} className="border-b">
                                            <td className="py-2 font-medium">{a.invoice?.invoice_number}</td>
                                            <td className="py-2">{formatDate(a.invoice?.invoice_date)}</td>
                                            <td className="py-2 text-right">{formatCurrency(a.invoice?.total_amount)}</td>
                                            <td className="py-2 text-right font-semibold">{formatCurrency(a.allocated_amount)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="border-t-2 font-semibold">
                                        <td colSpan={3} className="py-2 text-right">{t('Total Payment:')}</td>
                                        <td className="py-2 text-right text-base">{formatCurrency(payment.payment_amount)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* ── Workflow Actions Footer ─────────────────────────────── */}
            <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t mt-2 bg-gray-50 p-4 rounded-b-lg">
                {sub && sub.verification_status === 'pending' && (
                    <Button 
                        onClick={() => router.post(route('account.vendor-payments.verify-invoice', payment.id), { verification_status: 'verified', three_way_match_status: 'matched' }, { preserveScroll: true })}
                        className="bg-amber-600 hover:bg-amber-700 text-white"
                    >
                        <Package className="h-4 w-4 mr-1" /> {t('Verify 3-Way Match')}
                    </Button>
                )}
                {stage === 'pending' && sub?.verification_status === 'verified' && (
                    <Button 
                        onClick={() => router.post(route('account.vendor-payments.approve', payment.id), { stage: 'hod' }, { preserveScroll: true })}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                        <CheckCircle2 className="h-4 w-4 mr-1" /> {t('HoD Approve')}
                    </Button>
                )}
                {stage === 'hod_approved' && (
                    <Button 
                        onClick={() => router.post(route('account.vendor-payments.approve', payment.id), { stage: 'finance' }, { preserveScroll: true })}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                        <CheckCircle2 className="h-4 w-4 mr-1" /> {t('Finance Approve')}
                    </Button>
                )}
                {stage === 'finance_approved' && (
                    <Button 
                        onClick={() => router.post(route('account.vendor-payments.approve', payment.id), { stage: 'cfo' }, { preserveScroll: true })}
                        className="bg-purple-600 hover:bg-purple-700 text-white"
                    >
                        <CheckCircle2 className="h-4 w-4 mr-1" /> {t('CFO Approve & Generate PV')}
                    </Button>
                )}
                <Button variant="outline" onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))}>{t('Close')}</Button>
            </div>
        </DialogContent>
    );
}
