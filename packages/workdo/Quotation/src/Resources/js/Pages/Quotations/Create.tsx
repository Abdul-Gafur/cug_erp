import React, { useState } from 'react';
import { Head, useForm, usePage } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import { RfqItem, User } from './types';
import AuthenticatedLayout from '@/layouts/authenticated-layout';
import QuotationItemsTable from './components/QuotationItemsTable';
import { useTaxCalculator } from './components/TaxCalculator';
import { formatCurrency } from '@/utils/helpers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { InputError } from '@/components/ui/input-error';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, Package, Users, X, FileText } from 'lucide-react';

interface PurchaseRequisition {
    id: number;
    requisition_number: string;
    purpose: string;
    total_amount: number;
    requesting_department?: { code: string; name: string };
    budget_period?: { period_name: string };
    items: Array<{
        id: number;
        description: string;
        quantity: number;
        unit: string | null;
        estimated_unit_cost: number;
        estimated_total_cost: number;
        account?: { account_code: string; account_name: string };
    }>;
}

interface CreateProps {
    suppliers: User[];
    warehouses: Array<{ id: number; name: string; address: string }>;
    purchaseRequisition?: PurchaseRequisition | null;
    [key: string]: any;
}

const EMPTY_ITEM: RfqItem = {
    product_id: 0,
    quantity: 1,
    unit_price: 0,
    discount_percentage: 0,
    discount_amount: 0,
    tax_percentage: 0,
    tax_amount: 0,
    total_amount: 0,
};

export default function Create() {
    const { t } = useTranslation();
    const { suppliers, warehouses, purchaseRequisition } = usePage<CreateProps>().props;
    const pr = purchaseRequisition ?? null;
    const [availableProducts, setAvailableProducts] = useState([]);
    const [invitedSuppliers, setInvitedSuppliers] = useState<User[]>([]);

    // Auto-populate department from the linked Purchase Requisition
    const initialDepartment = pr?.requesting_department
        ? `${pr.requesting_department.code} — ${pr.requesting_department.name}`
        : '';

    // Auto-populate items from the linked Purchase Requisition
    const initialItems: RfqItem[] = pr?.items?.length
        ? pr.items.map(item => ({
            product_id: 0,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.estimated_unit_cost,
            discount_percentage: 0,
            discount_amount: 0,
            tax_percentage: 0,
            tax_amount: 0,
            total_amount: item.estimated_total_cost,
        }))
        : [{ ...EMPTY_ITEM }];

    const { data, setData, post, processing, errors } = useForm({
        invoice_date:  new Date().toISOString().split('T')[0],
        due_date:      '',
        closing_date:  '',
        department:    initialDepartment,
        pr_id:         pr?.id ?? null as number | null,
        warehouse_id:  '',
        payment_terms: '',
        notes:         pr ? `${t('Linked to Purchase Requisition')}: ${pr.requisition_number}. ${pr.purpose}` : '',
        invited_supplier_ids: [] as number[],
        items: initialItems as RfqItem[],
    });

    const handleWarehouseChange = async (warehouseId: string) => {
        setData('warehouse_id', warehouseId);
        if (warehouseId) {
            try {
                const res = await fetch(route('quotations.warehouse.products') + `?warehouse_id=${warehouseId}`);
                setAvailableProducts(await res.json());
            } catch {
                setAvailableProducts([]);
            }
        } else {
            setAvailableProducts([]);
        }
    };

    const addSupplier = (supplierId: string) => {
        const supplier = suppliers.find(s => s.id === parseInt(supplierId));
        if (!supplier || invitedSuppliers.find(s => s.id === supplier.id)) return;
        const updated = [...invitedSuppliers, supplier];
        setInvitedSuppliers(updated);
        setData('invited_supplier_ids', updated.map(s => s.id));
    };

    const removeSupplier = (supplierId: number) => {
        const updated = invitedSuppliers.filter(s => s.id !== supplierId);
        setInvitedSuppliers(updated);
        setData('invited_supplier_ids', updated.map(s => s.id));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        post(route('quotations.store'));
    };

    const totals = useTaxCalculator(data.items);
    const availableToInvite = suppliers.filter(s => !invitedSuppliers.find(i => i.id === s.id));

    return (
        <AuthenticatedLayout
            breadcrumbs={[
                { label: t('Requests for Quotations / Tenders'), url: route('quotations.index') },
                { label: t('New RFQ / Tender') },
            ]}
            pageTitle={t('New Request for Quotations / Tender')}
        >
            <Head title={t('New Request for Quotations / Tender')} />

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Purchase Requisition Link Banner */}
                {pr && (
                    <Card className="border-blue-200 bg-blue-50">
                        <CardContent className="p-4 flex items-center gap-3">
                            <FileText className="h-5 w-5 text-blue-700" />
                            <div>
                                <p className="font-semibold text-blue-800">
                                    {t('Linked Purchase Requisition')}: {pr.requisition_number}
                                </p>
                                <p className="text-sm text-blue-700">
                                    {t('Department')}: {pr.requesting_department?.code} — {pr.requesting_department?.name} | {t('Budget Period')}: {pr.budget_period?.period_name} | {t('Estimated Value')}: {formatCurrency(pr.total_amount)}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* RFQ / Tender Details */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <CalendarDays className="h-5 w-5" />
                            {t('RFQ / Tender Details')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div>
                                <Label htmlFor="invoice_date" required>{t('RFQ Date')}</Label>
                                <DatePicker
                                    id="invoice_date"
                                    value={data.invoice_date}
                                    onChange={v => setData('invoice_date', v)}
                                    required
                                />
                                <InputError message={errors.invoice_date} />
                            </div>

                            <div>
                                <Label htmlFor="closing_date" required>{t('Closing Date')}</Label>
                                <DatePicker
                                    id="closing_date"
                                    value={data.closing_date}
                                    onChange={v => setData('closing_date', v)}
                                    required
                                />
                                <InputError message={errors.closing_date} />
                            </div>

                            <div>
                                <Label htmlFor="due_date">{t('Expected Delivery Date')}</Label>
                                <DatePicker
                                    id="due_date"
                                    value={data.due_date}
                                    onChange={v => setData('due_date', v)}
                                />
                                <InputError message={errors.due_date} />
                            </div>

                            <div>
                                <Label htmlFor="warehouse_id">{t('Delivery Warehouse')}</Label>
                                <Select value={data.warehouse_id} onValueChange={handleWarehouseChange}>
                                    <SelectTrigger>
                                        <SelectValue placeholder={t('Select Warehouse')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {warehouses.map(w => (
                                            <SelectItem key={w.id} value={w.id.toString()}>{w.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <InputError message={errors.warehouse_id} />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                            <div>
                                <Label htmlFor="department" required>{t('Requesting Department')}</Label>
                                <Input
                                    id="department"
                                    value={data.department}
                                    onChange={e => setData('department', e.target.value)}
                                    placeholder={t('e.g., ICT Department')}
                                    required
                                />
                                <InputError message={errors.department} />
                            </div>

                            <div>
                                <Label htmlFor="payment_terms">{t('Payment Terms')}</Label>
                                <Input
                                    id="payment_terms"
                                    value={data.payment_terms}
                                    onChange={e => setData('payment_terms', e.target.value)}
                                    placeholder={t('e.g., 30 days from delivery')}
                                />
                            </div>

                            <div>
                                <Label htmlFor="notes">{t('Special Requirements / Notes')}</Label>
                                <Textarea
                                    id="notes"
                                    value={data.notes}
                                    onChange={e => setData('notes', e.target.value)}
                                    rows={2}
                                    placeholder={t('Any special requirements or terms...')}
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Invited Suppliers */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <Users className="h-5 w-5" />
                            {t('Invited Suppliers')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground mb-3">
                            {t('Select the suppliers who will be invited to submit quotations for this RFQ. You can add more after issuing.')}
                        </p>

                        <div className="flex gap-2 mb-4">
                            <Select onValueChange={addSupplier}>
                                <SelectTrigger className="w-80">
                                    <SelectValue placeholder={t('Add supplier...')} />
                                </SelectTrigger>
                                <SelectContent searchable>
                                    {availableToInvite.map(s => (
                                        <SelectItem key={s.id} value={s.id.toString()}>
                                            {s.name} — {s.email}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {invitedSuppliers.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                                {invitedSuppliers.map(s => (
                                    <Badge key={s.id} variant="secondary" className="flex items-center gap-1 text-sm py-1 px-3">
                                        {s.name}
                                        <button type="button" onClick={() => removeSupplier(s.id)} className="ml-1 hover:text-red-600">
                                            <X className="h-3 w-3" />
                                        </button>
                                    </Badge>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground italic">
                                {t('No suppliers invited yet. You must add at least one supplier before issuing the RFQ.')}
                            </p>
                        )}
                    </CardContent>
                </Card>

                {/* Items */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <Package className="h-5 w-5" />
                                {t('Items / Services Required')}
                            </CardTitle>
                            <Button
                                type="button"
                                variant="default"
                                size="sm"
                                onClick={() => setData('items', [...data.items, { ...EMPTY_ITEM }])}
                            >
                                + {t('Add Item')}
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <QuotationItemsTable
                            items={data.items}
                            onChange={items => setData('items', items)}
                            errors={errors}
                            products={availableProducts}
                            showAddButton={false}
                        />

                        <div className="mt-6 flex justify-end">
                            <div className="w-80 bg-muted/30 rounded-lg p-4">
                                <h3 className="font-semibold mb-3">{t('Estimated Value')}</h3>
                                <div className="space-y-1">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">{t('Subtotal')}</span>
                                        <span>{formatCurrency(totals.subtotal)}</span>
                                    </div>
                                    {totals.discountAmount > 0 && (
                                        <div className="flex justify-between text-sm">
                                            <span className="text-muted-foreground">{t('Discount')}</span>
                                            <span className="text-red-600">-{formatCurrency(totals.discountAmount)}</span>
                                        </div>
                                    )}
                                    {totals.taxAmount > 0 && (
                                        <div className="flex justify-between text-sm">
                                            <span className="text-muted-foreground">{t('Tax')}</span>
                                            <span>{formatCurrency(totals.taxAmount)}</span>
                                        </div>
                                    )}
                                    <Separator className="my-2" />
                                    <div className="flex justify-between font-semibold">
                                        <span>{t('Total')}</span>
                                        <span className="text-lg">{formatCurrency(totals.total)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <div className="flex justify-end gap-3">
                    <Button type="button" variant="outline" onClick={() => window.history.back()}>
                        {t('Cancel')}
                    </Button>
                    <Button type="submit" disabled={processing || data.items.length === 0}>
                        {processing ? t('Saving...') : t('Save RFQ / Tender')}
                    </Button>
                </div>
            </form>
        </AuthenticatedLayout>
    );
}
