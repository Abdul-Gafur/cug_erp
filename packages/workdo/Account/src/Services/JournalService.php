<?php

namespace Workdo\Account\Services;

use Workdo\Account\Models\JournalEntry;
use Workdo\Account\Models\JournalEntryItem;
use Workdo\Account\Models\ChartOfAccount;
use Workdo\Account\Models\FiscalPeriod;
use Illuminate\Support\Facades\Auth;
use Workdo\Account\Events\UpdateBudgetSpending;
use Workdo\Account\Models\BankAccount;
use Workdo\Retainer\Models\RetainerPaymentAllocation;

/**
 * JournalService - Automatic double-entry journal creation for all transactions
 * Usage: Call from transaction controllers after creating records (Invoice, Payment, etc.)
 */
class JournalService
{
    private function validateAccounts(array $accountCodes , $userID = null)
    {
        foreach ($accountCodes as $code) {
            $account = ChartOfAccount::where('account_code', $code)
                ->where('created_by', $userID ?? creatorId())
                ->first();
            if (!$account) {
                throw new \Exception("Account with code {$code} not found");
            }
        }
    }

    private function validateBalance($totalDebit, $totalCredit)
    {
        if (abs($totalDebit - $totalCredit) > 0.01) {
            throw new \Exception("Journal entry not balanced: Debit {$totalDebit} != Credit {$totalCredit}");
        }
    }

    /**
     * IPSAS period-lock guard.
     * Throws if the entry date falls in a closed fiscal period.
     * Passes silently when no fiscal years are configured (new tenant without periods).
     */
    private function assertPeriodOpen(string $date): void
    {
        $period = FiscalPeriod::where('start_date', '<=', $date)
            ->where('end_date', '>=', $date)
            ->whereHas('fiscalYear', fn ($q) => $q->where('created_by', creatorId()))
            ->first();

        if ($period && $period->isClosed()) {
            throw new \Exception(
                "Financial Period '{$period->period_name}' is closed. " .
                "Posting to a closed period is not permitted. " .
                "Use a reversing entry in an open period to correct this transaction."
            );
        }
    }

    /**
     * Returns the fiscal_period_id for a given entry date, or null if no periods exist.
     */
    private function resolveFiscalPeriodId(string $date): ?int
    {
        $period = FiscalPeriod::where('start_date', '<=', $date)
            ->where('end_date', '>=', $date)
            ->whereHas('fiscalYear', fn ($q) => $q->where('created_by', creatorId()))
            ->first();

        return $period?->id;
    }

    /**
     * Creates journal entry for sales invoice: Dr: A/R, Cr: Sales Revenue + Tax
     * Usage: SalesInvoiceController->store() after creating invoice
     */
    public function createSalesInvoiceJournal($salesInvoice)
    {
        // Validate required accounts exist
        $requiredAccounts = ['1100', '4100'];
        if ($salesInvoice->tax_amount > 0) {
            $requiredAccounts[] = '2210';
        }
        $this->validateAccounts($requiredAccounts);
        // Validate amounts balance
        $totalDebit = $salesInvoice->total_amount;
        $totalCredit = $salesInvoice->subtotal - $salesInvoice->discount_amount + ($salesInvoice->tax_amount ?? 0);
        $this->validateBalance($totalDebit, $totalCredit);

        $entryDate = $salesInvoice->invoice_date ?? now()->toDateString();
        $this->assertPeriodOpen($entryDate);

        $arAccount = ChartOfAccount::where('account_code', '1100')->where('created_by', creatorId())->first();
        $salesAccount = ChartOfAccount::where('account_code', '4100')->where('created_by', creatorId())->first();
        $taxAccount = ChartOfAccount::where('account_code', '2210')->where('created_by', creatorId())->first();

        $journalEntry = JournalEntry::create([
            'journal_date'      => $entryDate,
            'entry_type'        => 'automatic',
            'reference_type'    => 'sales_invoice',
            'reference_id'      => $salesInvoice->id,
            'description'       => 'Sales Invoice #' . $salesInvoice->invoice_number,
            'total_debit'       => $salesInvoice->total_amount,
            'total_credit'      => $salesInvoice->total_amount,
            'status'            => 'posted',
            'fiscal_period_id'  => $this->resolveFiscalPeriodId($entryDate),
            'approval_status'   => 'approved',
            'prepared_by'       => Auth::id(),
            'creator_id'        => Auth::id(),
            'created_by'        => creatorId(),
        ]);

        // Debit: Accounts Receivable
        JournalEntryItem::create([
            'journal_entry_id' => $journalEntry->id,
            'account_id' => $arAccount->id,
            'description' => 'Sales to ' . $salesInvoice->customer->name,
            'debit_amount' => $salesInvoice->total_amount,
            'credit_amount' => 0,
            'creator_id' => Auth::id(),
            'created_by' => creatorId()
        ]);

        // Credit: Sales Revenue
        JournalEntryItem::create([
            'journal_entry_id' => $journalEntry->id,
            'account_id' => $salesAccount->id,
            'description' => 'Product sales',
            'debit_amount' => 0,
            'credit_amount' => $salesInvoice->subtotal - $salesInvoice->discount_amount,
            'creator_id' => Auth::id(),
            'created_by' => creatorId()
        ]);

        // Credit: Tax Payable (if tax exists)
        if ($salesInvoice->tax_amount > 0) {
            JournalEntryItem::create([
                'journal_entry_id' => $journalEntry->id,
                'account_id' => $taxAccount->id,
                'description' => 'Sales tax collected',
                'debit_amount' => 0,
                'credit_amount' => $salesInvoice->tax_amount,
                'creator_id' => Auth::id(),
                'created_by' => creatorId()
            ]);
        }

        $this->updateAccountBalances($journalEntry);
        return $journalEntry;
    }

    public function createSalesRetainerToInvoiceJournal($retainer)
    {

        $allocations = RetainerPaymentAllocation::whereHas('payment', function($q) {
                $q->where('status', 'cleared');
            })
            ->where('retainer_id', $retainer->id)
            ->get();

        $totalAmount = $allocations->sum('allocated_amount');

        if ($totalAmount <= 0) {
            return null;
        }

        $this->validateAccounts(['2350', '1100']);
        $this->validateBalance($totalAmount, $totalAmount);

        $customerDepositsAccount = ChartOfAccount::where('account_code', '2350')->where('created_by', creatorId())->first();
        $arAccount = ChartOfAccount::where('account_code', '1100')->where('created_by', creatorId())->first();

        $retainerDate = now()->toDateString();
        $this->assertPeriodOpen($retainerDate);

        $journalEntry = JournalEntry::create([
            'journal_date'      => $retainerDate,
            'entry_type'        => 'automatic',
            'reference_type'    => 'retainer_to_invoice',
            'reference_id'      => $retainer->id,
            'description'       => 'Retainer converted to invoice',
            'total_debit'       => $totalAmount,
            'total_credit'      => $totalAmount,
            'status'            => 'posted',
            'fiscal_period_id'  => $this->resolveFiscalPeriodId($retainerDate),
            'approval_status'   => 'approved',
            'prepared_by'       => Auth::id(),
            'creator_id'        => Auth::id(),
            'created_by'        => creatorId(),
        ]);

        JournalEntryItem::create([
            'journal_entry_id' => $journalEntry->id,
            'account_id' => $customerDepositsAccount->id,
            'description' => 'Retainer converted to invoice',
            'debit_amount' => $totalAmount,
            'credit_amount' => 0,
            'creator_id' => Auth::id(),
            'created_by' => creatorId()
        ]);

        JournalEntryItem::create([
            'journal_entry_id' => $journalEntry->id,
            'account_id' => $arAccount->id,
            'description' => 'Retainer converted to invoice',
            'debit_amount' => 0,
            'credit_amount' => $totalAmount,
            'creator_id' => Auth::id(),
            'created_by' => creatorId()
        ]);

        $this->updateAccountBalances($journalEntry);
        return $journalEntry;
    }
    /**
     * Creates journal entry for service invoice: Dr: A/R, Cr: Service Revenue + Tax
     * Usage: PostSalesInvoiceListener for service type invoices
     */
    public function createServiceInvoiceJournal($salesInvoice)
    {
        $requiredAccounts = ['1100', '4200'];
        if ($salesInvoice->tax_amount > 0) {
            $requiredAccounts[] = '2210';
        }
        $this->validateAccounts($requiredAccounts);

        $totalDebit = $salesInvoice->total_amount;
        $totalCredit = $salesInvoice->subtotal - $salesInvoice->discount_amount + ($salesInvoice->tax_amount ?? 0);
        $this->validateBalance($totalDebit, $totalCredit);

        $serviceDate = $salesInvoice->invoice_date ?? now()->toDateString();
        $this->assertPeriodOpen($serviceDate);

        $arAccount = ChartOfAccount::where('account_code', '1100')->where('created_by', creatorId())->first();
        $serviceRevenueAccount = ChartOfAccount::where('account_code', '4200')->where('created_by', creatorId())->first();
        $taxAccount = ChartOfAccount::where('account_code', '2210')->where('created_by', creatorId())->first();

        $journalEntry = JournalEntry::create([
            'journal_date'      => $serviceDate,
            'entry_type'        => 'automatic',
            'reference_type'    => 'service_invoice',
            'reference_id'      => $salesInvoice->id,
            'description'       => 'Service Invoice #' . $salesInvoice->invoice_number,
            'total_debit'       => $salesInvoice->total_amount,
            'total_credit'      => $salesInvoice->total_amount,
            'status'            => 'posted',
            'fiscal_period_id'  => $this->resolveFiscalPeriodId($serviceDate),
            'approval_status'   => 'approved',
            'prepared_by'       => Auth::id(),
            'creator_id'        => Auth::id(),
            'created_by'        => creatorId(),
        ]);

        JournalEntryItem::create([
            'journal_entry_id' => $journalEntry->id,
            'account_id' => $arAccount->id,
            'description' => 'Service to ' . $salesInvoice->customer->name,
            'debit_amount' => $salesInvoice->total_amount,
            'credit_amount' => 0,
            'creator_id' => Auth::id(),
            'created_by' => creatorId()
        ]);

        JournalEntryItem::create([
            'journal_entry_id' => $journalEntry->id,
            'account_id' => $serviceRevenueAccount->id,
            'description' => 'Service revenue',
            'debit_amount' => 0,
            'credit_amount' => $salesInvoice->subtotal - $salesInvoice->discount_amount,
            'creator_id' => Auth::id(),
            'created_by' => creatorId()
        ]);

        if ($salesInvoice->tax_amount > 0) {
            JournalEntryItem::create([
                'journal_entry_id' => $journalEntry->id,
                'account_id' => $taxAccount->id,
                'description' => 'Sales tax collected',
                'debit_amount' => 0,
                'credit_amount' => $salesInvoice->tax_amount,
                'creator_id' => Auth::id(),
                'created_by' => creatorId()
            ]);
        }

        $this->updateAccountBalances($journalEntry);
        return $journalEntry;
    }

    /**
     * Creates journal entry for purchase inventory: Dr: Inventory + Tax, Cr: A/P
     * Usage: PostPurchaseInvoiceListener after creating invoice
     */
    public function createPurchaseInventoryJournal($purchaseInvoice)
    {
        $requiredAccounts = ['2000', '1200'];
        if ($purchaseInvoice->tax_amount > 0) {
            $requiredAccounts[] = '1500';
        }

        $this->validateAccounts($requiredAccounts);

        $totalDebit = $purchaseInvoice->subtotal - $purchaseInvoice->discount_amount + ($purchaseInvoice->tax_amount ?? 0);
        $totalCredit = $purchaseInvoice->total_amount;
        $this->validateBalance($totalDebit, $totalCredit);

        $purchaseDate = $purchaseInvoice->invoice_date ?? now()->toDateString();
        $this->assertPeriodOpen($purchaseDate);

        $apAccount = ChartOfAccount::where('account_code', '2000')->where('created_by', creatorId())->first();
        $inventoryAccount = ChartOfAccount::where('account_code', '1200')->where('created_by', creatorId())->first();
        $taxAccount = ChartOfAccount::where('account_code', '1500')->where('created_by', creatorId())->first();

        $journalEntry = JournalEntry::create([
            'journal_date'      => $purchaseDate,
            'entry_type'        => 'automatic',
            'reference_type'    => 'purchase_invoice',
            'reference_id'      => $purchaseInvoice->id,
            'description'       => 'Supplier Invoice #' . $purchaseInvoice->invoice_number,
            'total_debit'       => $purchaseInvoice->total_amount,
            'total_credit'      => $purchaseInvoice->total_amount,
            'status'            => 'posted',
            'fiscal_period_id'  => $this->resolveFiscalPeriodId($purchaseDate),
            'approval_status'   => 'approved',
            'prepared_by'       => Auth::id(),
            'creator_id'        => Auth::id(),
            'created_by'        => creatorId(),
        ]);

        JournalEntryItem::create([
            'journal_entry_id' => $journalEntry->id,
            'account_id' => $inventoryAccount->id,
            'description' => 'Purchase from ' . $purchaseInvoice->vendor->name,
            'debit_amount' => $purchaseInvoice->subtotal - $purchaseInvoice->discount_amount,
            'credit_amount' => 0,
            'creator_id' => Auth::id(),
            'created_by' => creatorId()
        ]);

        if ($purchaseInvoice->tax_amount > 0) {
            JournalEntryItem::create([
                'journal_entry_id' => $journalEntry->id,
                'account_id' => $taxAccount->id,
                'description' => 'Purchase tax paid',
                'debit_amount' => $purchaseInvoice->tax_amount,
                'credit_amount' => 0,
                'creator_id' => Auth::id(),
                'created_by' => creatorId()
            ]);
        }

        JournalEntryItem::create([
            'journal_entry_id' => $journalEntry->id,
            'account_id' => $apAccount->id,
            'description' => 'Purchase from vendor',
            'debit_amount' => 0,
            'credit_amount' => $purchaseInvoice->total_amount,
            'creator_id' => Auth::id(),
            'created_by' => creatorId()
        ]);

        $this->updateAccountBalances($journalEntry);
        return $journalEntry;
    }

    /**
     * Creates journal entry for customer payment: Dr: Bank, Cr: A/R
     * Usage: CustomerPaymentController->updateStatus() when payment is cleared
     */
    public function createCustomerPaymentJournal($customerPayment)
    {
        // Get the specific bank account's GL account
        $bankGLAccount = $customerPayment->bankAccount->glAccount;
        if (!$bankGLAccount) {
            throw new \Exception("Bank account must have a GL account assigned");
        }

        // Validate A/R account exists
        $this->validateAccounts(['1100']);
        $arAccount = ChartOfAccount::where('account_code', '1100')->where('created_by', creatorId())->first();

        // Validate amounts balance
        $this->validateBalance($customerPayment->payment_amount, $customerPayment->payment_amount);

        $custPayDate = $customerPayment->payment_date ?? now()->toDateString();
        $this->assertPeriodOpen($custPayDate);

        $journalEntry = JournalEntry::create([
            'journal_date'      => $custPayDate,
            'entry_type'        => 'automatic',
            'reference_type'    => 'customer_payment',
            'reference_id'      => $customerPayment->id,
            'description'       => 'Income Receipt #' . $customerPayment->payment_number,
            'total_debit'       => $customerPayment->payment_amount,
            'total_credit'      => $customerPayment->payment_amount,
            'status'            => 'posted',
            'fiscal_period_id'  => $this->resolveFiscalPeriodId($custPayDate),
            'approval_status'   => 'approved',
            'prepared_by'       => Auth::id(),
            'creator_id'        => Auth::id(),
            'created_by'        => creatorId(),
        ]);

        // Debit: Specific Bank Account (from GL Account)
        JournalEntryItem::create([
            'journal_entry_id' => $journalEntry->id,
            'account_id' => $bankGLAccount->id,
            'description' => 'Payment received from ' . $customerPayment->customer->name,
            'debit_amount' => $customerPayment->payment_amount,
            'credit_amount' => 0,
            'creator_id' => Auth::id(),
            'created_by' => creatorId()
        ]);

        // Credit: Accounts Receivable
        JournalEntryItem::create([
            'journal_entry_id' => $journalEntry->id,
            'account_id' => $arAccount->id,
            'description' => 'Payment from customer',
            'debit_amount' => 0,
            'credit_amount' => $customerPayment->payment_amount,
            'creator_id' => Auth::id(),
            'created_by' => creatorId()
        ]);

        try {
            UpdateBudgetSpending::dispatch($journalEntry);
        } catch (\Exception $e) {
            return back()->with('error', $e->getMessage());
        }

        $this->updateAccountBalances($journalEntry);
        return $journalEntry;
    }

    /**
     * Creates journal entry for vendor payment: Dr: A/P, Cr: Bank
     * Usage: VendorPaymentController->store() after making payment
     */
    public function createVendorPaymentJournal($vendorPayment)
    {
        // Get the specific bank account's GL account
        $bankGLAccount = $vendorPayment->bankAccount->glAccount;
        if (!$bankGLAccount) {
            throw new \Exception("Bank account must have a GL account assigned");
        }

        // Validate A/P account exists
        $this->validateAccounts(['2000']);
        $apAccount = ChartOfAccount::where('account_code', '2000')->where('created_by', creatorId())->first();
        // Validate amounts balance
        $this->validateBalance($vendorPayment->payment_amount, $vendorPayment->payment_amount);

        $vendPayDate = $vendorPayment->payment_date ?? now()->toDateString();
        $this->assertPeriodOpen($vendPayDate);

        $journalEntry = JournalEntry::create([
            'journal_date'      => $vendPayDate,
            'entry_type'        => 'automatic',
            'reference_type'    => 'vendor_payment',
            'reference_id'      => $vendorPayment->id,
            'description'       => 'Supplier Payment #' . $vendorPayment->payment_number,
            'total_debit'       => $vendorPayment->payment_amount,
            'total_credit'      => $vendorPayment->payment_amount,
            'status'            => 'posted',
            'fiscal_period_id'  => $this->resolveFiscalPeriodId($vendPayDate),
            'approval_status'   => 'approved',
            'prepared_by'       => Auth::id(),
            'creator_id'        => Auth::id(),
            'created_by'        => creatorId(),
        ]);
        // Debit: Accounts Payable
        JournalEntryItem::create([
            'journal_entry_id' => $journalEntry->id,
            'account_id' => $apAccount->id,
            'description' => 'Payment to ' . $vendorPayment->vendor->name,
            'debit_amount' => $vendorPayment->payment_amount,
            'credit_amount' => 0,
            'creator_id' => Auth::id(),
            'created_by' => creatorId()
        ]);

        // Credit: Specific Bank Account (from GL Account)
        JournalEntryItem::create([
            'journal_entry_id' => $journalEntry->id,
            'account_id' => $bankGLAccount->id,
            'description' => 'Payment from ' . $vendorPayment->bankAccount->account_name,
            'debit_amount' => 0,
            'credit_amount' => $vendorPayment->payment_amount,
            'creator_id' => Auth::id(),
            'created_by' => creatorId()
        ]);

        try {
            UpdateBudgetSpending::dispatch($journalEntry);
        } catch (\Exception $e) {
            return back()->with('error', $e->getMessage());
        }

        $this->updateAccountBalances($journalEntry);
        return $journalEntry;
    }

    /**
     * Creates journal entry for revenue: Dr: Bank, Cr: Revenue
     * Usage: RevenueController->store() after recording revenue
     */
    public function createRevenueEntryJournal($revenueEntry)
    {
        // Get the specific bank account's GL account
        $bankGLAccount = $revenueEntry->bankAccount->glAccount;
        if (!$bankGLAccount) {
            throw new \Exception("Bank account must have a GL account assigned");
        }

        // Use selected chart of account
        $revenueAccount = $revenueEntry->chartOfAccount;
        if (!$revenueAccount) {
            throw new \Exception("Revenue account not found");
        }

        // Validate amounts balance
        $this->validateBalance($revenueEntry->amount, $revenueEntry->amount);

        $revDate = $revenueEntry->entry_date ?? now()->toDateString();
        $this->assertPeriodOpen($revDate);

        $journalEntry = JournalEntry::create([
            'journal_date'      => $revDate,
            'entry_type'        => 'automatic',
            'reference_type'    => 'revenue',
            'reference_id'      => $revenueEntry->id,
            'description'       => 'Income Entry #' . $revenueEntry->revenue_number,
            'total_debit'       => $revenueEntry->amount,
            'total_credit'      => $revenueEntry->amount,
            'status'            => 'posted',
            'fiscal_period_id'  => $this->resolveFiscalPeriodId($revDate),
            'approval_status'   => 'approved',
            'prepared_by'       => Auth::id(),
            'creator_id'        => Auth::id(),
            'created_by'        => creatorId(),
        ]);

        // Debit: Specific Bank Account (from GL Account)
        JournalEntryItem::create([
            'journal_entry_id' => $journalEntry->id,
            'account_id' => $bankGLAccount->id,
            'description' => 'Revenue received',
            'debit_amount' => $revenueEntry->amount,
            'credit_amount' => 0,
            'creator_id' => Auth::id(),
            'created_by' => creatorId()
        ]);

        // Credit: Selected Revenue Account
        JournalEntryItem::create([
            'journal_entry_id' => $journalEntry->id,
            'account_id' => $revenueAccount->id,
            'description' => 'Revenue earned',
            'debit_amount' => 0,
            'credit_amount' => $revenueEntry->amount,
            'creator_id' => Auth::id(),
            'created_by' => creatorId()
        ]);

        try {
            UpdateBudgetSpending::dispatch($journalEntry);
        } catch (\Exception $e) {
            return back()->with('error', $e->getMessage());
        }

        $this->updateAccountBalances($journalEntry);
        return $journalEntry;
    }

    /**
     * Creates journal entry for expense: Dr: Expense, Cr: Bank
     * Usage: ExpenseController->store() after recording expense
     */
    public function createExpenseEntryJournal($expenseEntry)
    {
        // Get the specific bank account's GL account
        $bankGLAccount = $expenseEntry->bankAccount->glAccount;
        if (!$bankGLAccount) {
            throw new \Exception("Bank account must have a GL account assigned");
        }

        // Use selected chart of account
        $expenseAccount = $expenseEntry->chartOfAccount;
        if (!$expenseAccount) {
            throw new \Exception("Expense account not found");
        }

        // Validate amounts balance
        $this->validateBalance($expenseEntry->amount, $expenseEntry->amount);

        $expDate = $expenseEntry->entry_date ?? now()->toDateString();
        $this->assertPeriodOpen($expDate);

        $journalEntry = JournalEntry::create([
            'journal_date'      => $expDate,
            'entry_type'        => 'automatic',
            'reference_type'    => 'expense',
            'reference_id'      => $expenseEntry->id,
            'description'       => 'Expenditure Entry #' . $expenseEntry->expense_number,
            'total_debit'       => $expenseEntry->amount,
            'total_credit'      => $expenseEntry->amount,
            'status'            => 'posted',
            'fiscal_period_id'  => $this->resolveFiscalPeriodId($expDate),
            'approval_status'   => 'approved',
            'prepared_by'       => Auth::id(),
            'creator_id'        => Auth::id(),
            'created_by'        => creatorId(),
        ]);

        // Debit: Selected Expense Account
        JournalEntryItem::create([
            'journal_entry_id' => $journalEntry->id,
            'account_id' => $expenseAccount->id,
            'description' => 'Expense incurred',
            'debit_amount' => $expenseEntry->amount,
            'credit_amount' => 0,
            'creator_id' => Auth::id(),
            'created_by' => creatorId()
        ]);

        // Credit: Specific Bank Account (from GL Account)
        JournalEntryItem::create([
            'journal_entry_id' => $journalEntry->id,
            'account_id' => $bankGLAccount->id,
            'description' => 'Payment made',
            'debit_amount' => 0,
            'credit_amount' => $expenseEntry->amount,
            'creator_id' => Auth::id(),
            'created_by' => creatorId()
        ]);

        try {
            UpdateBudgetSpending::dispatch($journalEntry);
        } catch (\Exception $e) {
            return back()->with('error', $e->getMessage());
        }

        $this->updateAccountBalances($journalEntry);
        return $journalEntry;
    }

    /**
     * Creates journal entry for stock transfer: Dr: To Warehouse, Cr: From Warehouse
     * Usage: StockTransferController->store() after transferring inventory
     */
    public function createStockTransferJournal($stockTransfer)
    {
        // Calculate transfer value (quantity * product cost or use default value)
        $transferValue = $stockTransfer->quantity * ($stockTransfer->product->purchase_price ?? 1);

        // Validate required accounts exist
        $this->validateAccounts(['1200']); // Inventory account

        // Validate amounts balance
        $this->validateBalance($transferValue, $transferValue);

        $inventoryAccount = ChartOfAccount::where('account_code', '1200')->where('created_by', creatorId())->first();

        $transferDate = $stockTransfer->date ?? now()->toDateString();
        $this->assertPeriodOpen($transferDate);

        $journalEntry = JournalEntry::create([
            'journal_date'      => $transferDate,
            'entry_type'        => 'automatic',
            'reference_type'    => 'stock_transfer',
            'reference_id'      => $stockTransfer->id,
            'description'       => 'Stores Transfer #' . $stockTransfer->id . ' — ' . $stockTransfer->fromWarehouse->name . ' to ' . $stockTransfer->toWarehouse->name,
            'total_debit'       => $transferValue,
            'total_credit'      => $transferValue,
            'status'            => 'posted',
            'fiscal_period_id'  => $this->resolveFiscalPeriodId($transferDate),
            'approval_status'   => 'approved',
            'prepared_by'       => Auth::id(),
            'creator_id'        => Auth::id(),
            'created_by'        => creatorId(),
        ]);

        // Debit: To Warehouse Inventory
        JournalEntryItem::create([
            'journal_entry_id' => $journalEntry->id,
            'account_id' => $inventoryAccount->id,
            'description' => 'Stock received at ' . $stockTransfer->toWarehouse->name,
            'debit_amount' => $transferValue,
            'credit_amount' => 0,
            'creator_id' => Auth::id(),
            'created_by' => creatorId()
        ]);

        // Credit: From Warehouse Inventory
        JournalEntryItem::create([
            'journal_entry_id' => $journalEntry->id,
            'account_id' => $inventoryAccount->id,
            'description' => 'Stock transferred from ' . $stockTransfer->fromWarehouse->name,
            'debit_amount' => 0,
            'credit_amount' => $transferValue,
            'creator_id' => Auth::id(),
            'created_by' => creatorId()
        ]);

        $this->updateAccountBalances($journalEntry);
        return $journalEntry;
    }


    /**
     * Deletes journal entry and items for stock transfer
     * Usage: DeleteTransferListener after transfer deletion
     */
    public function deleteStockTransferJournal($transferId)
    {
        $journalEntry = JournalEntry::where('reference_type', 'stock_transfer')
                                  ->where('reference_id', $transferId)
                                  ->first();

        if ($journalEntry) {
            // Reverse account balances before deleting
            $this->reverseAccountBalances($journalEntry);

            // Delete journal entry items first
            JournalEntryItem::where('journal_entry_id', $journalEntry->id)->delete();

            // Delete journal entry
            $journalEntry->delete();
        }
    }

    private function updateAccountBalances($journalEntry)
    {
        $journalEntry->load('items.account');

        foreach($journalEntry->items as $item) {
            $account = $item->account;
            $debitAmount = $item->debit_amount;
            $creditAmount = $item->credit_amount;

            if ($account->normal_balance === 'debit') {
                $account->current_balance += ($debitAmount - $creditAmount);
            } else {
                $account->current_balance += ($creditAmount - $debitAmount);
            }

            $account->save();
        }
    }

    private function reverseAccountBalances($journalEntry)
    {
        $journalEntry->load('items.account');

        foreach($journalEntry->items as $item) {
            $account = $item->account;
            $debitAmount = $item->debit_amount;
            $creditAmount = $item->credit_amount;

            // Reverse the balance update
            if ($account->normal_balance === 'debit') {
                $account->current_balance -= ($debitAmount - $creditAmount);
            } else {
                $account->current_balance -= ($creditAmount - $debitAmount);
            }

            $account->save();
        }
    }

    /**
     * Creates journal entry for debit note: Dr: A/P, Cr: Inventory + Tax Receivable
     * Usage: DebitNoteController->approve() after approving debit note
     */
    public function createDebitNoteJournal($debitNote)
    {
        $requiredAccounts = ['2000', '1200'];
        if ($debitNote->tax_amount > 0) {
            $requiredAccounts[] = '1500';
        }
        $this->validateAccounts($requiredAccounts);

        $totalDebit = $debitNote->total_amount;
        $totalCredit = $debitNote->subtotal  - $debitNote->discount_amount + ($debitNote->tax_amount ?? 0);
        $this->validateBalance($totalDebit, $totalCredit);

        $apAccount = ChartOfAccount::where('account_code', '2000')->where('created_by', creatorId())->first();
        $inventoryAccount = ChartOfAccount::where('account_code', '1200')->where('created_by', creatorId())->first();
        $taxAccount = ChartOfAccount::where('account_code', '1500')->where('created_by', creatorId())->first();

        $debitDate = $debitNote->debit_note_date ?? now()->toDateString();
        $this->assertPeriodOpen($debitDate);

        $journalEntry = JournalEntry::create([
            'journal_date'      => $debitDate,
            'entry_type'        => 'automatic',
            'reference_type'    => 'debit_note',
            'reference_id'      => $debitNote->id,
            'description'       => 'Debit Note #' . $debitNote->debit_note_number,
            'total_debit'       => $debitNote->total_amount,
            'total_credit'      => $debitNote->total_amount,
            'status'            => 'posted',
            'fiscal_period_id'  => $this->resolveFiscalPeriodId($debitDate),
            'approval_status'   => 'approved',
            'prepared_by'       => Auth::id(),
            'creator_id'        => Auth::id(),
            'created_by'        => creatorId(),
        ]);

        JournalEntryItem::create([
            'journal_entry_id' => $journalEntry->id,
            'account_id' => $apAccount->id,
            'description' => 'Debit Note - ' . $debitNote->vendor->name,
            'debit_amount' => $debitNote->total_amount,
            'credit_amount' => 0,
            'creator_id' => Auth::id(),
            'created_by' => creatorId()
        ]);

        JournalEntryItem::create([
            'journal_entry_id' => $journalEntry->id,
            'account_id' => $inventoryAccount->id,
            'description' => 'Goods returned to vendor',
            'debit_amount' => 0,
            'credit_amount' => $debitNote->subtotal - $debitNote->discount_amount,
            'creator_id' => Auth::id(),
            'created_by' => creatorId()
        ]);

        if ($debitNote->tax_amount > 0) {
            JournalEntryItem::create([
                'journal_entry_id' => $journalEntry->id,
                'account_id' => $taxAccount->id,
                'description' => 'Tax credit from debit note',
                'debit_amount' => 0,
                'credit_amount' => $debitNote->tax_amount,
                'creator_id' => Auth::id(),
                'created_by' => creatorId()
            ]);
        }

        $this->updateAccountBalances($journalEntry);
        return $journalEntry;
    }

    /**
     * Creates journal entry for credit note: Dr: Sales Revenue + Tax, Cr: A/R
     * Usage: CreditNoteController->approve() after approving credit note
     */
    public function createCreditNoteJournal($creditNote)
    {
        // Validate required accounts exist
        $requiredAccounts = ['1100', '4100'];
        if ($creditNote->tax_amount > 0) {
            $requiredAccounts[] = '2210';
        }
        $this->validateAccounts($requiredAccounts);

        // Validate amounts balance
        $totalDebit = $creditNote->subtotal - $creditNote->discount_amount + ($creditNote->tax_amount ?? 0);
        $totalCredit = $creditNote->total_amount;
        $this->validateBalance($totalDebit, $totalCredit);

        $arAccount = ChartOfAccount::where('account_code', '1100')->where('created_by', creatorId())->first();
        $salesAccount = ChartOfAccount::where('account_code', '4100')->where('created_by', creatorId())->first();
        $taxAccount = ChartOfAccount::where('account_code', '2210')->where('created_by', creatorId())->first();

        $creditDate = $creditNote->credit_note_date ?? now()->toDateString();
        $this->assertPeriodOpen($creditDate);

        $journalEntry = JournalEntry::create([
            'journal_date'      => $creditDate,
            'entry_type'        => 'automatic',
            'reference_type'    => 'credit_note',
            'reference_id'      => $creditNote->id,
            'description'       => 'Credit Note #' . $creditNote->credit_note_number,
            'total_debit'       => $creditNote->total_amount,
            'total_credit'      => $creditNote->total_amount,
            'status'            => 'posted',
            'fiscal_period_id'  => $this->resolveFiscalPeriodId($creditDate),
            'approval_status'   => 'approved',
            'prepared_by'       => Auth::id(),
            'creator_id'        => Auth::id(),
            'created_by'        => creatorId(),
        ]);

        // Debit: Sales Revenue (reduces revenue)
        JournalEntryItem::create([
            'journal_entry_id' => $journalEntry->id,
            'account_id' => $salesAccount->id,
            'description' => 'Credit Note adjustment',
            'debit_amount' => $creditNote->subtotal - $creditNote->discount_amount,
            'credit_amount' => 0,
            'creator_id' => Auth::id(),
            'created_by' => creatorId()
        ]);

        // Debit: Tax Payable (if tax exists)
        if ($creditNote->tax_amount > 0) {
            JournalEntryItem::create([
                'journal_entry_id' => $journalEntry->id,
                'account_id' => $taxAccount->id,
                'description' => 'Tax reduction from credit note',
                'debit_amount' => $creditNote->tax_amount,
                'credit_amount' => 0,
                'creator_id' => Auth::id(),
                'created_by' => creatorId()
            ]);
        }

        // Credit: Accounts Receivable (reduces customer debt)
        JournalEntryItem::create([
            'journal_entry_id' => $journalEntry->id,
            'account_id' => $arAccount->id,
            'description' => 'Credit Note - ' . $creditNote->customer->name,
            'debit_amount' => 0,
            'credit_amount' => $creditNote->total_amount,
            'creator_id' => Auth::id(),
            'created_by' => creatorId()
        ]);

        $this->updateAccountBalances($journalEntry);
        return $journalEntry;
    }

    /**
     * Creates journal entry for bank transfer: Dr: To Bank + Charges, Cr: From Bank
     * Usage: BankTransferController->process() after processing transfer
     */
    public function createBankTransferJournal($bankTransfer)
    {
        // Get the specific bank accounts' GL accounts
        $fromBankGLAccount = $bankTransfer->fromAccount->glAccount;
        if (!$fromBankGLAccount) {
            throw new \Exception( __("Source bank account must have a GL account assigned"));
        }

        $toBankGLAccount = $bankTransfer->toAccount->glAccount;
        if (!$toBankGLAccount) {
            throw new \Exception( __("Destination bank account must have a GL account assigned"));
        }

        $bankChargesAccount = ChartOfAccount::where('account_code', '5510')->where('created_by', creatorId())->first();

        $totalDebit = $bankTransfer->transfer_amount + $bankTransfer->transfer_charges;
        $totalCredit = $bankTransfer->transfer_amount + $bankTransfer->transfer_charges;

        $this->validateBalance($totalDebit, $totalCredit);

        $btDate = $bankTransfer->transfer_date ?? now()->toDateString();
        $this->assertPeriodOpen($btDate);

        $journalEntry = JournalEntry::create([
            'journal_date'      => $btDate,
            'entry_type'        => 'automatic',
            'reference_type'    => 'bank_transfer',
            'reference_id'      => $bankTransfer->id,
            'description'       => 'Bank Transfer #' . $bankTransfer->transfer_number,
            'total_debit'       => $totalDebit,
            'total_credit'      => $totalCredit,
            'status'            => 'posted',
            'fiscal_period_id'  => $this->resolveFiscalPeriodId($btDate),
            'approval_status'   => 'approved',
            'prepared_by'       => Auth::id(),
            'creator_id'        => Auth::id(),
            'created_by'        => creatorId(),
        ]);

        // Debit: Destination Bank Account
        JournalEntryItem::create([
            'journal_entry_id' => $journalEntry->id,
            'account_id' => $toBankGLAccount->id,
            'description' => 'Transfer received from ' . $bankTransfer->fromAccount->account_name,
            'debit_amount' => $bankTransfer->transfer_amount,
            'credit_amount' => 0,
            'creator_id' => Auth::id(),
            'created_by' => creatorId()
        ]);

        // Debit: Bank Charges (if any)
        if ($bankTransfer->transfer_charges > 0 && $bankChargesAccount) {
            JournalEntryItem::create([
                'journal_entry_id' => $journalEntry->id,
                'account_id' => $bankChargesAccount->id,
                'description' => 'Bank transfer charges',
                'debit_amount' => $bankTransfer->transfer_charges,
                'credit_amount' => 0,
                'creator_id' => Auth::id(),
                'created_by' => creatorId()
            ]);
        }

        // Credit: Source Bank Account
        JournalEntryItem::create([
            'journal_entry_id' => $journalEntry->id,
            'account_id' => $fromBankGLAccount->id,
            'description' => 'Transfer sent to ' . $bankTransfer->toAccount->account_name,
            'debit_amount' => 0,
            'credit_amount' => $totalDebit,
            'creator_id' => Auth::id(),
            'created_by' => creatorId()
        ]);

        $this->updateAccountBalances($journalEntry);
        return $journalEntry;
    }
    public function createRetainerPaymentJournal($retainerPayment)
    {
        // Get the specific bank account's GL account
        $bankGLAccount = BankAccount::where('id', $retainerPayment->bank_account_id)->first()->glAccount;
        if (!$bankGLAccount) {
            throw new \Exception("Bank account must have a GL account assigned");
        }

        // Validate Customer Deposits exists (2350)
        $this->validateAccounts(['2350']);
        $unearnedRevenueAccount = ChartOfAccount::where('account_code', '2350')->where('created_by', creatorId())->first();

        // Validate amounts balance
        $this->validateBalance($retainerPayment->payment_amount, $retainerPayment->payment_amount);

        $retPayDate = $retainerPayment->payment_date ?? now()->toDateString();
        $this->assertPeriodOpen($retPayDate);

        $journalEntry = JournalEntry::create([
            'journal_date'      => $retPayDate,
            'entry_type'        => 'automatic',
            'reference_type'    => 'retainer_payment',
            'reference_id'      => $retainerPayment->id,
            'description'       => 'Advance Receipt from ' . $retainerPayment->customer->name,
            'total_debit'       => $retainerPayment->payment_amount,
            'total_credit'      => $retainerPayment->payment_amount,
            'status'            => 'posted',
            'fiscal_period_id'  => $this->resolveFiscalPeriodId($retPayDate),
            'approval_status'   => 'approved',
            'prepared_by'       => Auth::id(),
            'creator_id'        => Auth::id(),
            'created_by'        => creatorId(),
        ]);
        // Debit: Specific Bank Account
        JournalEntryItem::create([
            'journal_entry_id' => $journalEntry->id,
            'account_id' => $bankGLAccount->id,
            'description' => 'Retainer advance payment received',
            'debit_amount' => $retainerPayment->payment_amount,
            'credit_amount' => 0,
            'creator_id' => Auth::id(),
            'created_by' => creatorId()
        ]);

        // Credit: Unearned Revenue (Liability)
        JournalEntryItem::create([
            'journal_entry_id' => $journalEntry->id,
            'account_id' => $unearnedRevenueAccount->id,
            'description' => 'Retainer advance payment received',
            'debit_amount' => 0,
            'credit_amount' => $retainerPayment->payment_amount,
            'creator_id' => Auth::id(),
            'created_by' => creatorId()
        ]);


        try {
            UpdateBudgetSpending::dispatch($journalEntry);
        } catch (\Exception $e) {
            return back()->with('error', $e->getMessage());
        }

        $this->updateAccountBalances($journalEntry);
        return $journalEntry;
    }
    public function createCommissionPaymentJournal($commissionPayment)
    {
        // Get the specific bank account's GL account
        $bankGLAccount = BankAccount::where('id', $commissionPayment->bank_account_id)->first()->glAccount;
        if (!$bankGLAccount) {
            throw new \Exception("Bank account must have a GL account assigned");
        }

        // Validate Commission Expense account exists (5220)
        $this->validateAccounts(['5220']);
        $commissionExpenseAccount = ChartOfAccount::where('account_code', '5220')->where('created_by', creatorId())->first();

        // Validate amounts balance
        $this->validateBalance($commissionPayment->payment_amount, $commissionPayment->payment_amount);

        $journalEntry = JournalEntry::create([
            'journal_date' => $commissionPayment->payment_date ?? now(),
            'entry_type' => 'automatic',
            'reference_type' => 'commission_payment',
            'reference_id' => $commissionPayment->id,
            'description' => 'Commission Payment to ' . $commissionPayment->agent->name,
            'total_debit' => $commissionPayment->payment_amount,
            'total_credit' => $commissionPayment->payment_amount,
            'status' => 'posted',
            'creator_id' => Auth::id(),
            'created_by' => creatorId()
        ]);

        // Debit: Commission Expense
        JournalEntryItem::create([
            'journal_entry_id' => $journalEntry->id,
            'account_id' => $commissionExpenseAccount->id,
            'description' => 'Commission paid to agent',
            'debit_amount' => $commissionPayment->payment_amount,
            'credit_amount' => 0,
            'creator_id' => Auth::id(),
            'created_by' => creatorId()
        ]);

        // Credit: Specific Bank Account
        JournalEntryItem::create([
            'journal_entry_id' => $journalEntry->id,
            'account_id' => $bankGLAccount->id,
            'description' => 'Commission payment from ' . $bankGLAccount->account_name,
            'debit_amount' => 0,
            'credit_amount' => $commissionPayment->payment_amount,
            'creator_id' => Auth::id(),
            'created_by' => creatorId()
        ]);

        try {
            UpdateBudgetSpending::dispatch($journalEntry);
        } catch (\Exception $e) {
            return back()->with('error', $e->getMessage());
        }

        $this->updateAccountBalances($journalEntry);
        return $journalEntry;
    }

    /**
     * Creates journal entry for payroll: Dr: Salary Expense, Cr: Bank
     * Usage: PaySalaryListener after paying salary
     */
    public function createPayrollJournal($payrollEntry)
    {
        $bankGLAccount = BankAccount::where('id', $payrollEntry->payroll->bank_account_id)->first()->glAccount;
        if (!$bankGLAccount) {
            throw new \Exception("Bank account must have a GL account assigned");
        }

        $this->validateAccounts(['5200']);
        $salaryExpenseAccount = ChartOfAccount::where('account_code', '5200')->where('created_by', creatorId())->first();
        $this->validateBalance($payrollEntry->net_pay, $payrollEntry->net_pay);

        $journalEntry = JournalEntry::create([
            'journal_date' => now(),
            'entry_type' => 'automatic',
            'reference_type' => 'payroll',
            'reference_id' => $payrollEntry->id,
            'description' => 'Salary Payment - ' . $payrollEntry->employee->user->name,
            'total_debit' => $payrollEntry->net_pay,
            'total_credit' => $payrollEntry->net_pay,
            'status' => 'posted',
            'creator_id' => Auth::id(),
            'created_by' => creatorId()
        ]);

        JournalEntryItem::create([
            'journal_entry_id' => $journalEntry->id,
            'account_id' => $salaryExpenseAccount->id,
            'description' => 'Salary paid to ' . $payrollEntry->employee->user->name,
            'debit_amount' => $payrollEntry->net_pay,
            'credit_amount' => 0,
            'creator_id' => Auth::id(),
            'created_by' => creatorId()
        ]);

        JournalEntryItem::create([
            'journal_entry_id' => $journalEntry->id,
            'account_id' => $bankGLAccount->id,
            'description' => 'Salary payment',
            'debit_amount' => 0,
            'credit_amount' => $payrollEntry->net_pay,
            'creator_id' => Auth::id(),
            'created_by' => creatorId()
        ]);

        try {
            UpdateBudgetSpending::dispatch($journalEntry);
        } catch (\Exception $e) {
            return back()->with('error', $e->getMessage());
        }

        $this->updateAccountBalances($journalEntry);
        return $journalEntry;
    }

    /**
     * Creates journal entry for POS sale: Dr: Cash/Bank, Cr: Sales Revenue + Tax
     * Usage: CreatePosListener after POS sale
     */
    public function createPosJournal($posSale)
    {
        $bankGLAccount = BankAccount::where('id', $posSale->bank_account_id)->first()->glAccount;
        if (!$bankGLAccount) {
            throw new \Exception("Bank account must have a GL account assigned");
        }

        $posSale->load(['payment', 'items']);

        $taxAmount = $posSale->items->sum('tax_amount');
        $requiredAccounts = ['1010', '4100'];
        if ($taxAmount > 0) {
            $requiredAccounts[] = '2210';
        }
        $this->validateAccounts($requiredAccounts);

        $salesAccount = ChartOfAccount::where('account_code', '4100')->where('created_by', creatorId())->first();
        $taxAccount = ChartOfAccount::where('account_code', '2210')->where('created_by', creatorId())->first();

        $totalAmount = $posSale->payment->discount_amount ?? 0;
        $subtotal = $posSale->items->sum('subtotal');
        $discount = $posSale->payment->discount ?? 0;

        $this->validateBalance($totalAmount, $subtotal - $discount + $taxAmount);

        $journalEntry = JournalEntry::create([
            'journal_date' => $posSale->pos_date ?? now(),
            'entry_type' => 'automatic',
            'reference_type' => 'pos_sale',
            'reference_id' => $posSale->id,
            'description' => 'POS Sale ' . $posSale->sale_number,
            'total_debit' => $totalAmount,
            'total_credit' => $totalAmount,
            'status' => 'posted',
            'creator_id' => Auth::id(),
            'created_by' => creatorId()
        ]);

        JournalEntryItem::create([
            'journal_entry_id' => $journalEntry->id,
            'account_id' => $bankGLAccount->id,
            'description' => 'POS cash sale',
            'debit_amount' => $totalAmount,
            'credit_amount' => 0,
            'creator_id' => Auth::id(),
            'created_by' => creatorId()
        ]);

        JournalEntryItem::create([
            'journal_entry_id' => $journalEntry->id,
            'account_id' => $salesAccount->id,
            'description' => 'POS product sales',
            'debit_amount' => 0,
            'credit_amount' => $subtotal - $discount,
            'creator_id' => Auth::id(),
            'created_by' => creatorId()
        ]);

        if ($taxAmount > 0 && $taxAccount) {
            JournalEntryItem::create([
                'journal_entry_id' => $journalEntry->id,
                'account_id' => $taxAccount->id,
                'description' => 'Sales tax collected',
                'debit_amount' => 0,
                'credit_amount' => $taxAmount,
                'creator_id' => Auth::id(),
                'created_by' => creatorId()
            ]);
        }

        try {
            UpdateBudgetSpending::dispatch($journalEntry);
        } catch (\Exception $e) {
            return back()->with('error', $e->getMessage());
        }

        $this->updateAccountBalances($journalEntry);
        return $journalEntry;
    }

    /**
     * Creates COGS journal entry for sales invoice: Dr: COGS, Cr: Inventory
     * Usage: PostSalesInvoiceListener after creating sales invoice
     */
    public function createSalesCOGSJournal($salesInvoice)
    {
        $salesInvoice->load('items.product');
        $totalCost = 0;

        foreach ($salesInvoice->items as $item) {
            if (!$item->product) {
                continue;
            }
            $costPrice = $item->product->purchase_price ?? 0;
            $totalCost += $item->quantity * $costPrice;
        }

        if ($totalCost <= 0.01) {
            return null;
        }

        $this->validateAccounts(['5100', '1200']);

        $cogsAccount = ChartOfAccount::where('account_code', '5100')->where('created_by', creatorId())->first();
        $inventoryAccount = ChartOfAccount::where('account_code', '1200')->where('created_by', creatorId())->first();

        $this->validateBalance($totalCost, $totalCost);

        $journalEntry = JournalEntry::create([
            'journal_date' => $salesInvoice->invoice_date ?? now(),
            'entry_type' => 'automatic',
            'reference_type' => 'sales_invoice_cogs',
            'reference_id' => $salesInvoice->id,
            'description' => 'COGS for Sales Invoice #' . $salesInvoice->invoice_number,
            'total_debit' => $totalCost,
            'total_credit' => $totalCost,
            'status' => 'posted',
            'creator_id' => Auth::id(),
            'created_by' => creatorId()
        ]);

        JournalEntryItem::create([
            'journal_entry_id' => $journalEntry->id,
            'account_id' => $cogsAccount->id,
            'description' => 'Cost of goods sold',
            'debit_amount' => $totalCost,
            'credit_amount' => 0,
            'creator_id' => Auth::id(),
            'created_by' => creatorId()
        ]);

        JournalEntryItem::create([
            'journal_entry_id' => $journalEntry->id,
            'account_id' => $inventoryAccount->id,
            'description' => 'Inventory reduction',
            'debit_amount' => 0,
            'credit_amount' => $totalCost,
            'creator_id' => Auth::id(),
            'created_by' => creatorId()
        ]);

        $this->updateAccountBalances($journalEntry);
        return $journalEntry;
    }

    /**
     * Creates COGS journal entry for POS sale: Dr: COGS, Cr: Inventory
     * Usage: CreatePosListener after creating POS sale
     */
    public function createPosCOGSJournal($posSale)
    {
        try {
            $posSale->load('items.product');
            $totalCost = 0;

            foreach ($posSale->items as $item) {
                if (!$item->product) {
                    continue;
                }
                $costPrice = $item->product->purchase_price ?? 0;
                $totalCost += $item->quantity * $costPrice;
            }

            if ($totalCost <= 0.01) {
                return null;
            }

            $this->validateAccounts(['5100', '1200']);

            $cogsAccount = ChartOfAccount::where('account_code', '5100')->where('created_by', creatorId())->first();
            $inventoryAccount = ChartOfAccount::where('account_code', '1200')->where('created_by', creatorId())->first();

            $this->validateBalance($totalCost, $totalCost);

            $journalEntry = JournalEntry::create([
                'journal_date' => $posSale->pos_date ?? now(),
                'entry_type' => 'automatic',
                'reference_type' => 'pos_sale_cogs',
                'reference_id' => $posSale->id,
                'description' => 'COGS for POS Sale ' . $posSale->sale_number,
                'total_debit' => $totalCost,
                'total_credit' => $totalCost,
                'status' => 'posted',
                'creator_id' => Auth::id(),
                'created_by' => creatorId()
            ]);

            JournalEntryItem::create([
                'journal_entry_id' => $journalEntry->id,
                'account_id' => $cogsAccount->id,
                'description' => 'Cost of goods sold',
                'debit_amount' => $totalCost,
                'credit_amount' => 0,
                'creator_id' => Auth::id(),
                'created_by' => creatorId()
            ]);

            JournalEntryItem::create([
                'journal_entry_id' => $journalEntry->id,
                'account_id' => $inventoryAccount->id,
                'description' => 'Inventory reduction',
                'debit_amount' => 0,
                'credit_amount' => $totalCost,
                'creator_id' => Auth::id(),
                'created_by' => creatorId()
            ]);

            $this->updateAccountBalances($journalEntry);
            return $journalEntry;
        } catch (\Exception $e) {
            return null;
        }
    }

    /**
     * Creates COGS reversal journal entry for credit note: Dr: Inventory, Cr: COGS
     * Usage: CreditNoteController->approve() after approving credit note
     */
    public function createCreditNoteCOGSJournal($creditNote)
    {
        try {
            $creditNote->load('items.product');
            $totalCost = 0;

            foreach ($creditNote->items as $item) {
                if (!$item->product) {
                    continue;
                }
                $costPrice = $item->product->purchase_price ?? 0;
                $totalCost += $item->quantity * $costPrice;
            }

            if ($totalCost <= 0.01) {
                return null;
            }

            $this->validateAccounts(['5100', '1200']);

            $cogsAccount = ChartOfAccount::where('account_code', '5100')->where('created_by', creatorId())->first();
            $inventoryAccount = ChartOfAccount::where('account_code', '1200')->where('created_by', creatorId())->first();

            $this->validateBalance($totalCost, $totalCost);

            $journalEntry = JournalEntry::create([
                'journal_date' => $creditNote->credit_note_date ?? now(),
                'entry_type' => 'automatic',
                'reference_type' => 'credit_note_cogs',
                'reference_id' => $creditNote->id,
                'description' => 'COGS Reversal for Credit Note #' . $creditNote->credit_note_number,
                'total_debit' => $totalCost,
                'total_credit' => $totalCost,
                'status' => 'posted',
                'creator_id' => Auth::id(),
                'created_by' => creatorId()
            ]);

            JournalEntryItem::create([
                'journal_entry_id' => $journalEntry->id,
                'account_id' => $inventoryAccount->id,
                'description' => 'Inventory returned',
                'debit_amount' => $totalCost,
                'credit_amount' => 0,
                'creator_id' => Auth::id(),
                'created_by' => creatorId()
            ]);

            JournalEntryItem::create([
                'journal_entry_id' => $journalEntry->id,
                'account_id' => $cogsAccount->id,
                'description' => 'COGS reversal',
                'debit_amount' => 0,
                'credit_amount' => $totalCost,
                'creator_id' => Auth::id(),
                'created_by' => creatorId()
            ]);

            $this->updateAccountBalances($journalEntry);
            return $journalEntry;
        } catch (\Exception $e) {
            return null;
        }
    }

    /**
     * Creates journal entry for mobile service payment: Dr: Bank, Cr: Mobile Service Revenue
     * Usage: MobileServiceController->store() after recording mobile service payment
     */
    public function createMobileServicePaymentJournal($payment)
    {
        // Get the specific bank account's GL account
        $bankGLAccount = BankAccount::where('id', $payment->bank_account_id)->first()->glAccount;
        if (!$bankGLAccount) {
            throw new \Exception("Bank account must have a GL account assigned");
        }

        // Validate required accounts exist (4200 for Mobile Service Revenue)
        $this->validateAccounts(['4200']);

        // Validate amounts balance
        $this->validateBalance($payment->payment_amount, $payment->payment_amount);

        $mobileServiceRevenueAccount = ChartOfAccount::where('account_code', '4200')->where('created_by', creatorId())->first();
        $journalEntry = JournalEntry::create([
            'journal_date' => $payment->payment_date ?? now(),
            'entry_type' => 'automatic',
            'reference_type' => 'mobile_service_payment',
            'reference_id' => $payment->id,
            'description' => 'Mobile Service Payment - ' . $payment->notes,
            'total_debit' => $payment->payment_amount,
            'total_credit' => $payment->payment_amount,
            'status' => 'posted',
            'creator_id' => Auth::id(),
            'created_by' => creatorId()
        ]);
        // Debit: Specific Bank Account (from GL Account)
        JournalEntryItem::create([
            'journal_entry_id' => $journalEntry->id,
            'account_id' => $bankGLAccount->id,
            'description' => 'Mobile service payment received',
            'debit_amount' => $payment->payment_amount,
            'credit_amount' => 0,
            'creator_id' => Auth::id(),
            'created_by' => creatorId()
        ]);

        // Credit: Mobile Service Revenue Account
        JournalEntryItem::create([
            'journal_entry_id' => $journalEntry->id,
            'account_id' => $mobileServiceRevenueAccount->id,
            'description' => 'Mobile service revenue earned',
            'debit_amount' => 0,
            'credit_amount' => $payment->payment_amount,
            'creator_id' => Auth::id(),
            'created_by' => creatorId()
        ]);

        try {
            UpdateBudgetSpending::dispatch($journalEntry);
        } catch (\Exception $e) {
            return back()->with('error', $e->getMessage());
        }

        $this->updateAccountBalances($journalEntry);
        return $journalEntry;
    }

    /**
     * Creates journal entry for fleet booking payment: Dr: Bank, Cr: Fleet Service Revenue
     * Usage: FleetBookingController->markPayment() after recording fleet booking payment
     */
    public function createMarkFleetBookingPaymentJournal($payment)
    {
        // Get the specific bank account's GL account
        $bankGLAccount = BankAccount::where('id', $payment->bank_account_id)->first()->glAccount;
        if (!$bankGLAccount) {
            throw new \Exception("Bank account must have a GL account assigned");
        }

        // Validate required accounts exist (4300 for Fleet Service Revenue)
        $this->validateAccounts(['4300']);

        // Validate amounts balance
        $this->validateBalance($payment->payment_amount, $payment->payment_amount);

        $fleetServiceRevenueAccount = ChartOfAccount::where('account_code', '4300')->where('created_by', creatorId())->first();
        $journalEntry = JournalEntry::create([
            'journal_date' => $payment->payment_date ?? now(),
            'entry_type' => 'automatic',
            'reference_type' => 'fleet_booking_payment',
            'reference_id' => $payment->id,
            'description' => 'Fleet Booking Payment - ' . ($payment->notes ?? 'Fleet service payment'),
            'total_debit' => $payment->payment_amount,
            'total_credit' => $payment->payment_amount,
            'status' => 'posted',
            'creator_id' => Auth::id(),
            'created_by' => creatorId()
        ]);
        // Debit: Specific Bank Account (from GL Account)
        JournalEntryItem::create([
            'journal_entry_id' => $journalEntry->id,
            'account_id' => $bankGLAccount->id,
            'description' => 'Fleet booking payment received',
            'debit_amount' => $payment->payment_amount,
            'credit_amount' => 0,
            'creator_id' => Auth::id(),
            'created_by' => creatorId()
        ]);

        // Credit: Fleet Service Revenue Account
        JournalEntryItem::create([
            'journal_entry_id' => $journalEntry->id,
            'account_id' => $fleetServiceRevenueAccount->id,
            'description' => 'Fleet service revenue earned',
            'debit_amount' => 0,
            'credit_amount' => $payment->payment_amount,
            'creator_id' => Auth::id(),
            'created_by' => creatorId()
        ]);

        try {
            UpdateBudgetSpending::dispatch($journalEntry);
        } catch (\Exception $e) {
            return back()->with('error', $e->getMessage());
        }

        $this->updateAccountBalances($journalEntry);
        return $journalEntry;
    }

    /**
     * Creates journal entry for beauty booking payment: Dr: Bank, Cr: Beauty Service Revenue
     * Usage: BeautyBookingController->markPayment() after recording beauty booking payment
     */
    public function createBeautyBookingPaymentJournal($booking)
    {
        // Get bank account by payment gateway
        $bankAccount = BankAccount::where('payment_gateway', $booking->payment_option)->where('created_by', $booking->created_by)
            ->first();

        if (!$bankAccount || !$bankAccount->glAccount) {
            throw new \Exception("Bank account with GL account not found for payment gateway: " . $booking->payment_option);
        }

        // Validate required accounts exist (4200 for Service Revenue)
        $this->validateAccounts(['4200'], $booking->created_by);
        // Validate amounts balance
        $this->validateBalance($booking->price, $booking->price);

        $beautyServiceRevenueAccount = ChartOfAccount::where('account_code', '4200')->where('created_by', $booking->created_by)->first();

        $journalEntry = JournalEntry::create([
            'journal_date' => $booking->date ?? now(),
            'entry_type' => 'automatic',
            'reference_type' => 'beauty_booking_payment',
            'reference_id' => $booking->id,
            'description' => 'Beauty Booking Payment via ' . $booking->payment_option,
            'total_debit' => $booking->price,
            'total_credit' => $booking->price,
            'status' => 'posted',
            'creator_id' => $booking->created_by,
            'created_by' => $booking->created_by
        ]);
        // Debit: Specific Bank Account (from GL Account)
        JournalEntryItem::create([
            'journal_entry_id' => $journalEntry->id,
            'account_id' => $bankAccount->glAccount->id,
            'description' => 'Beauty booking payment received',
            'debit_amount' => $booking->price,
            'credit_amount' => 0,
            'creator_id' => $booking->created_by,
            'created_by' => $booking->created_by
        ]);

        // Credit: Beauty Service Revenue Account
        JournalEntryItem::create([
            'journal_entry_id' => $journalEntry->id,
            'account_id' => $beautyServiceRevenueAccount->id,
            'description' => 'Beauty service revenue earned',
            'debit_amount' => 0,
            'credit_amount' => $booking->price,
            'creator_id' => $booking->created_by,
            'created_by' => $booking->created_by
        ]);

        try {
            UpdateBudgetSpending::dispatch($journalEntry);
        } catch (\Exception $e) {
            return back()->with('error', $e->getMessage());
        }
        $this->updateAccountBalances($journalEntry);
        return $journalEntry;
    }

    public function createDairyCattlePaymentJournal($dairyCattlePayment)
    {
        $bankGLAccount = BankAccount::where('id', $dairyCattlePayment->bank_account_id)->first()->glAccount;
        if (!$bankGLAccount) {
            throw new \Exception("Bank account must have a GL account assigned");
        }

        $this->validateAccounts(['4200']);
        $this->validateBalance($dairyCattlePayment->payment_amount, $dairyCattlePayment->payment_amount);

        $dairyCattleRevenueAccount = ChartOfAccount::where('account_code', '4200')->where('created_by', creatorId())->first();
        $journalEntry = JournalEntry::create([
            'journal_date' => $dairyCattlePayment->payment_date ?? now(),
            'entry_type' => 'automatic',
            'reference_type' => 'dairy_cattle_payment',
            'reference_id' => $dairyCattlePayment->id,
            'description' => 'Dairy Cattle Payment - ' . ($dairyCattlePayment->notes ?? 'Dairy cattle service payment'),
            'total_debit' => $dairyCattlePayment->payment_amount,
            'total_credit' => $dairyCattlePayment->payment_amount,
            'status' => 'posted',
            'creator_id' => Auth::id(),
            'created_by' => creatorId()
        ]);

        JournalEntryItem::create([
            'journal_entry_id' => $journalEntry->id,
            'account_id' => $bankGLAccount->id,
            'description' => 'Dairy cattle payment received',
            'debit_amount' => $dairyCattlePayment->payment_amount,
            'credit_amount' => 0,
            'creator_id' => Auth::id(),
            'created_by' => creatorId()
        ]);

        JournalEntryItem::create([
            'journal_entry_id' => $journalEntry->id,
            'account_id' => $dairyCattleRevenueAccount->id,
            'description' => 'Dairy cattle service revenue earned',
            'debit_amount' => 0,
            'credit_amount' => $dairyCattlePayment->payment_amount,
            'creator_id' => Auth::id(),
            'created_by' => creatorId()
        ]);

        try {
            UpdateBudgetSpending::dispatch($journalEntry);
        } catch (\Exception $e) {
            return back()->with('error', $e->getMessage());
        }

        $this->updateAccountBalances($journalEntry);
        return $journalEntry;
    }

    public function createCateringOrderPaymentJournal($payment) {

        $bankGLAccount = BankAccount::where('id', $payment->bank_account_id)->first()->glAccount;
        if (!$bankGLAccount) {
            throw new \Exception("Bank account must have a GL account assigned");
        }
        $this->validateAccounts(['4200']);
        $this->validateBalance($payment->amount, $payment->amount);

        $cateringServiceRevenueAccount = ChartOfAccount::where('account_code', '4200')->where('created_by', creatorId())->first();
        $journalEntry = JournalEntry::create([
            'journal_date' => $payment->payment_date ?? now(),
            'entry_type' => 'automatic',
            'reference_type' => 'catering_order_payment',
            'reference_id' => $payment->id,
            'description' => 'Catering Order Payment - ' . ($payment->notes ?? 'Catering service payment'),
            'total_debit' => $payment->amount,
            'total_credit' => $payment->amount,
            'status' => 'posted',
            'creator_id' => Auth::id(),
            'created_by' => creatorId()
        ]);

        JournalEntryItem::create([
            'journal_entry_id' => $journalEntry->id,
            'account_id' => $bankGLAccount->id,
            'description' => 'Catering order payment received',
            'debit_amount' => $payment->amount,
            'credit_amount' => 0,
            'creator_id' => Auth::id(),
            'created_by' => creatorId()
        ]);

        JournalEntryItem::create([
            'journal_entry_id' => $journalEntry->id,
            'account_id' => $cateringServiceRevenueAccount->id,
            'description' => 'Catering service revenue earned',
            'debit_amount' => 0,
            'credit_amount' => $payment->amount,
            'creator_id' => Auth::id(),
            'created_by' => creatorId()
        ]);

        try {
            UpdateBudgetSpending::dispatch($journalEntry);
        } catch (\Exception $e) {
            return back()->with('error', $e->getMessage());
        }

        $this->updateAccountBalances($journalEntry);
        return $journalEntry;
    }

    public function createUpdateSalesAgentCommissionPaymentJournal($payment)
    {
        $bankAccount = BankAccount::where('id', $payment->bank_account_id)->first();
        if (!$bankAccount || !$bankAccount->glAccount) {
            throw new \Exception("Bank account must have a GL account assigned");
        }
        $bankGLAccount = $bankAccount->glAccount;

        $this->validateAccounts(['5220']);
        $this->validateBalance($payment->payment_amount, $payment->payment_amount);

        $commissionExpenseAccount = ChartOfAccount::where('account_code', '5220')->where('created_by', creatorId())->first();
        $journalEntry = JournalEntry::create([
            'journal_date' => $payment->payment_date ?? now(),
            'entry_type' => 'automatic',
            'reference_type' => 'sales_agent_commission_payment',
            'reference_id' => $payment->id,
            'description' => 'Commission Payment #' . $payment->payment_number . ' - ' . $payment->agent->user->name,
            'total_debit' => $payment->payment_amount,
            'total_credit' => $payment->payment_amount,
            'status' => 'posted',
            'creator_id' => Auth::id(),
            'created_by' => creatorId()
        ]);
        JournalEntryItem::create([
            'journal_entry_id' => $journalEntry->id,
            'account_id' => $commissionExpenseAccount->id,
            'description' => 'Commission expense - ' . $payment->agent->user->name,
            'debit_amount' => $payment->payment_amount,
            'credit_amount' => 0,
            'creator_id' => Auth::id(),
            'created_by' => creatorId()
        ]);

        JournalEntryItem::create([
            'journal_entry_id' => $journalEntry->id,
            'account_id' => $bankGLAccount->id,
            'description' => 'Payment from ' . $bankAccount->account_name,
            'debit_amount' => 0,
            'credit_amount' => $payment->payment_amount,
            'creator_id' => Auth::id(),
            'created_by' => creatorId()
        ]);

        try {
            UpdateBudgetSpending::dispatch($journalEntry);
        } catch (\Exception $e) {
            return back()->with('error', $e->getMessage());
        }

        $this->updateAccountBalances($journalEntry);
        return $journalEntry;
    }

    /**
     * Creates journal entry for commission adjustment
     * Bonus = Company Expense, Penalty = Company Income
     * Usage: ApproveSalesAgentCommissionAdjustment listener
     */
    public function createCommissionAdjustmentJournal($adjustment)
    {
        $this->validateAccounts(['5220', '2400', '4300']);
        $this->validateBalance($adjustment->adjustment_amount, $adjustment->adjustment_amount);

        $commissionExpenseAccount = ChartOfAccount::where('account_code', '5220')->where('created_by', creatorId())->first();
        $commissionPayableAccount = ChartOfAccount::where('account_code', '2400')->where('created_by', creatorId())->first();
        $otherIncomeAccount = ChartOfAccount::where('account_code', '4300')->where('created_by', creatorId())->first();

        $journalEntry = JournalEntry::create([
            'journal_date' => $adjustment->adjustment_date ?? now(),
            'entry_type' => 'automatic',
            'reference_type' => 'commission_adjustment',
            'reference_id' => $adjustment->id,
            'description' => 'Commission Adjustment (' . ucfirst($adjustment->adjustment_type) . ') - ' . $adjustment->agent->user->name,
            'total_debit' => $adjustment->adjustment_amount,
            'total_credit' => $adjustment->adjustment_amount,
            'status' => 'posted',
            'creator_id' => Auth::id(),
            'created_by' => creatorId()
        ]);

        if ($adjustment->adjustment_type === 'bonus') {
            // Bonus = Company Expense
            JournalEntryItem::create([
                'journal_entry_id' => $journalEntry->id,
                'account_id' => $commissionExpenseAccount->id,
                'description' => 'Commission bonus - ' . $adjustment->adjustment_reason,
                'debit_amount' => $adjustment->adjustment_amount,
                'credit_amount' => 0,
                'creator_id' => Auth::id(),
                'created_by' => creatorId()
            ]);

            JournalEntryItem::create([
                'journal_entry_id' => $journalEntry->id,
                'account_id' => $commissionPayableAccount->id,
                'description' => 'Commission payable to agent',
                'debit_amount' => 0,
                'credit_amount' => $adjustment->adjustment_amount,
                'creator_id' => Auth::id(),
                'created_by' => creatorId()
            ]);
        } elseif ($adjustment->adjustment_type === 'penalty') {
            // Penalty = Company Income
            JournalEntryItem::create([
                'journal_entry_id' => $journalEntry->id,
                'account_id' => $commissionPayableAccount->id,
                'description' => 'Commission deduction from agent',
                'debit_amount' => $adjustment->adjustment_amount,
                'credit_amount' => 0,
                'creator_id' => Auth::id(),
                'created_by' => creatorId()
            ]);

            JournalEntryItem::create([
                'journal_entry_id' => $journalEntry->id,
                'account_id' => $otherIncomeAccount->id,
                'description' => 'Commission penalty - ' . $adjustment->adjustment_reason,
                'debit_amount' => 0,
                'credit_amount' => $adjustment->adjustment_amount,
                'creator_id' => Auth::id(),
                'created_by' => creatorId()
            ]);
        } else {
            // Correction = Can be positive or negative
            $amount = abs($adjustment->adjustment_amount);

            if ($adjustment->adjustment_amount > 0) {
                // Positive correction = Increase expense
                JournalEntryItem::create([
                    'journal_entry_id' => $journalEntry->id,
                    'account_id' => $commissionExpenseAccount->id,
                    'description' => 'Commission correction - ' . $adjustment->adjustment_reason,
                    'debit_amount' => $amount,
                    'credit_amount' => 0,
                    'creator_id' => Auth::id(),
                    'created_by' => creatorId()
                ]);

                JournalEntryItem::create([
                    'journal_entry_id' => $journalEntry->id,
                    'account_id' => $commissionPayableAccount->id,
                    'description' => 'Commission payable adjustment',
                    'debit_amount' => 0,
                    'credit_amount' => $amount,
                    'creator_id' => Auth::id(),
                    'created_by' => creatorId()
                ]);
            } else {
                // Negative correction = Decrease expense
                JournalEntryItem::create([
                    'journal_entry_id' => $journalEntry->id,
                    'account_id' => $commissionPayableAccount->id,
                    'description' => 'Commission payable adjustment',
                    'debit_amount' => $amount,
                    'credit_amount' => 0,
                    'creator_id' => Auth::id(),
                    'created_by' => creatorId()
                ]);

                JournalEntryItem::create([
                    'journal_entry_id' => $journalEntry->id,
                    'account_id' => $commissionExpenseAccount->id,
                    'description' => 'Commission correction - ' . $adjustment->adjustment_reason,
                    'debit_amount' => 0,
                    'credit_amount' => $amount,
                    'creator_id' => Auth::id(),
                    'created_by' => creatorId()
                ]);
            }
        }

        try {
            UpdateBudgetSpending::dispatch($journalEntry);
        } catch (\Exception $e) {
            return back()->with('error', $e->getMessage());
        }

        $this->updateAccountBalances($journalEntry);
        return $journalEntry;
    }

    // =========================================================================
    // FIXED ASSETS — IPSAS 17
    // =========================================================================

    /**
     * Post a monthly straight-line depreciation journal for a fixed asset.
     *
     *   DR: Depreciation Expense Account  (depreciation_expense_account_id)
     *   CR: Accumulated Depreciation      (accumulated_depreciation_account_id)
     *
     * Period-lock is enforced via assertPeriodOpen(). The journal carries
     * the asset's fund_code for fund-level reporting.
     */
    public function createDepreciationJournal($asset, float $amount, string $date)
    {
        $this->assertPeriodOpen($date);

        $expenseAccount = ChartOfAccount::find($asset->depreciation_expense_account_id);
        $contraAccount  = ChartOfAccount::find($asset->accumulated_depreciation_account_id);

        if (! $expenseAccount || ! $contraAccount) {
            throw new \Exception("Depreciation GL accounts not found for asset {$asset->asset_code}.");
        }

        $this->validateBalance($amount, $amount);

        $journalEntry = JournalEntry::create([
            'journal_date'     => $date,
            'entry_type'       => 'automatic',
            'reference_type'   => 'fixed_asset_depreciation',
            'reference_id'     => $asset->id,
            'description'      => "Depreciation — {$asset->asset_name} ({$asset->asset_code}) — " . date('F Y', strtotime($date)),
            'total_debit'      => $amount,
            'total_credit'     => $amount,
            'status'           => 'posted',
            'fiscal_period_id' => $this->resolveFiscalPeriodId($date),
            'fund_code'        => $asset->fund?->code ?? null,
            'approval_status'  => 'approved',
            'prepared_by'      => Auth::id(),
            'creator_id'       => Auth::id(),
            'created_by'       => creatorId(),
        ]);

        JournalEntryItem::create([
            'journal_entry_id' => $journalEntry->id,
            'account_id'       => $expenseAccount->id,
            'description'      => "Depreciation expense — {$asset->asset_code}",
            'debit_amount'     => $amount,
            'credit_amount'    => 0,
            'creator_id'       => Auth::id(),
            'created_by'       => creatorId(),
        ]);

        JournalEntryItem::create([
            'journal_entry_id' => $journalEntry->id,
            'account_id'       => $contraAccount->id,
            'description'      => "Accumulated depreciation — {$asset->asset_code}",
            'debit_amount'     => 0,
            'credit_amount'    => $amount,
            'creator_id'       => Auth::id(),
            'created_by'       => creatorId(),
        ]);

        $this->updateAccountBalances($journalEntry);

        // Notify BudgetPlanner so any depreciation expense budget line
        // gets its spent_amount updated (consistent with all other journal types).
        try {
            UpdateBudgetSpending::dispatch($journalEntry);
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::warning('UpdateBudgetSpending dispatch failed for depreciation: ' . $e->getMessage());
        }

        return $journalEntry;
    }

    /**
     * Post an asset disposal journal per IPSAS 17.
     *
     *   DR: Accumulated Depreciation          (full accumulated amount)
     *   DR: Other Receivables / Cash (1130)   (proceeds, if > 0)
     *   DR: Loss on Disposal (5850)           (if proceeds < carrying amount)
     *   CR: Asset at Cost                     (purchase_cost)
     *   CR: Gain on Disposal (4800)           (if proceeds > carrying amount)
     */
    public function createAssetDisposalJournal($asset, float $proceeds, string $date)
    {
        $this->assertPeriodOpen($date);

        $cost           = (float) $asset->purchase_cost;
        $accumulated    = (float) $asset->accumulated_depreciation;
        $carryingAmount = $cost - $accumulated;
        $gainOrLoss     = $proceeds - $carryingAmount;

        $assetAccount  = ChartOfAccount::find($asset->asset_account_id);
        $contraAccount = $asset->accumulated_depreciation_account_id
            ? ChartOfAccount::find($asset->accumulated_depreciation_account_id)
            : null;

        if (! $assetAccount) {
            throw new \Exception("Asset GL account not found for asset {$asset->asset_code}.");
        }

        $gainAccount = ChartOfAccount::where('account_code', '4800')->where('created_by', creatorId())->first();
        $lossAccount = ChartOfAccount::where('account_code', '5850')->where('created_by', creatorId())->first();
        $cashAccount = ChartOfAccount::where('account_code', '1130')->where('created_by', creatorId())->first();

        $totalDebit  = 0.0;
        $totalCredit = 0.0;
        $items       = [];

        // CR: Asset at cost
        $items[] = ['account_id' => $assetAccount->id, 'debit' => 0, 'credit' => $cost,
                    'desc' => "Disposal of {$asset->asset_code} — cost"];
        $totalCredit += $cost;

        // DR: Remove accumulated depreciation
        if ($accumulated > 0 && $contraAccount) {
            $items[] = ['account_id' => $contraAccount->id, 'debit' => $accumulated, 'credit' => 0,
                        'desc' => "Remove accumulated depreciation — {$asset->asset_code}"];
            $totalDebit += $accumulated;
        }

        // DR: Proceeds received
        if ($proceeds > 0 && $cashAccount) {
            $items[] = ['account_id' => $cashAccount->id, 'debit' => $proceeds, 'credit' => 0,
                        'desc' => "Proceeds from disposal of {$asset->asset_code}"];
            $totalDebit += $proceeds;
        }

        // Gain (CR) or Loss (DR)
        if ($gainOrLoss > 0.005 && $gainAccount) {
            $gain = round($gainOrLoss, 2);
            $items[] = ['account_id' => $gainAccount->id, 'debit' => 0, 'credit' => $gain,
                        'desc' => "Gain on disposal — {$asset->asset_code}"];
            $totalCredit += $gain;
        } elseif ($gainOrLoss < -0.005 && $lossAccount) {
            $loss = round(abs($gainOrLoss), 2);
            $items[] = ['account_id' => $lossAccount->id, 'debit' => $loss, 'credit' => 0,
                        'desc' => "Loss on disposal — {$asset->asset_code}"];
            $totalDebit += $loss;
        }

        $totalDebit  = round($totalDebit, 2);
        $totalCredit = round($totalCredit, 2);
        $this->validateBalance($totalDebit, $totalCredit);

        $journalEntry = JournalEntry::create([
            'journal_date'     => $date,
            'entry_type'       => 'automatic',
            'reference_type'   => 'fixed_asset_disposal',
            'reference_id'     => $asset->id,
            'description'      => "Disposal of asset — {$asset->asset_name} ({$asset->asset_code})",
            'total_debit'      => $totalDebit,
            'total_credit'     => $totalCredit,
            'status'           => 'posted',
            'fiscal_period_id' => $this->resolveFiscalPeriodId($date),
            'fund_code'        => $asset->fund?->code ?? null,
            'approval_status'  => 'approved',
            'prepared_by'      => Auth::id(),
            'creator_id'       => Auth::id(),
            'created_by'       => creatorId(),
        ]);

        foreach ($items as $item) {
            JournalEntryItem::create([
                'journal_entry_id' => $journalEntry->id,
                'account_id'       => $item['account_id'],
                'description'      => $item['desc'],
                'debit_amount'     => $item['debit'],
                'credit_amount'    => $item['credit'],
                'creator_id'       => Auth::id(),
                'created_by'       => creatorId(),
            ]);
        }

        $this->updateAccountBalances($journalEntry);
        return $journalEntry;
    }

    /**
     * Creates journal entry for a supplier invoice posted through a three-way-match
     * procurement workflow (LPO → GRN → Invoice).
     *
     * Instead of debiting Inventory, this debits the expense/vote account defined
     * on the LPO so expenditure is coded to the correct budget line.
     *
     *   DR: Vote / Expense Account (from LPO vote_account_id)
     *   DR: VAT Input / Tax Receivable (if tax > 0)
     *   CR: Accounts Payable (2000)
     *
     * Usage: PostPurchaseInvoiceListener when invoice has an LPO link.
     */
    public function createSupplierInvoiceExpenseJournal($purchaseInvoice, $expenseAccountId): void
    {
        $apAccount = ChartOfAccount::where('account_code', '2000')
            ->where('created_by', creatorId())->first();
        $expenseAccount = ChartOfAccount::find($expenseAccountId);
        $taxAccount = null;

        if (!$apAccount) {
            throw new \Exception("Accounts Payable account (2000) not found.");
        }
        if (!$expenseAccount) {
            throw new \Exception("Vote/expense account (id:{$expenseAccountId}) not found.");
        }

        if ($purchaseInvoice->tax_amount > 0) {
            $taxAccount = ChartOfAccount::where('account_code', '1500')
                ->where('created_by', creatorId())->first();
        }

        $netExpense  = (float)$purchaseInvoice->subtotal - (float)$purchaseInvoice->discount_amount;
        $taxAmount   = (float)($purchaseInvoice->tax_amount ?? 0);
        $totalCredit = $netExpense + $taxAmount;

        $this->validateBalance($totalCredit, (float)$purchaseInvoice->total_amount);

        $invoiceDate = $purchaseInvoice->invoice_date ?? now()->toDateString();
        $this->assertPeriodOpen($invoiceDate);

        $journalEntry = JournalEntry::create([
            'journal_date'     => $invoiceDate,
            'entry_type'       => 'automatic',
            'reference_type'   => 'purchase_invoice',
            'reference_id'     => $purchaseInvoice->id,
            'description'      => 'Supplier Invoice #' . $purchaseInvoice->invoice_number,
            'total_debit'      => $purchaseInvoice->total_amount,
            'total_credit'     => $purchaseInvoice->total_amount,
            'status'           => 'posted',
            'fiscal_period_id' => $this->resolveFiscalPeriodId($invoiceDate),
            'approval_status'  => 'approved',
            'prepared_by'      => Auth::id(),
            'creator_id'       => Auth::id(),
            'created_by'       => creatorId(),
        ]);

        // Debit: Expense / Vote account
        JournalEntryItem::create([
            'journal_entry_id' => $journalEntry->id,
            'account_id'       => $expenseAccount->id,
            'description'      => 'Expenditure from ' . ($purchaseInvoice->vendor->name ?? 'supplier'),
            'debit_amount'     => $netExpense,
            'credit_amount'    => 0,
            'creator_id'       => Auth::id(),
            'created_by'       => creatorId(),
        ]);

        // Debit: VAT Input (if applicable)
        if ($taxAmount > 0 && $taxAccount) {
            JournalEntryItem::create([
                'journal_entry_id' => $journalEntry->id,
                'account_id'       => $taxAccount->id,
                'description'      => 'VAT on supplier invoice',
                'debit_amount'     => $taxAmount,
                'credit_amount'    => 0,
                'creator_id'       => Auth::id(),
                'created_by'       => creatorId(),
            ]);
        }

        // Credit: Accounts Payable
        JournalEntryItem::create([
            'journal_entry_id' => $journalEntry->id,
            'account_id'       => $apAccount->id,
            'description'      => 'Payable to ' . ($purchaseInvoice->vendor->name ?? 'supplier'),
            'debit_amount'     => 0,
            'credit_amount'    => $purchaseInvoice->total_amount,
            'creator_id'       => Auth::id(),
            'created_by'       => creatorId(),
        ]);

        $this->updateAccountBalances($journalEntry);

        // Notify BudgetPlanner to recalculate spending against this expense account
        try {
            UpdateBudgetSpending::dispatch($journalEntry);
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::warning('UpdateBudgetSpending dispatch failed: ' . $e->getMessage());
        }
    }

}
