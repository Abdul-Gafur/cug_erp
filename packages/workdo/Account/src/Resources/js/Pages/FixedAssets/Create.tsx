import { useState } from 'react';
import { Head, router, Link } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import AuthenticatedLayout from '@/layouts/authenticated-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import InputError from '@/components/ui/input-error';

interface Category {
    id: number;
    name: string;
    default_useful_life_months: number;
    depreciation_method: string;
    is_depreciable: boolean;
}
interface Fund { id: number; name: string; code: string }

interface Props {
    categories: Category[];
    funds: Fund[];
    errors?: Record<string, string>;
}

export default function Create({ categories, funds, errors = {} }: Props) {
    const { t } = useTranslation();

    const [form, setForm] = useState({
        asset_name: '',
        category_id: '',
        description: '',
        fund_id: '',
        department: '',
        location: '',
        purchase_date: '',
        purchase_cost: '',
        residual_value: '0',
        useful_life_months: '',
        depreciation_method: 'straight_line',
    });

    const [processing, setProcessing] = useState(false);

    const handleCategoryChange = (id: string) => {
        const cat = categories.find((c) => c.id.toString() === id);
        setForm({
            ...form,
            category_id: id,
            useful_life_months: cat ? cat.default_useful_life_months.toString() : '',
            depreciation_method: cat ? cat.depreciation_method : 'straight_line',
        });
    };

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        setProcessing(true);
        router.post(route('account.fixed-assets.store'), form, {
            onFinish: () => setProcessing(false),
        });
    };

    const selectedCategory = categories.find((c) => c.id.toString() === form.category_id);
    const monthlyDepreciation = (() => {
        const cost = parseFloat(form.purchase_cost) || 0;
        const residual = parseFloat(form.residual_value) || 0;
        const months = parseInt(form.useful_life_months) || 0;
        if (months <= 0 || cost <= 0) return null;
        return ((cost - residual) / months).toFixed(2);
    })();

    return (
        <AuthenticatedLayout
            breadcrumbs={[
                { label: t('Accounting'), url: route('account.index') },
                { label: t('Asset Register'), url: route('account.fixed-assets.index') },
                { label: t('Register Asset') },
            ]}
            pageTitle={t('Register Fixed Asset')}
        >
            <Head title={t('Register Fixed Asset')} />

            <form onSubmit={submit}>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Main fields */}
                    <div className="lg:col-span-2 space-y-6">
                        <Card>
                            <CardHeader><CardTitle>{t('Asset Details')}</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('Asset Name')} *</label>
                                        <Input value={form.asset_name} onChange={(e) => setForm({ ...form, asset_name: e.target.value })} />
                                        <InputError message={errors.asset_name} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('Category')} *</label>
                                        <Select value={form.category_id} onValueChange={handleCategoryChange}>
                                            <SelectTrigger><SelectValue placeholder={t('Select category')} /></SelectTrigger>
                                            <SelectContent>
                                                {categories.map((c) => (
                                                    <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <InputError message={errors.category_id} />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('Description')}</label>
                                    <textarea
                                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        rows={3}
                                        value={form.description}
                                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('Department')}</label>
                                        <Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}
                                               placeholder={t('e.g. Faculty of Science')} />
                                        <InputError message={errors.department} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('Location')}</label>
                                        <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}
                                               placeholder={t('e.g. Block C, Room 101')} />
                                        <InputError message={errors.location} />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader><CardTitle>{t('Acquisition & Valuation')}</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('Purchase Date')} *</label>
                                        <Input type="date" value={form.purchase_date}
                                               onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} />
                                        <InputError message={errors.purchase_date} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('Fund')} *</label>
                                        <Select value={form.fund_id} onValueChange={(v) => setForm({ ...form, fund_id: v })}>
                                            <SelectTrigger><SelectValue placeholder={t('Select fund')} /></SelectTrigger>
                                            <SelectContent>
                                                {funds.map((f) => (
                                                    <SelectItem key={f.id} value={f.id.toString()}>{f.code} — {f.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <InputError message={errors.fund_id} />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('Purchase Cost')} *</label>
                                        <Input type="number" step="0.01" min="0.01" value={form.purchase_cost}
                                               onChange={(e) => setForm({ ...form, purchase_cost: e.target.value })} />
                                        <InputError message={errors.purchase_cost} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('Residual Value')}</label>
                                        <Input type="number" step="0.01" min="0" value={form.residual_value}
                                               onChange={(e) => setForm({ ...form, residual_value: e.target.value })} />
                                        <InputError message={errors.residual_value} />
                                        <p className="text-xs text-gray-500 mt-1">{t('Estimated scrap/salvage value at end of useful life')}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader><CardTitle>{t('Depreciation Parameters — IPSAS 17')}</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                {selectedCategory && !selectedCategory.is_depreciable && (
                                    <div className="rounded-md bg-blue-50 border border-blue-200 p-3 text-sm text-blue-700">
                                        {t('This category (e.g. Land) is not subject to depreciation per IPSAS 17.')}
                                    </div>
                                )}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('Useful Life (months)')} *</label>
                                        <Input type="number" min="1" value={form.useful_life_months}
                                               onChange={(e) => setForm({ ...form, useful_life_months: e.target.value })}
                                               disabled={selectedCategory && !selectedCategory.is_depreciable} />
                                        <InputError message={errors.useful_life_months} />
                                        {form.useful_life_months && (
                                            <p className="text-xs text-gray-500 mt-1">
                                                {(parseInt(form.useful_life_months) / 12).toFixed(1)} {t('years')}
                                            </p>
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('Depreciation Method')}</label>
                                        <Select value={form.depreciation_method}
                                                onValueChange={(v) => setForm({ ...form, depreciation_method: v })}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="straight_line">{t('Straight-Line (IPSAS 17 default)')}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                {monthlyDepreciation && selectedCategory?.is_depreciable !== false && (
                                    <div className="rounded-md bg-green-50 border border-green-200 p-3">
                                        <p className="text-sm font-medium text-green-800">
                                            {t('Monthly depreciation charge')}: <strong>{monthlyDepreciation}</strong>
                                        </p>
                                        <p className="text-xs text-gray-500 mt-1">
                                            {t('Formula')}: (Cost − Residual Value) ÷ Useful Life in Months
                                        </p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-4">
                        <Card>
                            <CardContent className="p-4 space-y-3">
                                <Button type="submit" className="w-full" disabled={processing}>
                                    {processing ? t('Saving...') : t('Register Asset')}
                                </Button>
                                <Link href={route('account.fixed-assets.index')}>
                                    <Button type="button" variant="outline" className="w-full">{t('Cancel')}</Button>
                                </Link>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader><CardTitle className="text-sm">{t('GL Accounts')}</CardTitle></CardHeader>
                            <CardContent className="text-sm text-gray-600 space-y-2">
                                {selectedCategory ? (
                                    <>
                                        <p><span className="font-medium">{t('Asset Account')}:</span> {selectedCategory ? categories.find(c => c.id.toString() === form.category_id) ? `See category defaults` : '-' : '-'}</p>
                                        <p className="text-xs text-gray-500">
                                            {t('GL accounts are resolved automatically from the selected category.')}
                                        </p>
                                    </>
                                ) : (
                                    <p className="text-xs text-gray-500">{t('Select a category to see the GL accounts that will be assigned.')}</p>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </form>
        </AuthenticatedLayout>
    );
}
