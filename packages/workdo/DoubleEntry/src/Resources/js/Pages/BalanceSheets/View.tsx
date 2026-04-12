import React, { useState } from 'react';
import { Head, usePage, router, useForm } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import AuthenticatedLayout from "@/layouts/authenticated-layout";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle, FileText, Printer, Plus, GitCompare, LayoutGrid, Columns, Trash2, Calendar, Activity } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { useDeleteHandler } from '@/hooks/useDeleteHandler';
import { BalanceSheetViewProps } from './types';
import { formatDate, formatCurrency } from '@/utils/helpers';
import Note from './Note';
import Compare from './Compare';
import Generate from './Generate';
import YearEndClose from './YearEndClose';

// Human-readable labels for IPSAS sub-sections
const SUB_SECTION_LABELS: Record<string, string> = {
    current_assets:          'Current Assets',
    non_current_assets:      'Non-Current Assets',
    // legacy keys generated before the IPSAS migration
    other_assets:            'Non-Current Assets',
    fixed_assets:            'Non-Current Assets',
    current_liabilities:     'Current Liabilities',
    non_current_liabilities: 'Non-Current Liabilities',
    long_term_liabilities:   'Non-Current Liabilities',
    net_assets:              'Net Assets',
    equity:                  'Net Assets',
};

const SECTION_LABELS: Record<string, string> = {
    assets:      'ASSETS',
    liabilities: 'LIABILITIES',
    net_assets:  'NET ASSETS',
    equity:      'NET ASSETS', // legacy
};

export default function View() {
    const { t } = useTranslation();
    const {
        balanceSheet,
        groupedItems,
        allBalanceSheets,
        otherBalanceSheets,
        auth,
        priorYearGroupedItems,
        priorYearTotals,
        isAudited,
        priorYear,
    } = usePage<BalanceSheetViewProps>().props;

    const [showNoteModal, setShowNoteModal]         = useState(false);
    const [showCompareModal, setShowCompareModal]   = useState(false);
    const [showGenerateModal, setShowGenerateModal] = useState(false);
    const [showYearEndModal, setShowYearEndModal]   = useState(false);
    const [viewType, setViewType]                   = useState<'vertical' | 'horizontal'>('horizontal');

    const { deleteState, openDeleteDialog, closeDeleteDialog, confirmDelete } = useDeleteHandler({
        routeName: 'double-entry.balance-sheets.delete-note',
        defaultMessage: t('Are you sure you want to delete this note?')
    });

    const handleFinalize = () => {
        router.post(route('double-entry.balance-sheets.finalize', balanceSheet.id), {}, {
            preserveState: true,
        });
    };

    const handleDeleteNote = (noteId: number) => {
        openDeleteDialog([balanceSheet.id, noteId]);
    };

    // Merge any legacy sub-section keys so old stored data still displays correctly
    const normaliseGrouped = (raw: any) => {
        if (!raw) return null;
        const out: Record<string, Record<string, any[]>> = {};
        for (const [sType, subs] of Object.entries(raw as Record<string, any>)) {
            const normSType = (sType === 'equity') ? 'net_assets' : sType;
            if (!out[normSType]) out[normSType] = {};
            for (const [sub, items] of Object.entries(subs as Record<string, any[]>)) {
                const normSub = SUB_SECTION_LABELS[sub]
                    ? (sub === 'other_assets' || sub === 'fixed_assets'   ? 'non_current_assets'
                    : sub === 'long_term_liabilities'                     ? 'non_current_liabilities'
                    : sub === 'equity'                                    ? 'net_assets'
                    : sub)
                    : sub;
                if (!out[normSType][normSub]) out[normSType][normSub] = [];
                out[normSType][normSub] = [...out[normSType][normSub], ...(items as any[])];
            }
        }
        return out;
    };

    const normGrouped      = normaliseGrouped(groupedItems)      ?? {};
    const normPriorGrouped = normaliseGrouped(priorYearGroupedItems);

    // Compute section totals from items
    const sectionTotal = (sectionData: Record<string, any[]> | undefined): number => {
        if (!sectionData) return 0;
        return Object.values(sectionData).flat().reduce((s, i) => s + parseFloat((i as any).amount ?? '0'), 0);
    };

    // Sum the prior year amount for a specific sub-section
    const priorSubTotal = (sType: string, sub: string): number => {
        if (!normPriorGrouped) return 0;
        return ((normPriorGrouped[sType] ?? {})[sub] ?? [])
            .reduce((s: number, i: any) => s + parseFloat(i.amount ?? '0'), 0);
    };

    const renderSection = (sectionType: string, sectionTitle: string) => {
        const sectionData = normGrouped[sectionType];
        if (!sectionData) return null;

        let sectionRunningTotal = 0;

        return (
            <div className="mb-8">
                <h3 className="text-xl font-bold text-gray-800 mb-6">{sectionTitle}</h3>

                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[50%]">{t('Account')}</TableHead>
                            <TableHead className="w-[10%] text-center">{t('Code')}</TableHead>
                            <TableHead className="w-[20%] text-right">{t('Current Year')}</TableHead>
                            {normPriorGrouped && (
                                <TableHead className="w-[20%] text-right text-gray-500">{priorYear}</TableHead>
                            )}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {Object.entries(sectionData).map(([sub, items]) => {
                            const subTotal  = (items as any[]).reduce((s, i) => s + parseFloat(i.amount ?? '0'), 0);
                            const priorSub  = priorSubTotal(sectionType, sub);
                            sectionRunningTotal += subTotal;

                            return (
                                <React.Fragment key={sub}>
                                    <TableRow key={`${sub}-header`}>
                                        <TableCell colSpan={normPriorGrouped ? 4 : 3} className="font-semibold text-gray-700">
                                            {t(SUB_SECTION_LABELS[sub] ?? sub.replace(/_/g, ' '))}
                                        </TableCell>
                                    </TableRow>
                                    {(items as any[]).map((item) => (
                                        <TableRow key={item.id ?? item.account_code}>
                                            <TableCell className="font-medium text-green-600 pl-6">
                                                {item.account?.account_name ?? item.account_name}
                                            </TableCell>
                                            <TableCell className="text-center text-green-600">
                                                {item.account?.account_code ?? item.account_code}
                                            </TableCell>
                                            <TableCell className="text-right font-semibold text-green-600 tabular-nums">
                                                {formatCurrency(item.amount)}
                                            </TableCell>
                                            {normPriorGrouped && (
                                                <TableCell className="text-right text-gray-500 tabular-nums">—</TableCell>
                                            )}
                                        </TableRow>
                                    ))}
                                    <TableRow key={`${sub}-total`} className="border-b-2">
                                        <TableCell className="font-semibold pl-6">
                                            {t('Total')} {t(SUB_SECTION_LABELS[sub] ?? sub.replace(/_/g, ' '))}
                                        </TableCell>
                                        <TableCell />
                                        <TableCell className="text-right font-bold tabular-nums">
                                            {formatCurrency(subTotal)}
                                        </TableCell>
                                        {normPriorGrouped && (
                                            <TableCell className="text-right font-bold text-gray-500 tabular-nums">
                                                {priorSub !== 0 ? formatCurrency(priorSub) : '—'}
                                            </TableCell>
                                        )}
                                    </TableRow>
                                </React.Fragment>
                            );
                        })}
                        <TableRow className="border-t-2 border-gray-400">
                            <TableCell className="font-bold text-lg">{t('TOTAL')} {sectionTitle}</TableCell>
                            <TableCell />
                            <TableCell className="text-right font-bold text-lg tabular-nums">
                                {formatCurrency(sectionRunningTotal)}
                            </TableCell>
                            {normPriorGrouped && (
                                <TableCell className="text-right font-bold text-lg text-gray-500 tabular-nums">
                                    {formatCurrency(sectionTotal(normPriorGrouped[sectionType]))}
                                </TableCell>
                            )}
                        </TableRow>
                    </TableBody>
                </Table>
            </div>
        );
    };

    const currentYear = balanceSheet.financial_year;
    const totalAssets     = sectionTotal(normGrouped['assets']);
    const totalLiab       = sectionTotal(normGrouped['liabilities']);
    const totalNetAssets  = sectionTotal(normGrouped['net_assets']);

    return (
        <AuthenticatedLayout
            breadcrumbs={[
                {label: t('Double Entry')},
                {label: t('Statement of Financial Position'), url: route('double-entry.balance-sheets.list')},
                {label: `${formatDate(balanceSheet.balance_sheet_date)}`}
            ]}
            pageTitle={`${t('Statement of Financial Position')} — ${formatDate(balanceSheet.balance_sheet_date)}`}
            pageActions={
                <div className="flex items-center gap-2">
                    <TooltipProvider>
                        {auth.user?.permissions?.includes('manage-balance-sheets') && (
                            <Tooltip delayDuration={0}>
                                <TooltipTrigger asChild>
                                    <Button variant="outline" size="sm" onClick={() => router.get(route('double-entry.balance-sheets.list'))}>
                                        <FileText className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>{t('All Statements')}</p></TooltipContent>
                            </Tooltip>
                        )}
                        {auth.user?.permissions?.includes('view-balance-sheet-comparisons') && (
                            <Tooltip delayDuration={0}>
                                <TooltipTrigger asChild>
                                    <Button variant="outline" size="sm" onClick={() => router.get(route('double-entry.balance-sheets.comparisons'))}>
                                        <GitCompare className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>{t('View Comparisons')}</p></TooltipContent>
                            </Tooltip>
                        )}
                        {auth.user?.permissions?.includes('year-end-close') && (
                            <Tooltip delayDuration={0}>
                                <TooltipTrigger asChild>
                                    <Button variant="outline" size="sm" onClick={() => setShowYearEndModal(true)}>
                                        <Calendar className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>{t('Year-End Close')}</p></TooltipContent>
                            </Tooltip>
                        )}
                        {auth.user?.permissions?.includes('manage-balance-sheets') && (
                            <Tooltip delayDuration={0}>
                                <TooltipTrigger asChild>
                                    <Button variant="outline" size="sm"
                                        onClick={() => router.visit(route('double-entry.diagnostics.index'))}
                                        className={!balanceSheet.is_balanced ? 'border-red-400 text-red-600 hover:bg-red-50' : ''}>
                                        <Activity className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>{t('Diagnostics')}</p></TooltipContent>
                            </Tooltip>
                        )}
                        <div className="flex items-center border rounded-lg">
                            <Tooltip delayDuration={0}>
                                <TooltipTrigger asChild>
                                    <Button variant={viewType === 'vertical' ? 'default' : 'ghost'} size="sm"
                                        onClick={() => setViewType('vertical')} className="rounded-r-none">
                                        <LayoutGrid className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>{t('Vertical View')}</p></TooltipContent>
                            </Tooltip>
                            <Tooltip delayDuration={0}>
                                <TooltipTrigger asChild>
                                    <Button variant={viewType === 'horizontal' ? 'default' : 'ghost'} size="sm"
                                        onClick={() => setViewType('horizontal')} className="rounded-l-none">
                                        <Columns className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>{t('Horizontal View')}</p></TooltipContent>
                            </Tooltip>
                        </div>
                        {auth.user?.permissions?.includes('create-balance-sheets') && (
                            <Tooltip delayDuration={0}>
                                <TooltipTrigger asChild>
                                    <Button size="sm" onClick={() => setShowGenerateModal(true)}>
                                        <Plus className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>{t('Generate Statement')}</p></TooltipContent>
                            </Tooltip>
                        )}
                    </TooltipProvider>
                </div>
            }
        >
            <Head title={`${t('Statement of Financial Position')} — ${formatDate(balanceSheet.balance_sheet_date)}`} />

            <div className="max-w-7xl mx-auto space-y-6">
                <Note open={showNoteModal} onOpenChange={setShowNoteModal} balanceSheetId={balanceSheet.id} />
                <Compare open={showCompareModal} onOpenChange={setShowCompareModal}
                    balanceSheetId={balanceSheet.id} otherBalanceSheets={otherBalanceSheets} />
                <Generate open={showGenerateModal} onOpenChange={setShowGenerateModal} />
                <YearEndClose open={showYearEndModal} onOpenChange={setShowYearEndModal} />

                {/* Header Card */}
                <Card className="shadow-lg border-0 bg-gradient-to-r from-white to-gray-50">
                    <CardHeader className="pb-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-blue-50 rounded-lg border flex items-center justify-center">
                                    <FileText className="w-5 h-5 text-blue-600" />
                                </div>
                                <div>
                                    <CardTitle className="text-xl">{t('Statement of Financial Position')}</CardTitle>
                                    <p className="text-sm text-gray-600">
                                        {t('As of')} {formatDate(balanceSheet.balance_sheet_date)}&nbsp;|&nbsp;
                                        {t('Financial Year')}: {currentYear}&nbsp;|&nbsp;
                                        <span className="text-gray-400">{t('Amounts in GHS')}</span>
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {allBalanceSheets && allBalanceSheets.length > 0 && (
                                    <Select value={balanceSheet.id.toString()}
                                        onValueChange={(v) => router.visit(route('double-entry.balance-sheets.show', v))}>
                                        <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {allBalanceSheets.map((s: any) => (
                                                <SelectItem key={s.id} value={s.id.toString()}>
                                                    {formatDate(s.balance_sheet_date)}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                                {auth.user?.permissions?.includes('create-balance-sheet-notes') && (
                                    <Button variant="outline" size="sm" onClick={() => setShowNoteModal(true)}>
                                        <Plus className="h-4 w-4 mr-2" />{t('Add Note')}
                                    </Button>
                                )}
                                {auth.user?.permissions?.includes('create-balance-sheet-comparisons') && (
                                    <Button variant="outline" size="sm" onClick={() => setShowCompareModal(true)}>
                                        <GitCompare className="h-4 w-4 mr-2" />{t('Compare')}
                                    </Button>
                                )}
                                {auth.user?.permissions?.includes('print-balance-sheets') && (
                                    <Button variant="outline" size="sm" onClick={() => {
                                        const url = route('double-entry.balance-sheets.print', balanceSheet.id) + '?download=pdf';
                                        window.open(url, '_blank');
                                    }}>
                                        <Printer className="h-4 w-4 mr-2" />{t('Download PDF')}
                                    </Button>
                                )}
                                {auth.user?.permissions?.includes('finalize-balance-sheets') &&
                                    balanceSheet.status === 'draft' && balanceSheet.is_balanced && (
                                    <Button size="sm" onClick={handleFinalize}>
                                        <CheckCircle className="h-4 w-4 mr-2" />{t('Finalize')}
                                    </Button>
                                )}
                                <div className="flex items-center gap-2 ml-2">
                                    {!isAudited && (
                                        <span className="px-2 py-1 rounded-full text-sm bg-amber-100 text-amber-800 font-medium border border-amber-300">
                                            {t('Unaudited')}
                                        </span>
                                    )}
                                    <span className={`px-2 py-1 rounded-full text-sm ${
                                        balanceSheet.is_balanced ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                    }`}>
                                        {t(balanceSheet.is_balanced ? 'Balanced' : 'Unbalanced')}
                                    </span>
                                    <span className={`px-2 py-1 rounded-full text-sm ${
                                        balanceSheet.status === 'finalized' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                    }`}>
                                        {t(balanceSheet.status === 'finalized' ? 'Finalized' : 'Draft')}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="text-center p-6 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl border border-emerald-200 shadow-sm hover:shadow-md transition-shadow">
                                <h4 className="font-semibold text-emerald-700 mb-2">{t('Total Assets')}</h4>
                                <p className="text-3xl font-bold text-emerald-900 tabular-nums">{formatCurrency(balanceSheet.total_assets)}</p>
                                {priorYearTotals && (
                                    <p className="text-xs text-gray-500 mt-1">{priorYear}: {formatCurrency((priorYearTotals as any).total_assets)}</p>
                                )}
                            </div>
                            <div className="text-center p-6 bg-gradient-to-br from-rose-50 to-rose-100 rounded-xl border border-rose-200 shadow-sm hover:shadow-md transition-shadow">
                                <h4 className="font-semibold text-rose-700 mb-2">{t('Total Liabilities')}</h4>
                                <p className="text-3xl font-bold text-rose-900 tabular-nums">{formatCurrency(balanceSheet.total_liabilities)}</p>
                                {priorYearTotals && (
                                    <p className="text-xs text-gray-500 mt-1">{priorYear}: {formatCurrency((priorYearTotals as any).total_liabilities)}</p>
                                )}
                            </div>
                            <div className="text-center p-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200 shadow-sm hover:shadow-md transition-shadow">
                                <h4 className="font-semibold text-blue-700 mb-2">{t('Total Net Assets')}</h4>
                                <p className="text-3xl font-bold text-blue-900 tabular-nums">{formatCurrency(balanceSheet.total_equity)}</p>
                                {priorYearTotals && (
                                    <p className="text-xs text-gray-500 mt-1">{priorYear}: {formatCurrency((priorYearTotals as any).total_net_assets)}</p>
                                )}
                            </div>
                        </div>

                        {!balanceSheet.is_balanced && (
                            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start justify-between gap-4">
                                <div>
                                    <p className="text-red-800 font-medium">
                                        ⚠️ {t('Warning: This statement is not balanced!')}
                                    </p>
                                    <p className="text-red-700 text-sm mt-1">
                                        {t('Total Assets should equal Total Liabilities + Total Net Assets.')}
                                        {' '}{t('Use Diagnostics to locate the source of the imbalance and apply a correction.')}
                                    </p>
                                </div>
                                <Button size="sm" variant="destructive"
                                    onClick={() => router.visit(route('double-entry.diagnostics.index'))}>
                                    <Activity className="h-4 w-4 mr-1" />
                                    {t('Diagnose')}
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Statement Body */}
                <Card className="shadow-lg border-0">
                    <CardContent className="p-8">
                        <div className="mb-8">
                            <h2 className="text-2xl font-bold text-gray-900 mb-1">
                                {t('Statement of Financial Position')}
                            </h2>
                            <p className="text-sm text-gray-500">
                                {t('As of')} {formatDate(balanceSheet.balance_sheet_date)}&nbsp;·&nbsp;{t('Amounts in GHS')}
                            </p>
                        </div>

                        {viewType === 'vertical' ? (
                            <>
                                {renderSection('assets', t('ASSETS'))}
                                {renderSection('liabilities', t('LIABILITIES'))}
                                {renderSection('net_assets', t('NET ASSETS'))}

                                {/* Balancing check row */}
                                <div className="mt-8 pt-6 border-t-4 border-gray-800">
                                    <div className="flex justify-between items-center py-3 font-bold text-lg">
                                        <span>{t('TOTAL LIABILITIES AND NET ASSETS')}</span>
                                        <span className="tabular-nums">{formatCurrency(totalLiab + totalNetAssets)}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-3 font-bold text-lg border-t-2 border-gray-300">
                                        <span>{t('TOTAL ASSETS')}</span>
                                        <span className="tabular-nums">{formatCurrency(totalAssets)}</span>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                                {/* Left — Liabilities & Net Assets */}
                                <div>
                                    <h3 className="text-xl font-bold text-gray-800 mb-6">{t('Liabilities & Net Assets')}</h3>

                                    {/* Net Assets */}
                                    {normGrouped['net_assets'] && (
                                        <div className="mb-6">
                                            <h4 className="font-semibold text-gray-700 mb-3">{t('Net Assets')}</h4>
                                            {Object.entries(normGrouped['net_assets']).map(([sub, items]) => (
                                                <div key={sub} className="mb-4">
                                                    {(items as any[]).map((item) => (
                                                        <div key={item.id ?? item.account_code} className="flex justify-between py-1 text-sm">
                                                            <span className="text-green-600">{item.account?.account_name ?? item.account_name}</span>
                                                            <span className="text-green-600 tabular-nums">{formatCurrency(item.amount)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            ))}
                                            <div className="flex justify-between py-2 font-semibold border-b">
                                                <span>{t('Total Net Assets')}</span>
                                                <span className="tabular-nums">{formatCurrency(totalNetAssets)}</span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Liabilities */}
                                    {normGrouped['liabilities'] && (
                                        <div className="mb-6">
                                            <h4 className="font-semibold text-gray-700 mb-3">{t('Liabilities')}</h4>
                                            {Object.entries(normGrouped['liabilities']).map(([sub, items]) => {
                                                const subTotal = (items as any[]).reduce((s, i) => s + parseFloat(i.amount ?? '0'), 0);
                                                return (
                                                    <div key={sub} className="mb-4">
                                                        <h5 className="font-medium text-gray-600 mb-2">{t(SUB_SECTION_LABELS[sub] ?? sub.replace(/_/g, ' '))}</h5>
                                                        {(items as any[]).map((item) => (
                                                            <div key={item.id ?? item.account_code} className="flex justify-between items-center py-1 text-sm ml-4">
                                                                <div className="flex justify-between w-full">
                                                                    <span className="text-green-600">{item.account?.account_name ?? item.account_name}</span>
                                                                    <div className="flex gap-8">
                                                                        <span className="text-gray-600">{item.account?.account_code ?? item.account_code}</span>
                                                                        <span className="text-green-600 tabular-nums">{formatCurrency(item.amount)}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                        <div className="flex justify-between py-2 font-medium border-b ml-4">
                                                            <span>{t('Total')} {t(SUB_SECTION_LABELS[sub] ?? sub.replace(/_/g, ' '))}</span>
                                                            <span className="tabular-nums">{formatCurrency(subTotal)}</span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            <div className="flex justify-between py-2 font-semibold border-b">
                                                <span>{t('Total Liabilities')}</span>
                                                <span className="tabular-nums">{formatCurrency(totalLiab)}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Right — Assets */}
                                <div>
                                    <h3 className="text-xl font-bold text-gray-800 mb-6">{t('Assets')}</h3>
                                    {normGrouped['assets'] && (
                                        <div>
                                            {Object.entries(normGrouped['assets']).map(([sub, items]) => {
                                                const subTotal = (items as any[]).reduce((s, i) => s + parseFloat(i.amount ?? '0'), 0);
                                                return (
                                                    <div key={sub} className="mb-6">
                                                        <h5 className="font-medium text-gray-600 mb-2">{t(SUB_SECTION_LABELS[sub] ?? sub.replace(/_/g, ' '))}</h5>
                                                        {(items as any[]).map((item) => (
                                                            <div key={item.id ?? item.account_code} className="flex justify-between items-center py-1 text-sm ml-4">
                                                                <div className="flex justify-between w-full">
                                                                    <span className="text-green-600">{item.account?.account_name ?? item.account_name}</span>
                                                                    <div className="flex gap-8">
                                                                        <span className="text-gray-600">{item.account?.account_code ?? item.account_code}</span>
                                                                        <span className="text-green-600 tabular-nums">{formatCurrency(item.amount)}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                        <div className="flex justify-between py-2 font-medium border-b ml-4">
                                                            <span>{t('Total')} {t(SUB_SECTION_LABELS[sub] ?? sub.replace(/_/g, ' '))}</span>
                                                            <span className="tabular-nums">{formatCurrency(subTotal)}</span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Balance Totals — always shown */}
                        <div className="mt-8 pt-6 border-t-2 border-gray-400">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                                <div className="flex justify-between py-3 font-bold text-lg">
                                    <span>{t('Total Liabilities & Net Assets')}</span>
                                    <span className="tabular-nums">{formatCurrency(totalLiab + totalNetAssets)}</span>
                                </div>
                                <div className="flex justify-between py-3 font-bold text-lg">
                                    <span>{t('Total Assets')}</span>
                                    <span className="tabular-nums">{formatCurrency(totalAssets)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Notes */}
                        {balanceSheet.notes && balanceSheet.notes.length > 0 && (
                            <div className="mt-8 pt-6 border-t">
                                <h3 className="text-lg font-semibold mb-4">{t('Notes to Financial Statements')}</h3>
                                <div className="space-y-4">
                                    {balanceSheet.notes.map((note: any) => (
                                        <div key={note.id} className="p-4 bg-gray-50 rounded-lg">
                                            <div className="flex justify-between items-start">
                                                <div className="flex-1">
                                                    <h4 className="font-medium">
                                                        {t('Note')} {note.note_number}: {note.note_title}
                                                    </h4>
                                                    <p className="text-gray-700 mt-2">{note.note_content}</p>
                                                </div>
                                                {auth.user?.permissions?.includes('delete-balance-sheet-notes') && (
                                                    <Tooltip delayDuration={0}>
                                                        <TooltipTrigger asChild>
                                                            <Button variant="ghost" size="sm"
                                                                onClick={() => handleDeleteNote(note.id)}
                                                                className="h-8 w-8 p-0 text-destructive hover:text-destructive">
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent><p>{t('Delete Note')}</p></TooltipContent>
                                                    </Tooltip>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <ConfirmationDialog
                    open={deleteState.isOpen}
                    onOpenChange={closeDeleteDialog}
                    title={t('Delete Note')}
                    message={deleteState.message}
                    confirmText={t('Delete')}
                    onConfirm={confirmDelete}
                    variant="destructive"
                />
            </div>
        </AuthenticatedLayout>
    );
}
