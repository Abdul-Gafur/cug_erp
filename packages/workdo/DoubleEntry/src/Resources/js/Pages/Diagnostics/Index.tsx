import { useState } from 'react';
import { Head, usePage, router, useForm } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import AuthenticatedLayout from '@/layouts/authenticated-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle, CheckCircle2, RefreshCw, Wrench, ChevronDown, ChevronRight, FileText, Activity } from 'lucide-react';
import { formatCurrency, formatDate } from '@/utils/helpers';

interface JournalLineItem {
    id: number;
    account_code: string;
    account_name: string;
    normal_balance: string;
    debit_amount: number;
    credit_amount: number;
    line_description: string;
}

interface UnbalancedEntry {
    id: number;
    journal_number: string;
    journal_date: string;
    description: string;
    entry_type: string;
    reference_type: string;
    status: string;
    total_debits: number;
    total_credits: number;
    imbalance: number;
    items: JournalLineItem[];
}

interface BalanceSheetRow {
    id: number;
    balance_sheet_date: string;
    financial_year: string;
    total_assets: number;
    total_liabilities: number;
    total_equity: number;
    is_balanced: boolean;
    status: string;
}

interface OpeningBalanceIssue {
    account_code: string;
    account_name: string;
    normal_balance: string;
    opening_balance: number;
    current_balance: number;
}

interface Account {
    id: number;
    account_code: string;
    account_name: string;
    normal_balance: string;
}

interface DiagnosticsProps {
    trialBalance: { total_debits: number; total_credits: number; gap: number };
    unbalancedEntries: UnbalancedEntry[];
    openingBalanceIssues: OpeningBalanceIssue[];
    balanceSheets: BalanceSheetRow[];
    accounts: Account[];
    auth: { user: { permissions: string[] } };
}

function CorrectingEntryForm({
    entry,
    accounts,
    onCancel,
}: {
    entry: UnbalancedEntry;
    accounts: Account[];
    onCancel: () => void;
}) {
    const { t } = useTranslation();
    const { data, setData, post, processing, errors } = useForm({
        account_id: '',
        description: `Correcting line for JE ${entry.journal_number} — missing ${entry.imbalance < 0 ? 'debit' : 'credit'} of ${Math.abs(entry.imbalance).toFixed(2)}`,
    });

    const missingAmount = Math.abs(entry.imbalance);
    const missingSide   = entry.imbalance < 0 ? 'Debit' : 'Credit';

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        post(route('double-entry.diagnostics.correcting-entry', entry.id), {
            preserveScroll: true,
            onSuccess: onCancel,
        });
    };

    return (
        <form onSubmit={submit} className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-3">
            <p className="text-sm font-semibold text-amber-800">
                {t('Add missing')} <span className="underline">{missingSide}</span> of {formatCurrency(missingAmount)}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                    <Label>{t('Post missing side to account')}</Label>
                    <Select value={data.account_id} onValueChange={v => setData('account_id', v)}>
                        <SelectTrigger>
                            <SelectValue placeholder={t('Select account...')} />
                        </SelectTrigger>
                        <SelectContent>
                            {accounts.map(a => (
                                <SelectItem key={a.id} value={String(a.id)}>
                                    {a.account_code} — {a.account_name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {errors.account_id && <p className="text-xs text-red-600 mt-1">{errors.account_id}</p>}
                </div>
                <div>
                    <Label>{t('Description')}</Label>
                    <Input
                        value={data.description}
                        onChange={e => setData('description', e.target.value)}
                        placeholder={t('Describe the correction')}
                    />
                    {errors.description && <p className="text-xs text-red-600 mt-1">{errors.description}</p>}
                </div>
            </div>

            <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={processing || !data.account_id}>
                    <Wrench className="h-4 w-4 mr-1" />
                    {processing ? t('Saving…') : t('Apply Correction')}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={onCancel}>
                    {t('Cancel')}
                </Button>
            </div>
        </form>
    );
}

function UnbalancedEntryRow({ entry, accounts }: { entry: UnbalancedEntry; accounts: Account[] }) {
    const { t } = useTranslation();
    const [expanded, setExpanded]           = useState(false);
    const [showCorrectForm, setShowCorrectForm] = useState(false);

    return (
        <div className="border rounded-lg overflow-hidden">
            {/* Summary row */}
            <div
                className="flex items-center justify-between px-4 py-3 bg-white cursor-pointer hover:bg-gray-50"
                onClick={() => setExpanded(v => !v)}
            >
                <div className="flex items-center gap-3">
                    {expanded ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
                    <div>
                        <span className="font-semibold text-sm">{entry.journal_number}</span>
                        <span className="ml-2 text-gray-500 text-sm">{formatDate(entry.journal_date)}</span>
                        <span className="ml-2 text-gray-600 text-sm">{entry.description}</span>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-500">
                        Dr {formatCurrency(entry.total_debits)} / Cr {formatCurrency(entry.total_credits)}
                    </span>
                    <Badge variant="destructive">
                        Gap: {formatCurrency(Math.abs(entry.imbalance))} {entry.imbalance < 0 ? '(Dr short)' : '(Cr short)'}
                    </Badge>
                </div>
            </div>

            {expanded && (
                <div className="px-4 pb-4 bg-gray-50 border-t">
                    {/* Line items */}
                    <Table className="mt-3">
                        <TableHeader>
                            <TableRow>
                                <TableHead>{t('Account')}</TableHead>
                                <TableHead>{t('Description')}</TableHead>
                                <TableHead className="text-right">{t('Debit')}</TableHead>
                                <TableHead className="text-right">{t('Credit')}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {entry.items.map(item => (
                                <TableRow key={item.id}>
                                    <TableCell className="text-sm">
                                        <span className="font-mono text-xs text-gray-500 mr-2">{item.account_code}</span>
                                        {item.account_name}
                                    </TableCell>
                                    <TableCell className="text-sm text-gray-600">{item.line_description}</TableCell>
                                    <TableCell className="text-right tabular-nums text-sm">
                                        {parseFloat(String(item.debit_amount)) > 0 ? formatCurrency(item.debit_amount) : '—'}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums text-sm">
                                        {parseFloat(String(item.credit_amount)) > 0 ? formatCurrency(item.credit_amount) : '—'}
                                    </TableCell>
                                </TableRow>
                            ))}
                            {/* Gap row */}
                            <TableRow className="bg-red-50 font-semibold">
                                <TableCell colSpan={2} className="text-red-700">{t('Missing entry (gap)')}</TableCell>
                                <TableCell className="text-right text-red-700 tabular-nums">
                                    {entry.imbalance < 0 ? formatCurrency(Math.abs(entry.imbalance)) : '—'}
                                </TableCell>
                                <TableCell className="text-right text-red-700 tabular-nums">
                                    {entry.imbalance > 0 ? formatCurrency(entry.imbalance) : '—'}
                                </TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>

                    {!showCorrectForm ? (
                        <Button size="sm" className="mt-3" onClick={() => setShowCorrectForm(true)}>
                            <Wrench className="h-4 w-4 mr-1" />
                            {t('Fix This Entry')}
                        </Button>
                    ) : (
                        <CorrectingEntryForm
                            entry={entry}
                            accounts={accounts}
                            onCancel={() => setShowCorrectForm(false)}
                        />
                    )}
                </div>
            )}
        </div>
    );
}

export default function DiagnosticsIndex() {
    const { t } = useTranslation();
    const { trialBalance, unbalancedEntries, openingBalanceIssues, balanceSheets, accounts } =
        usePage<DiagnosticsProps>().props;

    const isBalanced = Math.abs(trialBalance.gap) < 0.01;

    const handleRebuild = (id: number) => {
        router.post(route('double-entry.diagnostics.rebuild-balance-sheet', id), {}, {
            preserveScroll: true,
        });
    };

    return (
        <AuthenticatedLayout
            breadcrumbs={[
                { label: t('Double Entry') },
                { label: t('Statement of Financial Position'), url: route('double-entry.balance-sheets.list') },
                { label: t('Diagnostics') },
            ]}
            pageTitle={t('Balance Sheet Diagnostics')}
            pageActions={
                <Button variant="outline" size="sm" onClick={() => router.reload()}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    {t('Refresh')}
                </Button>
            }
        >
            <Head title={t('Balance Sheet Diagnostics')} />

            <div className="max-w-6xl mx-auto space-y-6">

                {/* ── 1. Trial Balance Summary ── */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Activity className="h-5 w-5 text-blue-600" />
                            {t('Trial Balance Check')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="text-center p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                                <p className="text-sm text-emerald-700 font-medium">{t('Total Debits')}</p>
                                <p className="text-2xl font-bold text-emerald-900 tabular-nums mt-1">
                                    {formatCurrency(trialBalance.total_debits)}
                                </p>
                            </div>
                            <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
                                <p className="text-sm text-blue-700 font-medium">{t('Total Credits')}</p>
                                <p className="text-2xl font-bold text-blue-900 tabular-nums mt-1">
                                    {formatCurrency(trialBalance.total_credits)}
                                </p>
                            </div>
                            <div className={`text-center p-4 rounded-lg border ${isBalanced ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                                <p className={`text-sm font-medium ${isBalanced ? 'text-green-700' : 'text-red-700'}`}>{t('Gap')}</p>
                                <p className={`text-2xl font-bold tabular-nums mt-1 ${isBalanced ? 'text-green-900' : 'text-red-900'}`}>
                                    {formatCurrency(Math.abs(trialBalance.gap))}
                                </p>
                                <div className="flex justify-center mt-2">
                                    {isBalanced
                                        ? <Badge className="bg-green-100 text-green-800 border border-green-300"><CheckCircle2 className="h-3 w-3 mr-1" />{t('Balanced')}</Badge>
                                        : <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />{t('Unbalanced')}</Badge>
                                    }
                                </div>
                            </div>
                        </div>

                        {!isBalanced && (
                            <p className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">
                                {t('The overall trial balance is off by')} <strong>{formatCurrency(Math.abs(trialBalance.gap))}</strong>.{' '}
                                {trialBalance.gap < 0
                                    ? t('There are more credits than debits — a debit entry is missing somewhere.')
                                    : t('There are more debits than credits — a credit entry is missing somewhere.')
                                }
                                {' '}{t('See the unbalanced entries below to locate and fix the source.')}
                            </p>
                        )}
                    </CardContent>
                </Card>

                {/* ── 2. Unbalanced Journal Entries ── */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <AlertTriangle className={`h-5 w-5 ${unbalancedEntries.length > 0 ? 'text-red-500' : 'text-green-500'}`} />
                            {t('Unbalanced Journal Entries')}
                            {unbalancedEntries.length > 0 && (
                                <Badge variant="destructive" className="ml-2">{unbalancedEntries.length}</Badge>
                            )}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {unbalancedEntries.length === 0 ? (
                            <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded p-3">
                                <CheckCircle2 className="h-5 w-5" />
                                <span>{t('All posted journal entries are balanced.')}</span>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <p className="text-sm text-gray-600">
                                    {t('Expand each entry to see its line items and apply a correcting line to balance it.')}
                                </p>
                                {unbalancedEntries.map(entry => (
                                    <UnbalancedEntryRow key={entry.id} entry={entry} accounts={accounts} />
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* ── 3. Opening Balance Issues ── */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <AlertTriangle className={`h-5 w-5 ${openingBalanceIssues.length > 0 ? 'text-amber-500' : 'text-green-500'}`} />
                            {t('Net Assets Opening Balances')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {openingBalanceIssues.length === 0 ? (
                            <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded p-3">
                                <CheckCircle2 className="h-5 w-5" />
                                <span>{t('No opening balances found on Net Assets accounts (3000–3999).')}</span>
                            </div>
                        ) : (
                            <>
                                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-3 mb-3">
                                    {t('Opening balances on Net Assets accounts must be matched by corresponding asset or liability opening balances, otherwise the balance sheet will not balance.')}
                                </p>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>{t('Code')}</TableHead>
                                            <TableHead>{t('Account Name')}</TableHead>
                                            <TableHead className="text-right">{t('Opening Balance')}</TableHead>
                                            <TableHead className="text-right">{t('Current Balance')}</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {openingBalanceIssues.map(issue => (
                                            <TableRow key={issue.account_code}>
                                                <TableCell className="font-mono text-sm">{issue.account_code}</TableCell>
                                                <TableCell>{issue.account_name}</TableCell>
                                                <TableCell className="text-right tabular-nums">
                                                    {formatCurrency(issue.opening_balance)}
                                                </TableCell>
                                                <TableCell className="text-right tabular-nums">
                                                    {formatCurrency(issue.current_balance)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </>
                        )}
                    </CardContent>
                </Card>

                {/* ── 4. Balance Sheet Status + Rebuild ── */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <FileText className="h-5 w-5 text-blue-600" />
                            {t('Generated Balance Sheets')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {balanceSheets.length === 0 ? (
                            <p className="text-sm text-gray-500">{t('No balance sheets generated yet.')}</p>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>{t('Date')}</TableHead>
                                        <TableHead>{t('Year')}</TableHead>
                                        <TableHead className="text-right">{t('Assets')}</TableHead>
                                        <TableHead className="text-right">{t('Liabilities')}</TableHead>
                                        <TableHead className="text-right">{t('Net Assets')}</TableHead>
                                        <TableHead className="text-right">{t('Liab + Net Assets')}</TableHead>
                                        <TableHead>{t('Status')}</TableHead>
                                        <TableHead>{t('Actions')}</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {balanceSheets.map(bs => {
                                        const sum = parseFloat(String(bs.total_liabilities)) + parseFloat(String(bs.total_equity));
                                        const assets = parseFloat(String(bs.total_assets));
                                        const gap = Math.abs(assets - sum);
                                        return (
                                            <TableRow key={bs.id}>
                                                <TableCell>{formatDate(bs.balance_sheet_date)}</TableCell>
                                                <TableCell>{bs.financial_year}</TableCell>
                                                <TableCell className="text-right tabular-nums">{formatCurrency(bs.total_assets)}</TableCell>
                                                <TableCell className="text-right tabular-nums">{formatCurrency(bs.total_liabilities)}</TableCell>
                                                <TableCell className="text-right tabular-nums">{formatCurrency(bs.total_equity)}</TableCell>
                                                <TableCell className={`text-right tabular-nums font-semibold ${gap > 0.01 ? 'text-red-600' : 'text-green-700'}`}>
                                                    {formatCurrency(sum)}
                                                    {gap > 0.01 && <span className="ml-2 text-xs">(off by {formatCurrency(gap)})</span>}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex gap-1 flex-wrap">
                                                        <Badge variant={bs.is_balanced ? 'default' : 'destructive'} className={bs.is_balanced ? 'bg-green-100 text-green-800' : ''}>
                                                            {bs.is_balanced ? t('Balanced') : t('Unbalanced')}
                                                        </Badge>
                                                        <Badge variant={bs.status === 'finalized' ? 'default' : 'secondary'} className={bs.status === 'finalized' ? 'bg-green-100 text-green-800' : ''}>
                                                            {t(bs.status === 'finalized' ? 'Finalized' : 'Draft')}
                                                        </Badge>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex gap-2">
                                                        <Button
                                                            variant="outline" size="sm"
                                                            onClick={() => router.visit(route('double-entry.balance-sheets.show', bs.id))}
                                                        >
                                                            {t('View')}
                                                        </Button>
                                                        {bs.status !== 'finalized' && (
                                                            <Button
                                                                variant="outline" size="sm"
                                                                onClick={() => handleRebuild(bs.id)}
                                                                title={t('Delete this draft and re-generate from current journal data')}
                                                            >
                                                                <RefreshCw className="h-3 w-3 mr-1" />
                                                                {t('Rebuild')}
                                                            </Button>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        )}
                        <p className="text-xs text-gray-400 mt-3">
                            {t('Rebuild re-generates the balance sheet from live journal data. Only available for draft statements.')}
                        </p>
                    </CardContent>
                </Card>

            </div>
        </AuthenticatedLayout>
    );
}
