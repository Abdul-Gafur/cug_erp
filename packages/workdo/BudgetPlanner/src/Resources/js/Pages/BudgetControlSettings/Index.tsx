import { Head, usePage, useForm } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import AuthenticatedLayout from "@/layouts/authenticated-layout";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ShieldCheck } from 'lucide-react';

interface Setting {
    id: number | null;
    economic_classification: string;
    control_mode: string;
}

const CLS_LABELS: Record<string, string> = {
    all:                    'All Classifications (default)',
    personnel_emoluments:   'Personnel Emoluments',
    goods_services:         'Goods & Services',
    capital_expenditure:    'Capital Expenditure',
    transfers_grants:       'Transfers & Grants',
};

export default function Index() {
    const { t } = useTranslation();
    const { settings } = usePage<any>().props;

    const { data, setData, post, processing } = useForm<{ settings: Setting[] }>({
        settings: settings ?? [],
    });

    const setMode = (index: number, mode: string) => {
        const updated = [...data.settings];
        updated[index] = { ...updated[index], control_mode: mode };
        setData('settings', updated);
    };

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        post(route('budget-planner.budget-control-settings.upsert'));
    };

    return (
        <AuthenticatedLayout
            breadcrumbs={[{label: t('Budget Planner')}, {label: t('Budget Control Settings')}]}
            pageTitle={t('Budget Control Settings')}
        >
            <Head title={t('Budget Control Settings')} />

            <Card className="shadow-sm max-w-2xl">
                <CardHeader className="border-b">
                    <div className="flex items-center gap-2">
                        <ShieldCheck className="h-5 w-5 text-primary" />
                        <CardTitle className="text-base">{t('Budget Control Settings')}</CardTitle>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                        Configure whether overspending triggers a <strong>hard block</strong> (transaction rejected) or a
                        <strong> warning</strong> (user must confirm with reason) — per economic classification.
                        The <em>All Classifications</em> row is the catch-all default.
                    </p>
                </CardHeader>
                <CardContent className="p-0">
                    <form onSubmit={submit}>
                        <table className="w-full">
                            <thead className="bg-gray-50 text-xs text-gray-600 uppercase">
                                <tr>
                                    <th className="px-6 py-3 text-left">{t('Economic Classification')}</th>
                                    <th className="px-6 py-3 text-left">{t('Control Mode')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {data.settings.map((row, idx) => (
                                    <tr key={row.economic_classification} className={row.economic_classification === 'all' ? 'bg-blue-50/40' : ''}>
                                        <td className="px-6 py-4 text-sm font-medium">
                                            {CLS_LABELS[row.economic_classification] ?? row.economic_classification}
                                        </td>
                                        <td className="px-6 py-4">
                                            <Select value={row.control_mode} onValueChange={(v) => setMode(idx, v)}>
                                                <SelectTrigger className="w-64">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="hard_block">
                                                        <span className="text-red-700 font-medium">Hard Block</span>
                                                        <span className="text-gray-500 text-xs ml-2">— transaction rejected</span>
                                                    </SelectItem>
                                                    <SelectItem value="warning">
                                                        <span className="text-amber-700 font-medium">Warning</span>
                                                        <span className="text-gray-500 text-xs ml-2">— confirm with reason</span>
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div className="px-6 py-4 border-t flex justify-end">
                            <Button type="submit" disabled={processing}>
                                {processing ? t('Updating...') : t('Save Settings')}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </AuthenticatedLayout>
    );
}
