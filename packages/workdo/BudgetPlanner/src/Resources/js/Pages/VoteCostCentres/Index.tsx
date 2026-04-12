import { useState } from 'react';
import { Head, usePage, router } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import { useForm } from '@inertiajs/react';
import { useDeleteHandler } from '@/hooks/useDeleteHandler';
import AuthenticatedLayout from "@/layouts/authenticated-layout";
import { Button } from '@/components/ui/button';
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { Plus, Edit as EditIcon, Trash2, Building2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { PerPageSelector } from '@/components/ui/per-page-selector';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import InputError from '@/components/ui/input-error';
import { Textarea } from '@/components/ui/textarea';
import NoRecordsFound from '@/components/no-records-found';

interface VoteCostCentre {
    id: number;
    code: string;
    name: string;
    description: string | null;
    is_active: boolean;
}

function VoteCostCentreForm({ item, onSuccess }: { item?: VoteCostCentre; onSuccess: () => void }) {
    const { t } = useTranslation();
    const isEdit = !!item;
    const { data, setData, post, put, processing, errors } = useForm({
        code:        item?.code ?? '',
        name:        item?.name ?? '',
        description: item?.description ?? '',
        is_active:   item?.is_active ?? true,
    });

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        if (isEdit) {
            put(route('budget-planner.vote-cost-centres.update', item!.id), { onSuccess });
        } else {
            post(route('budget-planner.vote-cost-centres.store'), { onSuccess });
        }
    };

    return (
        <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
                <div>
                    <Label htmlFor="code" required>{t('Code')}</Label>
                    <Input id="code" value={data.code} onChange={e => setData('code', e.target.value)}
                        placeholder="e.g. FAC-ENG" className="uppercase" />
                    <InputError message={errors.code} />
                </div>
                <div className="col-span-2">
                    <Label htmlFor="name" required>{t('Name')}</Label>
                    <Input id="name" value={data.name} onChange={e => setData('name', e.target.value)}
                        placeholder="e.g. Faculty of Engineering" />
                    <InputError message={errors.name} />
                </div>
            </div>
            <div>
                <Label htmlFor="description">{t('Description')}</Label>
                <Textarea id="description" value={data.description ?? ''} onChange={e => setData('description', e.target.value)}
                    rows={2} />
                <InputError message={errors.description} />
            </div>
            {isEdit && (
                <div className="flex items-center gap-2">
                    <input type="checkbox" id="is_active" checked={data.is_active}
                        onChange={e => setData('is_active', e.target.checked)} className="rounded" />
                    <Label htmlFor="is_active">{t('Is Active')}</Label>
                </div>
            )}
            <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={onSuccess}>{t('Cancel')}</Button>
                <Button type="submit" disabled={processing}>
                    {processing ? t('Creating...') : isEdit ? t('Update') : t('Create')}
                </Button>
            </div>
        </form>
    );
}

export default function Index() {
    const { t } = useTranslation();
    const { voteCostCentres, auth } = usePage<any>().props;
    const perms: string[] = auth.user?.permissions || [];
    const urlParams = new URLSearchParams(window.location.search);

    const [search, setSearch] = useState(urlParams.get('search') || '');
    const [perPage] = useState(urlParams.get('per_page') || '15');
    const [modalState, setModalState] = useState({ isOpen: false, item: null as VoteCostCentre | null });

    const { deleteState, openDeleteDialog, closeDeleteDialog, confirmDelete } = useDeleteHandler({
        routeName: 'budget-planner.vote-cost-centres.destroy',
        defaultMessage: t('Are you sure you want to delete this Vote / Cost Centre?')
    });

    const openModal = (item: VoteCostCentre | null = null) => setModalState({ isOpen: true, item });
    const closeModal = () => {
        setModalState({ isOpen: false, item: null });
        router.reload();
    };

    const tableColumns = [
        { key: 'code', header: t('Code'), sortable: true,
            render: (v: string) => <span className="font-mono font-medium">{v}</span> },
        { key: 'name', header: t('Name'), sortable: true },
        { key: 'description', header: t('Description'), sortable: false,
            render: (v: string) => v || '-' },
        { key: 'is_active', header: t('Status'), sortable: false,
            render: (v: boolean) => (
                <span className={`px-2 py-0.5 rounded-full text-xs ${v ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {v ? t('Active') : 'Inactive'}
                </span>
            )
        },
        {
            key: 'actions',
            header: t('Actions'),
            render: (_: any, item: VoteCostCentre) => (
                <div className="flex gap-1">
                    <TooltipProvider>
                        {perms.includes('edit-vote-cost-centres') && (
                            <Tooltip delayDuration={0}>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-blue-600"
                                        onClick={() => openModal(item)}>
                                        <EditIcon className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>{t('Edit')}</p></TooltipContent>
                            </Tooltip>
                        )}
                        {perms.includes('delete-vote-cost-centres') && (
                            <Tooltip delayDuration={0}>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive"
                                        onClick={() => openDeleteDialog(item.id)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>{t('Delete')}</p></TooltipContent>
                            </Tooltip>
                        )}
                    </TooltipProvider>
                </div>
            )
        },
    ];

    return (
        <AuthenticatedLayout
            breadcrumbs={[{label: t('Budget Planner')}, {label: t('Vote \/ Cost Centres')}]}
            pageTitle={t('Vote \/ Cost Centres')}
            pageActions={
                perms.includes('create-vote-cost-centres') ? (
                    <TooltipProvider>
                        <Tooltip delayDuration={0}>
                            <TooltipTrigger asChild>
                                <Button size="sm" onClick={() => openModal()}>
                                    <Plus className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>{t('Create Vote \/ Cost Centre')}</p></TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                ) : undefined
            }
        >
            <Head title={t('Vote \/ Cost Centres')} />
            <Card className="shadow-sm">
                <CardContent className="p-6 border-b bg-gray-50/50">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex-1 max-w-md">
                            <SearchInput value={search} onChange={setSearch}
                                onSearch={() => router.get(route('budget-planner.vote-cost-centres.index'), { search, per_page: perPage })}
                                placeholder={t('Search Vote \/ Cost Centres...')} />
                        </div>
                        <PerPageSelector routeName="budget-planner.vote-cost-centres.index" filters={{ search }} />
                    </div>
                </CardContent>
                <CardContent className="p-0">
                    <div className="overflow-y-auto max-h-[70vh]">
                        <DataTable
                            data={voteCostCentres?.data || []}
                            columns={tableColumns}
                            className="rounded-none"
                            emptyState={
                                <NoRecordsFound
                                    icon={Building2}
                                    title={t('No Vote \/ Cost Centres found')}
                                    description={t('Get started by creating your first Vote \/ Cost Centre.')}
                                    hasFilters={!!search}
                                    onClearFilters={() => { setSearch(''); router.get(route('budget-planner.vote-cost-centres.index')); }}
                                    createPermission="create-vote-cost-centres"
                                    onCreateClick={() => openModal()}
                                    createButtonText={t('Create Vote \/ Cost Centre')}
                                    className="h-auto"
                                />
                            }
                        />
                    </div>
                </CardContent>
                <CardContent className="px-4 py-2 border-t bg-gray-50/30">
                    <Pagination data={voteCostCentres || {}} routeName="budget-planner.vote-cost-centres.index" filters={{ search, per_page: perPage }} />
                </CardContent>
            </Card>

            <Dialog open={modalState.isOpen} onOpenChange={closeModal}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{modalState.item ? t('Edit Vote \/ Cost Centre') : t('Create Vote \/ Cost Centre')}</DialogTitle>
                    </DialogHeader>
                    <VoteCostCentreForm item={modalState.item ?? undefined} onSuccess={closeModal} />
                </DialogContent>
            </Dialog>

            <ConfirmationDialog
                open={deleteState.isOpen}
                onOpenChange={closeDeleteDialog}
                title={t('Delete Vote \/ Cost Centre')}
                message={deleteState.message}
                confirmText={t('Delete')}
                onConfirm={confirmDelete}
                variant="destructive"
            />
        </AuthenticatedLayout>
    );
}
