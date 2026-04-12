import { Head, usePage, router } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import AuthenticatedLayout from '@/layouts/authenticated-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/utils/helpers';
import { ArrowLeft, CheckCircle } from 'lucide-react';

interface GrnItem {
    id: number;
    description: string;
    unit?: string;
    ordered_qty: number;
    received_qty: number;
    rejected_qty: number;
    condition: string;
    condition_notes?: string;
}

interface Grn {
    id: number;
    grn_number: string;
    grn_date: string;
    status: string;
    posted_at?: string;
    receiving_department?: string;
    delivery_note_number?: string;
    remarks?: string;
    inspection_status: string;
    inspected_at?: string;
    inspection_remarks?: string;
    lpo?: {
        id: number;
        lpo_number: string;
    };
    receiving_officer?: { name: string };
    posted_by_user?: { name: string };
    inspected_by_user?: { name: string };
    items: GrnItem[];
}

const CONDITION_COLORS: Record<string, string> = {
    good:      'bg-green-100 text-green-800',
    partial:   'bg-yellow-100 text-yellow-800',
    damaged:   'bg-orange-100 text-orange-800',
    defective: 'bg-red-100 text-red-800',
};

export default function GrnShow() {
    const { grn } = usePage<{ grn: Grn }>().props;
    const { t } = useTranslation();

    const handlePost = () => {
        router.post(route('procurement.grns.post', grn.id));
    };

    const handleInspect = (status: 'accepted' | 'rejected') => {
        const remarks = prompt(t('Enter inspection remarks (optional):')) ?? '';
        router.post(route('procurement.grns.inspect', grn.id), {
            inspection_status: status,
            inspection_remarks: remarks,
        });
    };

    return (
        <AuthenticatedLayout>
            <Head title={`${t('GRN')} ${grn.grn_number}`} />

            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={() => router.visit(route('procurement.grns.index'))}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold">{t('Goods Received Note')} — {grn.grn_number}</h1>
                        <p className="text-sm text-gray-500">{formatDate(grn.grn_date)}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${grn.status === 'posted' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                        {t(grn.status)}
                    </span>
                    {grn.status === 'draft' && (
                        <Button onClick={handlePost}>
                            <CheckCircle className="h-4 w-4 mr-2" />
                            {t('Post GRN (Confirm Receipt)')}
                        </Button>
                    )}
                    {grn.status === 'posted' && grn.inspection_status === 'pending' && (
                        <div className="flex gap-2 ml-2">
                            <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => handleInspect('rejected')}>
                                {t('Reject Delivery')}
                            </Button>
                            <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => handleInspect('accepted')}>
                                <CheckCircle className="h-4 w-4 mr-2" />
                                {t('Accept Delivery')}
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left: Details */}
                <div className="lg:col-span-1 space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">{t('Receipt Information')}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm">
                            <div>
                                <p className="font-semibold text-gray-500 uppercase text-xs tracking-wide">{t('Purchase Order (PO) Reference')}</p>
                                <p className="mt-0.5">{grn.lpo?.lpo_number ?? '—'}</p>
                            </div>
                            <div>
                                <p className="font-semibold text-gray-500 uppercase text-xs tracking-wide">{t('Date of Receipt')}</p>
                                <p className="mt-0.5">{formatDate(grn.grn_date)}</p>
                            </div>
                            <div>
                                <p className="font-semibold text-gray-500 uppercase text-xs tracking-wide">{t('Receiving Department')}</p>
                                <p className="mt-0.5">{grn.receiving_department ?? '—'}</p>
                            </div>
                            <div>
                                <p className="font-semibold text-gray-500 uppercase text-xs tracking-wide">{t('Receiving Officer')}</p>
                                <p className="mt-0.5">{grn.receiving_officer?.name ?? '—'}</p>
                            </div>
                            {grn.delivery_note_number && (
                                <div>
                                    <p className="font-semibold text-gray-500 uppercase text-xs tracking-wide">{t("Supplier's Delivery Note")}</p>
                                    <p className="mt-0.5">{grn.delivery_note_number}</p>
                                </div>
                            )}
                            {grn.posted_at && (
                                <div>
                                    <p className="font-semibold text-gray-500 uppercase text-xs tracking-wide">{t('Posted')}</p>
                                    <p className="mt-0.5">{formatDate(grn.posted_at)}</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {grn.remarks && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">{t('Remarks')}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-gray-700">{grn.remarks}</p>
                            </CardContent>
                        </Card>
                    )}

                    {grn.inspection_status !== 'pending' && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base flex items-center justify-between">
                                    <span>{t('Department Inspection')}</span>
                                    <Badge variant={grn.inspection_status === 'accepted' ? 'default' : 'destructive'} 
                                        className={grn.inspection_status === 'accepted' ? 'bg-blue-100 text-blue-800 hover:bg-blue-100' : ''}>
                                        {t(grn.inspection_status)}
                                    </Badge>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3 text-sm">
                                <div>
                                    <p className="font-semibold text-gray-500 uppercase text-xs tracking-wide">{t('Inspected By')}</p>
                                    <p className="mt-0.5">{grn.inspected_by_user?.name ?? '—'}</p>
                                </div>
                                <div>
                                    <p className="font-semibold text-gray-500 uppercase text-xs tracking-wide">{t('Inspected At')}</p>
                                    <p className="mt-0.5">{grn.inspected_at ? formatDate(grn.inspected_at) : '—'}</p>
                                </div>
                                {grn.inspection_remarks && (
                                    <div>
                                        <p className="font-semibold text-gray-500 uppercase text-xs tracking-wide">{t('Inspection Remarks')}</p>
                                        <p className="mt-0.5 whitespace-pre-wrap">{grn.inspection_remarks}</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Right: Line Items */}
                <div className="lg:col-span-2">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">{t('Items Received')}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm border-collapse">
                                    <thead>
                                        <tr className="border-b bg-gray-50 text-left">
                                            <th className="px-3 py-2 font-semibold">{t('Description')}</th>
                                            <th className="px-3 py-2 font-semibold text-right">{t('Ordered')}</th>
                                            <th className="px-3 py-2 font-semibold text-right">{t('Received')}</th>
                                            <th className="px-3 py-2 font-semibold text-right">{t('Rejected')}</th>
                                            <th className="px-3 py-2 font-semibold text-right">{t('Accepted')}</th>
                                            <th className="px-3 py-2 font-semibold">{t('Condition')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {grn.items.map((item) => {
                                            const accepted = Math.max(0, Number(item.received_qty) - Number(item.rejected_qty));
                                            return (
                                                <tr key={item.id} className="border-b hover:bg-gray-50">
                                                    <td className="px-3 py-2">
                                                        <p className="font-medium">{item.description}</p>
                                                        {item.unit && <p className="text-xs text-gray-400">{item.unit}</p>}
                                                        {item.condition_notes && (
                                                            <p className="text-xs text-gray-500 italic mt-0.5">{item.condition_notes}</p>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-2 text-right font-mono">{item.ordered_qty}</td>
                                                    <td className="px-3 py-2 text-right font-mono">{item.received_qty}</td>
                                                    <td className="px-3 py-2 text-right font-mono text-red-600">{item.rejected_qty}</td>
                                                    <td className="px-3 py-2 text-right font-mono font-semibold text-green-700">{accepted}</td>
                                                    <td className="px-3 py-2">
                                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${CONDITION_COLORS[item.condition] ?? 'bg-gray-100 text-gray-700'}`}>
                                                            {t(item.condition)}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {grn.status === 'draft' && (
                                <p className="text-xs text-amber-600 mt-4 border-t pt-3">
                                    {t('This GRN is a draft. Post it to update the Purchase Order receipt status and enable 3-way matching for invoice approval (PO → GRN → Supplier Invoice).')}
                                </p>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
