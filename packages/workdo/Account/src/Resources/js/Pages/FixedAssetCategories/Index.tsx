import { useState } from 'react';
import { Head, usePage, router } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import { useDeleteHandler } from '@/hooks/useDeleteHandler';
import AuthenticatedLayout from '@/layouts/authenticated-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import NoRecordsFound from '@/components/no-records-found';

interface Category {
    id: number;
    name: string;
    description: string | null;
    asset_account_code: string;
    accumulated_depreciation_account_code: string | null;
    depreciation_expense_account_code: string | null;
    default_useful_life_months: number;
    depreciation_method: string;
    is_depreciable: boolean;
}

interface Props { categories: Category[]; auth: any }

const emptyForm = {
    name: '',
    description: '',
    asset_account_code: '',
    accumulated_depreciation_account_code: '',
    depreciation_expense_account_code: '',
    default_useful_life_months: '60',
    depreciation_method: 'straight_line',
    is_depreciable: true,
};

export default function Index() {
    const { t } = useTranslation();
    const { categories } = usePage<Props>().props;

    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<Category | null>(null);
    const [form, setForm] = useState({ ...emptyForm });
    const [processing, setProcessing] = useState(false);

    const { deleteState, openDeleteDialog, closeDeleteDialog, confirmDelete } = useDeleteHandler({
        routeName: 'account.fixed-asset-categories.destroy',
        defaultMessage: t('Are you sure you want to delete this category?'),
    });

    const openCreate = () => {
        setEditing(null);
        setForm({ ...emptyForm });
        setModalOpen(true);
    };

    const openEdit = (cat: Category) => {
        setEditing(cat);
        setForm({
            name: cat.name,
            description: cat.description ?? '',
            asset_account_code: cat.asset_account_code,
            accumulated_depreciation_account_code: cat.accumulated_depreciation_account_code ?? '',
            depreciation_expense_account_code: cat.depreciation_expense_account_code ?? '',
            default_useful_life_months: cat.default_useful_life_months.toString(),
            depreciation_method: cat.depreciation_method,
            is_depreciable: cat.is_depreciable,
        });
        setModalOpen(true);
    };

    const submit = () => {
        setProcessing(true);
        const payload = {
            ...form,
            default_useful_life_months: parseInt(form.default_useful_life_months),
            is_depreciable: form.is_depreciable,
        };
        if (editing) {
            router.put(route('account.fixed-asset-categories.update', editing.id), payload, {
                onSuccess: () => setModalOpen(false),
                onFinish: () => setProcessing(false),
            });
        } else {
            router.post(route('account.fixed-asset-categories.store'), payload, {
                onSuccess: () => setModalOpen(false),
                onFinish: () => setProcessing(false),
            });
        }
    };

    return (
        <AuthenticatedLayout
            breadcrumbs={[
                { label: t('Accounting'), url: route('account.index') },
                { label: t('Asset Categories') },
            ]}
            pageTitle={t('Fixed Asset Categories')}
            pageActions={
                <TooltipProvider>
                    <Tooltip delayDuration={0}>
                        <TooltipTrigger asChild>
                            <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4" /></Button>
                        </TooltipTrigger>
                        <TooltipContent><p>{t('Add Category')}</p></TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            }
        >
            <Head title={t('Asset Categories')} />

            <Card>
                <CardContent className="p-0">
                    {categories.length === 0 ? (
                        <NoRecordsFound
                            icon={Plus}
                            title={t('No categories found')}
                            description={t('Add asset categories to classify your university PPE.')}
                            onCreateClick={openCreate}
                            createButtonText={t('Add Category')}
                        />
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 border-b">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('Category')}</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('Asset Account')}</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('Acc. Depreciation')}</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('Depr. Expense')}</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('Useful Life')}</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('Depreciable')}</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('Actions')}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {categories.map((cat) => (
                                        <tr key={cat.id} className="hover:bg-gray-50">
                                            <td className="px-4 py-3">
                                                <p className="font-medium">{cat.name}</p>
                                                {cat.description && <p className="text-xs text-gray-500">{cat.description}</p>}
                                            </td>
                                            <td className="px-4 py-3 font-mono text-xs">{cat.asset_account_code}</td>
                                            <td className="px-4 py-3 font-mono text-xs">{cat.accumulated_depreciation_account_code ?? '—'}</td>
                                            <td className="px-4 py-3 font-mono text-xs">{cat.depreciation_expense_account_code ?? '—'}</td>
                                            <td className="px-4 py-3">
                                                {cat.is_depreciable
                                                    ? `${cat.default_useful_life_months} ${t('mths')} (${(cat.default_useful_life_months / 12).toFixed(0)} ${t('yrs')})`
                                                    : '—'}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cat.is_depreciable ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                                                    {cat.is_depreciable ? t('Yes') : t('No')}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex gap-1">
                                                    <TooltipProvider>
                                                        <Tooltip delayDuration={0}>
                                                            <TooltipTrigger asChild>
                                                                <Button variant="ghost" size="sm" onClick={() => openEdit(cat)}
                                                                        className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700">
                                                                    <Edit className="h-4 w-4" />
                                                                </Button>
                                                            </TooltipTrigger>
                                                            <TooltipContent><p>{t('Edit')}</p></TooltipContent>
                                                        </Tooltip>
                                                        <Tooltip delayDuration={0}>
                                                            <TooltipTrigger asChild>
                                                                <Button variant="ghost" size="sm" onClick={() => openDeleteDialog(cat.id)}
                                                                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700">
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </TooltipTrigger>
                                                            <TooltipContent><p>{t('Delete')}</p></TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Create / Edit Modal */}
            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{editing ? t('Edit Category') : t('Add Asset Category')}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('Category Name')} *</label>
                            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('Description')}</label>
                            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('Asset GL Code')} *</label>
                                <Input value={form.asset_account_code}
                                       onChange={(e) => setForm({ ...form, asset_account_code: e.target.value })}
                                       placeholder="e.g. 1600" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('Acc. Depr. Code')}</label>
                                <Input value={form.accumulated_depreciation_account_code}
                                       onChange={(e) => setForm({ ...form, accumulated_depreciation_account_code: e.target.value })}
                                       placeholder="e.g. 1610" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('Depr. Expense Code')}</label>
                                <Input value={form.depreciation_expense_account_code}
                                       onChange={(e) => setForm({ ...form, depreciation_expense_account_code: e.target.value })}
                                       placeholder="e.g. 5600" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('Default Useful Life (months)')}</label>
                                <Input type="number" min="0" value={form.default_useful_life_months}
                                       onChange={(e) => setForm({ ...form, default_useful_life_months: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('Depreciable?')}</label>
                                <Select value={form.is_depreciable ? 'true' : 'false'}
                                        onValueChange={(v) => setForm({ ...form, is_depreciable: v === 'true' })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="true">{t('Yes')}</SelectItem>
                                        <SelectItem value="false">{t('No (e.g. Land)')}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setModalOpen(false)}>{t('Cancel')}</Button>
                        <Button onClick={submit} disabled={processing}>
                            {processing ? t('Saving...') : t('Save')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <ConfirmationDialog
                open={deleteState.isOpen}
                onOpenChange={closeDeleteDialog}
                title={t('Delete Category')}
                message={deleteState.message}
                confirmText={t('Delete')}
                onConfirm={confirmDelete}
                variant="destructive"
            />
        </AuthenticatedLayout>
    );
}
