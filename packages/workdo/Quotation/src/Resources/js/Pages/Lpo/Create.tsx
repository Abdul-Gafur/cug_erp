import React, { useState } from 'react';
import { Head, useForm, usePage } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import { Rfq, User, ChartOfAccount, BudgetPeriod, LpoItem } from '../Quotations/types';
import AuthenticatedLayout from '@/layouts/authenticated-layout';
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
import { FileText, Package, Wallet } from 'lucide-react';

interface CreateProps {
    rfq?: Rfq;
    suppliers: User[];
    accounts: ChartOfAccount[];
    budgetPeriods: BudgetPeriod[];
    [key: string]: any;
}

const EMPTY_ITEM: LpoItem = {
    description: '',
    quantity: 1,
    unit: '',
    unit_price: 0,
    discount_percentage: 0,
    discount_amount: 0,
    tax_percentage: 0,
    tax_amount: 0,
    total_amount: 0,
};

function calcTotals(items: LpoItem[]) {
    return items.reduce((acc, i) => {
        const line = i.quantity * i.unit_price;
        const disc = (line * (i.discount_percentage ?? 0)) / 100;
        const tax  = ((line - disc) * (i.tax_percentage ?? 0)) / 100;
        acc.subtotal += line;
        acc.discount += disc;
        acc.tax      += tax;
        acc.total    += line - disc + tax;
        return acc;
    }, { subtotal: 0, discount: 0, tax: 0, total: 0 });
}

export default function Create() {
    const { t } = useTranslation();
    const { rfq, suppliers, accounts, budgetPeriods } = usePage<CreateProps>().props;

    // Pre-populate items from RFQ if present
    const initialItems: LpoItem[] = rfq?.items?.map(ri => ({
        product_id: ri.product_id,
        description: ri.description || ri.product?.name || '',
        quantity: ri.quantity,
        unit: ri.product?.unit || '',
        unit_price: ri.unit_price,
        discount_percentage: ri.discount_percentage,
        discount_amount: ri.discount_amount,
        tax_percentage: ri.tax_percentage,
        tax_amount: ri.tax_amount,
        total_amount: ri.total_amount,
    })) ?? [{ ...EMPTY_ITEM }];

    const { data, setData, post, processing, errors } = useForm({
        rfq_id:                  rfq?.id?.toString() ?? '',
        requisition_id:          rfq?.pr_id?.toString() ?? '',
        supplier_id:             rfq?.awarded_supplier_id?.toString() ?? '',
        lpo_date:                new Date().toISOString().split('T')[0],
        issuing_department:      rfq?.department ?? '',
        delivery_location:       '',
        delivery_date:           rfq?.due_date ?? '',
        payment_terms:           rfq?.payment_terms ?? '',
        vote_account_id:         '',
        fund_type:               '',
        economic_classification: '',
        budget_period_id:        '',
        is_contract:             false,
        contract_number:         '',
        contract_terms:          '',
        notes:                   '',
        items:                   initialItems as LpoItem[],
    });

    const updateItem = (i: number, field: keyof LpoItem, value: any) => {
        const updated = [...data.items];
        (updated[i] as any)[field] = value;

        // Recalculate line total
        const item = updated[i];
        const line  = item.quantity * item.unit_price;
        const disc  = (line * (item.discount_percentage ?? 0)) / 100;
        const tax   = ((line - disc) * (item.tax_percentage ?? 0)) / 100;
        item.discount_amount = disc;
        item.tax_amount      = tax;
        item.total_amount    = line - disc + tax;

        setData('items', updated);
    };

    const totals = calcTotals(data.items);

    return (
        <AuthenticatedLayout
            breadcrumbs={[
                { label: t('Local Purchase Orders'), url: route('lpo.index') },
                { label: t('New LPO') },
            ]}
            pageTitle={t('New Local Purchase Order')}
        >
            <Head title={t('New Local Purchase Order')} />

            <form onSubmit={e => { e.preventDefault(); post(route('lpo.store')); }} className="space-y-6">
                {rfq && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
                        <span className="font-semibold">{t('Based on RFQ')}:</span> #{rfq.quotation_number}
                        {rfq.awarded_supplier && (
                            <span> — {t('Awarded to')} <strong>{rfq.awarded_supplier.name}</strong></span>
                        )}
                    </div>
                )}

                {/* LPO Header */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex justify-between items-center text-lg gap-2">
                            <div className="flex items-center gap-2">
                                <FileText className="h-5 w-5" />
                                {t('LPO Details')}
                            </div>
                            <div className="flex items-center gap-2">
                                <input 
                                    type="checkbox" 
                                    id="is_contract" 
                                    checked={data.is_contract} 
                                    onChange={e => setData('is_contract', e.target.checked)} 
                                />
                                <Label htmlFor="is_contract" className="font-normal cursor-pointer">
                                    {t('Issue as Contract Agreement')}
                                </Label>
                            </div>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div>
                                <Label htmlFor="supplier_id" required>{t('Supplier')}</Label>
                                <Select value={data.supplier_id} onValueChange={v => setData('supplier_id', v)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder={t('Select supplier...')} />
                                    </SelectTrigger>
                                    <SelectContent searchable>
                                        {suppliers.map(s => (
                                            <SelectItem key={s.id} value={s.id.toString()}>
                                                {s.name} — {s.email}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <InputError message={errors.supplier_id} />
                            </div>

                            <div>
                                <Label htmlFor="lpo_date" required>{t('LPO Date')}</Label>
                                <DatePicker id="lpo_date" value={data.lpo_date} onChange={v => setData('lpo_date', v)} required />
                                <InputError message={errors.lpo_date} />
                            </div>

                            <div>
                                <Label htmlFor="delivery_date">{t('Required Delivery Date')}</Label>
                                <DatePicker id="delivery_date" value={data.delivery_date} onChange={v => setData('delivery_date', v)} />
                            </div>

                            <div>
                                <Label htmlFor="issuing_department" required>{t('Issuing Department')}</Label>
                                <Input
                                    id="issuing_department"
                                    value={data.issuing_department}
                                    onChange={e => setData('issuing_department', e.target.value)}
                                    placeholder={t('e.g., ICT Department')}
                                    required
                                />
                                <InputError message={errors.issuing_department} />
                            </div>

                            <div>
                                <Label htmlFor="delivery_location">{t('Delivery Location / Instructions')}</Label>
                                <Input
                                    id="delivery_location"
                                    value={data.delivery_location}
                                    onChange={e => setData('delivery_location', e.target.value)}
                                    placeholder={t('e.g., Stores — Main Campus')}
                                />
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

                            {data.is_contract && (
                                <div>
                                    <Label htmlFor="contract_number">{t('Contract Number')}</Label>
                                    <Input
                                        id="contract_number"
                                        value={data.contract_number}
                                        onChange={e => setData('contract_number', e.target.value)}
                                        placeholder={t('e.g., CON-2026-001')}
                                    />
                                </div>
                            )}
                        </div>

                        {data.is_contract && (
                            <div>
                                <Label htmlFor="contract_terms">{t('Contract Terms')}</Label>
                                <Textarea
                                    id="contract_terms"
                                    value={data.contract_terms}
                                    onChange={e => setData('contract_terms', e.target.value)}
                                    rows={4}
                                    placeholder={t('Enter standard terms and conditions for the contract...')}
                                />
                            </div>
                        )}

                        <div>
                            <Label htmlFor="notes">{t('Notes / Special Instructions')}</Label>
                            <Textarea
                                id="notes"
                                value={data.notes}
                                onChange={e => setData('notes', e.target.value)}
                                rows={2}
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Budget / Vote */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <Wallet className="h-5 w-5" />
                            {t('Budget & Vote Information')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div>
                                <Label>{t('Vote / Account Charged')}</Label>
                                <Select value={data.vote_account_id} onValueChange={v => setData('vote_account_id', v)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder={t('Select account...')} />
                                    </SelectTrigger>
                                    <SelectContent searchable>
                                        {accounts.map(a => (
                                            <SelectItem key={a.id} value={a.id.toString()}>
                                                {a.account_code} — {a.account_name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label>{t('Fund Type')}</Label>
                                <Select value={data.fund_type} onValueChange={v => setData('fund_type', v)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder={t('Select...')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="recurrent">{t('Recurrent')}</SelectItem>
                                        <SelectItem value="development">{t('Development / Capital')}</SelectItem>
                                        <SelectItem value="donor_funded">{t('Donor Funded')}</SelectItem>
                                        <SelectItem value="igi">{t('IGF / IGI')}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label>{t('Economic Classification')}</Label>
                                <Select value={data.economic_classification} onValueChange={v => setData('economic_classification', v)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder={t('Select...')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="goods_and_services">{t('Goods & Services')}</SelectItem>
                                        <SelectItem value="capital_expenditure">{t('Capital Expenditure')}</SelectItem>
                                        <SelectItem value="consultancy">{t('Consultancy')}</SelectItem>
                                        <SelectItem value="maintenance">{t('Maintenance & Repairs')}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label>{t('Budget Period')}</Label>
                                <Select value={data.budget_period_id} onValueChange={v => setData('budget_period_id', v)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder={t('Select period...')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {budgetPeriods.map(p => (
                                            <SelectItem key={p.id} value={p.id.toString()}>{p.period_name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Line Items */}
                <Card>
                    <CardHeader>
                        <div className="flex justify-between items-center">
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <Package className="h-5 w-5" />
                                {t('Items')}
                            </CardTitle>
                            <Button type="button" size="sm"
                                onClick={() => setData('items', [...data.items, { ...EMPTY_ITEM }])}>
                                + {t('Add Item')}
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b">
                                        <th className="px-2 py-2 text-left">{t('Description')}</th>
                                        <th className="px-2 py-2 text-center w-16">{t('Qty')}</th>
                                        <th className="px-2 py-2 text-left w-20">{t('Unit')}</th>
                                        <th className="px-2 py-2 text-right w-28">{t('Unit Price')}</th>
                                        <th className="px-2 py-2 text-right w-20">{t('Disc%')}</th>
                                        <th className="px-2 py-2 text-right w-20">{t('Tax%')}</th>
                                        <th className="px-2 py-2 text-right w-28">{t('Total')}</th>
                                        <th className="w-8"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.items.map((item, i) => (
                                        <tr key={i} className="border-b">
                                            <td className="px-2 py-1">
                                                <Input
                                                    value={item.description}
                                                    onChange={e => updateItem(i, 'description', e.target.value)}
                                                    placeholder={t('Item description...')}
                                                    required
                                                />
                                            </td>
                                            <td className="px-2 py-1">
                                                <Input
                                                    type="number"
                                                    min={1}
                                                    value={item.quantity}
                                                    onChange={e => updateItem(i, 'quantity', parseInt(e.target.value) || 1)}
                                                    className="text-center"
                                                />
                                            </td>
                                            <td className="px-2 py-1">
                                                <Input
                                                    value={item.unit ?? ''}
                                                    onChange={e => updateItem(i, 'unit', e.target.value)}
                                                    placeholder={t('pcs')}
                                                />
                                            </td>
                                            <td className="px-2 py-1">
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    min={0}
                                                    value={item.unit_price}
                                                    onChange={e => updateItem(i, 'unit_price', parseFloat(e.target.value) || 0)}
                                                    className="text-right"
                                                />
                                            </td>
                                            <td className="px-2 py-1">
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    min={0}
                                                    max={100}
                                                    value={item.discount_percentage}
                                                    onChange={e => updateItem(i, 'discount_percentage', parseFloat(e.target.value) || 0)}
                                                    className="text-right"
                                                />
                                            </td>
                                            <td className="px-2 py-1">
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    min={0}
                                                    max={100}
                                                    value={item.tax_percentage}
                                                    onChange={e => updateItem(i, 'tax_percentage', parseFloat(e.target.value) || 0)}
                                                    className="text-right"
                                                />
                                            </td>
                                            <td className="px-2 py-1 text-right font-medium">
                                                {formatCurrency(item.total_amount)}
                                            </td>
                                            <td className="px-2 py-1">
                                                {data.items.length > 1 && (
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-8 w-8 p-0 text-red-500"
                                                        onClick={() => setData('items', data.items.filter((_, j) => j !== i))}
                                                    >×</Button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="mt-6 flex justify-end">
                            <div className="w-72 space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">{t('Subtotal')}</span>
                                    <span>{formatCurrency(totals.subtotal)}</span>
                                </div>
                                {totals.discount > 0 && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">{t('Discount')}</span>
                                        <span className="text-red-600">-{formatCurrency(totals.discount)}</span>
                                    </div>
                                )}
                                {totals.tax > 0 && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">{t('Tax')}</span>
                                        <span>{formatCurrency(totals.tax)}</span>
                                    </div>
                                )}
                                <Separator />
                                <div className="flex justify-between font-bold text-base">
                                    <span>{t('Total')}</span>
                                    <span>{formatCurrency(totals.total)}</span>
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
                        {processing ? t('Saving...') : t('Create LPO')}
                    </Button>
                </div>
            </form>
        </AuthenticatedLayout>
    );
}
