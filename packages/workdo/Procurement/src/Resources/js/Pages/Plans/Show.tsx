import { useState } from 'react';
import { Head, usePage, router, useForm } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import AuthenticatedLayout from '@/layouts/authenticated-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import InputError from '@/components/ui/input-error';
import { DataTable } from '@/components/ui/data-table';
import NoRecordsFound from '@/components/no-records-found';
import { formatCurrency } from '@/utils/helpers';
import { Plus, Trash2, Edit as EditIcon, ArrowLeft, CheckCircle, Play, X } from 'lucide-react';
import { useDeleteHandler } from '@/hooks/useDeleteHandler';

const PROCUREMENT_METHOD_LABELS: Record<string, string> = {
    open_tender:          'Open Tender',
    restricted_tender:    'Restricted Tender',
    rfq:                  'RFQ',
    single_source:        'Single Source',
    framework_agreement:  'Framework Agreement',
};

const QUARTER_LABELS: Record<number, string> = { 1: 'Q1', 2: 'Q2', 3: 'Q3', 4: 'Q4' };

const STATUS_COLORS: Record<string, string> = {
    draft:    'bg-gray-100 text-gray-700',
    approved: 'bg-blue-100 text-blue-800',
    active:   'bg-green-100 text-green-800',
    closed:   'bg-red-100 text-red-800',
};

interface Account { id: number; account_code: string; account_name: string; }
interface PlanItem {
    id: number;
    item_description: string;
    quantity: number;
    unit: string | null;
    estimated_unit_cost: number;
    estimated_total_cost: number;
    procurement_method: string;
    planned_quarter: number;
    fund_type: string;
    economic_classification: string;
    notes: string | null;
    account?: Account;
}
interface Plan {
    id: number;
    plan_number: string;
    financial_year: string;
    title: string;
    status: string;
    notes: string | null;
    approved_at: string | null;
    vote_cost_centre?: { code: string; name: string };
    approved_by?: { name: string };
    items: PlanItem[];
}

const emptyItemForm = {
    item_description: '',
    quantity: '',
    unit: '',
    estimated_unit_cost: '',
    procurement_method: '',
    planned_quarter: '',
    account_id: '',
    fund_type: '',
    economic_classification: '',
    notes: '',
};

export default function PlanShow() {
    const { plan, accounts } = usePage<any>().props;
    const { t } = useTranslation();
    const [addingItem, setAddingItem] = useState(false);
    const [editingItem, setEditingItem] = useState<PlanItem | null>(null);
    const { deleteState, openDeleteDialog, closeDeleteDialog, confirmDelete } = useDeleteHandler({
        routeName: 'procurement.plans.items.destroy'
    });

    const itemForm = useForm({ ...emptyItemForm });

    const isDraft = plan.status === 'draft';

    const estimatedTotal = plan.items.reduce(
        (sum: number, i: PlanItem) => sum + Number(i.estimated_total_cost), 0
    );

    const submitItem = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingItem) {
            itemForm.put(route('procurement.plans.items.update', { plan: plan.id, item: editingItem.id }), {
                onSuccess: () => { setEditingItem(null); itemForm.reset(); },
            });
        } else {
            itemForm.post(route('procurement.plans.items.store', plan.id), {
                onSuccess: () => { setAddingItem(false); itemForm.reset(); },
            });
        }
    };

    const openEditItem = (item: PlanItem) => {
        itemForm.setData({
            item_description:        item.item_description,
            quantity:                String(item.quantity),
            unit:                    item.unit ?? '',
            estimated_unit_cost:     String(item.estimated_unit_cost),
            procurement_method:      item.procurement_method,
            planned_quarter:         String(item.planned_quarter),
            account_id:              String(item.account?.id ?? ''),
            fund_type:               item.fund_type,
            economic_classification: item.economic_classification,
            notes:                   item.notes ?? '',
        });
        setEditingItem(item);
    };

    const columns = [
        { key: 'item_description', header: t('Description') },
        {
            key: 'qty',
            header: t('Qty'),
            render: (_: any, row: PlanItem) => `${row.quantity} ${row.unit ?? ''}`.trim(),
        },
        {
            key: 'estimated_unit_cost',
            header: t('Unit Cost'),
            render: (v: number) => formatCurrency(v),
        },
        {
            key: 'estimated_total_cost',
            header: t('Total'),
            render: (v: number) => formatCurrency(v),
        },
        {
            key: 'procurement_method',
            header: t('Method'),
            render: (v: string) => PROCUREMENT_METHOD_LABELS[v] ?? v,
        },
        {
            key: 'planned_quarter',
            header: t('Quarter'),
            render: (v: number) => QUARTER_LABELS[v] ?? `Q${v}`,
        },
        {
            key: 'account',
            header: t('Budget Head'),
            render: (_: any, row: PlanItem) => row.account
                ? `${row.account.account_code} — ${row.account.account_name}` : '—',
        },
        { key: 'fund_type', header: t('Fund') },
        {
            key: 'actions',
            header: '',
            render: (_: any, row: PlanItem) => isDraft ? (
                <div className="flex gap-1 justify-end">
                    <Button size="icon" variant="ghost" onClick={() => openEditItem(row)}>
                        <EditIcon className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost"
                        onClick={() => openDeleteDialog({ plan: plan.id, item: row.id })}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                </div>
            ) : null,
        },
    ];

    return (
        <AuthenticatedLayout>
            <Head title={`${t('Procurement Plan')} — ${plan.plan_number}`} />

            <div className="p-6 space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" size="sm" onClick={() => router.visit(route('procurement.plans.index'))}>
                            <ArrowLeft className="h-4 w-4 mr-1" /> {t('Plans')}
                        </Button>
                        <h1 className="text-2xl font-semibold">{plan.plan_number}</h1>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[plan.status] ?? 'bg-gray-100'}`}>
                            {plan.status ? t(plan.status.charAt(0).toUpperCase() + plan.status.slice(1)) : '—'}
                        </span>
                    </div>
                    <div className="flex gap-2">
                        {plan.status === 'draft' && (
                            <Button onClick={() => router.post(route('procurement.plans.approve', plan.id))} variant="outline">
                                <CheckCircle className="h-4 w-4 mr-2 text-blue-600" /> {t('Approve')}
                            </Button>
                        )}
                        {plan.status === 'approved' && (
                            <Button onClick={() => router.post(route('procurement.plans.activate', plan.id))} variant="outline">
                                <Play className="h-4 w-4 mr-2 text-green-600" /> {t('Activate')}
                            </Button>
                        )}
                        {['approved', 'active'].includes(plan.status) && (
                            <Button onClick={() => router.post(route('procurement.plans.close', plan.id))} variant="outline">
                                <X className="h-4 w-4 mr-2" /> {t('Close')}
                            </Button>
                        )}
                    </div>
                </div>

                {/* Plan meta */}
                <Card>
                    <CardContent className="pt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                            <p className="text-muted-foreground">{t('Financial Year')}</p>
                            <p className="font-medium">{plan.financial_year}</p>
                        </div>
                        <div>
                            <p className="text-muted-foreground">{t('Title')}</p>
                            <p className="font-medium">{plan.title}</p>
                        </div>
                        <div>
                            <p className="text-muted-foreground">{t('Vote / Department')}</p>
                            <p className="font-medium">
                                {plan.vote_cost_centre
                                    ? `${plan.vote_cost_centre.code} — ${plan.vote_cost_centre.name}`
                                    : '—'}
                            </p>
                        </div>
                        <div>
                            <p className="text-muted-foreground">{t('Estimated Total')}</p>
                            <p className="font-semibold text-primary">{formatCurrency(estimatedTotal)}</p>
                        </div>
                        {plan.approved_at && (
                            <div>
                                <p className="text-muted-foreground">{t('Approved By')}</p>
                                <p className="font-medium">{plan.approved_by?.name}</p>
                            </div>
                        )}
                        {plan.notes && (
                            <div className="col-span-2 md:col-span-4">
                                <p className="text-muted-foreground">{t('Notes')}</p>
                                <p className="font-medium">{plan.notes}</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Items */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle>{t('Plan Items')}</CardTitle>
                        {isDraft && (
                            <Button size="sm" onClick={() => setAddingItem(true)}>
                                <Plus className="h-4 w-4 mr-2" /> {t('Add Item')}
                            </Button>
                        )}
                    </CardHeader>
                    <CardContent>
                        {plan.items.length === 0
                            ? <NoRecordsFound 
                                icon={Plus} 
                                title={t('No Items Found')} 
                                description={t('Add items to your procurement plan to specify your requirements for the year.')}
                              />
                            : <DataTable columns={columns} data={plan.items} />
                        }
                    </CardContent>
                </Card>
            </div>

            {/* Add / Edit Item Dialog */}
            <Dialog open={addingItem || !!editingItem} onOpenChange={(open) => {
                if (!open) { setAddingItem(false); setEditingItem(null); itemForm.reset(); }
            }}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{editingItem ? t('Edit Plan Item') : t('Add Plan Item')}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={submitItem} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
                        <div>
                            <Label required>{t('Item Description')}</Label>
                            <Textarea
                                value={itemForm.data.item_description}
                                onChange={(e) => itemForm.setData('item_description', e.target.value)}
                                rows={2}
                                required
                            />
                            <InputError message={itemForm.errors.item_description} />
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <Label required>{t('Quantity')}</Label>
                                <Input
                                    type="number"
                                    min="0.001"
                                    step="0.001"
                                    value={itemForm.data.quantity}
                                    onChange={(e) => itemForm.setData('quantity', e.target.value)}
                                    required
                                />
                                <InputError message={itemForm.errors.quantity} />
                            </div>
                            <div>
                                <Label>{t('Unit')}</Label>
                                <Input
                                    value={itemForm.data.unit}
                                    onChange={(e) => itemForm.setData('unit', e.target.value)}
                                    placeholder="units, reams…"
                                />
                            </div>
                            <div>
                                <Label required>{t('Est. Unit Cost')}</Label>
                                <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={itemForm.data.estimated_unit_cost}
                                    onChange={(e) => itemForm.setData('estimated_unit_cost', e.target.value)}
                                    required
                                />
                                <InputError message={itemForm.errors.estimated_unit_cost} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label required>{t('Procurement Method')}</Label>
                                <Select
                                    value={itemForm.data.procurement_method}
                                    onValueChange={(v) => itemForm.setData('procurement_method', v)}
                                >
                                    <SelectTrigger><SelectValue placeholder={t('Select…')} /></SelectTrigger>
                                    <SelectContent>
                                        {Object.entries({
                                            open_tender: 'Open Tender',
                                            restricted_tender: 'Restricted Tender',
                                            rfq: 'Request for Quotation (RFQ)',
                                            single_source: 'Single Source',
                                            framework_agreement: 'Framework Agreement',
                                        }).map(([k, v]) => <SelectItem key={k} value={k}>{t(v)}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <InputError message={itemForm.errors.procurement_method} />
                            </div>
                            <div>
                                <Label required>{t('Planned Quarter')}</Label>
                                <Select
                                    value={itemForm.data.planned_quarter}
                                    onValueChange={(v) => itemForm.setData('planned_quarter', v)}
                                >
                                    <SelectTrigger><SelectValue placeholder={t('Select…')} /></SelectTrigger>
                                    <SelectContent>
                                        {[1, 2, 3, 4].map(q => <SelectItem key={q} value={String(q)}>Q{q}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <InputError message={itemForm.errors.planned_quarter} />
                            </div>
                        </div>
                        <div>
                            <Label required>{t('Budget Head (Account)')}</Label>
                            <Select value={itemForm.data.account_id} onValueChange={(v) => itemForm.setData('account_id', v)}>
                                <SelectTrigger><SelectValue placeholder={t('Select account…')} /></SelectTrigger>
                                <SelectContent>
                                    {accounts.map((a: Account) => (
                                        <SelectItem key={a.id} value={String(a.id)}>
                                            {a.account_code} — {a.account_name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <InputError message={itemForm.errors.account_id} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label required>{t('Fund Type')}</Label>
                                <Select value={itemForm.data.fund_type} onValueChange={(v) => itemForm.setData('fund_type', v)}>
                                    <SelectTrigger><SelectValue placeholder={t('Select…')} /></SelectTrigger>
                                    <SelectContent>
                                        {['IGF', 'GoG', 'Donor', 'Grant'].map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <InputError message={itemForm.errors.fund_type} />
                            </div>
                            <div>
                                <Label required>{t('Economic Classification')}</Label>
                                <Select value={itemForm.data.economic_classification} onValueChange={(v) => itemForm.setData('economic_classification', v)}>
                                    <SelectTrigger><SelectValue placeholder={t('Select…')} /></SelectTrigger>
                                    <SelectContent>
                                        {[
                                            ['goods_services', 'Goods & Services'],
                                            ['capital_expenditure', 'Capital Expenditure'],
                                            ['transfers', 'Transfers & Grants'],
                                            ['personal_emoluments', 'Personal Emoluments'],
                                        ].map(([k, v]) => <SelectItem key={k} value={k}>{t(v)}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <InputError message={itemForm.errors.economic_classification} />
                            </div>
                        </div>
                        <div>
                            <Label>{t('Notes')}</Label>
                            <Input
                                value={itemForm.data.notes}
                                onChange={(e) => itemForm.setData('notes', e.target.value)}
                            />
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <Button type="button" variant="outline" onClick={() => { setAddingItem(false); setEditingItem(null); itemForm.reset(); }}>
                                {t('Cancel')}
                            </Button>
                            <Button type="submit" disabled={itemForm.processing}>
                                {editingItem ? t('Update Item') : t('Add Item')}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            <ConfirmationDialog
                open={deleteState.isOpen}
                onOpenChange={closeDeleteDialog}
                onConfirm={confirmDelete}
                title={t('Remove Item')}
                message={deleteState.message}
                variant="destructive"
            />
        </AuthenticatedLayout>
    );
}
