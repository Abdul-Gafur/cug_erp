import { DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useForm } from "@inertiajs/react";
import { useTranslation } from 'react-i18next';
import { Button } from "@/components/ui/button";
import { Label } from '@/components/ui/label';
import InputError from '@/components/ui/input-error';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/date-picker';
import { EditBudgetPeriodProps, EditBudgetPeriodFormData } from './types';

export default function Edit({ budgetperiod, onSuccess }: EditBudgetPeriodProps) {
    const { t } = useTranslation();
    const { data, setData, put, processing, errors } = useForm<EditBudgetPeriodFormData>({
        period_name:    budgetperiod.period_name ?? '',
        financial_year: budgetperiod.financial_year ?? '',
        start_date:     budgetperiod.start_date || '',
        end_date:       budgetperiod.end_date || '',
    });



    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        put(route('budget-planner.budget-periods.update', budgetperiod.id), {
            onSuccess: () => {
                onSuccess();
            }
        });
    };

    return (
        <DialogContent>
            <DialogHeader>
                <DialogTitle>{t('Edit Budget Period')}</DialogTitle>
            </DialogHeader>
            <form onSubmit={submit} className="space-y-4">
                <div>
                    <Label htmlFor="period_name">{t('Period Name')}</Label>
                    <Input
                        id="period_name"
                        type="text"
                        value={data.period_name}
                        onChange={(e) => setData('period_name', e.target.value)}
                        placeholder={t('Enter Period Name')}
                        required
                    />
                    <InputError message={errors.period_name} />
                </div>

                <div>
                    <Label htmlFor="financial_year">{t('Financial Year')}</Label>
                    <Input
                        id="financial_year"
                        type="text"
                        value={data.financial_year}
                        onChange={(e) => setData('financial_year', e.target.value)}
                        placeholder={t('Enter Financial Year')}
                        required
                    />
                    <InputError message={errors.financial_year} />
                </div>

                <div>
                    <Label required>{t('Start Date')}</Label>
                    <DatePicker
                        value={data.start_date}
                        onChange={(date) => setData('start_date', date)}
                        placeholder={t('Select Start Date')}
                    />
                    <InputError message={errors.start_date} />
                </div>

                <div>
                    <Label required>{t('End Date')}</Label>
                    <DatePicker
                        value={data.end_date}
                        onChange={(date) => setData('end_date', date)}
                        placeholder={t('Select End Date')}
                    />
                    <InputError message={errors.end_date} />
                </div>

                <div>
                    <Label>{t('Status')}</Label>
                    <p className="text-sm text-gray-600 mt-1 px-3 py-2 bg-gray-50 border rounded-md capitalize">
                        {budgetperiod.status}
                        <span className="ml-2 text-xs text-gray-400">
                            {t('(use Approve / Activate / Close buttons to change)')}
                        </span>
                    </p>
                </div>


                <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={onSuccess}>
                        {t('Cancel')}
                    </Button>
                    <Button type="submit" disabled={processing}>
                        {processing ? t('Updating...') : t('Update')}
                    </Button>
                </div>
            </form>
        </DialogContent>
    );
}
