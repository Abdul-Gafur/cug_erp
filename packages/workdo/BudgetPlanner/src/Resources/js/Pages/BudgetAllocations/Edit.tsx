import { DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useForm, usePage } from "@inertiajs/react";
import { useTranslation } from 'react-i18next';
import { Button } from "@/components/ui/button";
import { Label } from '@/components/ui/label';
import InputError from '@/components/ui/input-error';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CurrencyInput } from '@/components/ui/currency-input';
import { formatCurrency } from '@/utils/helpers';

interface EditProps {
    budgetAllocation: any;
    onSuccess: () => void;
}

export default function Edit({ budgetAllocation, onSuccess }: EditProps) {
    const { accounts } = usePage<any>().props;
    const { t } = useTranslation();
    const { data, setData, put, processing, errors } = useForm({
        account_id:               budgetAllocation.account_id?.toString() || '',
        economic_classification:  budgetAllocation.economic_classification || '',
        allocated_amount:         budgetAllocation.allocated_amount?.toString() || '',
        q1_amount:                budgetAllocation.q1_amount?.toString() || '',
        q2_amount:                budgetAllocation.q2_amount?.toString() || '',
        q3_amount:                budgetAllocation.q3_amount?.toString() || '',
        q4_amount:                budgetAllocation.q4_amount?.toString() || '',
    });

    const quarterlyTotal =
        (parseFloat(data.q1_amount) || 0) +
        (parseFloat(data.q2_amount) || 0) +
        (parseFloat(data.q3_amount) || 0) +
        (parseFloat(data.q4_amount) || 0);
    const allocated = parseFloat(data.allocated_amount) || 0;
    const quarterlyMismatch = quarterlyTotal > 0 && Math.abs(quarterlyTotal - allocated) > 0.01;

    // Computed live position
    const committed = parseFloat(budgetAllocation.committed_amount) || 0;
    const spent = parseFloat(budgetAllocation.spent_amount) || 0;
    const available = allocated - committed - spent;

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        put(route('budget-planner.budget-allocations.update', budgetAllocation.id), {
            onSuccess: () => { onSuccess(); }
        });
    };

    return (
        <DialogContent className="max-w-lg">
            <DialogHeader>
                <DialogTitle>{t('Edit Budget Allocation')}</DialogTitle>
            </DialogHeader>

            {/* Budget Position Summary */}
            <div className="grid grid-cols-4 gap-2 text-center bg-gray-50 rounded-lg p-3 text-xs">
                <div>
                    <p className="text-gray-500 mb-0.5">{t('Allocated')}</p>
                    <p className="font-semibold">{formatCurrency(allocated)}</p>
                </div>
                <div>
                    <p className="text-gray-500 mb-0.5">{t('Committed')}</p>
                    <p className="font-semibold text-amber-700">{formatCurrency(committed)}</p>
                </div>
                <div>
                    <p className="text-gray-500 mb-0.5">{t('Spent')}</p>
                    <p className="font-semibold text-red-700">{formatCurrency(spent)}</p>
                </div>
                <div>
                    <p className="text-gray-500 mb-0.5">{t('Available')}</p>
                    <p className={`font-semibold ${available < 0 ? 'text-red-600' : 'text-green-700'}`}>
                        {formatCurrency(available)}
                    </p>
                </div>
            </div>

            <form onSubmit={submit} className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
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

                <div className="border rounded-lg p-3 bg-gray-50/50 space-y-3">
                    <p className="text-sm font-medium text-gray-700">{t('Quarterly Distribution')}</p>
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
                        {processing ? t('Updating...') : t('Update')}
                    </Button>
                </div>
            </form>
        </DialogContent>
    );
}
