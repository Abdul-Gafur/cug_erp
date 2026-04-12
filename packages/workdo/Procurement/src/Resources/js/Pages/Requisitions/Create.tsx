import { useState } from 'react';
import { Head, usePage, useForm, router } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import AuthenticatedLayout from '@/layouts/authenticated-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import InputError from '@/components/ui/input-error';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';

interface Account { id: number; account_code: string; account_name: string; }
interface PlanItem {
    id: number;
    item_description: string;
    estimated_total_cost: number;
    fund_type: string;
    economic_classification: string;
    account?: Account;
}

interface LineItem {
    description: string;
    quantity: string;
    unit: string;
    estimated_unit_cost: string;
    account_id: string;
    fund_type: string;
    economic_classification: string;
    notes: string;
}

const emptyLine = (): LineItem => ({
    description: '',
    quantity: '1',
    unit: '',
    estimated_unit_cost: '',
    account_id: '',
    fund_type: '',
    economic_classification: '',
    notes: '',
});

export default function RequisitionCreate() {
    const { departments, budgetPeriods, activePlan, accounts, fundTypes, economicClassifications } =
        usePage<any>().props;
    const { t } = useTranslation();

    const { data, setData, post, processing, errors } = useForm({
        requisition_date: new Date().toISOString().slice(0, 10),
        requesting_department_id: '',
        purpose: '',
        justification: '',
        category: 'administrative',
        plan_item_id: '',
        is_off_plan: false,
        off_plan_justification: '',
        budget_period_id: '',
        items: [emptyLine()],
    });

    const [items, setItems] = useState<LineItem[]>([emptyLine()]);

    const updateItem = (index: number, field: keyof LineItem, value: string) => {
        const next = items.map((item, i) => i === index ? { ...item, [field]: value } : item);
        setItems(next);
        setData('items', next);
    };

    const addLine = () => {
        const next = [...items, emptyLine()];
        setItems(next);
        setData('items', next);
    };

    const removeLine = (index: number) => {
        if (items.length === 1) return;
        const next = items.filter((_, i) => i !== index);
        setItems(next);
        setData('items', next);
    };

    const lineTotal = (item: LineItem): number =>
        (parseFloat(item.quantity) || 0) * (parseFloat(item.estimated_unit_cost) || 0);

    const grandTotal = items.reduce((sum, item) => sum + lineTotal(item), 0);

    const handlePlanItemSelect = (val: string) => {
        const planItemId = val === 'none' ? '' : val;
        setData('plan_item_id', planItemId);
        if (planItemId && activePlan) {
            const planItem: PlanItem = activePlan.items.find((i: PlanItem) => String(i.id) === planItemId);
            if (planItem) {
                // Pre-fill first line item with plan item details
                const updated = items.map((item, idx) => idx === 0 ? {
                    ...item,
                    description:             planItem.item_description,
                    fund_type:               planItem.fund_type,
                    economic_classification: planItem.economic_classification,
                    account_id:              String(planItem.account?.id ?? ''),
                } : item);
                setItems(updated);
                setData('items', updated);
            }
        }
    };

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        post(route('procurement.requisitions.store'));
    };

    return (
        <AuthenticatedLayout>
            <Head title={t('New Purchase Requisition')} />

            <div className="p-6 space-y-6">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="sm" onClick={() => router.visit(route('procurement.requisitions.index'))}>
                        <ArrowLeft className="h-4 w-4 mr-1" /> {t('Requisitions')}
                    </Button>
                    <h1 className="text-2xl font-semibold">{t('New Purchase Requisition')}</h1>
                </div>

                <form onSubmit={submit} className="space-y-6">
                    {/* Header fields */}
                    <Card>
                        <CardHeader><CardTitle>{t('Requisition Details')}</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <Label required>{t('Requisition Date')}</Label>
                                    <Input
                                        type="date"
                                        value={data.requisition_date}
                                        onChange={(e) => setData('requisition_date', e.target.value)}
                                        required
                                    />
                                    <InputError message={errors.requisition_date} />
                                </div>
                                <div>
                                    <Label required>{t('Requesting Department')}</Label>
                                    <Select value={data.requesting_department_id} onValueChange={(v) => setData('requesting_department_id', v)}>
                                        <SelectTrigger><SelectValue placeholder={t('Select department…')} /></SelectTrigger>
                                        <SelectContent>
                                            {departments.map((d: any) => (
                                                <SelectItem key={d.id} value={String(d.id)}>{d.code} — {d.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <InputError message={errors.requesting_department_id} />
                                </div>
                                <div>
                                    <Label required>{t('Budget Period')}</Label>
                                    <Select value={data.budget_period_id} onValueChange={(v) => setData('budget_period_id', v)}>
                                        <SelectTrigger><SelectValue placeholder={t('Select period…')} /></SelectTrigger>
                                        <SelectContent>
                                            {budgetPeriods.map((p: any) => (
                                                <SelectItem key={p.id} value={String(p.id)}>{p.period_name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <InputError message={errors.budget_period_id} />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <Label required>{t('Category')}</Label>
                                    <Select value={data.category} onValueChange={(v) => setData('category', v)}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="academic">{t('Academic')}</SelectItem>
                                            <SelectItem value="administrative">{t('Administrative')}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {activePlan && (
                                    <div>
                                        <Label>{t('Link to Plan Item (Optional)')}</Label>
                                        <Select value={data.plan_item_id || 'none'} onValueChange={handlePlanItemSelect}>
                                            <SelectTrigger><SelectValue placeholder={t('Select plan item…')} /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">{t('None (Off-Plan)')}</SelectItem>
                                                {activePlan.items.map((item: PlanItem) => (
                                                    <SelectItem key={item.id} value={String(item.id)}>
                                                        {item.item_description.substring(0, 60)}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                            </div>

                            {/* Off-plan flag */}
                            <div className="flex items-center gap-2">
                                <Checkbox
                                    id="is_off_plan"
                                    checked={data.is_off_plan}
                                    onCheckedChange={(v) => setData('is_off_plan', Boolean(v))}
                                />
                                <Label htmlFor="is_off_plan" className="cursor-pointer">
                                    {t('This is an off-plan requisition (not in the Annual Procurement Plan)')}
                                </Label>
                            </div>
                            {data.is_off_plan && (
                                <div>
                                    <Label required>{t('Off-Plan Justification')}</Label>
                                    <Textarea
                                        value={data.off_plan_justification}
                                        onChange={(e) => setData('off_plan_justification', e.target.value)}
                                        rows={3}
                                        placeholder={t('Provide written justification for why this procurement was not included in the Annual Procurement Plan…')}
                                        required
                                    />
                                    <InputError message={errors.off_plan_justification} />
                                </div>
                            )}

                            <div>
                                <Label required>{t('Purpose / Subject')}</Label>
                                <Input
                                    value={data.purpose}
                                    onChange={(e) => setData('purpose', e.target.value)}
                                    placeholder={t('What is being procured?')}
                                    required
                                />
                                <InputError message={errors.purpose} />
                            </div>
                            <div>
                                <Label required>{t('Justification')}</Label>
                                <Textarea
                                    value={data.justification}
                                    onChange={(e) => setData('justification', e.target.value)}
                                    rows={4}
                                    placeholder={t('Explain why this procurement is needed for academic or administrative operations…')}
                                    required
                                />
                                <InputError message={errors.justification} />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Line items */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle>{t('Items Required')}</CardTitle>
                            <Button type="button" size="sm" variant="outline" onClick={addLine}>
                                <Plus className="h-4 w-4 mr-1" /> {t('Add Line')}
                            </Button>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {(errors as any).items && (
                                <p className="text-sm text-red-500">{(errors as any).items}</p>
                            )}
                            {items.map((item, index) => (
                                <div key={index} className="border rounded-lg p-4 space-y-3 relative">
                                    {items.length > 1 && (
                                        <Button
                                            type="button"
                                            size="icon"
                                            variant="ghost"
                                            className="absolute top-2 right-2"
                                            onClick={() => removeLine(index)}
                                        >
                                            <Trash2 className="h-4 w-4 text-red-500" />
                                        </Button>
                                    )}
                                    <p className="text-sm font-medium text-muted-foreground">{t('Line')} {index + 1}</p>
                                    <div>
                                        <Label required>{t('Description')}</Label>
                                        <Input
                                            value={item.description}
                                            onChange={(e) => updateItem(index, 'description', e.target.value)}
                                            placeholder={t('Item description')}
                                            required
                                        />
                                        <InputError message={(errors as any)[`items.${index}.description`]} />
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        <div>
                                            <Label required>{t('Qty')}</Label>
                                            <Input
                                                type="number"
                                                min="0.001"
                                                step="0.001"
                                                value={item.quantity}
                                                onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                                                required
                                            />
                                        </div>
                                        <div>
                                            <Label>{t('Unit')}</Label>
                                            <Input
                                                value={item.unit}
                                                onChange={(e) => updateItem(index, 'unit', e.target.value)}
                                                placeholder="units…"
                                            />
                                        </div>
                                        <div>
                                            <Label required>{t('Est. Unit Cost')}</Label>
                                            <Input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={item.estimated_unit_cost}
                                                onChange={(e) => updateItem(index, 'estimated_unit_cost', e.target.value)}
                                                required
                                            />
                                        </div>
                                        <div className="flex items-end">
                                            <div className="w-full">
                                                <Label>{t('Line Total')}</Label>
                                                <div className="h-9 flex items-center px-3 border rounded bg-muted text-sm font-medium">
                                                    {lineTotal(item).toLocaleString('en-GH', { style: 'currency', currency: 'GHS' })}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                        <div>
                                            <Label required>{t('Budget Head (Account)')}</Label>
                                            <Select value={item.account_id} onValueChange={(v) => updateItem(index, 'account_id', v)}>
                                                <SelectTrigger><SelectValue placeholder={t('Select…')} /></SelectTrigger>
                                                <SelectContent>
                                                    {accounts.map((a: Account) => (
                                                        <SelectItem key={a.id} value={String(a.id)}>
                                                            {a.account_code} — {a.account_name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div>
                                            <Label required>{t('Fund Type')}</Label>
                                            <Select value={item.fund_type} onValueChange={(v) => updateItem(index, 'fund_type', v)}>
                                                <SelectTrigger><SelectValue placeholder={t('Select…')} /></SelectTrigger>
                                                <SelectContent>
                                                    {fundTypes.map((f: string) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div>
                                            <Label required>{t('Economic Classification')}</Label>
                                            <Select value={item.economic_classification} onValueChange={(v) => updateItem(index, 'economic_classification', v)}>
                                                <SelectTrigger><SelectValue placeholder={t('Select…')} /></SelectTrigger>
                                                <SelectContent>
                                                    {Object.entries(economicClassifications).map(([k, v]) => (
                                                        <SelectItem key={k} value={k}>{t(v as string)}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {/* Grand total */}
                            <div className="flex justify-end">
                                <div className="text-right">
                                    <p className="text-sm text-muted-foreground">{t('Estimated Total')}</p>
                                    <p className="text-xl font-semibold text-primary">
                                        {grandTotal.toLocaleString('en-GH', { style: 'currency', currency: 'GHS' })}
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="flex justify-end gap-3">
                        <Button type="button" variant="outline" onClick={() => router.visit(route('procurement.requisitions.index'))}>
                            {t('Cancel')}
                        </Button>
                        <Button type="submit" disabled={processing}>{t('Save Requisition')}</Button>
                    </div>
                </form>
            </div>
        </AuthenticatedLayout>
    );
}
