import { DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useForm, usePage } from "@inertiajs/react";
import { useTranslation } from 'react-i18next';
import { Button } from "@/components/ui/button";
import { Label } from '@/components/ui/label';
import InputError from '@/components/ui/input-error';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CurrencyInput } from '@/components/ui/currency-input';

interface CreateProps {
    onSuccess: () => void;
}

export default function Create({ onSuccess }: CreateProps) {
    const { budgets, accounts } = usePage<any>().props;
    const { t } = useTranslation();
    const { data, setData, post, processing, errors } = useForm({
        budget_id:                '',
        account_id:               '',
        economic_classification:  '',
        allocated_amount:         '',
        q1_amount:                '',
        q2_amount:                '',
        q3_amount:                '',
        q4_amount:                '',
    });

    const quarterlyTotal =
        (parseFloat(data.q1_amount) || 0) +
        (parseFloat(data.q2_amount) || 0) +
        (parseFloat(data.q3_amount) || 0) +
        (parseFloat(data.q4_amount) || 0);

    const allocated = parseFloat(data.allocated_amount) || 0;
    const quarterlyMismatch = quarterlyTotal > 0 && Math.abs(quarterlyTotal - allocated) > 0.01;

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        post(route('budget-planner.budget-allocations.store'), {
            onSuccess: () => { onSuccess(); }
        });
    };

    return (
        <DialogContent className="max-w-lg">
            <DialogHeader>
                <DialogTitle>{t('Create Budget Allocation')}</DialogTitle>
            </DialogHeader>
            <form onSubmit={submit} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
                <div>
                    <Label required>{t('Budget')}</Label>
                    <Select value={data.budget_id} onValueChange={(v) => setData('budget_id', v)}>
                        <SelectTrigger><SelectValue placeholder={t('Select Budget')} /></SelectTrigger>
                        <SelectContent>
                            {budgets?.map((budget: any) => (
                                <SelectItem key={budget.id} value={budget.id.toString()}>
                                    {budget.budget_name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <InputError message={errors.budget_id} />
                </div>

                <div>
                    <Label required>{t('Account')}</Label>
                    <Select value={data.account_id} onValueChange={(v) => setData('account_id', v)}>
                        <SelectTrigger><SelectValue placeholder={t('Select Account')} /></SelectTrigger>
                        <SelectContent>
                            {accounts?.map((account: any) => (
                                <SelectItem key={account.id} value={account.id.toString()}>
                                    {account.account_code} — {account.account_name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <InputError message={errors.account_id} />
                </div>

                <div>
                    <Label>{t('Economic Classification')}</Label>
                    <Select value={data.economic_classification} onValueChange={(v) => setData('economic_classification', v)}>
                        <SelectTrigger><SelectValue placeholder={t('Select Economic Classification')} /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="personnel_emoluments">{t('Personnel Emoluments')}</SelectItem>
                            <SelectItem value="goods_services">{t('Goods & Services')}</SelectItem>
                            <SelectItem value="capital_expenditure">{t('Capital Expenditure')}</SelectItem>
                            <SelectItem value="transfers_grants">{t('Transfers & Grants')}</SelectItem>
                        </SelectContent>
                    </Select>
                    <InputError message={errors.economic_classification} />
                </div>

                <div>
                    <CurrencyInput
                        label={t('Allocated Amount')}
                        value={data.allocated_amount}
                        onChange={(v) => setData('allocated_amount', v)}
                        error={errors.allocated_amount}
                        required
                    />
                </div>

                {/* Quarterly Distribution */}
                <div className="border rounded-lg p-3 bg-gray-50/50 space-y-3">
                    <p className="text-sm font-medium text-gray-700">{t('Quarterly Distribution')} <span className="text-xs text-gray-400">(optional)</span></p>
                    <div className="grid grid-cols-2 gap-3">
                        <CurrencyInput label={t('Q1')} value={data.q1_amount} onChange={(v) => setData('q1_amount', v)} error={errors.q1_amount} />
                        <CurrencyInput label={t('Q2')} value={data.q2_amount} onChange={(v) => setData('q2_amount', v)} error={errors.q2_amount} />
                        <CurrencyInput label={t('Q3')} value={data.q3_amount} onChange={(v) => setData('q3_amount', v)} error={errors.q3_amount} />
                        <CurrencyInput label={t('Q4')} value={data.q4_amount} onChange={(v) => setData('q4_amount', v)} error={errors.q4_amount} />
                    </div>
                    {quarterlyTotal > 0 && (
                        <p className={`text-xs ${quarterlyMismatch ? 'text-red-600' : 'text-green-600'}`}>
                            Q1+Q2+Q3+Q4 = {quarterlyTotal.toFixed(2)}
                            {quarterlyMismatch ? ` ≠ ${allocated.toFixed(2)} (allocated)` : ' ✓'}
                        </p>
                    )}
                </div>

                <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="outline" onClick={onSuccess}>{t('Cancel')}</Button>
                    <Button type="submit" disabled={processing}>
                        {processing ? t('Creating...') : t('Create')}
                    </Button>
                </div>
            </form>
        </DialogContent>
    );
}
