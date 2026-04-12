import { Head, usePage, router, useForm } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import AuthenticatedLayout from '@/layouts/authenticated-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState, useEffect } from 'react';

interface LpoItem {
    id: number;
    description: string;
    unit?: string;
    quantity: number;
    product_id?: number;
}

interface Lpo {
    id: number;
    lpo_number: string;
    supplier?: string;
    items: LpoItem[];
}

interface Officer {
    id: number;
    name: string;
}

interface GrnItemForm {
    lpo_item_id: number;
    description: string;
    unit: string;
    ordered_qty: number;
    received_qty: number | string;
    rejected_qty: number | string;
    condition: string;
    condition_notes: string;
}

export default function GrnCreate() {
    const { lpos, officers, selectedLpoId } = usePage<any>().props;
    const { t } = useTranslation();

    const { data, setData, post, processing, errors } = useForm<{
        lpo_id: number | string;
        grn_date: string;
        receiving_department: string;
        receiving_officer_id: number | string;
        delivery_note_number: string;
        remarks: string;
        items: GrnItemForm[];
    }>({
        lpo_id: selectedLpoId ?? '',
        grn_date: new Date().toISOString().split('T')[0],
        receiving_department: '',
        receiving_officer_id: '',
        delivery_note_number: '',
        remarks: '',
        items: [],
    });

    const [selectedLpo, setSelectedLpo] = useState<Lpo | null>(null);

    // Pre-select LPO if passed via query string
    useEffect(() => {
        if (selectedLpoId) {
            const lpo = lpos.find((l: Lpo) => l.id === selectedLpoId);
            if (lpo) onLpoChange(String(selectedLpoId));
        }
    }, []);

    const onLpoChange = (lpoId: string) => {
        setData('lpo_id', lpoId);
        const lpo = lpos.find((l: Lpo) => l.id === Number(lpoId));
        setSelectedLpo(lpo ?? null);
        if (lpo) {
            setData('items', lpo.items.map((item: LpoItem): GrnItemForm => ({
                lpo_item_id: item.id,
                description: item.description,
                unit: item.unit ?? '',
                ordered_qty: item.quantity,
                received_qty: item.quantity,
                rejected_qty: 0,
                condition: 'good',
                condition_notes: '',
            })));
        } else {
            setData('items', []);
        }
    };

    const updateItem = (index: number, field: keyof GrnItemForm, value: string | number) => {
        const updated = [...data.items];
        updated[index] = { ...updated[index], [field]: value };
        setData('items', updated);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        post(route('procurement.grns.store'));
    };

    const CONDITIONS = ['good', 'damaged', 'defective', 'partial'];

    return (
        <AuthenticatedLayout>
            <Head title={t('New Goods Received Note')} />

            <div className="mb-6">
                <h1 className="text-2xl font-bold">{t('New Goods Received Note (GRN)')}</h1>
                <p className="text-sm text-gray-500 mt-1">{t('Record goods or services received against an approved Purchase Order / Contract')}</p>
            </div>

            {/* 3-Way Matching Documentation Panel */}
            <Card className="border-indigo-200 bg-indigo-50 mb-6">
                <CardContent className="p-4">
                    <h3 className="font-semibold text-indigo-800 mb-2">{t('3-Way Matching Documentation')}</h3>
                    <p className="text-sm text-indigo-700 mb-2">
                        {t('This GRN is part of the 3-Way Matching process required under IPSAS. The following documents must align before payment can be processed:')}
                    </p>
                    <div className="grid grid-cols-3 gap-3 text-sm">
                        <div className="border border-indigo-200 bg-white rounded p-2">
                            <p className="font-semibold text-indigo-800">1. {t('Purchase Order (PO)')}</p>
                            <p className="text-xs text-indigo-600">{t('The approved order placed with the supplier')}</p>
                        </div>
                        <div className="border border-indigo-200 bg-white rounded p-2">
                            <p className="font-semibold text-indigo-800">2. {t('Goods Received Note (GRN)')}</p>
                            <p className="text-xs text-indigo-600">{t('This document — confirming delivery by Stores / User Department')}</p>
                        </div>
                        <div className="border border-indigo-200 bg-white rounded p-2">
                            <p className="font-semibold text-indigo-800">3. {t('Supplier Invoice')}</p>
                            <p className="text-xs text-indigo-600">{t('The invoice submitted by the supplier for payment')}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* GRN Header */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">{t('GRN Details')}</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">

                        {/* LPO Selection */}
                        <div className="space-y-1">
                            <Label>{t('Purchase Order (PO) Reference')} <span className="text-red-500">*</span></Label>
                            <Select value={String(data.lpo_id)} onValueChange={onLpoChange}>
                                <SelectTrigger>
                                    <SelectValue placeholder={t('Select Purchase Order')} />
                                </SelectTrigger>
                                <SelectContent>
                                    {lpos.map((lpo: Lpo) => (
                                        <SelectItem key={lpo.id} value={String(lpo.id)}>
                                            {lpo.lpo_number} — {lpo.supplier}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {errors.lpo_id && <p className="text-xs text-red-500">{errors.lpo_id}</p>}
                        </div>

                        {/* GRN Date */}
                        <div className="space-y-1">
                            <Label>{t('Date of Receipt')} <span className="text-red-500">*</span></Label>
                            <Input
                                type="date"
                                value={data.grn_date}
                                onChange={(e) => setData('grn_date', e.target.value)}
                            />
                            {errors.grn_date && <p className="text-xs text-red-500">{errors.grn_date}</p>}
                        </div>

                        {/* Receiving Department */}
                        <div className="space-y-1">
                            <Label>{t('Receiving Department')}</Label>
                            <Input
                                value={data.receiving_department}
                                onChange={(e) => setData('receiving_department', e.target.value)}
                                placeholder={t('e.g. Engineering Department')}
                            />
                        </div>

                        {/* Receiving Officer */}
                        <div className="space-y-1">
                            <Label>{t('Receiving Officer')} <span className="text-red-500">*</span></Label>
                            <Select
                                value={String(data.receiving_officer_id)}
                                onValueChange={(v) => setData('receiving_officer_id', v)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder={t('Select officer')} />
                                </SelectTrigger>
                                <SelectContent>
                                    {officers.map((o: Officer) => (
                                        <SelectItem key={o.id} value={String(o.id)}>{o.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {errors.receiving_officer_id && <p className="text-xs text-red-500">{errors.receiving_officer_id}</p>}
                        </div>

                        {/* Supplier Delivery Note */}
                        <div className="space-y-1">
                            <Label>{t("Supplier's Delivery Note / Waybill No.")}</Label>
                            <Input
                                value={data.delivery_note_number}
                                onChange={(e) => setData('delivery_note_number', e.target.value)}
                                placeholder={t('Optional')}
                            />
                        </div>

                        {/* Remarks */}
                        <div className="space-y-1 md:col-span-2">
                            <Label>{t('Remarks')}</Label>
                            <Textarea
                                value={data.remarks}
                                onChange={(e) => setData('remarks', e.target.value)}
                                placeholder={t('General remarks about the delivery')}
                                rows={2}
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Line Items */}
                {data.items.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">{t('Items Received')}</CardTitle>
                            <p className="text-xs text-gray-500">
                                {t('Review each line against the LPO. Enter the quantity actually received and accepted.')}
                            </p>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm border-collapse">
                                    <thead>
                                        <tr className="border-b bg-gray-50 text-left">
                                            <th className="px-3 py-2 font-semibold">{t('Description')}</th>
                                            <th className="px-3 py-2 font-semibold text-center">{t('Ordered')}</th>
                                            <th className="px-3 py-2 font-semibold text-center">{t('Received')}</th>
                                            <th className="px-3 py-2 font-semibold text-center">{t('Rejected')}</th>
                                            <th className="px-3 py-2 font-semibold">{t('Condition')}</th>
                                            <th className="px-3 py-2 font-semibold">{t('Notes')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.items.map((item, index) => (
                                            <tr key={item.lpo_item_id} className="border-b hover:bg-gray-50">
                                                <td className="px-3 py-2">
                                                    <p className="font-medium">{item.description}</p>
                                                    {item.unit && <p className="text-xs text-gray-400">{item.unit}</p>}
                                                </td>
                                                <td className="px-3 py-2 text-center">
                                                    <span className="font-mono">{item.ordered_qty}</span>
                                                </td>
                                                <td className="px-3 py-2 text-center">
                                                    <Input
                                                        type="number"
                                                        min={0}
                                                        max={item.ordered_qty}
                                                        step="0.001"
                                                        value={item.received_qty}
                                                        onChange={(e) => updateItem(index, 'received_qty', e.target.value)}
                                                        className="w-24 text-center mx-auto"
                                                    />
                                                    {errors[`items.${index}.received_qty` as keyof typeof errors] && (
                                                        <p className="text-xs text-red-500">
                                                            {errors[`items.${index}.received_qty` as keyof typeof errors]}
                                                        </p>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2 text-center">
                                                    <Input
                                                        type="number"
                                                        min={0}
                                                        step="0.001"
                                                        value={item.rejected_qty}
                                                        onChange={(e) => updateItem(index, 'rejected_qty', e.target.value)}
                                                        className="w-24 text-center mx-auto"
                                                    />
                                                </td>
                                                <td className="px-3 py-2">
                                                    <Select
                                                        value={item.condition}
                                                        onValueChange={(v) => updateItem(index, 'condition', v)}
                                                    >
                                                        <SelectTrigger className="w-32">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {CONDITIONS.map((c) => (
                                                                <SelectItem key={c} value={c}>{t(c)}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </td>
                                                <td className="px-3 py-2">
                                                    <Input
                                                        value={item.condition_notes}
                                                        onChange={(e) => updateItem(index, 'condition_notes', e.target.value)}
                                                        placeholder={t('Optional')}
                                                        className="w-40"
                                                    />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {data.items.length === 0 && data.lpo_id && (
                    <p className="text-sm text-amber-600 border border-amber-200 bg-amber-50 rounded p-3">
                        {t('No items found on the selected LPO, or all items have been fully received.')}
                    </p>
                )}

                <div className="flex gap-3">
                    <Button type="submit" disabled={processing || data.items.length === 0}>
                        {processing ? t('Saving…') : t('Save GRN (Draft)')}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => router.visit(route('procurement.grns.index'))}>
                        {t('Cancel')}
                    </Button>
                </div>
            </form>
        </AuthenticatedLayout>
    );
}
