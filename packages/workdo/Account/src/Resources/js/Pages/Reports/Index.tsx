import { useState, useEffect } from 'react';
import { Head, usePage } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import AuthenticatedLayout from "@/layouts/authenticated-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import InvoiceAging from './InvoiceAging';
import BillAging from './BillAging';
import TaxSummary from './TaxSummary';
import CustomerBalance from './CustomerBalance';
import VendorBalance from './VendorBalance';
import StatementOfPosition from './StatementOfPosition';
import StatementOfPerformance from './StatementOfPerformance';
import CashFlow from './CashFlow';
import BudgetVsActual from './BudgetVsActual';

interface ReportsIndexProps {
    auth: {
        user?: {
            permissions?: string[];
        };
    };
    financialYear?: {
        year_start_date: string;
        year_end_date: string;
    };
}

export default function Index() {
    const { t } = useTranslation();
    const { auth, financialYear } = usePage<ReportsIndexProps>().props;
    const [activeTab, setActiveTab] = useState('invoice-aging');

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const tab = params.get('tab');
        if (tab) {
            setActiveTab(tab);
        }
    }, []);

    const perms = auth.user?.permissions ?? [];

    const tabs = [
        // Standard accounting reports
        { id: 'invoice-aging',            label: t('Invoice Aging'),           permission: 'view-invoice-aging' },
        { id: 'bill-aging',               label: t('Bill Aging'),              permission: 'view-bill-aging' },
        { id: 'tax-summary',              label: t('Tax Summary'),             permission: 'view-tax-summary' },
        { id: 'customer-balance',         label: t('Customer Balance'),        permission: 'view-customer-balance' },
        { id: 'vendor-balance',           label: t('Vendor Balance'),          permission: 'view-vendor-balance' },
        // IPSAS Financial Statements
        { id: 'statement-of-position',    label: t('Fin. Position'),          permission: 'view-statement-of-position',    group: 'ipsas' },
        { id: 'statement-of-performance', label: t('Fin. Performance'),       permission: 'view-statement-of-performance', group: 'ipsas' },
        { id: 'cash-flow',                label: t('Cash Flow'),               permission: 'view-cash-flow',                group: 'ipsas' },
        { id: 'budget-vs-actual',         label: t('Budget vs Actual'),        permission: 'view-budget-vs-actual',         group: 'ipsas' },
    ].filter(tab => perms.includes(tab.permission));

    return (
        <AuthenticatedLayout
            breadcrumbs={[
                { label: t('Accounting'), url: route('account.index') },
                { label: t('Reports') },
            ]}
            pageTitle={t('Reports')}
        >
            <Head title={t('Reports')} />

            <Card className="shadow-sm">
                <CardContent className="p-6">
                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                        <TabsList className="w-full justify-start overflow-x-auto overflow-y-hidden h-auto p-1 flex-wrap gap-1">
                            {/* Standard */}
                            {tabs.filter(t => !t.group).map(tab => (
                                <TabsTrigger key={tab.id} value={tab.id} className="whitespace-nowrap flex-shrink-0">
                                    {tab.label}
                                </TabsTrigger>
                            ))}
                            {/* IPSAS divider */}
                            {tabs.some(t => t.group === 'ipsas') && (
                                <>
                                    <div className="w-px h-6 bg-gray-300 mx-1 self-center" />
                                    <span className="text-xs text-blue-600 font-semibold self-center px-1">IPSAS</span>
                                    {tabs.filter(t => t.group === 'ipsas').map(tab => (
                                        <TabsTrigger key={tab.id} value={tab.id} className="whitespace-nowrap flex-shrink-0 border border-blue-200 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                                            {tab.label}
                                        </TabsTrigger>
                                    ))}
                                </>
                            )}
                        </TabsList>

                        {/* Standard reports */}
                        <TabsContent value="invoice-aging" className="mt-4">
                            <InvoiceAging financialYear={financialYear} />
                        </TabsContent>
                        <TabsContent value="bill-aging" className="mt-4">
                            <BillAging financialYear={financialYear} />
                        </TabsContent>
                        <TabsContent value="tax-summary" className="mt-4">
                            <TaxSummary financialYear={financialYear} />
                        </TabsContent>
                        <TabsContent value="customer-balance" className="mt-4">
                            <CustomerBalance financialYear={financialYear} />
                        </TabsContent>
                        <TabsContent value="vendor-balance" className="mt-4">
                            <VendorBalance financialYear={financialYear} />
                        </TabsContent>

                        {/* IPSAS Financial Statements */}
                        <TabsContent value="statement-of-position" className="mt-4">
                            <StatementOfPosition financialYear={financialYear} />
                        </TabsContent>
                        <TabsContent value="statement-of-performance" className="mt-4">
                            <StatementOfPerformance financialYear={financialYear} />
                        </TabsContent>
                        <TabsContent value="cash-flow" className="mt-4">
                            <CashFlow financialYear={financialYear} />
                        </TabsContent>
                        <TabsContent value="budget-vs-actual" className="mt-4">
                            <BudgetVsActual financialYear={financialYear} />
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </AuthenticatedLayout>
    );
}
