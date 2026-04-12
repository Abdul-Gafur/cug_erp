import { useState, useEffect, useMemo } from 'react';
import { useForm } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import { DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CurrencyInput } from '@/components/ui/currency-input';
import { DatePicker } from '@/components/ui/date-picker';
import InputError from '@/components/ui/input-error';
import { Trash2, Calculator, FileText, Package, Landmark } from 'lucide-react';
import { CreateVendorPaymentFormData, CreateVendorPaymentProps, PurchaseInvoice, DebitNote } from './types';
import { formatCurrency } from '@/utils/helpers';

// ─── Ghana Revenue Authority Tax Calculator ───────────────────────────────────
function calcGraTaxes(base: number, supplierType: string, goodsOrServices: string) {
    const nhil    = Math.round(base * 0.025 * 100) / 100;
    const getfund = Math.round(base * 0.025 * 100) / 100;
    const chrl    = Math.round(base * 0.010 * 100) / 100;
    const vatBase = base + nhil + getfund + chrl;
    const vat     = Math.round(vatBase * 0.15 * 100) / 100;
    const gross   = Math.round((base + nhil + getfund + chrl + vat) * 100) / 100;

    let whtRate: number;
    if (supplierType === 'non_resident') {
        whtRate = goodsOrServices === 'goods' ? 15 : 20;
    } else {
        whtRate = goodsOrServices === 'goods' ? 3 : 5;
    }

    const wht        = Math.round(base * (whtRate / 100) * 100) / 100;
    const netPayable = Math.round((gross - wht) * 100) / 100;

    return { nhil, getfund, chrl, vatBase: Math.round(vatBase * 100) / 100, vat, gross, whtRate, wht, netPayable };
}

const fmt = (n: number) => n.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function Create({ vendors, bankAccounts, onSuccess }: CreateVendorPaymentProps) {
    const { t } = useTranslation();
    const [outstandingInvoices, setOutstandingInvoices] = useState<PurchaseInvoice[]>([]);
    const [availableDebitNotes, setAvailableDebitNotes] = useState<DebitNote[]>([]);
    const [selectedAllocations, setSelectedAllocations] = useState<{ invoice_id: number; amount: number }[]>([]);
    const [selectedDebitNotes, setSelectedDebitNotes] = useState<{ debit_note_id: number; amount: number }[]>([]);

    // Invoice submission state
    const [invoiceNumber, setInvoiceNumber]     = useState('');
    const [invoiceDate, setInvoiceDate]         = useState('');
    const [poReference, setPoReference]         = useState('');
    const [deliveryNote, setDeliveryNote]       = useState('');
    const [supplierType, setSupplierType]       = useState<'resident' | 'non_resident'>('resident');
    const [goodsOrServices, setGoodsOrServices] = useState<'goods' | 'services'>('goods');
    const [baseAmount, setBaseAmount]           = useState('');

    const { data, setData, post, processing, errors, transform } = useForm<CreateVendorPaymentFormData>({
        payment_date:    new Date().toISOString().split('T')[0],
        vendor_id:       '',
        bank_account_id: '',
        reference_number:'',
        payment_method:  '',
        cheque_number:   '',
        narration:       '',
        payment_amount:  '',
        notes:           '',
        allocations:     [],
        debit_notes:     [],
    });

    // Live GRA tax calculation
    const taxes = useMemo(() => {
        const b = parseFloat(baseAmount) || 0;
        if (b <= 0) return null;
        return calcGraTaxes(b, supplierType, goodsOrServices);
    }, [baseAmount, supplierType, goodsOrServices]);

    useEffect(() => { setData('allocations', selectedAllocations); }, [selectedAllocations]);
    useEffect(() => { setData('debit_notes', selectedDebitNotes); }, [selectedDebitNotes]);

    transform((data) => ({
        ...data,
        invoice_number: invoiceNumber,
        invoice_date: invoiceDate,
        po_reference: poReference,
        delivery_note_number: deliveryNote,
        supplier_type: supplierType,
        goods_or_services: goodsOrServices,
        base_amount: baseAmount
    }));

    // Sync payment amount from net payable when using tax calculator
    useEffect(() => {
        if (taxes && parseFloat(baseAmount) > 0) {
            setData('payment_amount', taxes.netPayable.toFixed(2));
        }
    }, [taxes]);

    const fetchOutstandingInvoices = async (vendorId: string) => {
        if (!vendorId) { setOutstandingInvoices([]); setAvailableDebitNotes([]); return; }
        try {
            const res  = await fetch(route('account.vendor-payments.vendors.outstanding', vendorId));
            const json = await res.json();
            setOutstandingInvoices(json.invoices || []);
            setAvailableDebitNotes(json.debitNotes || []);
        } catch { setOutstandingInvoices([]); setAvailableDebitNotes([]); }
    };

    useEffect(() => {
        if (data.vendor_id) { fetchOutstandingInvoices(data.vendor_id); }
        else { setOutstandingInvoices([]); setAvailableDebitNotes([]); }
        setSelectedAllocations([]);
        setSelectedDebitNotes([]);
        setData('payment_amount', '');
    }, [data.vendor_id]);

    const addAllocation = (inv: PurchaseInvoice) => {
        if (selectedAllocations.find(a => a.invoice_id === inv.id)) return;
        const next = [...selectedAllocations, { invoice_id: inv.id, amount: inv.balance_amount }];
        setSelectedAllocations(next);
        updateTotal(next, selectedDebitNotes);
    };

    const removeAllocation = (id: number) => {
        const next = selectedAllocations.filter(a => a.invoice_id !== id);
        setSelectedAllocations(next);
        updateTotal(next, selectedDebitNotes);
    };

    const updateAllocationAmount = (id: number, amount: number) => {
        const next = selectedAllocations.map(a => a.invoice_id === id ? { ...a, amount } : a);
        setSelectedAllocations(next);
        updateTotal(next, selectedDebitNotes);
    };

    const updateTotal = (allocs: { invoice_id: number; amount: number }[], dns = selectedDebitNotes) => {
        // Only auto-compute if not using GRA tax calculator
        if (!(taxes && parseFloat(baseAmount) > 0)) {
            const total = allocs.reduce((s, a) => s + Number(a.amount || 0), 0)
                        - dns.reduce((s, d) => s + Number(d.amount || 0), 0);
            setData('payment_amount', Math.max(0, total).toFixed(2));
        }
    };

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        post(route('account.vendor-payments.store'), { onSuccess });
    };

    const getInvoice = (id: number) => outstandingInvoices.find(i => i.id === id);

    return (
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-blue-600" />
                    {t('Create Vendor Payment')}
                </DialogTitle>
            </DialogHeader>

            <form onSubmit={submit} className="space-y-5">

                {/* ─── Step 1: Basic Payment Info ─────────────────────────── */}
                <Card>
                    <CardHeader className="py-3 px-4 bg-blue-50 border-b">
                        <CardTitle className="text-sm font-semibold text-blue-700 flex items-center gap-2">
                            <span className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">1</span>
                            {t('Payment Details')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="payment_date" required>{t('Payment Date')}</Label>
                                <DatePicker
                                    id="payment_date"
                                    value={data.payment_date}
                                    onChange={(v) => setData('payment_date', v instanceof Date ? v.toISOString().split('T')[0] : v)}
                                    placeholder={t('Select payment date')}
                                    required
                                />
                                <InputError message={errors.payment_date} />
                            </div>

                            <div>
                                <Label htmlFor="vendor_id" required>{t('Vendor')}</Label>
                                <Select value={data.vendor_id} onValueChange={(v) => setData('vendor_id', v)}>
                                    <SelectTrigger><SelectValue placeholder={t('Select Vendor')} /></SelectTrigger>
                                    <SelectContent>
                                        {vendors?.map(v => (
                                            <SelectItem key={v.id} value={v.id.toString()}>{v.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <InputError message={errors.vendor_id} />
                            </div>

                            <div>
                                <Label htmlFor="bank_account_id" required>{t('Bank Account')}</Label>
                                <Select value={data.bank_account_id} onValueChange={(v) => setData('bank_account_id', v)}>
                                    <SelectTrigger><SelectValue placeholder={t('Select Bank Account')} /></SelectTrigger>
                                    <SelectContent>
                                        {bankAccounts?.map(a => (
                                            <SelectItem key={a.id} value={a.id.toString()}>
                                                {a.account_name} ({a.account_number})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <InputError message={errors.bank_account_id} />
                            </div>

                            <div>
                                <Label htmlFor="payment_method">{t('Payment Method')}</Label>
                                <Select value={data.payment_method} onValueChange={(v) => setData('payment_method', v)}>
                                    <SelectTrigger><SelectValue placeholder={t('Select method')} /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="bank_transfer">{t('Bank Transfer')}</SelectItem>
                                        <SelectItem value="cheque">{t('Cheque')}</SelectItem>
                                        <SelectItem value="electronic">{t('Electronic Payment')}</SelectItem>
                                    </SelectContent>
                                </Select>
                                <InputError message={errors.payment_method} />
                            </div>

                            {data.payment_method === 'cheque' && (
                                <div>
                                    <Label htmlFor="cheque_number" required>{t('Cheque Number')}</Label>
                                    <Input
                                        id="cheque_number"
                                        value={data.cheque_number}
                                        onChange={(e) => setData('cheque_number', e.target.value)}
                                        placeholder={t('Enter cheque number')}
                                    />
                                    <InputError message={errors.cheque_number} />
                                </div>
                            )}

                            <div>
                                <Label htmlFor="reference_number">{t('Reference Number')}</Label>
                                <Input
                                    id="reference_number"
                                    value={data.reference_number}
                                    onChange={(e) => setData('reference_number', e.target.value)}
                                    placeholder={t('Internal reference')}
                                />
                                <InputError message={errors.reference_number} />
                            </div>
                        </div>
                        <div className="mt-4">
                            <Label htmlFor="narration">{t('Narration / Purpose')}</Label>
                            <Textarea
                                id="narration"
                                value={data.narration}
                                onChange={(e) => setData('narration', e.target.value)}
                                rows={2}
                                placeholder={t('Brief description of payment purpose')}
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* ─── Step 1b: Invoice Submission ────────────────────────── */}
                <Card>
                    <CardHeader className="py-3 px-4 bg-amber-50 border-b">
                        <CardTitle className="text-sm font-semibold text-amber-700 flex items-center gap-2">
                            <span className="bg-amber-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">2</span>
                            {t('Invoice Submission (Supplier Details)')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="invoice_number">{t('Supplier Invoice Number')}</Label>
                                <Input
                                    id="invoice_number"
                                    value={invoiceNumber}
                                    onChange={(e) => setInvoiceNumber(e.target.value)}
                                    placeholder={t('e.g. INV-2024-001')}
                                />
                            </div>
                            <div>
                                <Label htmlFor="invoice_date">{t('Invoice Date')}</Label>
                                <Input
                                    id="invoice_date"
                                    type="date"
                                    value={invoiceDate}
                                    onChange={(e) => setInvoiceDate(e.target.value)}
                                />
                            </div>
                            <div>
                                <Label htmlFor="po_reference">{t('Purchase Order Reference')}</Label>
                                <Input
                                    id="po_reference"
                                    value={poReference}
                                    onChange={(e) => setPoReference(e.target.value)}
                                    placeholder={t('e.g. LPO-2024-015')}
                                />
                            </div>
                            <div>
                                <Label htmlFor="delivery_note">{t('Delivery Note / GRN Number')}</Label>
                                <Input
                                    id="delivery_note"
                                    value={deliveryNote}
                                    onChange={(e) => setDeliveryNote(e.target.value)}
                                    placeholder={t('e.g. GRN-2024-030')}
                                />
                            </div>
                            <div>
                                <Label>{t('Supplier Type')}</Label>
                                <Select value={supplierType} onValueChange={(v: any) => setSupplierType(v)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="resident">{t('Resident (Ghana)')}</SelectItem>
                                        <SelectItem value="non_resident">{t('Non-Resident (Foreign)')}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>{t('Transaction Type')}</Label>
                                <Select value={goodsOrServices} onValueChange={(v: any) => setGoodsOrServices(v)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="goods">{t('Goods')}</SelectItem>
                                        <SelectItem value="services">{t('Services')}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* ─── Step 2: GRA Tax Calculator ─────────────────────────── */}
                <Card>
                    <CardHeader className="py-3 px-4 bg-green-50 border-b">
                        <CardTitle className="text-sm font-semibold text-green-700 flex items-center gap-2">
                            <Calculator className="h-4 w-4" />
                            {t('GRA Tax Calculator (Ghana Revenue Authority)')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4">
                        <div className="mb-4 max-w-xs">
                            <Label htmlFor="base_amount">{t('Base Amount (Invoice Value before Taxes)')}</Label>
                            <Input
                                id="base_amount"
                                type="number"
                                min="0"
                                step="0.01"
                                value={baseAmount}
                                onChange={(e) => setBaseAmount(e.target.value)}
                                placeholder="0.00"
                                className="font-mono"
                            />
                        </div>

                        {taxes && (
                            <div className="rounded-lg border border-green-200 overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-green-100">
                                            <th className="text-left px-3 py-2 font-semibold">{t('Tax Component')}</th>
                                            <th className="text-right px-3 py-2 font-semibold">{t('Rate')}</th>
                                            <th className="text-right px-3 py-2 font-semibold">{t('Amount (GHS)')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr className="border-t">
                                            <td className="px-3 py-2">{t('Base Amount')}</td>
                                            <td className="px-3 py-2 text-right text-gray-500">—</td>
                                            <td className="px-3 py-2 text-right font-mono">{fmt(parseFloat(baseAmount) || 0)}</td>
                                        </tr>
                                        <tr className="border-t bg-blue-50/40">
                                            <td className="px-3 py-2">{t('NHIL (National Health Insurance Levy)')}</td>
                                            <td className="px-3 py-2 text-right text-blue-600">2.5%</td>
                                            <td className="px-3 py-2 text-right font-mono">{fmt(taxes.nhil)}</td>
                                        </tr>
                                        <tr className="border-t bg-blue-50/40">
                                            <td className="px-3 py-2">{t('GETFund Levy')}</td>
                                            <td className="px-3 py-2 text-right text-blue-600">2.5%</td>
                                            <td className="px-3 py-2 text-right font-mono">{fmt(taxes.getfund)}</td>
                                        </tr>
                                        <tr className="border-t bg-blue-50/40">
                                            <td className="px-3 py-2">{t('COVID-19 Health Recovery Levy (CHRL)')}</td>
                                            <td className="px-3 py-2 text-right text-blue-600">1.0%</td>
                                            <td className="px-3 py-2 text-right font-mono">{fmt(taxes.chrl)}</td>
                                        </tr>
                                        <tr className="border-t bg-gray-50">
                                            <td className="px-3 py-2 italic text-gray-500">{t('VAT Base')} (= Base + NHIL + GETFund + CHRL)</td>
                                            <td className="px-3 py-2 text-right text-gray-500">—</td>
                                            <td className="px-3 py-2 text-right font-mono text-gray-600">{fmt(taxes.vatBase)}</td>
                                        </tr>
                                        <tr className="border-t bg-blue-50/40">
                                            <td className="px-3 py-2">{t('VAT (on augmented base)')}</td>
                                            <td className="px-3 py-2 text-right text-blue-600">15%</td>
                                            <td className="px-3 py-2 text-right font-mono">{fmt(taxes.vat)}</td>
                                        </tr>
                                        <tr className="border-t bg-green-100 font-semibold">
                                            <td className="px-3 py-2">{t('Gross Amount')}</td>
                                            <td className="px-3 py-2"></td>
                                            <td className="px-3 py-2 text-right font-mono text-green-800">{fmt(taxes.gross)}</td>
                                        </tr>
                                        <tr className="border-t bg-red-50">
                                            <td className="px-3 py-2 text-red-700">
                                                {t('Withholding Tax (WHT)')}
                                                <span className="text-xs text-gray-500 ml-1">
                                                    ({supplierType === 'non_resident' ? t('Non-Resident') : t('Resident')} — {goodsOrServices === 'goods' ? t('Goods') : t('Services')})
                                                </span>
                                            </td>
                                            <td className="px-3 py-2 text-right text-red-600">{taxes.whtRate}%</td>
                                            <td className="px-3 py-2 text-right font-mono text-red-700">({fmt(taxes.wht)})</td>
                                        </tr>
                                        <tr className="border-t border-2 border-gray-800 bg-gray-900 text-white">
                                            <td className="px-3 py-3 font-bold text-lg">{t('Net Payable to Supplier')}</td>
                                            <td className="px-3 py-3"></td>
                                            <td className="px-3 py-3 text-right font-mono font-bold text-xl text-green-400">
                                                GHS {fmt(taxes.netPayable)}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                                <p className="text-xs text-amber-700 bg-amber-50 px-3 py-2 border-t">
                                    ⚠️ {t('WHT of')} GHS {fmt(taxes.wht)} {t('must be remitted to Ghana Revenue Authority. Issue WHT certificate to supplier.')}
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* ─── Step 3: Invoice Allocation (3-Way Match) ───────────── */}
                {data.vendor_id && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Card>
                            <CardHeader className="py-3 px-4 border-b">
                                <CardTitle className="text-sm flex items-center gap-2">
                                    <Package className="h-4 w-4 text-gray-500" />
                                    {t('Outstanding Invoices')}
                                    <span className="text-xs text-gray-500 ml-1">{t('(3-Way Match — PO / GRN / Invoice)')}</span>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-3">
                                {outstandingInvoices.length > 0 ? (
                                    <div className="space-y-2 max-h-40 overflow-y-auto">
                                        {outstandingInvoices.map(inv => (
                                            <div key={inv.id} className="flex items-center justify-between p-2 border rounded text-sm">
                                                <div>
                                                    <span className="font-medium">{inv.invoice_number}</span>
                                                    <span className="text-gray-500 ml-2">Balance: {formatCurrency(inv.balance_amount)}</span>
                                                </div>
                                                <Button type="button" size="sm" onClick={() => addAllocation(inv)}
                                                    disabled={selectedAllocations.some(a => a.invoice_id === inv.id)}>
                                                    {t('Add')}
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-center py-4 text-gray-500 text-sm">{t('No outstanding invoices')}</p>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="py-3 px-4 border-b">
                                <CardTitle className="text-sm flex items-center gap-2">
                                    <Landmark className="h-4 w-4 text-gray-500" />
                                    {t('Available Debit Notes')}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-3">
                                {availableDebitNotes.length > 0 ? (
                                    <div className="space-y-2 max-h-40 overflow-y-auto">
                                        {availableDebitNotes.map(dn => (
                                            <div key={dn.id} className="flex items-center justify-between p-2 border rounded text-sm">
                                                <div>
                                                    <span className="font-medium">{dn.debit_note_number}</span>
                                                    <span className="text-gray-500 ml-2">Balance: {formatCurrency(dn.balance_amount)}</span>
                                                </div>
                                                <Button type="button" size="sm" variant="outline"
                                                    onClick={() => {
                                                        const totalInv = selectedAllocations.reduce((s, a) => s + a.amount, 0);
                                                        const curDns = selectedDebitNotes.reduce((s, d) => s + d.amount, 0);
                                                        const max = Math.min(dn.balance_amount, totalInv - curDns);
                                                        const next = [...selectedDebitNotes, { debit_note_id: dn.id, amount: max > 0 ? max : dn.balance_amount }];
                                                        setSelectedDebitNotes(next);
                                                        updateTotal(selectedAllocations, next);
                                                    }}
                                                    disabled={selectedDebitNotes.some(d => d.debit_note_id === dn.id)}>
                                                    {t('Apply')}
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-center py-4 text-gray-500 text-sm">{t('No debit notes available')}</p>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* ─── Step 4: Payment Summary ─────────────────────────────── */}
                {(selectedAllocations.length > 0 || selectedDebitNotes.length > 0) && (
                    <Card>
                        <CardHeader className="py-3 px-4 border-b"><CardTitle className="text-sm">{t('Payment Summary')}</CardTitle></CardHeader>
                        <CardContent className="p-4 space-y-2">
                            {selectedAllocations.map(a => {
                                const inv = getInvoice(a.invoice_id);
                                return (
                                    <div key={a.invoice_id} className="flex items-center gap-3 p-3 border rounded">
                                        <div className="flex-1">
                                            <div className="font-medium">{inv?.invoice_number}</div>
                                            <div className="text-sm text-gray-500">{t('Balance')}: {formatCurrency(inv?.balance_amount || 0)}</div>
                                        </div>
                                        <div className="w-32">
                                            <Input type="number" step="0.01" value={a.amount}
                                                onChange={(e) => updateAllocationAmount(a.invoice_id, Number(e.target.value) || 0)}
                                                max={inv?.balance_amount} />
                                        </div>
                                        <Button type="button" variant="ghost" size="sm" onClick={() => removeAllocation(a.invoice_id)}>
                                            <Trash2 className="h-4 w-4 text-red-600" />
                                        </Button>
                                    </div>
                                );
                            })}
                            {selectedDebitNotes.map((dn, idx) => {
                                const note = availableDebitNotes.find(d => d.id === dn.debit_note_id);
                                return (
                                    <div key={`dn-${idx}`} className="flex items-center gap-3 p-3 border rounded bg-green-50">
                                        <div className="flex-1">
                                            <div className="font-medium text-green-700">{note?.debit_note_number}</div>
                                            <div className="text-sm text-gray-500">{t('Credit applied')}</div>
                                        </div>
                                        <div className="w-32">
                                            <Input type="number" step="0.01" value={dn.amount}
                                                onChange={(e) => {
                                                    const val = Number(e.target.value);
                                                    const next = selectedDebitNotes.map((d, i) => i === idx ? { ...d, amount: val } : d);
                                                    setSelectedDebitNotes(next);
                                                    updateTotal(selectedAllocations, next);
                                                }}
                                                max={note?.balance_amount}
                                                className="text-right" />
                                        </div>
                                        <Button type="button" variant="ghost" size="sm"
                                            onClick={() => {
                                                const next = selectedDebitNotes.filter((_, i) => i !== idx);
                                                setSelectedDebitNotes(next);
                                                updateTotal(selectedAllocations, next);
                                            }}>
                                            <Trash2 className="h-4 w-4 text-red-600" />
                                        </Button>
                                    </div>
                                );
                            })}
                        </CardContent>
                    </Card>
                )}

                {/* ─── Total Amount ────────────────────────────────────────── */}
                <div>
                    <CurrencyInput
                        label={t('Total Payment Amount')}
                        value={data.payment_amount}
                        onChange={(v) => setData('payment_amount', v)}
                        error={errors.payment_amount}
                        required
                    />
                    {taxes && (
                        <p className="text-xs text-green-600 mt-1">
                            ✓ {t('Auto-filled from GRA net payable calculation')}
                        </p>
                    )}
                </div>

                <div>
                    <Label htmlFor="notes">{t('Internal Notes')}</Label>
                    <Textarea id="notes" value={data.notes} onChange={(e) => setData('notes', e.target.value)} rows={2} />
                    <InputError message={errors.notes} />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t">
                    <Button type="button" variant="outline" onClick={onSuccess}>{t('Cancel')}</Button>
                    <Button type="submit" disabled={processing || (!selectedAllocations.length && !selectedDebitNotes.length)}>
                        {processing ? t('Creating...') : t('Create Payment')}
                    </Button>
                </div>
            </form>
        </DialogContent>
    );
}
