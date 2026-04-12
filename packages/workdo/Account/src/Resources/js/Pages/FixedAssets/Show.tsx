import { useState } from 'react';
import { Head, router, Link } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import AuthenticatedLayout from '@/layouts/authenticated-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { formatDate, formatCurrency } from '@/utils/helpers';
import { Edit, TrendingDown, Archive } from 'lucide-react';

interface DepreciationSchedule {
    id: number;
    period_label: string;
    depreciation_date: string;
    depreciation_amount: string;
    accumulated_depreciation_after: string;
    journal_entry?: { id: number; journal_number: string } | null;
}

interface Asset {
    id: number;
    asset_code: string;
    asset_name: string;
    category: { id: number; name: string } | null;
    fund: { id: number; name: string; code: string } | null;
    asset_account: { account_code: string; account_name: string } | null;
    accumulated_depreciation_account: { account_code: string; account_name: string } | null;
    depreciation_expense_account: { account_code: string; account_name: string } | null;
    department: string | null;
    location: string | null;
    description: string | null;
    purchase_date: string;
    purchase_cost: string;
    residual_value: string;
    useful_life_months: number;
    depreciation_method: string;
    accumulated_depreciation: string;
    status: 'active' | 'fully_depreciated' | 'disposed';
    disposal_date: string | null;
    disposal_method: string | null;
    disposal_proceeds: string | null;
    authorising_officer: { id: number; name: string } | null;
    disposal_journal: { id: number; journal_number: string } | null;
    depreciation_schedules: DepreciationSchedule[];
}

interface User { id: number; name: string }
interface Props { asset: Asset; users: User[]; auth: any }

export default function Show({ asset, users }: Props) {
    const { t } = useTranslation();

    const [depreciateOpen, setDepreciateOpen] = useState(false);
    const [disposeOpen, setDisposeOpen] = useState(false);
    const [deprDate, setDeprDate] = useState(new Date().toISOString().split('T')[0]);
    const [deprProcessing, setDeprProcessing] = useState(false);
    const [disposeForm, setDisposeForm] = useState({
        disposal_date: new Date().toISOString().split('T')[0],
        disposal_method: 'sale',
        disposal_proceeds: '0',
        authorising_officer_id: '',
    });
    const [disposeProcessing, setDisposeProcessing] = useState(false);

    const carryingAmount = parseFloat(asset.purchase_cost) - parseFloat(asset.accumulated_depreciation);
    const monthlyCharge = asset.useful_life_months > 0
        ? ((parseFloat(asset.purchase_cost) - parseFloat(asset.residual_value)) / asset.useful_life_months)
        : 0;

    const handleDepreciate = () => {
        setDeprProcessing(true);
        router.post(route('account.fixed-assets.depreciate', asset.id), { depreciation_date: deprDate }, {
            onSuccess: () => { setDepreciateOpen(false); },
            onFinish: () => setDeprProcessing(false),
        });
    };

    const handleDispose = () => {
        setDisposeProcessing(true);
        router.post(route('account.fixed-assets.dispose', asset.id), disposeForm, {
            onSuccess: () => { setDisposeOpen(false); },
            onFinish: () => setDisposeProcessing(false),
        });
    };

    const statusBadge = (status: string) => {
        const cfg: Record<string, string> = {
            active: 'bg-green-100 text-green-800',
            fully_depreciated: 'bg-yellow-100 text-yellow-800',
            disposed: 'bg-gray-100 text-gray-600',
        };
        const labels: Record<string, string> = {
            active: t('Active'),
            fully_depreciated: t('Fully Depreciated'),
            disposed: t('Disposed'),
        };
        return (
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${cfg[status]}`}>
                {labels[status] ?? status}
            </span>
        );
    };

    const disposalMethodLabel = (m: string | null) => {
        const labels: Record<string, string> = { sale: t('Sale'), transfer: t('Transfer'), write_off: t('Write-Off'), scrapped: t('Scrapped') };
        return m ? (labels[m] ?? m) : '-';
    };

    return (
        <AuthenticatedLayout
            breadcrumbs={[
                { label: t('Accounting'), url: route('account.index') },
                { label: t('Asset Register'), url: route('account.fixed-assets.index') },
                { label: asset.asset_code },
            ]}
            pageTitle={asset.asset_name}
            pageActions={
                asset.status === 'active' ? (
                    <div className="flex items-center gap-2">
                        <Link href={route('account.fixed-assets.edit', asset.id)}>
                            <Button variant="outline" size="sm"><Edit className="h-4 w-4 mr-1" />{t('Edit')}</Button>
                        </Link>
                        {asset.category?.name !== 'Land' && (
                            <Button size="sm" variant="outline"
                                    onClick={() => setDepreciateOpen(true)}>
                                <TrendingDown className="h-4 w-4 mr-1" />{t('Run Depreciation')}
                            </Button>
                        )}
                        <Button size="sm" variant="destructive"
                                onClick={() => setDisposeOpen(true)}>
                            <Archive className="h-4 w-4 mr-1" />{t('Dispose Asset')}
                        </Button>
                    </div>
                ) : undefined
            }
        >
            <Head title={asset.asset_code} />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left: main info */}
                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>{t('Asset Information')}</CardTitle>
                            {statusBadge(asset.status)}
                        </CardHeader>
                        <CardContent>
                            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                                <div><dt className="text-gray-500">{t('Asset Code')}</dt><dd className="font-mono font-medium">{asset.asset_code}</dd></div>
                                <div><dt className="text-gray-500">{t('Category')}</dt><dd>{asset.category?.name ?? '-'}</dd></div>
                                <div><dt className="text-gray-500">{t('Fund')}</dt><dd>{asset.fund ? `${asset.fund.code} — ${asset.fund.name}` : '-'}</dd></div>
                                <div><dt className="text-gray-500">{t('Department')}</dt><dd>{asset.department ?? '-'}</dd></div>
                                <div><dt className="text-gray-500">{t('Location')}</dt><dd>{asset.location ?? '-'}</dd></div>
                                <div><dt className="text-gray-500">{t('Purchase Date')}</dt><dd>{formatDate(asset.purchase_date)}</dd></div>
                                {asset.description && (
                                    <div className="col-span-2"><dt className="text-gray-500">{t('Description')}</dt><dd>{asset.description}</dd></div>
                                )}
                            </dl>
                        </CardContent>
                    </Card>

                    {/* Valuation */}
                    <Card>
                        <CardHeader><CardTitle>{t('Valuation — IPSAS 17')}</CardTitle></CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                                <div className="rounded-lg bg-blue-50 p-3">
                                    <p className="text-xs text-gray-500">{t('Cost')}</p>
                                    <p className="text-base font-bold text-blue-700">{formatCurrency(asset.purchase_cost)}</p>
                                </div>
                                <div className="rounded-lg bg-orange-50 p-3">
                                    <p className="text-xs text-gray-500">{t('Acc. Depreciation')}</p>
                                    <p className="text-base font-bold text-orange-700">{formatCurrency(asset.accumulated_depreciation)}</p>
                                </div>
                                <div className="rounded-lg bg-green-50 p-3">
                                    <p className="text-xs text-gray-500">{t('Carrying Amount')}</p>
                                    <p className="text-base font-bold text-green-700">{formatCurrency(carryingAmount.toFixed(2))}</p>
                                </div>
                                <div className="rounded-lg bg-gray-50 p-3">
                                    <p className="text-xs text-gray-500">{t('Residual Value')}</p>
                                    <p className="text-base font-bold text-gray-700">{formatCurrency(asset.residual_value)}</p>
                                </div>
                            </div>

                            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                                <div><dt className="text-gray-500">{t('Useful Life')}</dt><dd>{asset.useful_life_months} {t('months')} ({(asset.useful_life_months / 12).toFixed(1)} {t('years')})</dd></div>
                                <div><dt className="text-gray-500">{t('Depreciation Method')}</dt><dd>{t('Straight-Line (IPSAS 17)')}</dd></div>
                                <div><dt className="text-gray-500">{t('Monthly Charge')}</dt><dd>{formatCurrency(monthlyCharge.toFixed(2))}</dd></div>
                            </dl>
                        </CardContent>
                    </Card>

                    {/* Depreciation schedule */}
                    <Card>
                        <CardHeader><CardTitle>{t('Depreciation History')}</CardTitle></CardHeader>
                        <CardContent className="p-0">
                            {asset.depreciation_schedules.length === 0 ? (
                                <p className="p-6 text-sm text-gray-500">{t('No depreciation entries yet.')}</p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50 border-b">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('Period')}</th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('Date')}</th>
                                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('Charge')}</th>
                                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('Accumulated')}</th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('Journal')}</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {asset.depreciation_schedules.map((s) => (
                                                <tr key={s.id} className="hover:bg-gray-50">
                                                    <td className="px-4 py-2">{s.period_label}</td>
                                                    <td className="px-4 py-2">{formatDate(s.depreciation_date)}</td>
                                                    <td className="px-4 py-2 text-right">{formatCurrency(s.depreciation_amount)}</td>
                                                    <td className="px-4 py-2 text-right">{formatCurrency(s.accumulated_depreciation_after)}</td>
                                                    <td className="px-4 py-2">
                                                        {s.journal_entry
                                                            ? <span className="font-mono text-xs text-blue-600">{s.journal_entry.journal_number}</span>
                                                            : '-'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Disposal detail */}
                    {asset.status === 'disposed' && (
                        <Card className="border-red-200">
                            <CardHeader><CardTitle className="text-red-700">{t('Disposal Details')}</CardTitle></CardHeader>
                            <CardContent>
                                <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                                    <div><dt className="text-gray-500">{t('Disposal Date')}</dt><dd>{formatDate(asset.disposal_date!)}</dd></div>
                                    <div><dt className="text-gray-500">{t('Method')}</dt><dd>{disposalMethodLabel(asset.disposal_method)}</dd></div>
                                    <div><dt className="text-gray-500">{t('Proceeds')}</dt><dd>{formatCurrency(asset.disposal_proceeds ?? '0')}</dd></div>
                                    <div><dt className="text-gray-500">{t('Authorised By')}</dt><dd>{asset.authorising_officer?.name ?? '-'}</dd></div>
                                    {asset.disposal_journal && (
                                        <div><dt className="text-gray-500">{t('Journal Entry')}</dt>
                                             <dd className="font-mono text-blue-600">{asset.disposal_journal.journal_number}</dd></div>
                                    )}
                                </dl>
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Right: GL accounts */}
                <div className="space-y-4">
                    <Card>
                        <CardHeader><CardTitle className="text-sm">{t('GL Accounts')}</CardTitle></CardHeader>
                        <CardContent className="text-sm space-y-2">
                            <div>
                                <p className="text-xs text-gray-500">{t('Asset at Cost')}</p>
                                <p className="font-mono">{asset.asset_account ? `${asset.asset_account.account_code} — ${asset.asset_account.account_name}` : '-'}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">{t('Accumulated Depreciation')}</p>
                                <p className="font-mono">{asset.accumulated_depreciation_account
                                    ? `${asset.accumulated_depreciation_account.account_code} — ${asset.accumulated_depreciation_account.account_name}`
                                    : t('N/A — Non-depreciable')}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">{t('Depreciation Expense')}</p>
                                <p className="font-mono">{asset.depreciation_expense_account
                                    ? `${asset.depreciation_expense_account.account_code} — ${asset.depreciation_expense_account.account_name}`
                                    : t('N/A — Non-depreciable')}</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Depreciate Modal */}
            <Dialog open={depreciateOpen} onOpenChange={setDepreciateOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{t('Run Depreciation — IPSAS 17')}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="rounded-md bg-blue-50 border border-blue-200 p-3 text-sm text-blue-700">
                            <p>{t('Monthly charge')}: <strong>{formatCurrency(monthlyCharge.toFixed(2))}</strong></p>
                            <p className="text-xs mt-1">{t('DR: Depreciation Expense  |  CR: Accumulated Depreciation')}</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('Depreciation Date')} *</label>
                            <Input type="date" value={deprDate} onChange={(e) => setDeprDate(e.target.value)} />
                            <p className="text-xs text-gray-500 mt-1">{t('The journal entry will be posted on this date.')}</p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDepreciateOpen(false)}>{t('Cancel')}</Button>
                        <Button onClick={handleDepreciate} disabled={deprProcessing}>
                            {deprProcessing ? t('Posting...') : t('Post Depreciation')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Dispose Modal */}
            <Dialog open={disposeOpen} onOpenChange={setDisposeOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{t('Dispose Asset — IPSAS 17')}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="rounded-md bg-orange-50 border border-orange-200 p-3 text-sm text-orange-700">
                            <p>{t('Carrying amount at disposal')}: <strong>{formatCurrency(carryingAmount.toFixed(2))}</strong></p>
                            <p className="text-xs mt-1">{t('A journal entry will be posted: DR Accumulated Depreciation, CR Asset at Cost, ± Gain/Loss on Disposal.')}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('Disposal Date')} *</label>
                                <Input type="date" value={disposeForm.disposal_date}
                                       onChange={(e) => setDisposeForm({ ...disposeForm, disposal_date: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('Method')} *</label>
                                <Select value={disposeForm.disposal_method}
                                        onValueChange={(v) => setDisposeForm({ ...disposeForm, disposal_method: v })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="sale">{t('Sale')}</SelectItem>
                                        <SelectItem value="transfer">{t('Transfer')}</SelectItem>
                                        <SelectItem value="write_off">{t('Write-Off')}</SelectItem>
                                        <SelectItem value="scrapped">{t('Scrapped')}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('Proceeds Amount')}</label>
                            <Input type="number" step="0.01" min="0" value={disposeForm.disposal_proceeds}
                                   onChange={(e) => setDisposeForm({ ...disposeForm, disposal_proceeds: e.target.value })} />
                            <p className="text-xs text-gray-500 mt-1">{t('Set to 0 for write-offs and scrapped assets.')}</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('Authorising Officer')}</label>
                            <Select value={disposeForm.authorising_officer_id}
                                    onValueChange={(v) => setDisposeForm({ ...disposeForm, authorising_officer_id: v })}>
                                <SelectTrigger><SelectValue placeholder={t('Select officer')} /></SelectTrigger>
                                <SelectContent>
                                    {users.map((u) => (
                                        <SelectItem key={u.id} value={u.id.toString()}>{u.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDisposeOpen(false)}>{t('Cancel')}</Button>
                        <Button variant="destructive" onClick={handleDispose} disabled={disposeProcessing}>
                            {disposeProcessing ? t('Processing...') : t('Confirm Disposal')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AuthenticatedLayout>
    );
}
