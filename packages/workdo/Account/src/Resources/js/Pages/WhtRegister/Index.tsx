import { useState } from 'react';
import { Head, usePage, router } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import AuthenticatedLayout from "@/layouts/authenticated-layout";
import { Button } from '@/components/ui/button';
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { SearchInput } from "@/components/ui/search-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, FileText, Download } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDate, formatCurrency } from '@/utils/helpers';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import NoRecordsFound from '@/components/no-records-found';
import { Pagination } from "@/components/ui/pagination";

export default function WhtRegisterIndex() {
    const { t } = useTranslation();
    const { entries, filters: initialFilters, auth } = usePage<any>().props;

    const [filters, setFilters] = useState({
        remittance_status: initialFilters?.remittance_status || '',
        search: initialFilters?.search || '',
        date_range: ''
    });

    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [isIssuing, setIsIssuing] = useState(false);
    const [isMarkingRemitted, setIsMarkingRemitted] = useState(false);

    const handleFilter = () => {
        const filterParams: any = { ...filters };
        if (filters.date_range) {
            const [fromDate, toDate] = filters.date_range.split(' - ');
            filterParams.date_from = fromDate;
            filterParams.date_to = toDate;
        }

        router.get(route('account.wht-register.index'), filterParams, {
            preserveState: true,
            replace: true
        });
    };

    const handleBatchIssue = async () => {
        if (!selectedIds.length) return;
        setIsIssuing(true);
        
        try {
            for (const id of selectedIds) {
                // We use router.post in a way that handles each request
                await new Promise((resolve) => {
                    router.post(route('account.wht-register.issue-certificate', id), {}, {
                        onFinish: () => resolve(true),
                        preserveScroll: true
                    });
                });
            }
        } finally {
            setIsIssuing(false);
            setSelectedIds([]);
        }
    };

    const handleBatchRemit = () => {
        if (!selectedIds.length) return;
        setIsMarkingRemitted(true);
        router.post(route('account.wht-register.remit'), { 
            ids: selectedIds, 
            remitted_date: new Date().toISOString().split('T')[0],
            remittance_reference: 'BATCH-' + Date.now()
        }, {
            onFinish: () => {
                setIsMarkingRemitted(false);
                setSelectedIds([]);
            }
        });
    };

    const tableColumns = [
        {
            key: 'checkbox',
            header: (
                <input 
                    type="checkbox" 
                    onChange={(e) => {
                        if (e.target.checked) {
                            setSelectedIds(entries.data.map((r: any) => r.id));
                        } else {
                            setSelectedIds([]);
                        }
                    }}
                    checked={entries.data.length > 0 && selectedIds.length === entries.data.length}
                    className="rounded border-gray-300"
                />
            ),
            sortable: false,
            render: (_: any, record: any) => (
                <input 
                    type="checkbox"
                    checked={selectedIds.includes(record.id)}
                    onChange={(e) => {
                        if (e.target.checked) setSelectedIds([...selectedIds, record.id]);
                        else setSelectedIds(selectedIds.filter(id => id !== record.id));
                    }}
                    className="rounded border-gray-300"
                />
            )
        },
        {
            key: 'payment_date',
            header: t('Date'),
            sortable: true,
            render: (value: string) => formatDate(value)
        },
        {
            key: 'vendor_name',
            header: t('Vendor / TIN'),
            sortable: true,
            render: (_: any, r: any) => (
                <div>
                    <div className="font-medium">{r.vendor_name}</div>
                    <div className="text-xs text-gray-500">{r.vendor_tin || 'No TIN'}</div>
                </div>
            )
        },
        {
            key: 'invoice_number',
            header: t('Invoice / PV'),
            sortable: false,
            render: (_: any, r: any) => (
                <div className="flex flex-col gap-1">
                    <span>{r.invoice_number || '-'}</span>
                    {r.payment?.pv_number && (
                        <span className="text-xs text-purple-600 font-mono">{r.payment.pv_number}</span>
                    )}
                </div>
            )
        },
        {
            key: 'gross_amount',
            header: t('Gross Amt'),
            sortable: true,
            render: (value: number) => formatCurrency(value)
        },
        {
            key: 'wht_amount',
            header: t('WHT Amt'),
            sortable: true,
            render: (value: number, r: any) => (
                <div className="font-semibold text-red-600 flex items-center gap-1">
                    {formatCurrency(value)}
                    <span className="text-xs font-normal text-gray-500">({r.wht_rate}%)</span>
                </div>
            )
        },
        {
            key: 'wht_certificate_number',
            header: t('Certificate'),
            sortable: true,
            render: (value: string, r: any) => value ? (
                <div className="flex flex-col gap-1">
                    <span className="text-xs font-mono bg-blue-50 text-blue-800 px-2 py-1 rounded">{value}</span>
                    <span className="text-[10px] text-gray-500">Issued: {formatDate(r.certificate_issued_date)}</span>
                </div>
            ) : <span className="text-gray-400 text-xs italic">{t('Not issued')}</span>
        },
        {
            key: 'remittance_status',
            header: t('GRA Status'),
            sortable: true,
            render: (value: string) => (
                <Badge variant={value === 'remitted' ? 'success' : 'warning'}>
                    {t(value)}
                </Badge>
            )
        },
        {
            key: 'actions',
            header: t('Actions'),
            render: (_: any, r: any) => (
                <div className="flex gap-1">
                    {!r.wht_certificate_number && (
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700"
                            onClick={() => router.post(route('account.wht-register.issue-certificate', r.id))}
                        >
                            <FileText className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            )
        }
    ];

    return (
        <AuthenticatedLayout
            breadcrumbs={[{ label: t('Accounting') }, { label: t('WHT Register') }]}
            pageTitle={t('GRA Withholding Tax (WHT) Register')}
        >
            <Head title={t('WHT Register')} />

            <div className="space-y-4">
                <Card>
                    <CardContent className="p-4 flex flex-wrap gap-4 items-end">
                        <div className="flex-1 min-w-[200px]">
                            <SearchInput 
                                placeholder={t('Search Vendor or TIN')}
                                value={filters.search}
                                onChange={(v) => setFilters({...filters, search: v})}
                                onSearch={() => handleFilter()}
                            />
                        </div>
                        <div className="w-48">
                            <Select 
                                value={filters.remittance_status} 
                                onValueChange={(v) => setFilters({...filters, remittance_status: v === 'all' ? '' : v})}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder={t('All Statuses')} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">{t('All Statuses')}</SelectItem>
                                    <SelectItem value="pending">{t('Pending Remittance')}</SelectItem>
                                    <SelectItem value="remitted">{t('Remitted to GRA')}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="w-64">
                            <DateRangePicker 
                                value={filters.date_range}
                                onChange={(v: string) => setFilters({...filters, date_range: v})}
                            />
                        </div>
                        <Button onClick={handleFilter} variant="default">{t('Filter')}</Button>
                    </CardContent>
                </Card>

                <Card>
                    <div className="flex items-center justify-between p-4 border-b">
                        <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{t('WHT Deductions')}</h3>
                            <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => window.open(route('account.wht-register.print') + `?date_from=${filters.date_range.split(' - ')[0] || ''}&date_to=${filters.date_range.split(' - ')[1] || ''}&remittance_status=${filters.remittance_status}`, '_blank')}
                            >
                                <Download className="h-4 w-4 mr-1" />
                                {t('Print Report')}
                            </Button>
                        </div>
                        
                        {selectedIds.length > 0 && (
                            <div className="flex gap-2">
                                <Button 
                                    size="sm" 
                                    variant="outline" 
                                    className="border-blue-200 text-blue-700"
                                    onClick={handleBatchIssue}
                                    disabled={isIssuing}
                                >
                                    <FileText className="h-4 w-4 mr-2" />
                                    {isIssuing ? t('Processing...') : t('Issue Certificates')}
                                </Button>
                                <Button 
                                    size="sm" 
                                    className="bg-green-600 hover:bg-green-700 text-white"
                                    onClick={handleBatchRemit}
                                    disabled={isMarkingRemitted}
                                >
                                    <CheckCircle className="h-4 w-4 mr-2" />
                                    {isMarkingRemitted ? t('Processing...') : t('Mark as Remitted')}
                                </Button>
                            </div>
                        )}
                    </div>
                    {entries.data.length > 0 ? (
                        <>
                            <DataTable 
                                columns={tableColumns} 
                                data={entries.data} 
                                onSort={() => {}} 
                                sortField="" 
                                sortDirection="desc" 
                            />
                            <div className="p-4 border-t">
                                <Pagination links={entries.links} meta={entries} />
                            </div>
                        </>
                    ) : (
                        <NoRecordsFound icon={FileText} description={t("No WHT records found matching your filters")} />
                    )}
                </Card>
            </div>
        </AuthenticatedLayout>
    );
}
