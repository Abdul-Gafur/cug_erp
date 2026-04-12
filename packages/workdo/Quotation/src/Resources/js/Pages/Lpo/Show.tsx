import React from 'react';
import { Head, usePage, router } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import { Lpo } from '../Quotations/types';
import AuthenticatedLayout from '@/layouts/authenticated-layout';
import { formatCurrency, formatDate } from '@/utils/helpers';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Download, CheckCircle, Mail, Package, Truck } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
    draft:     'bg-gray-100 text-gray-800',
    approved:  'bg-green-100 text-green-800',
    emailed:   'bg-blue-100 text-blue-800',
    completed: 'bg-teal-100 text-teal-800',
    cancelled: 'bg-red-100 text-red-800',
};

interface ShowProps {
    lpo: Lpo;
    auth: any;
    [key: string]: any;
}

export default function Show() {
    const { t } = useTranslation();
    const { lpo, auth } = usePage<ShowProps>().props;
    const permissions: string[] = auth?.user?.permissions ?? [];

    return (
        <AuthenticatedLayout
            breadcrumbs={[
                { label: t('Purchase Orders / Contracts'), url: route('lpo.index') },
                { label: lpo.lpo_number },
            ]}
            pageTitle={`${t('Purchase Order / Contract Award')} #${lpo.lpo_number}`}
        >
            <Head title={`${t('Purchase Order / Contract Award')} #${lpo.lpo_number}`} />

            <div className="space-y-6">
                {/* Header */}
                <Card>
                    <CardContent className="p-6">
                        <div className="flex flex-wrap justify-between items-start gap-4 mb-6">
                            <div>
                                <p className="text-muted-foreground text-sm">{t('Purchase Order / Contract Award')}</p>
                                <h2 className="text-xl font-bold">#{lpo.lpo_number}</h2>
                                <p className="text-sm mt-1">
                                    <span className="font-medium">{t('Department')}:</span> {lpo.issuing_department}
                                </p>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                                <span className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLORS[lpo.status] ?? 'bg-gray-100 text-gray-800'}`}>
                                    {t(lpo.status.charAt(0).toUpperCase() + lpo.status.slice(1))}
                                </span>
                                <div className="text-right">
                                    <div className="text-2xl font-bold">{formatCurrency(lpo.total_amount)}</div>
                                    <div className="text-xs text-muted-foreground">{t('Total PO / Contract Value')}</div>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-6">
                            <div>
                                <span className="text-muted-foreground block">{t('PO Date')}</span>
                                <span className="font-medium">{formatDate(lpo.lpo_date)}</span>
                            </div>
                            <div>
                                <span className="text-muted-foreground block">{t('Supplier')}</span>
                                <span className="font-medium">{lpo.supplier?.name}</span>
                                <span className="text-xs text-muted-foreground block">{lpo.supplier?.email}</span>
                            </div>
                            <div>
                                <span className="text-muted-foreground block">{t('Delivery Date')}</span>
                                <span className="font-medium">{lpo.delivery_date ? formatDate(lpo.delivery_date) : '-'}</span>
                            </div>
                            <div>
                                <span className="text-muted-foreground block">{t('Payment Terms')}</span>
                                <span className="font-medium">{lpo.payment_terms ?? '-'}</span>
                            </div>
                        </div>

                        {/* Budget info */}
                        {(lpo.vote_account || lpo.fund_type || lpo.budget_period) && (
                            <div className="bg-muted/30 rounded-lg p-3 text-sm grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                                {lpo.vote_account && (
                                    <div>
                                        <span className="text-muted-foreground block text-xs">{t('Vote / Account')}</span>
                                        <span>{lpo.vote_account.account_code} — {lpo.vote_account.account_name}</span>
                                    </div>
                                )}
                                {lpo.fund_type && (
                                    <div>
                                        <span className="text-muted-foreground block text-xs">{t('Fund Type')}</span>
                                        <span className="capitalize">{lpo.fund_type.replace(/_/g, ' ')}</span>
                                    </div>
                                )}
                                {lpo.economic_classification && (
                                    <div>
                                        <span className="text-muted-foreground block text-xs">{t('Classification')}</span>
                                        <span className="capitalize">{lpo.economic_classification.replace(/_/g, ' ')}</span>
                                    </div>
                                )}
                                {lpo.budget_period && (
                                    <div>
                                        <span className="text-muted-foreground block text-xs">{t('Budget Period')}</span>
                                        <span>{lpo.budget_period.period_name}</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex flex-wrap gap-2 pt-4 border-t">
                            {permissions.includes('print-quotations') && (
                                <Button variant="outline" size="sm"
                                    onClick={() => window.open(route('lpo.print', lpo.id) + '?download=pdf', '_blank')}>
                                    <Download className="h-4 w-4 mr-2" />
                                    {lpo.is_contract ? t('Download Contract Document') : t('Download Purchase Order')}
                                </Button>
                            )}

                            {lpo.status === 'draft' && permissions.includes('approve-quotations') && (
                                <Button size="sm"
                                    onClick={() => router.post(route('lpo.approve', lpo.id))}>
                                    <CheckCircle className="h-4 w-4 mr-2" />{t('Approve Purchase Order')}
                                </Button>
                            )}

                            {lpo.status === 'approved' && permissions.includes('sent-quotations') && (
                                <Button size="sm" variant="outline"
                                    onClick={() => router.post(route('lpo.email', lpo.id))}>
                                    <Mail className="h-4 w-4 mr-2" />{t('Email to Supplier')}
                                </Button>
                            )}

                            {/* Step 6: Delivery of Goods/Services — Create GRN */}
                            {['approved', 'emailed'].includes(lpo.status) && permissions.includes('create-grns') && (
                                <Button size="sm" variant="default"
                                    onClick={() => router.visit(route('procurement.grns.create', { lpo_id: lpo.id }))}>
                                    <Truck className="h-4 w-4 mr-2" />{t('Receive Goods / Services (Create GRN)')}
                                </Button>
                            )}
                        </div>

                        {lpo.status === 'approved' && lpo.approved_by_user && (
                            <p className="text-xs text-muted-foreground mt-3">
                                {t('Approved by')} {lpo.approved_by_user.name} on {formatDate(lpo.approved_at!)}
                            </p>
                        )}
                        {lpo.emailed_at && (
                            <p className="text-xs text-muted-foreground mt-1">
                                {t('Emailed to supplier on')} {formatDate(lpo.emailed_at)}
                            </p>
                        )}
                    </CardContent>
                </Card>

                {/* Contract Agreement Section */}
                {lpo.is_contract && (
                    <Card className="border-blue-200 bg-blue-50/20">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base flex items-center gap-2 text-blue-900">
                                <FileText className="h-4 w-4" />
                                {t('Formal Contract Agreement')}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <span className="text-blue-700 block text-xs font-semibold uppercase tracking-wider">{t('Contract Registration Number')}</span>
                                <span className="font-bold text-lg">{lpo.contract_number}</span>
                            </div>
                            {lpo.contract_terms && (
                                <div className="pt-3 border-t border-blue-100">
                                    <span className="text-blue-700 block text-xs font-semibold uppercase tracking-wider mb-2">{t('Contractual Terms & Conditions')}</span>
                                    <div className="text-sm text-blue-900 bg-white/50 p-4 rounded border border-blue-50 whitespace-pre-wrap leading-relaxed">
                                        {lpo.contract_terms}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* Delivery */}
                {lpo.delivery_location && (
                    <Card>
                        <CardContent className="p-4 text-sm">
                            <span className="font-semibold">{t('Delivery Location')}: </span>
                            <span className="text-muted-foreground">{lpo.delivery_location}</span>
                        </CardContent>
                    </Card>
                )}

                {/* Line items */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Package className="h-5 w-5" />
                            {t('Items')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <table className="min-w-full text-sm">
                            <thead>
                                <tr className="border-b">
                                    <th className="px-4 py-2 text-left">#</th>
                                    <th className="px-4 py-2 text-left">{t('Description')}</th>
                                    <th className="px-4 py-2 text-center">{t('Qty')}</th>
                                    <th className="px-4 py-2 text-left">{t('Unit')}</th>
                                    <th className="px-4 py-2 text-right">{t('Unit Price')}</th>
                                    <th className="px-4 py-2 text-right">{t('Discount')}</th>
                                    <th className="px-4 py-2 text-right">{t('Tax')}</th>
                                    <th className="px-4 py-2 text-right">{t('Total')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {lpo.items?.map((item, i) => (
                                    <tr key={i}>
                                        <td className="px-4 py-3">{i + 1}</td>
                                        <td className="px-4 py-3">
                                            <div className="font-medium">{item.description}</div>
                                            {item.product?.sku && <div className="text-xs text-muted-foreground">SKU: {item.product.sku}</div>}
                                        </td>
                                        <td className="px-4 py-3 text-center">{item.quantity}</td>
                                        <td className="px-4 py-3">{item.unit ?? '-'}</td>
                                        <td className="px-4 py-3 text-right">{formatCurrency(item.unit_price)}</td>
                                        <td className="px-4 py-3 text-right">
                                            {item.discount_percentage > 0 ? `${item.discount_percentage}%` : '-'}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            {item.tax_percentage > 0 ? `${item.tax_percentage}%` : '-'}
                                        </td>
                                        <td className="px-4 py-3 text-right font-semibold">
                                            {formatCurrency(item.total_amount)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <div className="mt-6 flex justify-end">
                            <div className="w-72 space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">{t('Subtotal')}</span>
                                    <span>{formatCurrency(lpo.subtotal)}</span>
                                </div>
                                {lpo.discount_amount > 0 && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">{t('Discount')}</span>
                                        <span className="text-red-600">-{formatCurrency(lpo.discount_amount)}</span>
                                    </div>
                                )}
                                {lpo.tax_amount > 0 && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">{t('Tax')}</span>
                                        <span>{formatCurrency(lpo.tax_amount)}</span>
                                    </div>
                                )}
                                <Separator />
                                <div className="flex justify-between font-bold text-base">
                                    <span>{t('Total')}</span>
                                    <span>{formatCurrency(lpo.total_amount)}</span>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {lpo.notes && (
                    <Card>
                        <CardContent className="p-4 text-sm">
                            <span className="font-semibold">{t('Notes')}: </span>
                            <span className="text-muted-foreground">{lpo.notes}</span>
                        </CardContent>
                    </Card>
                )}
            </div>
        </AuthenticatedLayout>
    );
}
