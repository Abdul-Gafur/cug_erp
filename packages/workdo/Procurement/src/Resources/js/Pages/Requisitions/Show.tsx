import { useState } from 'react';
import { Head, usePage, router, useForm } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import AuthenticatedLayout from '@/layouts/authenticated-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import InputError from '@/components/ui/input-error';
import { DataTable } from '@/components/ui/data-table';
import { formatCurrency } from '@/utils/helpers';
import {
    ArrowLeft, CheckCircle, XCircle, ClipboardCheck,
    AlertTriangle, TrendingDown, DollarSign
} from 'lucide-react';

interface BudgetPosition {
    approved: number;
    committed: number;
    actual: number;
    available: number;
    allocation_id: number | null;
    control_mode: string;
}

interface RequisitionItem {
    id: number;
    description: string;
    quantity: number;
    unit: string | null;
    estimated_unit_cost: number;
    estimated_total_cost: number;
    fund_type: string;
    economic_classification: string;
    notes: string | null;
    account?: { account_code: string; account_name: string };
}

interface Requisition {
    id: number;
    requisition_number: string;
    requisition_date: string;
    purpose: string;
    justification: string;
    category: string;
    is_off_plan: boolean;
    off_plan_justification: string | null;
    total_amount: number;
    status: string;
    finance_notes: string | null;
    rejection_reason: string | null;
    requesting_department?: { code: string; name: string };
    budget_period?: { period_name: string };
    plan_item?: { item_description: string; plan?: { plan_number: string } };
    requester?: { name: string };
    hod_approved_by?: { name: string };
    hod_approved_at?: string;
    finance_checked_by?: { name: string };
    finance_checked_at?: string;
    procurement_approved_by?: { name: string };
    procurement_approved_at?: string;
    rejected_by?: { name: string };
    rejected_at?: string;
    items: RequisitionItem[];
}

const STATUS_COLORS: Record<string, string> = {
    draft:                'bg-gray-100 text-gray-700',
    submitted:            'bg-yellow-100 text-yellow-800',
    hod_approved:         'bg-blue-100 text-blue-800',
    finance_checked:      'bg-indigo-100 text-indigo-800',
    procurement_approved: 'bg-green-100 text-green-800',
    rejected:             'bg-red-100 text-red-800',
    cancelled:            'bg-gray-100 text-gray-500',
};

function BudgetPositionWidget({ position, label }: { position: BudgetPosition; label: string }) {
    const { t } = useTranslation();
    const isWarning = position.available < 0;
    const isNoAllocation = position.allocation_id === null;

    return (
        <div className={`rounded-lg border p-3 text-xs space-y-1 ${isNoAllocation ? 'border-red-200 bg-red-50' : isWarning ? 'border-orange-200 bg-orange-50' : 'border-green-200 bg-green-50'}`}>
            <p className="font-semibold text-sm">{label}</p>
            {isNoAllocation ? (
                <p className="text-red-600 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> {t('No budget allocation found')}
                </p>
            ) : (
                <div className="grid grid-cols-2 gap-1">
                    <span className="text-muted-foreground">{t('Approved Budget')}</span>
                    <span className="font-medium text-right">{formatCurrency(position.approved)}</span>
                    <span className="text-muted-foreground">{t('Commitments')}</span>
                    <span className="font-medium text-right text-orange-700">{formatCurrency(position.committed)}</span>
                    <span className="text-muted-foreground">{t('Actuals')}</span>
                    <span className="font-medium text-right">{formatCurrency(position.actual)}</span>
                    <span className="text-muted-foreground font-semibold">{t('Available')}</span>
                    <span className={`font-bold text-right ${isWarning ? 'text-red-600' : 'text-green-700'}`}>
                        {formatCurrency(position.available)}
                    </span>
                </div>
            )}
            <p className="text-muted-foreground">{t('Control')}: <strong>{position.control_mode}</strong></p>
        </div>
    );
}

export default function RequisitionShow() {
    const { requisition, budgetPositions, statusLabels } = usePage<any>().props;
    const req: Requisition = requisition;
    const { t } = useTranslation();
    const [rejectOpen, setRejectOpen] = useState(false);
    const [financeOpen, setFinanceOpen] = useState(false);

    const rejectForm = useForm({ rejection_reason: '' });
    const financeForm = useForm({ finance_notes: '' });

    const itemColumns = [
        { key: 'description', header: t('Description') },
        { key: 'quantity', header: t('Qty'), className: 'text-right' },
        { key: 'unit', header: t('Unit') },
        { key: 'estimated_unit_cost', header: t('Unit Cost'), render: (v: number) => formatCurrency(v), className: 'text-right' },
        { key: 'estimated_total_cost', header: t('Line Total'), render: (v: number) => formatCurrency(v), className: 'text-right' },
        {
            key: 'account',
            header: t('Budget Head'),
            render: (_: any, row: RequisitionItem) => row.account
                ? `${row.account.account_code} — ${row.account.account_name}` : '—',
        },
        { key: 'fund_type', header: t('Fund') },
        { key: 'economic_classification', header: t('Classification') },
    ];

    const canSubmit   = req.status === 'draft';
    const canApproveHod = req.status === 'submitted';
    const canFinance  = req.status === 'hod_approved';
    const canProcurement = req.status === 'finance_checked';
    const canReject   = ['submitted', 'hod_approved', 'finance_checked'].includes(req.status);

    return (
        <AuthenticatedLayout>
            <Head title={`${t('Requisition')} ${req.requisition_number}`} />

            <div className="p-6 space-y-5">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" size="sm" onClick={() => router.visit(route('procurement.requisitions.index'))}>
                            <ArrowLeft className="h-4 w-4 mr-1" /> {t('Requisitions')}
                        </Button>
                        <h1 className="text-2xl font-semibold">{req.requisition_number}</h1>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[req.status] ?? 'bg-gray-100'}`}>
                            {statusLabels[req.status] ?? req.status}
                        </span>
                        {req.is_off_plan && (
                            <span className="px-2 py-0.5 rounded text-xs bg-orange-100 text-orange-700 font-medium">
                                {t('Off-Plan')}
                            </span>
                        )}
                    </div>

                    {/* Workflow action buttons */}
                    <div className="flex gap-2">
                        {canSubmit && (
                            <Button onClick={() => router.post(route('procurement.requisitions.submit', req.id))}>
                                <ClipboardCheck className="h-4 w-4 mr-2" /> {t('Submit for HoD Approval')}
                            </Button>
                        )}
                        {canApproveHod && (
                            <Button onClick={() => router.post(route('procurement.requisitions.approve-hod', req.id))}>
                                <CheckCircle className="h-4 w-4 mr-2 text-blue-600" /> {t('Approve (HoD)')}
                            </Button>
                        )}
                        {canFinance && (
                            <Button onClick={() => setFinanceOpen(true)}>
                                <DollarSign className="h-4 w-4 mr-2 text-indigo-600" /> {t('Finance Check & Commit Budget')}
                            </Button>
                        )}
                        {canProcurement && (
                            <Button onClick={() => router.post(route('procurement.requisitions.approve-procurement', req.id))}>
                                <CheckCircle className="h-4 w-4 mr-2 text-green-600" /> {t('Final Approval (Procurement)')}
                            </Button>
                        )}
                        {req.status === 'procurement_approved' && (
                            <Button onClick={() => router.visit(route('quotations.create', { pr_id: req.id }))}>
                                <CheckCircle className="h-4 w-4 mr-2" /> {t('Initiate Supplier Selection (RFQ)')}
                            </Button>
                        )}
                        {canReject && (
                            <Button variant="outline" onClick={() => setRejectOpen(true)}>
                                <XCircle className="h-4 w-4 mr-2 text-red-500" /> {t('Reject')}
                            </Button>
                        )}
                    </div>
                </div>

                {/* Meta */}
                <Card>
                    <CardContent className="pt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                            <p className="text-muted-foreground">{t('Date')}</p>
                            <p className="font-medium">{req.requisition_date}</p>
                        </div>
                        <div>
                            <p className="text-muted-foreground">{t('Department')}</p>
                            <p className="font-medium">
                                {req.requesting_department
                                    ? `${req.requesting_department.code} — ${req.requesting_department.name}` : '—'}
                            </p>
                        </div>
                        <div>
                            <p className="text-muted-foreground">{t('Budget Period')}</p>
                            <p className="font-medium">{req.budget_period?.period_name ?? '—'}</p>
                        </div>
                        <div>
                            <p className="text-muted-foreground">{t('Category')}</p>
                            <p className="font-medium capitalize">{req.category}</p>
                        </div>
                        <div>
                            <p className="text-muted-foreground">{t('Raised By')}</p>
                            <p className="font-medium">{req.requester?.name ?? '—'}</p>
                        </div>
                        <div>
                            <p className="text-muted-foreground">{t('Estimated Total')}</p>
                            <p className="font-semibold text-primary">{formatCurrency(req.total_amount)}</p>
                        </div>
                        {req.plan_item && (
                            <div className="col-span-2">
                                <p className="text-muted-foreground">{t('Plan Item')}</p>
                                <p className="font-medium">
                                    {req.plan_item.plan?.plan_number}: {req.plan_item.item_description.substring(0, 80)}
                                </p>
                            </div>
                        )}
                        <div className="col-span-2 md:col-span-4">
                            <p className="text-muted-foreground">{t('Purpose')}</p>
                            <p className="font-medium">{req.purpose}</p>
                        </div>
                        <div className="col-span-2 md:col-span-4">
                            <p className="text-muted-foreground">{t('Justification')}</p>
                            <p className="font-medium whitespace-pre-wrap">{req.justification}</p>
                        </div>
                        {req.is_off_plan && req.off_plan_justification && (
                            <div className="col-span-2 md:col-span-4 p-3 bg-orange-50 border border-orange-200 rounded">
                                <p className="text-orange-700 font-semibold text-xs mb-1">{t('Off-Plan Justification')}</p>
                                <p className="text-sm">{req.off_plan_justification}</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Approval trail */}
                <Card>
                    <CardHeader><CardTitle>{t('Approval Trail')}</CardTitle></CardHeader>
                    <CardContent className="space-y-2 text-sm">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                            {[
                                { label: t('HoD Approval'), by: req.hod_approved_by?.name, at: req.hod_approved_at },
                                { label: t('Finance Check'), by: req.finance_checked_by?.name, at: req.finance_checked_at, note: req.finance_notes },
                                { label: t('Procurement Approval'), by: req.procurement_approved_by?.name, at: req.procurement_approved_at },
                                req.status === 'rejected'
                                    ? { label: t('Rejection'), by: req.rejected_by?.name, at: req.rejected_at, note: req.rejection_reason }
                                    : null,
                            ].filter(Boolean).map((step: any, i) => (
                                <div key={i} className={`border rounded p-3 ${step.by ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
                                    <p className="font-semibold text-xs text-muted-foreground">{step.label}</p>
                                    {step.by ? (
                                        <>
                                            <p className="font-medium">{step.by}</p>
                                            <p className="text-xs text-muted-foreground">{step.at}</p>
                                            {step.note && <p className="text-xs italic mt-1">{step.note}</p>}
                                        </>
                                    ) : (
                                        <p className="text-muted-foreground text-xs">{t('Pending')}</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Budget positions — visible to Finance and above */}
                {Object.keys(budgetPositions).length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <TrendingDown className="h-5 w-5" />
                                {t('Budget Position (at time of Finance Review)')}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {req.items.map((item) => {
                                const pos: BudgetPosition = budgetPositions[item.id];
                                if (!pos) return null;
                                return (
                                    <BudgetPositionWidget
                                        key={item.id}
                                        position={pos}
                                        label={`${item.description.substring(0, 40)} (${item.fund_type} / ${item.economic_classification})`}
                                    />
                                );
                            })}
                        </CardContent>
                    </Card>
                )}

                {/* Items table */}
                <Card>
                    <CardHeader><CardTitle>{t('Line Items')}</CardTitle></CardHeader>
                    <CardContent>
                        <DataTable columns={itemColumns} data={req.items} />
                        <div className="flex justify-end mt-3">
                            <div className="text-right">
                                <p className="text-sm text-muted-foreground">{t('Total Estimated Cost')}</p>
                                <p className="text-xl font-semibold text-primary">{formatCurrency(req.total_amount)}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Finance Check Dialog */}
            <Dialog open={financeOpen} onOpenChange={setFinanceOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>{t('Finance Check — Commit Budget')}</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">
                        {t('This will verify budget availability for each line and create a commitment against the relevant budget allocations. Budget over-runs will be flagged.')}
                    </p>
                    <div className="space-y-3">
                        <Label>{t('Finance Notes (optional)')}</Label>
                        <Textarea
                            value={financeForm.data.finance_notes}
                            onChange={(e) => financeForm.setData('finance_notes', e.target.value)}
                            rows={3}
                            placeholder={t('Any observations for the record…')}
                        />
                        <InputError message={financeForm.errors.finance_notes} />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" onClick={() => setFinanceOpen(false)}>{t('Cancel')}</Button>
                        <Button
                            disabled={financeForm.processing}
                            onClick={() => {
                                financeForm.post(route('procurement.requisitions.finance-check', req.id), {
                                    onSuccess: () => setFinanceOpen(false),
                                });
                            }}
                        >
                            <DollarSign className="h-4 w-4 mr-2" /> {t('Confirm & Commit')}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Reject Dialog */}
            <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>{t('Reject Requisition')}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                        <Label required>{t('Reason for Rejection')}</Label>
                        <Textarea
                            value={rejectForm.data.rejection_reason}
                            onChange={(e) => rejectForm.setData('rejection_reason', e.target.value)}
                            rows={4}
                            placeholder={t('Provide a clear reason that will be visible to the requesting department…')}
                            required
                        />
                        <InputError message={rejectForm.errors.rejection_reason} />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" onClick={() => setRejectOpen(false)}>{t('Cancel')}</Button>
                        <Button
                            variant="destructive"
                            disabled={rejectForm.processing}
                            onClick={() => {
                                rejectForm.post(route('procurement.requisitions.reject', req.id), {
                                    onSuccess: () => setRejectOpen(false),
                                });
                            }}
                        >
                            <XCircle className="h-4 w-4 mr-2" /> {t('Reject')}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </AuthenticatedLayout>
    );
}
