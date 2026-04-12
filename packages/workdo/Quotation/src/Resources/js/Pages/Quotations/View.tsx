import React, { useState } from 'react';
import { Head, usePage, router, useForm } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import { Rfq, RfqSupplier, User } from './types';
import AuthenticatedLayout from '@/layouts/authenticated-layout';
import { formatCurrency, formatDate } from '@/utils/helpers';
import { getStatusBadgeClasses, getStatusLabel } from './utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
    Download, Send, Lock, ClipboardList, Award, FileText, Plus, X,
    CheckCircle, AlertCircle, Users, Package, Info,
} from 'lucide-react';

interface ViewProps {
    quotation: Rfq;
    auth: any;
    suppliers?: User[];
    [key: string]: any;
}

export default function View() {
    const { t } = useTranslation();
    const { quotation, auth, suppliers = [] } = usePage<ViewProps>().props;
    const permissions: string[] = auth?.user?.permissions ?? [];

    // ── Add supplier dialog ─────────────────────────────────────────────────
    const [showAddSupplier, setShowAddSupplier] = useState(false);
    const addSupplierForm = useForm({ supplier_id: '' });

    const handleAddSupplier = () => {
        addSupplierForm.post(route('quotations.suppliers.add', quotation.id), {
            onSuccess: () => { setShowAddSupplier(false); addSupplierForm.reset(); },
        });
    };

    // ── Record response dialog ─────────────────────────────────────────────
    const [responseTarget, setResponseTarget] = useState<RfqSupplier | null>(null);
    const responseForm = useForm({
        quoted_amount:  '',
        delivery_days:  '',
        response_notes: '',
    });

    const handleRecordResponse = () => {
        if (!responseTarget) return;
        responseForm.post(route('quotations.suppliers.response', { quotation: quotation.id, rfqSupplier: responseTarget.id }), {
            onSuccess: () => { setResponseTarget(null); responseForm.reset(); },
        });
    };

    // ── Award dialog ───────────────────────────────────────────────────────
    const [showAward, setShowAward] = useState(false);
    const awardForm = useForm({ awarded_supplier_id: '' });

    const handleAward = () => {
        awardForm.post(route('quotations.award', quotation.id), {
            onSuccess: () => setShowAward(false),
        });
    };

    const respondedSuppliers = quotation.suppliers?.filter(s => s.status === 'responded') ?? [];
    const canManage = permissions.includes('edit-quotations');
    const canApprove = permissions.includes('approve-quotations');

    return (
        <AuthenticatedLayout
            breadcrumbs={[
                { label: t('Requests for Quotations / Tenders'), url: route('quotations.index') },
                { label: quotation.quotation_number },
            ]}
            pageTitle={`${t('RFQ')} #${quotation.quotation_number}`}
        >
            <Head title={`RFQ #${quotation.quotation_number}`} />

            <div className="space-y-6">
                {/* Header card */}
                <Card>
                    <CardContent className="p-6">
                        <div className="flex flex-wrap justify-between items-start gap-4 mb-6">
                            <div>
                                <p className="text-muted-foreground text-sm">#{quotation.quotation_number}</p>
                                {quotation.department && (
                                    <p className="text-sm mt-1">
                                        <span className="font-medium">{t('Department')}:</span> {quotation.department}
                                    </p>
                                )}
                            </div>
                            <div className="flex flex-wrap items-center gap-3">
                                <span className={getStatusBadgeClasses(quotation.status)}>
                                    {t(getStatusLabel(quotation.status))}
                                </span>
                                <div className="text-right">
                                    <div className="text-2xl font-bold">{formatCurrency(quotation.total_amount)}</div>
                                    <div className="text-sm text-muted-foreground">{t('Estimated Value')}</div>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-6">
                            <div>
                                <span className="text-muted-foreground block">{t('RFQ Date')}</span>
                                <span className="font-medium">{formatDate(quotation.quotation_date)}</span>
                            </div>
                            <div>
                                <span className="text-muted-foreground block">{t('Closing Date')}</span>
                                <span className={`font-medium ${quotation.closing_date && new Date(quotation.closing_date) < new Date() ? 'text-red-600' : ''}`}>
                                    {quotation.closing_date ? formatDate(quotation.closing_date) : '-'}
                                </span>
                            </div>
                            <div>
                                <span className="text-muted-foreground block">{t('Expected Delivery')}</span>
                                <span className="font-medium">{quotation.due_date ? formatDate(quotation.due_date) : '-'}</span>
                            </div>
                            <div>
                                <span className="text-muted-foreground block">{t('Warehouse')}</span>
                                <span className="font-medium">{quotation.warehouse?.name ?? '-'}</span>
                            </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex flex-wrap gap-2 pt-4 border-t">
                            {permissions.includes('print-quotations') && (
                                <Button variant="outline" size="sm"
                                    onClick={() => window.open(route('quotations.print', quotation.id) + '?download=pdf', '_blank')}>
                                    <Download className="h-4 w-4 mr-2" />{t('Download RFQ')}
                                </Button>
                            )}

                            {quotation.status === 'draft' && canManage && (
                                <Button size="sm" variant="outline"
                                    onClick={() => router.post(route('quotations.issue', quotation.id))}>
                                    <Send className="h-4 w-4 mr-2" />{t('Issue to Suppliers')}
                                </Button>
                            )}

                            {quotation.status === 'issued' && canApprove && (
                                <Button size="sm" variant="outline"
                                    onClick={() => router.post(route('quotations.close', quotation.id))}>
                                    <Lock className="h-4 w-4 mr-2" />{t('Close RFQ')}
                                </Button>
                            )}

                            {['closed', 'under_evaluation'].includes(quotation.status) && canApprove && (
                                <Button size="sm" variant="outline"
                                    onClick={() => quotation.evaluation
                                        ? router.get(route('rfq.evaluation.show', quotation.id))
                                        : router.post(route('rfq.evaluation.start', quotation.id))
                                    }>
                                    <ClipboardList className="h-4 w-4 mr-2" />
                                    {quotation.evaluation ? t('View Evaluation') : t('Start Evaluation')}
                                </Button>
                            )}

                            {quotation.status === 'under_evaluation' && canApprove && quotation.evaluation?.status === 'finalised' && (
                                <Button size="sm" onClick={() => setShowAward(true)}>
                                    <Award className="h-4 w-4 mr-2" />{t('Award Contract')}
                                </Button>
                            )}

                            {quotation.status === 'awarded' && !quotation.lpo && permissions.includes('create-quotations') && (
                                <Button size="sm"
                                    onClick={() => router.get(route('lpo.create'), { rfq_id: quotation.id })}>
                                    <FileText className="h-4 w-4 mr-2" />{t('Issue Purchase Order / Contract')}
                                </Button>
                            )}

                            {quotation.lpo && (
                                <Button size="sm" variant="outline"
                                    onClick={() => router.get(route('lpo.show', quotation.lpo!.id))}>
                                    <FileText className="h-4 w-4 mr-2" />
                                    {t('View Purchase Order')} #{quotation.lpo.lpo_number}
                                </Button>
                            )}
                        </div>

                        {quotation.notes && (
                            <div className="mt-4 pt-4 border-t text-sm">
                                <span className="font-medium">{t('Notes')}: </span>
                                <span className="text-muted-foreground">{quotation.notes}</span>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Suppliers panel */}
                <Card>
                    <CardHeader>
                        <div className="flex justify-between items-center">
                            <CardTitle className="flex items-center gap-2 text-base">
                                <Users className="h-5 w-5" />
                                {t('Invited Suppliers')}
                                <Badge variant="outline">{quotation.suppliers?.length ?? 0}</Badge>
                            </CardTitle>
                            {['draft', 'issued'].includes(quotation.status) && canManage && (
                                <Button variant="outline" size="sm" onClick={() => setShowAddSupplier(true)}>
                                    <Plus className="h-4 w-4 mr-1" />{t('Add Supplier')}
                                </Button>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent>
                        {(!quotation.suppliers || quotation.suppliers.length === 0) ? (
                            <p className="text-sm text-muted-foreground italic">
                                {t('No suppliers invited yet.')}
                            </p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-sm">
                                    <thead>
                                        <tr className="border-b">
                                            <th className="px-4 py-2 text-left font-semibold">{t('Supplier')}</th>
                                            <th className="px-4 py-2 text-left font-semibold">{t('Status')}</th>
                                            <th className="px-4 py-2 text-right font-semibold">{t('Quoted Amount')}</th>
                                            <th className="px-4 py-2 text-right font-semibold">{t('Delivery (days)')}</th>
                                            <th className="px-4 py-2 text-left font-semibold">{t('Response Date')}</th>
                                            <th className="px-4 py-2 text-left font-semibold">{t('Notes')}</th>
                                            <th className="px-4 py-2"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {quotation.suppliers.map(s => (
                                            <tr key={s.id}>
                                                <td className="px-4 py-3">
                                                    <div className="font-medium">{s.supplier?.name}</div>
                                                    <div className="text-xs text-muted-foreground">{s.supplier?.email}</div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    {s.status === 'responded' ? (
                                                        <span className="flex items-center gap-1 text-green-700">
                                                            <CheckCircle className="h-3 w-3" />{t('Responded')}
                                                        </span>
                                                    ) : (
                                                        <span className="flex items-center gap-1 text-muted-foreground">
                                                            <AlertCircle className="h-3 w-3" />{t('Awaiting')}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    {s.quoted_amount ? formatCurrency(s.quoted_amount) : '-'}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    {s.delivery_days ?? '-'}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {s.response_received_at ? formatDate(s.response_received_at) : '-'}
                                                </td>
                                                <td className="px-4 py-3 max-w-xs truncate text-muted-foreground">
                                                    {s.response_notes ?? '-'}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex gap-1">
                                                        {['issued', 'closed'].includes(quotation.status) && canManage && (
                                                            <Button variant="ghost" size="sm"
                                                                onClick={() => { setResponseTarget(s); responseForm.setData({ quoted_amount: s.quoted_amount?.toString() ?? '', delivery_days: s.delivery_days?.toString() ?? '', response_notes: s.response_notes ?? '' }); }}>
                                                                {s.status === 'responded' ? t('Edit Response') : t('Record Response')}
                                                            </Button>
                                                        )}
                                                        {quotation.status === 'draft' && canManage && (
                                                            <Button variant="ghost" size="sm" className="text-red-600"
                                                                onClick={() => router.delete(route('quotations.suppliers.remove', { quotation: quotation.id, rfqSupplier: s.id }))}>
                                                                <X className="h-3 w-3" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Items */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Package className="h-5 w-5" />
                            {t('Items / Services Required')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <table className="min-w-full text-sm">
                            <thead>
                                <tr className="border-b">
                                    <th className="px-4 py-3 text-left font-semibold">{t('Item')}</th>
                                    <th className="px-4 py-3 text-right font-semibold">{t('Qty')}</th>
                                    <th className="px-4 py-3 text-right font-semibold">{t('Unit Price')}</th>
                                    <th className="px-4 py-3 text-right font-semibold">{t('Discount')}</th>
                                    <th className="px-4 py-3 text-right font-semibold">{t('Tax')}</th>
                                    <th className="px-4 py-3 text-right font-semibold">{t('Total')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {quotation.items?.map((item, i) => (
                                    <tr key={i}>
                                        <td className="px-4 py-4 min-w-[200px]">
                                            <div className="font-medium">{item.description || item.product?.name || t('N/A')}</div>
                                            {(item.product_id && item.product?.sku) ? <div className="text-xs text-muted-foreground">SKU: {item.product.sku}</div> : null}
                                        </td>
                                        <td className="px-4 py-4 text-right">{item.quantity}</td>
                                        <td className="px-4 py-4 text-right">{formatCurrency(item.unit_price)}</td>
                                        <td className="px-4 py-4 text-right">
                                            {item.discount_percentage > 0 ? `${item.discount_percentage}%` : '-'}
                                        </td>
                                        <td className="px-4 py-4 text-right">
                                            {item.taxes && item.taxes.length > 0
                                                ? item.taxes.map(tx => `${tx.tax_name} (${tx.tax_rate}%)`).join(', ')
                                                : item.tax_percentage > 0 ? `${item.tax_percentage}%` : '-'
                                            }
                                        </td>
                                        <td className="px-4 py-4 text-right font-semibold">{formatCurrency(item.total_amount)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <div className="mt-6 flex justify-end">
                            <div className="w-72 space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">{t('Subtotal')}</span>
                                    <span>{formatCurrency(quotation.subtotal)}</span>
                                </div>
                                {quotation.discount_amount > 0 && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">{t('Discount')}</span>
                                        <span className="text-red-600">-{formatCurrency(quotation.discount_amount)}</span>
                                    </div>
                                )}
                                {quotation.tax_amount > 0 && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">{t('Tax')}</span>
                                        <span>{formatCurrency(quotation.tax_amount)}</span>
                                    </div>
                                )}
                                <Separator />
                                <div className="flex justify-between font-bold text-base">
                                    <span>{t('Total')}</span>
                                    <span>{formatCurrency(quotation.total_amount)}</span>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Evaluation summary (read-only) */}
                {quotation.evaluation && (
                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <ClipboardList className="h-5 w-5" />
                                    {t('Tender Evaluation Report')}
                                    {quotation.evaluation.status === 'finalised' && (
                                        <Badge className="bg-green-100 text-green-800 ml-2">{t('Finalised')}</Badge>
                                    )}
                                </CardTitle>
                                <Button variant="outline" size="sm"
                                    onClick={() => router.get(route('rfq.evaluation.show', quotation.id))}>
                                    {t('Open Scorecard')}
                                </Button>
                            </div>
                        </CardHeader>
                        {quotation.evaluation.recommended_supplier && (
                            <CardContent>
                                <div className="flex items-center gap-2 text-sm">
                                    <Award className="h-4 w-4 text-green-600" />
                                    <span className="font-medium">{t('Recommended Supplier')}:</span>
                                    <span>{quotation.evaluation.recommended_supplier.name}</span>
                                </div>
                                {quotation.evaluation.recommendation_notes && (
                                    <p className="text-sm text-muted-foreground mt-2">
                                        {quotation.evaluation.recommendation_notes}
                                    </p>
                                )}
                            </CardContent>
                        )}
                    </Card>
                )}

                {/* Awarded supplier */}
                {quotation.awarded_supplier && (
                    <Card className="border-green-200 bg-green-50">
                        <CardContent className="p-4 flex items-center gap-3">
                            <Award className="h-5 w-5 text-green-700" />
                            <div>
                                <span className="font-semibold text-green-800">{t('Awarded to')}:</span>{' '}
                                <span className="text-green-800">{quotation.awarded_supplier.name}</span>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Add Supplier Dialog */}
            <Dialog open={showAddSupplier} onOpenChange={setShowAddSupplier}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t('Add Invited Supplier')}</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        <Label>{t('Supplier')}</Label>
                        <Select value={addSupplierForm.data.supplier_id || 'none'}
                            onValueChange={v => addSupplierForm.setData('supplier_id', v === 'none' ? '' : v)}>
                            <SelectTrigger>
                                <SelectValue placeholder={t('Select supplier...')} />
                            </SelectTrigger>
                            <SelectContent searchable>
                                <SelectItem value="none">{t('Select...')}</SelectItem>
                                {suppliers.filter((s: User) => !quotation.suppliers?.find((is: any) => is.supplier_id === s.id)).map((s: User) => (
                                    <SelectItem key={s.id} value={s.id.toString()}>
                                        {s.name} — {s.email}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground mt-1">
                            {t('Search by name or email.')}
                        </p>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowAddSupplier(false)}>{t('Cancel')}</Button>
                        <Button onClick={handleAddSupplier} disabled={addSupplierForm.processing}>
                            {t('Add Supplier')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Record Response Dialog */}
            <Dialog open={!!responseTarget} onOpenChange={() => setResponseTarget(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t('Record Supplier Response')} — {responseTarget?.supplier?.name}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div>
                            <Label required>{t('Quoted Amount')}</Label>
                            <Input
                                type="number"
                                step="0.01"
                                value={responseForm.data.quoted_amount}
                                onChange={e => responseForm.setData('quoted_amount', e.target.value)}
                                placeholder="0.00"
                            />
                        </div>
                        <div>
                            <Label>{t('Delivery Time (days)')}</Label>
                            <Input
                                type="number"
                                value={responseForm.data.delivery_days}
                                onChange={e => responseForm.setData('delivery_days', e.target.value)}
                                placeholder="e.g. 14"
                            />
                        </div>
                        <div>
                            <Label>{t('Notes / Conditions')}</Label>
                            <Textarea
                                value={responseForm.data.response_notes}
                                onChange={e => responseForm.setData('response_notes', e.target.value)}
                                rows={3}
                                placeholder={t('Any conditions or notes from the supplier...')}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setResponseTarget(null)}>{t('Cancel')}</Button>
                        <Button onClick={handleRecordResponse} disabled={responseForm.processing}>
                            {t('Save Response')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Award Dialog */}
            <Dialog open={showAward} onOpenChange={setShowAward}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t('Award Contract')}</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        <p className="text-sm text-muted-foreground mb-4">
                            {t('Select the winning supplier. This will mark the RFQ as awarded and allow you to issue a Purchase Order / Contract.')}
                        </p>
                        <Label required>{t('Awarded Supplier')}</Label>
                        <Select
                            value={awardForm.data.awarded_supplier_id}
                            onValueChange={v => awardForm.setData('awarded_supplier_id', v)}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder={t('Select supplier...')} />
                            </SelectTrigger>
                            <SelectContent>
                                {respondedSuppliers.map(s => (
                                    <SelectItem key={s.supplier_id} value={s.supplier_id.toString()}>
                                        {s.supplier?.name} — {formatCurrency(s.quoted_amount ?? 0)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {quotation.evaluation?.recommended_supplier && (
                            <p className="text-xs text-green-700 mt-2 flex items-center gap-1">
                                <Award className="h-3 w-3" />
                                {t('Evaluation recommends')}: {quotation.evaluation.recommended_supplier.name}
                            </p>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowAward(false)}>{t('Cancel')}</Button>
                        <Button onClick={handleAward} disabled={awardForm.processing || !awardForm.data.awarded_supplier_id}>
                            {t('Confirm Award')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AuthenticatedLayout>
    );
}
