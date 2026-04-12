import React, { useState } from 'react';
import { Head, usePage, router, useForm } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import { PurchaseInvoice } from './types';
import AuthenticatedLayout from '@/layouts/authenticated-layout';
import { formatCurrency, formatDate } from '@/utils/helpers';
import { getStatusBadgeClasses } from './utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Edit, FileText, ArrowLeft, Building2, User, Calendar, Package, MapPin, Download, AlertTriangle, CheckCircle, ShieldCheck } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { usePageButtons } from '@/hooks/usePageButtons';

interface Discrepancy {
    type: string;
    item?: string;
    message: string;
    lpo_qty?: number;
    grn_qty?: number;
    invoice_qty?: number;
    lpo_price?: number;
    invoice_price?: number;
    variance_pct?: number;
}

interface MatchLog {
    id: number;
    match_status: string;
    discrepancies: Discrepancy[] | null;
    override_reason?: string;
    override_at?: string;
}

interface ViewProps {
    invoice: PurchaseInvoice & {
        lpo_id?: number;
        match_status?: string;
        match_override_reason?: string;
    };
    matchLog?: MatchLog;
    auth: any;
    [key: string]: any;
}

function MatchStatusPanel({ invoice, matchLog, t, auth }: {
    invoice: ViewProps['invoice'];
    matchLog?: MatchLog;
    t: (k: string) => string;
    auth: any;
}) {
    const [showOverrideForm, setShowOverrideForm] = useState(false);
    const { data, setData, post, processing, errors } = useForm({ override_reason: '' });

    if (!invoice.lpo_id) return null;

    const status = invoice.match_status ?? 'pending';

    const submitOverride = (e: React.FormEvent) => {
        e.preventDefault();
        post(route('purchase-invoices.override-match', invoice.id), {
            onSuccess: () => { setShowOverrideForm(false); router.reload(); }
        });
    };

    return (
        <Card className={`border-l-4 ${
            status === 'pass'     ? 'border-l-green-500' :
            status === 'fail'     ? 'border-l-red-500' :
            status === 'override' ? 'border-l-amber-500' :
            'border-l-gray-300'
        }`}>
            <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                    {status === 'pass'     && <CheckCircle className="h-4 w-4 text-green-600" />}
                    {status === 'fail'     && <AlertTriangle className="h-4 w-4 text-red-600" />}
                    {status === 'override' && <ShieldCheck className="h-4 w-4 text-amber-600" />}
                    {status === 'pending'  && <FileText className="h-4 w-4 text-gray-400" />}
                    {t('Three-Way Match')}
                    <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${
                        status === 'pass'     ? 'bg-green-100 text-green-800' :
                        status === 'fail'     ? 'bg-red-100 text-red-800' :
                        status === 'override' ? 'bg-amber-100 text-amber-800' :
                        'bg-gray-100 text-gray-600'
                    }`}>
                        {t(status.charAt(0).toUpperCase() + status.slice(1))}
                    </span>
                </CardTitle>
            </CardHeader>
            <CardContent>
                {status === 'pass' && (
                    <p className="text-sm text-green-700">{t('LPO, GRN, and invoice quantities and prices all match. Invoice may be posted.')}</p>
                )}

                {status === 'pending' && (
                    <p className="text-sm text-gray-500">{t('Three-way match has not been performed yet. Post the invoice to run the check.')}</p>
                )}

                {status === 'override' && matchLog?.override_reason && (
                    <div className="text-sm">
                        <p className="text-amber-700">{t('A Finance Officer has overridden the failed match.')}</p>
                        <p className="mt-1 text-gray-600"><span className="font-semibold">{t('Reason')}:</span> {matchLog.override_reason}</p>
                    </div>
                )}

                {status === 'fail' && matchLog && (
                    <div className="space-y-3">
                        <p className="text-sm text-red-700 font-medium">{t('The following discrepancies were found:')}</p>
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs border-collapse">
                                <thead>
                                    <tr className="bg-red-50 border-b border-red-100">
                                        <th className="px-3 py-2 text-left font-semibold">{t('Item')}</th>
                                        <th className="px-3 py-2 text-left font-semibold">{t('Issue')}</th>
                                        <th className="px-3 py-2 text-left font-semibold">{t('Detail')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(matchLog.discrepancies ?? []).map((d, i) => (
                                        <tr key={i} className="border-b border-red-50">
                                            <td className="px-3 py-2 font-medium">{d.item ?? '—'}</td>
                                            <td className="px-3 py-2">{t(d.type)}</td>
                                            <td className="px-3 py-2 text-gray-600">{d.message}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Finance Officer override */}
                        {auth.user?.permissions?.includes('override-match') && !showOverrideForm && (
                            <div className="pt-2">
                                <p className="text-xs text-gray-500 mb-2">{t('If you have reviewed and accepted these discrepancies, you may override the failed match with a recorded reason.')}</p>
                                <Button variant="outline" size="sm" onClick={() => setShowOverrideForm(true)}>
                                    <ShieldCheck className="h-4 w-4 mr-2" />
                                    {t('Record Override')}
                                </Button>
                            </div>
                        )}

                        {showOverrideForm && (
                            <form onSubmit={submitOverride} className="space-y-3 bg-amber-50 border border-amber-200 rounded p-4">
                                <p className="text-sm font-semibold text-amber-800">{t('Finance Officer Override')}</p>
                                <div className="space-y-1">
                                    <Label className="text-xs">{t('Override Reason')} <span className="text-red-500">*</span></Label>
                                    <Textarea
                                        value={data.override_reason}
                                        onChange={(e) => setData('override_reason', e.target.value)}
                                        placeholder={t('State the reason for accepting these discrepancies…')}
                                        rows={3}
                                    />
                                    {errors.override_reason && <p className="text-xs text-red-500">{errors.override_reason}</p>}
                                </div>
                                <div className="flex gap-2">
                                    <Button type="submit" size="sm" disabled={processing}>
                                        {processing ? t('Saving…') : t('Confirm Override')}
                                    </Button>
                                    <Button type="button" size="sm" variant="ghost" onClick={() => setShowOverrideForm(false)}>
                                        {t('Cancel')}
                                    </Button>
                                </div>
                            </form>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

export default function View() {
    const { t } = useTranslation();
    const { invoice, matchLog, auth } = usePage<ViewProps>().props;


    const signatureStatusButtons = usePageButtons('signatureViewBtn', {
        invoice: invoice,
        invoiceType: 'purchase'
    });


    const downloadPDF = () => {
        const printUrl = route('purchase-invoices.print', invoice.id) + '?download=pdf';
        window.open(printUrl, '_blank');
    };



    return (
        <AuthenticatedLayout
            breadcrumbs={[
                {label: t('Purchase Invoice'), url: route('purchase-invoices.index')},
                {label: t('Purchase Invoice Details')}
            ]}
            pageTitle={`${t('Purchase Invoice')} #${invoice.invoice_number}`}

        >
            <Head title={`${t('Purchase Invoice')} #${invoice.invoice_number}`} />

            <div className="space-y-6">
                {/* Invoice Header */}
                <Card>
                    <CardContent className="p-6">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <p className="text-lg text-muted-foreground">#{invoice.invoice_number}</p>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className={getStatusBadgeClasses(invoice.status)}>
                                    {t(invoice.status.toUpperCase())}
                                </span>
                                <div className="text-right">
                                    <div className="text-2xl font-bold">{formatCurrency(invoice.total_amount)}</div>
                                    <div className="text-sm text-muted-foreground">{t('Total Amount')}</div>
                                </div>
                            </div>
                        </div>

                        <div className={`grid grid-cols-1 gap-6 ${invoice.vendor_details?.billing_address || invoice.vendor_details?.shipping_address ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
                            <div>
                                <h3 className="font-semibold mb-2">{t('VENDOR')}</h3>
                                <div className="text-sm space-y-1">
                                    <div className="font-medium">{invoice.vendor?.name}</div>
                                    <div className="text-muted-foreground">{invoice.vendor?.email}</div>
                                </div>
                                {invoice.vendor_details?.billing_address && (
                                    <div className="mt-3">
                                        <div className="font-medium text-sm mb-1">{t('Billing Address')}</div>
                                        <div className="text-sm text-muted-foreground space-y-1">
                                            <div>{invoice.vendor_details.billing_address.name}</div>
                                            <div>{invoice.vendor_details.billing_address.address_line_1}</div>
                                            <div>{invoice.vendor_details.billing_address.city}, {invoice.vendor_details.billing_address.state} {invoice.vendor_details.billing_address.zip_code}</div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {invoice.vendor_details?.shipping_address && (
                                <div>
                                    <h3 className="font-semibold mb-2">{t('SHIPPING ADDRESS')}</h3>
                                    <div className="text-sm text-muted-foreground space-y-1">
                                        <div>{invoice.vendor_details.shipping_address.name}</div>
                                        <div>{invoice.vendor_details.shipping_address.address_line_1}</div>
                                        <div>{invoice.vendor_details.shipping_address.city}, {invoice.vendor_details.shipping_address.state} {invoice.vendor_details.shipping_address.zip_code}</div>
                                    </div>
                                </div>
                            )}

                            <div>
                                <h3 className="font-semibold mb-2">{t('DETAILS')}</h3>
                                <div className="space-y-1 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">{t('Invoice Date')}</span>
                                        <span>{formatDate(invoice.invoice_date)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">{t('Due Date')}</span>
                                        <span className={new Date(invoice.due_date) < new Date() ? 'text-red-600' : ''}>
                                            {formatDate(invoice.due_date)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">{t('Warehouse')}</span>
                                        <span>{invoice.warehouse?.name || '-'}</span>
                                    </div>
                                    {invoice.lpo_id && (
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">{t('LPO Reference')}</span>
                                            <span className="font-mono text-xs">{t('LPO linked')}</span>
                                        </div>
                                    )}
                                    {invoice.payment_terms && (
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">{t('Terms')}</span>
                                            <span>{invoice.payment_terms}</span>
                                        </div>
                                    )}
                                </div>
                                <div className="mt-4 p-3 bg-blue-50 rounded">
                                    <div className="flex justify-between items-center">
                                        <div className="flex gap-2">
                                            {auth.user?.permissions?.includes('print-purchase-invoices') && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={downloadPDF}
                                                >
                                                    <Download className="h-4 w-4 mr-2" />
                                                    {t('Download PDF')}
                                                </Button>
                                            )}
                                            {invoice.status === 'draft' && auth.user?.permissions?.includes('post-purchase-invoices') && (
                                                <TooltipProvider>
                                                    <Tooltip delayDuration={0}>
                                                        <TooltipTrigger asChild>
                                                            <Button
                                                                size="sm"
                                                                onClick={() => router.post(route('purchase-invoices.post', invoice.id), {}, {
                                                                    onSuccess: () => {
                                                                        router.reload();
                                                                    }
                                                                })}
                                                            >
                                                                <FileText className="h-4 w-4 mr-2" />
                                                                {t('Post Invoice')}
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <p>{t('Post invoice to finalize and create journal entries')}</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            )}
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xl font-bold text-blue-600">{formatCurrency(invoice.balance_amount)}</div>
                                            <div className="text-sm text-muted-foreground">{t('Balance Due')}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {invoice.notes && (
                            <div className="mt-4 pt-4 border-t">
                                <span className="font-medium text-sm">{t('Notes')}:</span>
                                <span className="text-sm text-muted-foreground ml-2">{invoice.notes}</span>
                            </div>
                        )}
                         {/* Signature Status */}
                        {signatureStatusButtons.length > 0 && signatureStatusButtons.map((button) => (
                          <div key={button.id} className="mt-4 pt-4 border-t">{button.component}</div>
                        ))}
                    </CardContent>
                </Card>

                {/* Three-Way Match Status (only shown for LPO-linked invoices) */}
                {invoice.lpo_id && (
                    <MatchStatusPanel invoice={invoice} matchLog={matchLog} t={t} auth={auth} />
                )}

                {/* Invoice Items */}
                <Card>
                    <CardHeader>
                        <h3 className="text-lg font-semibold">
                            {t('Invoice Items')}
                        </h3>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <table className="min-w-full">
                                <thead>
                                    <tr className="border-b">
                                        <th className="px-4 py-3 text-left text-sm font-semibold">{t('Product')}</th>
                                        <th className="px-4 py-3 text-right text-sm font-semibold">{t('Qty')}</th>
                                        <th className="px-4 py-3 text-right text-sm font-semibold">{t('Unit Price')}</th>
                                        <th className="px-4 py-3 text-right text-sm font-semibold">{t('Discount')}</th>
                                        <th className="px-4 py-3 text-right text-sm font-semibold">{t('Tax')}</th>
                                        <th className="px-4 py-3 text-right text-sm font-semibold">{t('Total')}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {invoice.items?.map((item, index) => (
                                        <tr key={index}>
                                            <td className="px-4 py-4">
                                                <div className="font-medium">{item.product?.name}</div>
                                                {item.product?.sku && (
                                                    <div className="text-sm text-muted-foreground">SKU: {item.product.sku}</div>
                                                )}
                                                {item.product?.description && (
                                                    <div className="text-sm text-muted-foreground mt-1">{item.product.description}</div>
                                                )}
                                            </td>
                                            <td className="px-4 py-4 text-right">{item.quantity}</td>
                                            <td className="px-4 py-4 text-right">{formatCurrency(item.unit_price)}</td>
                                            <td className="px-4 py-4 text-right">
                                                {item.discount_percentage > 0 ? (
                                                    <div>
                                                        <div>{item.discount_percentage}%</div>
                                                        <div className="text-sm text-muted-foreground">
                                                            -{formatCurrency(item.discount_amount)}
                                                        </div>
                                                    </div>
                                                ) : '-'}
                                            </td>
                                            <td className="px-4 py-4 text-right">
                                                {item.taxes && item.taxes.length > 0 ? (
                                                    <div>
                                                        {item.taxes.map((tax, taxIndex) => (
                                                            <div key={taxIndex} className="text-sm">{tax.tax_name} ({tax.tax_rate}%)</div>
                                                        ))}
                                                        <div className="text-sm text-muted-foreground">
                                                            {formatCurrency(item.tax_amount)}
                                                        </div>
                                                    </div>
                                                ) : item.tax_percentage > 0 ? (
                                                    <div>
                                                        <div>{item.tax_percentage}%</div>
                                                        <div className="text-sm text-muted-foreground">
                                                            {formatCurrency(item.tax_amount)}
                                                        </div>
                                                    </div>
                                                ) : '-'}
                                            </td>
                                            <td className="px-4 py-4 text-right font-semibold">
                                                {formatCurrency(item.total_amount)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Invoice Summary */}
                        <div className="mt-6 flex justify-end">
                            <div className="w-80 space-y-3">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">{t('Subtotal')}</span>
                                    <span className="font-medium">{formatCurrency(invoice.subtotal)}</span>
                                </div>
                                {invoice.discount_amount > 0 && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">{t('Discount')}</span>
                                        <span className="font-medium text-red-600">-{formatCurrency(invoice.discount_amount)}</span>
                                    </div>
                                )}
                                {invoice.tax_amount > 0 && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">{t('Tax')}</span>
                                        <span className="font-medium">{formatCurrency(invoice.tax_amount)}</span>
                                    </div>
                                )}
                                <div className="border-t pt-3">
                                    <div className="flex justify-between">
                                        <span className="font-semibold">{t('Total Amount')}</span>
                                        <span className="font-bold text-lg">{formatCurrency(invoice.total_amount)}</span>
                                    </div>
                                </div>
                                {invoice.paid_amount > 0 && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">{t('Paid Amount')}</span>
                                        <span className="font-medium text-green-600">{formatCurrency(invoice.paid_amount)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between">
                                    <span className="font-semibold">{t('Balance Due')}</span>
                                    <span className="font-bold text-lg">{formatCurrency(invoice.balance_amount)}</span>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </AuthenticatedLayout>
    );
}
