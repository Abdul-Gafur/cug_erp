# IPSAS Audit — University ERPGo System
*Generated: 2026-04-06*

---

## 1. System Overview

**Framework**: Laravel 10/11 (PHP), Inertia.js bridge, React/TypeScript (TSX) frontend.

**Architecture pattern**: Modular SaaS add-on architecture by Workdo. The core application (`/app/`) handles the foundational purchasing, sales, warehousing, and user management. Accounting, double-entry reporting, and budgeting are separate Composer packages installed under `/packages/workdo/`.

**Frontend stack**: React + TypeScript via Inertia.js. All pages are `.tsx` files rendered server-side-initiated but client-side navigated. No Blade templates in the three modules — all UI is React components. PDF/print output is done via browser print (client-side `jsPDF` or `html2pdf` libraries called in TSX), not server-side PDF generation.

**Multi-tenancy**: Every table has `created_by` (the company owner's user ID) and `creator_id` (the staff member who created the record). The `creatorId()` helper in `/app/Helpers/Helper.php` resolves the current tenant. All queries are scoped by `created_by`.

**User roles**: `superadmin` (platform owner), `company` (university/tenant owner), `staff` (university staff), `client` (maps to Customer), `vendor` (maps to Supplier). This role model is a commercial SaaS construct — the `client` role is inappropriate for a university context.

**Module activation**: Modules are toggled via `Module_is_active('Account')` etc. Each module has a `PlanModuleCheck` middleware guard. The Account, DoubleEntry, and BudgetPlanner packages must all be active for the three modules to function.

**Key packages relevant to these modules**:
- `workdo/Account` — Chart of accounts, journal entries, bank accounts, vendor/customer payments, debit/credit notes, revenues, expenses
- `workdo/DoubleEntry` — Balance sheet, trial balance, P&L, general ledger, cash flow, ledger summary
- `workdo/BudgetPlanner` — Budget periods, budgets, allocations, monitoring
- `workdo/ProductService` — Products and services catalogue (referenced by purchase and sales invoice items)

**Inter-module communication**: Laravel Events and Listeners. No direct method calls across package boundaries — everything goes through event dispatch. This is architecturally clean and means adding new listeners (e.g., commitment accounting) is low-risk.

**Translation system**: All UI strings are wrapped in `t()` (frontend) and `__()` (backend). Translation files exist per locale per package. This means terminology changes can be made in translation files without touching component logic — a significant advantage for the university renaming task.

---

## 2. Module File Maps

### 2.1 Accounting & Finance

#### Core Application Files
| File | Description |
|---|---|
| `app/Http/Controllers/SalesInvoiceController.php` | CRUD + post + print for sales invoices; dispatches PostSalesInvoice event on post |
| `app/Http/Controllers/TransferController.php` | CRUD for stock transfers between warehouses; dispatches CreateTransfer/DestroyTransfer events |
| `app/Http/Controllers/WarehouseController.php` | CRUD for warehouse master records |
| `app/Models/SalesInvoice.php` | Sales invoice model; relations to customer (User), items, payment allocations, returns |
| `app/Models/SalesInvoiceItem.php` | Line items for sales invoices; auto-calculates totals on save |
| `app/Models/SalesInvoiceItemTax.php` | Per-item tax records for sales invoices |
| `app/Models/SalesInvoiceReturn.php` | Sales return header linked to original sales invoice |
| `app/Models/SalesInvoiceReturnItem.php` | Line items for sales returns |
| `app/Models/Transfer.php` | Stock transfer record between two warehouses |
| `app/Models/Warehouse.php` | Warehouse master |
| `app/Helpers/Helper.php` | `creatorId()`, `Module_is_active()`, `formatCurrency()`, and other global helpers |
| `routes/web.php` | Core routes: purchase-invoices, sales-invoices, purchase-returns, sales-returns, transfers, warehouses |

#### Account Package Files
| File | Description |
|---|---|
| `packages/workdo/Account/src/Services/JournalService.php` | Central service (~850 lines); creates all automatic double-entry journal entries for every transaction type |
| `packages/workdo/Account/src/Services/ReportService.php` | Account module reports: invoice aging, bill aging, tax summary, customer/vendor balances |
| `packages/workdo/Account/src/Services/DebitNoteService.php` | Debit note creation and application logic |
| `packages/workdo/Account/src/Services/BankTransactionsService.php` | Bank transaction recording and reconciliation |
| `packages/workdo/Account/src/Helpers/AccountUtility.php` | Seeds default Chart of Accounts, account types, and categories when a company activates the module |
| `packages/workdo/Account/src/Models/ChartOfAccount.php` | COA model; fields: account_code, account_name, account_type_id, parent_account_id, level, normal_balance, opening_balance, current_balance, is_active, is_system_account |
| `packages/workdo/Account/src/Models/JournalEntry.php` | Journal entry header; fields include journal_number, entry_type (automatic/manual), reference_type, reference_id, status (draft/posted/reversed) |
| `packages/workdo/Account/src/Models/JournalEntryItem.php` | Journal line item; fields: account_id, debit_amount, credit_amount |
| `packages/workdo/Account/src/Models/BankAccount.php` | Bank account; linked to a GL account via gl_account_id |
| `packages/workdo/Account/src/Models/DebitNote.php` | Debit note (created from purchase returns); fields include vendor_id, original_invoice_id, return_id, approved_by |
| `packages/workdo/Account/src/Models/CreditNote.php` | Credit note (created from sales returns); fields include customer_id, original_invoice_id, return_id, approved_by |
| `packages/workdo/Account/src/Models/AccountCategory.php` | Five top-level categories: Assets, Liabilities, Equity, Revenue, Expenses |
| `packages/workdo/Account/src/Models/AccountType.php` | Account sub-types (Current Assets, Fixed Assets, COGS, Operating Expenses, etc.) |
| `packages/workdo/Account/src/Models/Vendor.php` | Vendor profile linked to User via user_id |
| `packages/workdo/Account/src/Models/Customer.php` | Customer profile linked to User via user_id |
| `packages/workdo/Account/src/Models/VendorPayment.php` | Vendor payment header; links to bank account and vendor |
| `packages/workdo/Account/src/Models/VendorPaymentAllocation.php` | Allocates a vendor payment to one or more purchase invoices |
| `packages/workdo/Account/src/Models/CustomerPayment.php` | Customer payment header |
| `packages/workdo/Account/src/Models/CustomerPaymentAllocation.php` | Allocates a customer payment to one or more sales invoices |
| `packages/workdo/Account/src/Models/Revenue.php` | Direct revenue entry (not invoice-based) |
| `packages/workdo/Account/src/Models/Expense.php` | Direct expense entry (not invoice-based) |
| `packages/workdo/Account/src/Listeners/PostPurchaseInvoiceListener.php` | Responds to PostPurchaseInvoice event; calls JournalService to create purchase inventory journal |
| `packages/workdo/Account/src/Listeners/PostSalesInvoiceListener.php` | Responds to PostSalesInvoice event; creates sales + COGS journals |
| `packages/workdo/Account/src/Listeners/CreateDebitNoteFromReturn.php` | Responds to ApprovePurchaseReturn; auto-creates a draft debit note |
| `packages/workdo/Account/src/Listeners/CreateCreditNoteFromReturn.php` | Responds to ApproveSalesReturn; auto-creates a draft credit note |
| `packages/workdo/Account/src/Listeners/CreateTransferListener.php` | Responds to CreateTransfer; creates stock transfer journal entry |
| `packages/workdo/Account/src/Listeners/DestroyTransferListener.php` | Responds to DestroyTransfer; reverses the stock transfer journal |
| `packages/workdo/Account/src/Providers/EventServiceProvider.php` | Binds all events to their Account module listeners |
| `packages/workdo/Account/src/Routes/web.php` | Account module routes: vendors, customers, bank-accounts, vendor-payments, customer-payments, debit-notes, credit-notes, revenues, expenses, chart-of-accounts, reports |
| `packages/workdo/Account/src/Resources/js/Pages/Dashboard/CompanyDashboard.tsx` | Account dashboard: total vendors, customer/vendor payment totals, monthly payment charts, recent revenues/expenses |
| `packages/workdo/Account/src/Resources/js/Pages/Vendors/` | Index, Create, Edit, View for vendors |
| `packages/workdo/Account/src/Resources/js/Pages/Customers/` | Index, Create, Edit, View for customers |
| `packages/workdo/Account/src/Resources/js/Pages/VendorPayments/` | Index, Create, View for vendor payments |
| `packages/workdo/Account/src/Resources/js/Pages/CustomerPayments/` | Index, Create, View for customer payments |
| `packages/workdo/Account/src/Resources/js/Pages/DebitNotes/` | Index, View, Create (manual) for debit notes |
| `packages/workdo/Account/src/Resources/js/Pages/CreditNotes/` | Index, View, Create (manual) for credit notes |
| `packages/workdo/Account/src/Resources/js/Pages/Revenues/` | Index, Create for direct revenue entries |
| `packages/workdo/Account/src/Resources/js/Pages/Expenses/` | Index, Create for direct expense entries |
| `packages/workdo/Account/src/Resources/js/Pages/BankAccounts/` | Index for bank accounts |
| `packages/workdo/Account/src/Resources/js/Pages/BankTransactions/` | Index, reconciliation mark |
| `packages/workdo/Account/src/Resources/js/Pages/BankTransfers/` | Index, Create for inter-bank transfers |
| `packages/workdo/Account/src/Resources/js/Pages/SystemSetup/ChartOfAccounts/` | Index, Create, Edit, Show for COA management |
| `packages/workdo/Account/src/Resources/js/Pages/Reports/` | InvoiceAging, BillAging, TaxSummary, CustomerBalance, VendorBalance, CustomerDetail, VendorDetail + Print variants |

#### DoubleEntry Package Files
| File | Description |
|---|---|
| `packages/workdo/DoubleEntry/src/Services/BalanceSheetService.php` | Generates balance sheet from journal entries by account code range; handles year-end close |
| `packages/workdo/DoubleEntry/src/Services/ProfitLossService.php` | Calculates net profit from revenue (4000-4999) minus expenses (5000-5999) for a date range |
| `packages/workdo/DoubleEntry/src/Services/TrialBalanceService.php` | Computes opening balance + journal activity per account for a period |
| `packages/workdo/DoubleEntry/src/Services/LedgerSummaryService.php` | Summarises GL activity by account |
| `packages/workdo/DoubleEntry/src/Services/ReportService.php` | General Ledger, Account Statement, Journal Entry Report, Account Balance, Cash Flow, Expense Report |
| `packages/workdo/DoubleEntry/src/Http/Controllers/BalanceSheetController.php` | Balance sheet CRUD + compare periods + year-end close + finalize + notes |
| `packages/workdo/DoubleEntry/src/Routes/web.php` | All double-entry routes under `/double-entry/` prefix |
| `packages/workdo/DoubleEntry/src/Resources/js/Pages/BalanceSheets/` | Index, Generate, View, Print, Compare, Comparison, ComparisonPrint, Note, YearEndClose |
| `packages/workdo/DoubleEntry/src/Resources/js/Pages/ProfitLoss/` | Index, Print — labelled "Profit & Loss Statement"; uses `net_profit` field name |
| `packages/workdo/DoubleEntry/src/Resources/js/Pages/TrialBalance/` | Index, Print |
| `packages/workdo/DoubleEntry/src/Resources/js/Pages/LedgerSummary/` | Index, Print |
| `packages/workdo/DoubleEntry/src/Resources/js/Pages/Reports/` | GeneralLedger, AccountStatement, JournalEntry, AccountBalance, CashFlow, ExpenseReport + Print variants |

---

### 2.2 Budgeting

| File | Description |
|---|---|
| `packages/workdo/BudgetPlanner/src/Services/BudgetService.php` | Core budget logic: recalculates `spent_amount` and `remaining_amount` on allocations from journal entry data; creates monitoring snapshots |
| `packages/workdo/BudgetPlanner/src/Http/Controllers/BudgetPeriodController.php` | CRUD + approve/active/close lifecycle for budget periods |
| `packages/workdo/BudgetPlanner/src/Http/Controllers/BudgetController.php` | CRUD + approve/active/close lifecycle for individual budgets |
| `packages/workdo/BudgetPlanner/src/Http/Controllers/BudgetAllocationController.php` | CRUD for budget allocations (account-level budget lines); restricted to expense accounts (5000-5999) |
| `packages/workdo/BudgetPlanner/src/Http/Controllers/BudgetMonitoringController.php` | Read-only monitoring dashboard showing allocation vs actual spending |
| `packages/workdo/BudgetPlanner/src/Listeners/UpdateBudgetSpendingLis.php` | Receives UpdateBudgetSpending event from JournalService; delegates to BudgetService |
| `packages/workdo/BudgetPlanner/src/Providers/EventServiceProvider.php` | Binds UpdateBudgetSpending event to UpdateBudgetSpendingLis |
| `packages/workdo/BudgetPlanner/src/Models/BudgetPeriod.php` | Budget period model; fields: period_name, financial_year, start_date, end_date, status, approved_by |
| `packages/workdo/BudgetPlanner/src/Models/Budget.php` | Budget model; fields: budget_name, period_id, budget_type (operational/capital/cash_flow), total_budget_amount, status, approved_by |
| `packages/workdo/BudgetPlanner/src/Models/BudgetAllocation.php` | Allocation model; links Budget to ChartOfAccount; tracks allocated_amount, spent_amount, remaining_amount |
| `packages/workdo/BudgetPlanner/src/Models/BudgetMonitoring.php` | Monitoring snapshot; stores total_allocated, total_spent, total_remaining, variance_amount, variance_percentage at a point in time |
| `packages/workdo/BudgetPlanner/src/Routes/web.php` | All budget routes under `/budget-planner/` prefix |
| `packages/workdo/BudgetPlanner/src/Resources/js/Pages/BudgetPeriods/` | Index, Create, Edit |
| `packages/workdo/BudgetPlanner/src/Resources/js/Pages/Budgets/` | Index, Create, Edit |
| `packages/workdo/BudgetPlanner/src/Resources/js/Pages/BudgetAllocations/` | Index, Create, Edit |
| `packages/workdo/BudgetPlanner/src/Resources/js/Pages/BudgetMonitorings/` | Index (read-only dashboard) |

---

### 2.3 Procurement / Purchasing

| File | Description |
|---|---|
| `app/Http/Controllers/PurchaseInvoiceController.php` | CRUD + post + print for purchase invoices; dispatches PostPurchaseInvoice on post |
| `app/Http/Controllers/PurchaseReturnController.php` | CRUD + approve + complete for purchase returns; dispatches ApprovePurchaseReturn/CompletePurchaseReturn |
| `app/Models/PurchaseInvoice.php` | Purchase invoice model; relations to vendor (User), warehouse, items, vendorDetails (Vendor profile), paymentAllocations, purchaseReturns |
| `app/Models/PurchaseInvoiceItem.php` | Line items; auto-calculates subtotal, discount, tax, total on save |
| `app/Models/PurchaseInvoiceItemTax.php` | Per-item tax breakdown records |
| `app/Models/PurchaseReturn.php` | Return header; linked to original_invoice_id; has debitNote relation |
| `app/Models/PurchaseReturnItem.php` | Return line items; tracks original_invoice_item_id, original_quantity, return_quantity |
| `app/Models/PurchaseReturnItemTax.php` | Per-item tax breakdown for return items |
| `routes/web.php:62-80` | Routes: purchase-invoices (resource + post + print), purchase-returns (manual routes + approve + complete) |
| `resources/js/pages/Purchase/` | Index, Create, Edit, View, Print + reusable form components |
| `resources/js/pages/PurchaseReturns/` | Index, Create, View |

---

## 3. Database Tables

### 3.1 Accounting & Finance

#### `account_categories`
| Column | Type | Notes |
|---|---|---|
| id | bigint PK | |
| name | string | Assets, Liabilities, Equity, Revenue, Expenses |
| code | string | ASSET, LIAB, EQ, REV, EXP |
| type | enum | asset, liability, equity, revenue, expense |
| description | text nullable | |
| created_by | bigint FK users | Tenant owner |
| creator_id | bigint FK users | |
| timestamps | | |

#### `account_types`
| Column | Type | Notes |
|---|---|---|
| id | bigint PK | |
| category_id | bigint FK account_categories | |
| name | string | Current Assets, Fixed Assets, COGS, Operating Expenses, etc. |
| code | string | CA, FA, COGS, OE, etc. |
| normal_balance | enum | debit, credit |
| description | text nullable | |
| created_by | bigint FK users | |
| creator_id | bigint FK users | |
| timestamps | | |

#### `chart_of_accounts`
| Column | Type | Notes |
|---|---|---|
| id | bigint PK | |
| account_code | string | 4-digit code (1000–5800 in default seeding) |
| account_name | string | Human-readable name |
| account_type_id | bigint FK account_types | |
| parent_account_id | bigint FK chart_of_accounts nullable | Self-referential hierarchy |
| level | integer | Hierarchy depth |
| normal_balance | enum | debit, credit |
| opening_balance | decimal(15,2) default 0 | |
| current_balance | decimal(15,2) default 0 | Updated by JournalService on each posting |
| is_active | boolean default true | |
| is_system_account | boolean default false | System accounts cannot be deleted |
| description | text nullable | |
| created_by | bigint FK users | |
| creator_id | bigint FK users | |
| timestamps | | |

**Relationships**: account_types → account_categories (many-to-one). chart_of_accounts → account_types (many-to-one). chart_of_accounts → chart_of_accounts self-join for hierarchy.

#### `journal_entries`
| Column | Type | Notes |
|---|---|---|
| id | bigint PK | |
| journal_number | string unique | Auto-generated: JE-YYYY-NNN |
| journal_date | date | |
| entry_type | enum | automatic, manual |
| reference_type | string nullable | e.g. 'purchase_invoice', 'vendor_payment' |
| reference_id | bigint nullable | FK to the originating record |
| description | text nullable | |
| total_debit | decimal(15,2) | |
| total_credit | decimal(15,2) | Must equal total_debit |
| status | enum | draft, posted, reversed |
| created_by | bigint FK users | |
| creator_id | bigint FK users | |
| timestamps | | |

#### `journal_entry_items`
| Column | Type | Notes |
|---|---|---|
| id | bigint PK | |
| journal_entry_id | bigint FK journal_entries | |
| account_id | bigint FK chart_of_accounts | |
| description | string nullable | |
| debit_amount | decimal(15,2) default 0 | |
| credit_amount | decimal(15,2) default 0 | |
| created_by | bigint FK users | |
| creator_id | bigint FK users | |
| timestamps | | |

#### `bank_accounts`
| Column | Type | Notes |
|---|---|---|
| id | bigint PK | |
| account_number | string | |
| account_name | string | |
| bank_name | string | |
| branch_name | string nullable | |
| account_type | string | e.g. checking, savings |
| payment_gateway | string nullable | |
| opening_balance | decimal(15,2) | |
| current_balance | decimal(15,2) | |
| iban | string nullable | |
| swift_code | string nullable | |
| routing_number | string nullable | |
| is_active | boolean | |
| gl_account_id | bigint FK chart_of_accounts | Links bank account to a GL account |
| created_by / creator_id | bigint | Tenant scoping |
| timestamps | | |

#### `vendor_payments`
| Column | Type | Notes |
|---|---|---|
| id | bigint PK | |
| payment_number | string | Auto-generated |
| payment_date | date | |
| vendor_id | bigint FK users | |
| bank_account_id | bigint FK bank_accounts | |
| amount | decimal(15,2) | |
| payment_method | string | |
| reference | string nullable | |
| notes | text nullable | |
| status | string | |
| created_by / creator_id | bigint | |
| timestamps | | |

#### `vendor_payment_allocations`
| Column | Type | Notes |
|---|---|---|
| id | bigint PK | |
| payment_id | bigint FK vendor_payments | |
| invoice_id | bigint FK purchase_invoices | |
| allocated_amount | decimal(15,2) | |
| created_by / creator_id | bigint | |
| timestamps | | |

#### `customer_payments` / `customer_payment_allocations`
Mirror structure of vendor_payments / vendor_payment_allocations, referencing sales_invoices.

#### `debit_notes`
| Column | Type | Notes |
|---|---|---|
| id | bigint PK | |
| debit_note_number | string | Auto-generated: DN-YYYY-MM-NNN |
| debit_note_date | date | |
| vendor_id | bigint FK users | |
| invoice_id | bigint FK purchase_invoices nullable | |
| return_id | bigint FK purchase_returns nullable | |
| reason | text | |
| status | enum | draft, approved, applied, cancelled |
| subtotal / tax_amount / discount_amount / total_amount | decimal(15,2) | |
| applied_amount | decimal(15,2) | Amount already offset against payables |
| balance_amount | decimal(15,2) | Remaining unapplied balance |
| approved_by | bigint FK users nullable | |
| created_by / creator_id | bigint | |
| timestamps | | |

#### `credit_notes`
Mirror structure of debit_notes but referencing customers and sales_invoices.

#### `revenues`
| Column | Type | Notes |
|---|---|---|
| id | bigint PK | |
| revenue_date | date | |
| category_id | bigint FK revenue_categories | |
| account_id | bigint FK chart_of_accounts | |
| bank_account_id | bigint FK bank_accounts | |
| amount | decimal(15,2) | |
| description | text nullable | |
| reference | string nullable | |
| created_by / creator_id | bigint | |
| timestamps | | |

#### `expenses`
Mirror structure of revenues, referencing expense_categories.

#### `balance_sheets` (DoubleEntry package)
| Column | Type | Notes |
|---|---|---|
| id | bigint PK | |
| sheet_name | string | |
| as_of_date | date | Balance sheet date |
| status | enum | draft, finalized |
| total_assets / total_liabilities / total_equity | decimal(15,2) | |
| notes | text nullable | |
| finalized_by | bigint FK users nullable | |
| finalized_at | timestamp nullable | |
| created_by / creator_id | bigint | |
| timestamps | | |

---

### 3.2 Budgeting

#### `budget_periods`
| Column | Type | Notes |
|---|---|---|
| id | bigint PK | |
| period_name | string | e.g. "FY 2025/2026" |
| financial_year | string | |
| start_date | date | |
| end_date | date | |
| status | enum | draft, approved, active, closed |
| approved_by | bigint FK users nullable | |
| created_by / creator_id | bigint | |
| timestamps | | |

#### `budgets`
| Column | Type | Notes |
|---|---|---|
| id | bigint PK | |
| budget_name | string | |
| period_id | bigint FK budget_periods | |
| budget_type | enum | operational, capital, cash_flow |
| total_budget_amount | decimal(15,2) | Recalculated as sum of allocations |
| status | enum | draft, approved, active, closed |
| approved_by | bigint FK users nullable | |
| created_by / creator_id | bigint | |
| timestamps | | |

#### `budget_allocations`
| Column | Type | Notes |
|---|---|---|
| id | bigint PK | |
| budget_id | bigint FK budgets | |
| account_id | bigint FK chart_of_accounts | Restricted to accounts 5000-5999 (expense range) |
| allocated_amount | decimal(15,2) | Budget line amount |
| spent_amount | decimal(15,2) default 0 | Updated automatically by BudgetService |
| remaining_amount | decimal(15,2) | = allocated_amount - spent_amount |
| created_by / creator_id | bigint | |
| timestamps | | |

#### `budget_monitorings`
| Column | Type | Notes |
|---|---|---|
| id | bigint PK | |
| budget_id | bigint FK budgets | |
| monitoring_date | date | Date of the snapshot |
| total_allocated | decimal(15,2) | |
| total_spent | decimal(15,2) | |
| total_remaining | decimal(15,2) | |
| variance_amount | decimal(15,2) | = total_allocated - total_spent |
| variance_percentage | decimal(5,2) | = variance / allocated * 100 |
| created_by / creator_id | bigint | |
| timestamps | | |

---

### 3.3 Procurement / Purchasing

#### `purchase_invoices`
| Column | Type | Notes |
|---|---|---|
| id | bigint PK | |
| invoice_number | string unique | Auto-generated: PI-YYYY-MM-NNN |
| invoice_date | date | |
| due_date | date | |
| vendor_id | bigint FK users | User with role=vendor |
| warehouse_id | bigint FK warehouses nullable | |
| subtotal | decimal(15,2) | |
| tax_amount | decimal(15,2) | |
| discount_amount | decimal(15,2) | |
| total_amount | decimal(15,2) | |
| paid_amount | decimal(15,2) default 0 | Updated by VendorPaymentAllocation |
| debit_note_applied | decimal(15,2) default 0 | Amount offset by debit notes |
| balance_amount | decimal(15,2) | = total - paid - debit_note_applied |
| status | enum | draft, posted, partial, paid, overdue |
| payment_terms | string nullable | Free text e.g. "Net 30" |
| notes | text nullable | |
| created_by / creator_id | bigint | |
| timestamps | | |

#### `purchase_invoice_items`
| Column | Type | Notes |
|---|---|---|
| id | bigint PK | |
| invoice_id | bigint FK purchase_invoices | |
| product_id | bigint FK product_service_items | |
| quantity | integer | |
| unit_price | decimal(15,2) | Sourced from product's purchase_price |
| discount_percentage | decimal(5,2) | |
| discount_amount | decimal(15,2) | |
| tax_percentage | decimal(5,2) | |
| tax_amount | decimal(15,2) | |
| total_amount | decimal(15,2) | |
| timestamps | | |

#### `purchase_invoice_item_taxes`
| Column | Type | Notes |
|---|---|---|
| id | bigint PK | |
| item_id | bigint FK purchase_invoice_items | |
| tax_name | string | |
| tax_rate | decimal(5,2) | |
| timestamps | | |

#### `purchase_returns`
| Column | Type | Notes |
|---|---|---|
| id | bigint PK | |
| return_number | string unique | Auto-generated: PR-YYYY-MM-NNN |
| return_date | date | |
| vendor_id | bigint FK users | |
| warehouse_id | bigint FK warehouses nullable | |
| original_invoice_id | bigint FK purchase_invoices | |
| reason | enum | defective, wrong_item, damaged, excess_quantity, other |
| subtotal / tax_amount / discount_amount / total_amount | decimal(15,2) | |
| status | enum | draft, approved, completed, cancelled |
| notes | text nullable | |
| created_by / creator_id | bigint | |
| timestamps | | |

#### `purchase_return_items`
| Column | Type | Notes |
|---|---|---|
| id | bigint PK | |
| return_id | bigint FK purchase_returns | |
| product_id | bigint FK product_service_items | |
| original_invoice_item_id | bigint FK purchase_invoice_items | |
| original_quantity | integer | |
| return_quantity | integer | Max = original - already returned |
| unit_price / discount_percentage / discount_amount / tax_percentage / tax_amount / total_amount | decimal | |
| reason | string nullable | Per-line reason |
| timestamps | | |

#### Related: `warehouses`
| Column | Type | Notes |
|---|---|---|
| id | bigint PK | |
| name | string | |
| address | text nullable | |
| city / state / country / zip | string nullable | |
| is_active | boolean | |
| created_by / creator_id | bigint | |
| timestamps | | |

#### Related: `transfers`
| Column | Type | Notes |
|---|---|---|
| id | bigint PK | |
| from_warehouse | bigint FK warehouses | |
| to_warehouse | bigint FK warehouses | |
| product_id | bigint FK product_service_items | |
| quantity | decimal(15,2) | |
| date | date | |
| created_by / creator_id | bigint | |
| timestamps | | |

---

## 4. Current Module Behaviour

### 4.1 Accounting & Finance — End-to-End

**Chart of Accounts setup**: When a company (tenant) activates the Account module, `AccountUtility::seedDefaultData()` creates the full 50-account default COA automatically. These are standard commercial IFRS accounts (codes 1000–5800). Administrators can add, edit, or deactivate accounts but cannot delete system accounts.

**Purchase Invoice lifecycle**:
1. User creates a purchase invoice (status: `draft`). Selects a vendor (user with vendor role), optional warehouse, invoice date, due date, payment terms, and adds line items (products from ProductService catalogue, each with quantity, unit price, discount %, tax %).
2. Invoice totals (subtotal, tax, discount, total) are computed automatically on save via model observer.
3. While `draft`, the invoice can be edited or deleted.
4. User clicks **Post**. Status changes to `posted`. Event `PostPurchaseInvoice` is dispatched.
5. `PostPurchaseInvoiceListener` calls `JournalService::createPurchaseInventoryJournal()`:
   - Dr: Inventory (1200) for item totals
   - Dr: Tax Receivable/VAT Input (1500) for tax amounts
   - Cr: Accounts Payable (2000) for total invoice amount
6. Posted invoices cannot be edited or deleted.

**Vendor Payment lifecycle**:
1. User creates a vendor payment in the Account module: selects vendor, bank account, amount, date.
2. Outstanding (posted, partial, overdue) invoices for that vendor are fetched for allocation.
3. Payment is allocated to one or more invoices. Each allocation updates `paid_amount` and recalculates `balance_amount` and status (partial/paid) on the invoice.
4. `JournalService::createVendorPaymentJournal()` is called:
   - Dr: Accounts Payable (2000)
   - Cr: Bank GL Account (linked via bank_account.gl_account_id)
5. Event `UpdateBudgetSpending` is dispatched with affected account IDs → triggers BudgetService.

**Purchase Return lifecycle**:
1. User creates a return linked to a posted purchase invoice. System calculates available return quantity.
2. Status: `draft`. Can be edited/deleted.
3. User **approves** the return. Status: `approved`. Event `ApprovePurchaseReturn` dispatched.
4. `CreateDebitNoteFromReturn` listener auto-creates a DebitNote (status: `draft`) for the return total.
5. User can then navigate to Account > Debit Notes to approve the debit note.
6. Once debit note is approved, it can be applied to reduce the vendor's outstanding balance.
7. User **completes** the return. Status: `completed`. Event `CompletePurchaseReturn` dispatched.

**Revenue entry**: Direct revenue entries (not via sales invoice) are recorded in Account > Revenues. User selects revenue category, GL account, bank account, amount. `JournalService` creates: Dr Bank GL, Cr selected Revenue account. `UpdateBudgetSpending` is dispatched.

**Expense entry**: Mirror of revenue. Dr selected Expense account, Cr Bank GL. `UpdateBudgetSpending` dispatched.

**Bank Transfer**: Between internal bank accounts. Dr destination bank GL + Dr Bank Charges (5510 if fee), Cr source bank GL.

**Double-Entry Reports**:
- **Balance Sheet**: Generated on demand for an "as of" date. Uses raw SQL across `journal_entry_items` + `chart_of_accounts` grouped by account code ranges. Can be finalized (locked) and compared across periods.
- **Profit & Loss**: Revenue accounts (4000–4999) minus expense accounts (5000–5999) for a date range. Labelled "Net Profit" / "Net Loss".
- **Trial Balance**: Opening balance per account + journal activity within a period.
- **Year-End Close**: Transfers net income/loss to Retained Earnings (3200). Creates a reversing journal entry zeroing out all revenue and expense accounts.

### 4.2 Budgeting — End-to-End

**Budget Period**: Created first. Defines a financial year with start/end dates. Lifecycle: draft → approved (by an authorised user) → active → closed. Only one period should be active at a time (not enforced in code — no uniqueness constraint on active periods).

**Budget**: Created within a period. Has a `budget_type` (operational, capital, cash_flow) — this is only a label; the code treats all types identically. Lifecycle mirrors the period: draft → approved → active → closed.

**Budget Allocation**: Links an active budget to a specific expense account (accounts 5000–5999 only — hardcoded filter). Stores the `allocated_amount`. The budget's `total_budget_amount` is recalculated as the sum of all its allocations. Important: creating an allocation auto-approves the parent budget if it is still `draft`.

**Budget Monitoring (passive)**:
- When any journal entry is posted that touches an expense account (via vendor payment, direct expense, or other), `JournalService` dispatches `UpdateBudgetSpending`.
- `BudgetService` finds all **active** budgets with allocations matching the affected accounts.
- For each matching allocation, it re-queries `journal_entry_items` + `journal_entries` (status=posted, within the budget period's date range) to recalculate actual spending from source data.
- Updates `spent_amount` = actual spend, `remaining_amount` = allocated - spent.
- Creates a new `BudgetMonitoring` snapshot record with totals and variance percentage.
- **No spending block**: If `remaining_amount` goes negative, the transaction still posts. There is no pre-commitment check, no warning to the user at point of entry.

### 4.3 Procurement / Purchasing — End-to-End

The procurement module is **invoice-only**. There is no purchase request, purchase order, or goods receipt workflow. The complete current flow is:

1. User directly creates a Purchase Invoice (supplier presents invoice → user enters it).
2. Line items are selected from the ProductService catalogue.
3. Invoice is posted → journal entries created → payable recorded.
4. Payment is made via Account module → payable cleared.
5. If goods need to be returned → Purchase Return → Debit Note.

**What is absent** (critical for IPSAS/university procurement):
- Purchase Requisition (no table, no controller, no model)
- Purchase Order (no table, no controller, no model)
- Goods Receipt / Delivery Note (no table, no controller, no model)
- Three-way matching (PO vs GRN vs Invoice) — not possible as PO and GRN do not exist
- Approval workflow on purchase invoices (only draft → posted, no approver field on the invoice)
- Department or cost centre attribution on line items

---

## 5. Inter-Module Connections

### Existing Connections (via Laravel Events)

| Event | Fired From | Received By | Effect |
|---|---|---|---|
| `PostPurchaseInvoice` | `PurchaseInvoiceController::post()` | `Account\Listeners\PostPurchaseInvoiceListener` | Creates Inventory + Tax Receivable / Accounts Payable journal |
| `PostSalesInvoice` | `SalesInvoiceController::post()` | `Account\Listeners\PostSalesInvoiceListener` | Creates A/R / Sales Revenue + VAT journal; then COGS journal if product type |
| `ApprovePurchaseReturn` | `PurchaseReturnController::approve()` | `Account\Listeners\CreateDebitNoteFromReturn` | Auto-creates draft debit note |
| `ApproveSalesReturn` | `SalesReturnController::approve()` | `Account\Listeners\CreateCreditNoteFromReturn` | Auto-creates draft credit note |
| `CreateTransfer` | `TransferController::store()` | `Account\Listeners\CreateTransferListener` | Creates inter-warehouse inventory journal |
| `DestroyTransfer` | `TransferController::destroy()` | `Account\Listeners\DestroyTransferListener` | Reverses inter-warehouse journal |
| `UpdateBudgetSpending` | `Account\Services\JournalService` (after vendor payment, customer payment, revenue entry, expense entry) | `BudgetPlanner\Listeners\UpdateBudgetSpendingLis` | Recalculates budget allocation spending and creates monitoring snapshot |

### Connections to Other System Modules
- **HR / Payroll**: No connection exists. Salaries are entered as direct expenses or via manual journal entries only.
- **Inventory / ProductService**: Purchase and sales invoice items reference `product_service_items` (ProductService package). Stock levels (`warehouse_stocks`) are updated when sales invoices are posted (via COGS journal and stock deduction). Purchase invoices add to inventory value but **do not automatically increment warehouse stock** — this is a known gap; the journal debits the Inventory GL account but the `warehouse_stocks` table is only updated by the Sales flow and Transfer flow.
- **Fixed Assets**: Two fixed asset GL accounts exist (Equipment 1600, Buildings 1700) with accumulated depreciation contra accounts, but there is no asset register module — no `fixed_assets` table, no depreciation schedule, no disposal workflow.
- **Helpdesk**: Present in the system but no financial integration.
- **SaaS Plans/Subscriptions**: Routes and controllers exist for selling ERP subscriptions (plans, coupons, orders). These are platform-level commercial features entirely inappropriate for university internal use.

### Connections Missing for IPSAS Compliance
- Budget → Purchase Invoice: No pre-commitment check when a purchase invoice is created or posted.
- Purchase Request → Purchase Order → Goods Receipt → Invoice: The entire upstream procurement chain is absent.
- Departmental/cost-centre coding: No link between transactions and university departments.
- Fund accounting: No fund dimension on any transaction.
- Grant/project tracking: No project codes on any transaction.

---

## 6. IPSAS Gap Analysis

### 6.1 Accounting & Finance

| Area | Current State | What Needs to Change | IPSAS Reference |
|---|---|---|---|
| Accounting basis | Mixed: purchase/sales invoices support accrual (post on invoice); revenues/expenses default to cash basis (bank-linked) | Ensure full accrual basis throughout; revenue entry should record A/R, not just bank receipt; expense entry should record A/P | IPSAS 1 — Presentation of Financial Statements |
| Fund accounting | None. No fund codes, fund types, or fund balance tracking | Add fund dimension to chart of accounts or as a separate code on transactions; ring-fence appropriated funds | IPSAS 1, IPSAS 24 — Presentation of Budget Information |
| Chart of accounts structure | Commercial IFRS structure (1000–5800); equity shows "Share Capital" and "Retained Earnings"; revenue includes "Product Sales", "Sales Revenue", "COGS" | Replace commercial accounts with IPSAS-appropriate accounts: Accumulated Surplus/Deficit replaces Retained Earnings; Net Assets replaces Share Capital; Non-exchange revenue accounts (grants, levies, transfers); remove or relabel COGS | IPSAS 1, IPSAS 9, IPSAS 23 |
| Journal entry controls | Manual journal entries have no approval workflow; no period locking (any date can be used); no reversal control | Add period locking (close periods to prevent back-dating); require approval for manual journals; auto-generate reversal references | IPSAS 1, IPF General |
| Financial statement formats | P&L is titled "Profit & Loss Statement" with "Net Profit/Net Loss" terminology; Balance Sheet shows "Share Capital", "Retained Earnings" | Rename to "Statement of Financial Performance"; rename "Net Profit" to "Surplus / (Deficit)"; rename "Retained Earnings" to "Accumulated Surplus"; rename "Share Capital" to "Net Assets / General Fund" | IPSAS 1 |
| Year-end close | Implemented: transfers net income to Retained Earnings (3200) | Change target account to Accumulated Surplus; update the close journal description | IPSAS 1 |
| Depreciation | GL accounts exist for depreciation expense (5430) and accumulated depreciation (1610, 1710) but no depreciation engine | Add asset register and depreciation schedule module or manual depreciation journal workflow | IPSAS 17 — Property, Plant and Equipment |
| Comparative statements | Balance sheet comparison exists (DoubleEntry) | Ensure prior-period comparatives are presented in financial statements | IPSAS 1 |

### 6.2 Budgeting

| Area | Current State | What Needs to Change | IPSAS Reference |
|---|---|---|---|
| Budget structure | Three budget types (operational, capital, cash_flow) but no differentiated logic | Implement actual differentiated treatment: capital budgets should link to asset acquisition; operating budgets to recurrent expenditure | IPSAS 24 |
| Budget presentation | Budget monitoring exists but is separate from financial statements | Financial statements must present original budget, final budget, and actual amounts in a Budget Execution Statement | IPSAS 24 — Presentation of Budget Information in Financial Statements |
| Budget control (hard) | None. Budget is monitored passively; no block on overspending | Add pre-commitment/encumbrance check: when a purchase invoice is posted, check remaining budget before allowing posting; configurable warn vs block | IPSAS 24, IPF |
| Commitment accounting | None. No encumbrance or pre-encumbrance | Add commitment tracking: when a purchase order is raised (once PO module exists), reserve the budget allocation; relieve on invoice posting | IPSAS 24 |
| Revenue budgets | Budget allocations restricted to expense accounts 5000–5999 (hardcoded) | Allow revenue budget allocations (income estimates) as well as expenditure allocations | IPSAS 24 |
| Multi-year budgets | Not supported (one period per budget) | Allow budget period to span multiple years for capital projects | IPSAS 24 |
| Budget amendments | No amendment workflow | Budget revisions should create an audit trail showing original vs amended amounts with reason and approver | IPSAS 24 |
| Variance reporting | Variance = allocated − spent. Monitoring snapshot created on each transaction | Enhance monitoring to show variance against both original and revised budget; exportable report | IPSAS 24 |

### 6.3 Procurement / Purchasing

| Area | Current State | What Needs to Change | IPSAS Reference |
|---|---|---|---|
| Procurement cycle | Invoice-only. No requisition, no PO, no GRN | Implement full procurement cycle: Purchase Requisition → Purchase Order → Goods Receipt Note → Supplier Invoice → Payment | IPSAS 12 (Inventories), General procurement standards |
| Three-way matching | Not possible (PO and GRN absent) | After implementing PO and GRN: enforce three-way match before invoice can be posted | General procurement |
| Approval workflow | Purchase invoices have draft → posted only; no approver field | Add multi-level approval (department head, finance officer, procurement officer) with approval audit trail | IPF |
| Commitment/encumbrance | None | On PO creation: encumber the relevant budget allocation; relieve on invoice receipt | IPSAS 24 |
| Supplier management | Vendors are Users with role=vendor. Basic fields only | Add supplier registration with registration number, tax ID, bank details, performance rating; separate from the user auth model | General procurement |
| Goods/services distinction | All purchase items are products from the ProductService catalogue with a `purchase_price` | Distinguish goods (inventory-affecting), services (expense-affecting), and capital items (asset-affecting) at the line item level | IPSAS 12, IPSAS 17 |
| Departmental coding | No department or cost centre on invoice or line items | Add department/cost_centre_id to purchase invoice header and/or line items | IPSAS 1 |
| Inventory reconciliation | Purchase invoice posts Dr: Inventory (GL), but does not increment `warehouse_stocks` | Fix: posting a purchase invoice should also increment the physical stock count in `warehouse_stocks` | IPSAS 12 |

---

## 7. University Context Issues

The following is a comprehensive list of commercial/sales-oriented terminology found in the codebase that is inappropriate for a university context.

### 7.1 Database Column Names & Model Fields

| Location | Current | Should Be | Notes |
|---|---|---|---|
| `purchase_invoices.vendor_id` | vendor_id | supplier_id | Vendor is commercial; Supplier is standard procurement |
| `purchase_returns.reason` (enum values) | defective, wrong_item, damaged, excess_quantity, other | Keep but review | These are acceptable |
| `sales_invoices.customer_id` | customer_id | payer_id or debtor_id | If university issues invoices to students/external parties |
| `sales_invoices.type` (enum: product/service) | product / service | goods / service | "Product" implies commercial sale |
| `budgets.budget_type` (enum) | operational, capital, cash_flow | Acceptable | These are standard budget type labels |
| `journal_entries.reference_type` values | 'purchase_invoice', 'sales_invoice', 'vendor_payment', 'customer_payment' | 'supplier_invoice', 'income_invoice', 'supplier_payment', 'income_receipt' | Internal reference strings in JournalService |
| `debit_notes.debit_note_number` (prefix DN-) | DN- | Acceptable | Standard accounting abbreviation |
| `credit_notes.credit_note_number` (prefix CN-) | CN- | Acceptable | Standard accounting abbreviation |
| `purchase_invoices.invoice_number` (prefix PI-) | PI- | Acceptable | Standard |
| `revenues` table | revenues | Could remain but income_entries or university_income is clearer | |
| `expenses` table | expenses | Acceptable | |

### 7.2 Chart of Accounts — Account Names

File: `packages/workdo/Account/src/Helpers/AccountUtility.php`

| Line | Current Account Name | Should Be | IPSAS / University Note |
|---|---|---|---|
| ~97 | "Accounts Receivable" description: "Money owed by customers" | "Money owed by debtors / students / external parties" | Description only |
| ~98 | "Inventory" description: "Goods held for sale" | "Goods / supplies held for use" | University holds consumables, not resale goods |
| ~109 | "Accounts Payable" description: "Money owed to suppliers" | Acceptable — change "suppliers" from current "suppliers" is fine | |
| ~115 | Account 2350: "Customer Deposits" | "Advance Receipts" or "Income Received in Advance" | Universities receive advance fees, not customer deposits |
| ~120 | Account 3100: "Share Capital" description: "Owner's investment in business" | "Net Assets" / "University Endowment" / "General Fund" | Universities have no shareholders |
| ~121 | Account 3200: "Retained Earnings" description: "Accumulated business profits" | "Accumulated Surplus / (Deficit)" | IPSAS 1 mandates this terminology |
| ~123 | Account 4100: "Sales Revenue" | "Income from Sales of Goods" or just remove if not applicable | |
| ~124 | Account 4010: "Product Sales" | "Sales of Goods" or "Sundry Income" | |
| ~127 | Account 4040: "Subscription Revenue" | Remove or rename to "Course/Programme Fees" if applicable | |
| ~128 | Account 4110: "Commission Income" | Remove or rename | Not typical for universities |
| ~133 | Account 4400: "Project Revenue" | "Research Grant Income" or "Project Income" | |
| ~135 | Account 5100: "Cost of Goods Sold" type_code: COGS | "Cost of Goods / Supplies Issued" | Universities do not "sell" goods; they issue supplies |
| ~138 | Account 5220: "Sales Commission Expense" | Remove or replace with "Agency Fees" | Universities do not pay sales commissions |
| ~141 | Account 5320: "Marketing Expense" | "Communications & Outreach Expense" or "Publicity Expense" | |

### 7.3 Account Type Names (account_types table / seeding)

File: `packages/workdo/Account/src/Helpers/AccountUtility.php` (account types array)

| Current Type Name | Current Code | Should Be |
|---|---|---|
| "Sales Revenue" | SR | "Income" or "Exchange Revenue" |
| "Cost of Goods Sold" | COGS | "Cost of Goods / Supplies" |
| "Share Capital" | SC | "Net Assets" / "General Fund" |
| "Retained Earnings" | RE | "Accumulated Surplus/Deficit" |

### 7.4 UI Labels — TSX Frontend Pages

| File | Line(s) | Current Label | Should Be |
|---|---|---|---|
| `packages/workdo/Account/src/Resources/js/Pages/Dashboard/CompanyDashboard.tsx` | ~56 | "Total Vendors" | "Total Suppliers" |
| `packages/workdo/Account/src/Resources/js/Pages/Dashboard/CompanyDashboard.tsx` | ~61 | "Active vendors" | "Active suppliers" |
| `packages/workdo/Account/src/Resources/js/Pages/Dashboard/CompanyDashboard.tsx` | ~66 | "Total Customer Payment" | "Total Income Received" or "Total Receipts" |
| `packages/workdo/Account/src/Resources/js/Pages/Dashboard/CompanyDashboard.tsx` | ~76 | "Total Vendor Payment" | "Total Supplier Payment" |
| `packages/workdo/Account/src/Resources/js/Pages/Dashboard/CompanyDashboard.tsx` | ~81 | "Paid to vendors" | "Paid to suppliers" |
| `packages/workdo/Account/src/Resources/js/Pages/Dashboard/CompanyDashboard.tsx` | ~91 | "Monthly Customer Payments" | "Monthly Income Receipts" |
| `packages/workdo/Account/src/Resources/js/Pages/Dashboard/CompanyDashboard.tsx` | ~135 | "Monthly Vendor Payments" | "Monthly Supplier Payments" |
| `packages/workdo/DoubleEntry/src/Resources/js/Pages/ProfitLoss/Index.tsx` | ~64 | "Profit & Loss Statement" (page title) | "Statement of Financial Performance" |
| `packages/workdo/DoubleEntry/src/Resources/js/Pages/ProfitLoss/Index.tsx` | ~137 | "Net Profit" / "Net Loss" | "Surplus" / "(Deficit)" |
| `packages/workdo/DoubleEntry/src/Resources/js/Pages/ProfitLoss/Print.tsx` | ~47 | filename `profit-loss-[date].pdf` | `statement-financial-performance-[date].pdf` |
| `packages/workdo/DoubleEntry/src/Resources/js/Pages/ProfitLoss/Print.tsx` | ~66 | "Profit & Loss Statement" | "Statement of Financial Performance" |
| `packages/workdo/DoubleEntry/src/Resources/js/Pages/ProfitLoss/Print.tsx` | ~148 | "Net Profit" / "Net Loss" | "Surplus" / "(Deficit)" |
| `packages/workdo/DoubleEntry/src/Resources/js/Pages/BalanceSheets/YearEndClose.tsx` | ~85 | "Net income will be transferred to retained earnings" | "Surplus/Deficit will be transferred to Accumulated Surplus" |
| `resources/js/pages/Purchase/Create.tsx` | ~69 | "Create Purchase Invoice" | "Create Supplier Invoice" or "New Purchase Invoice" |
| `resources/js/pages/Purchase/Create.tsx` | ~119 | "Select Vendor" (placeholder) | "Select Supplier" |
| `resources/js/pages/SalesReturns/View.tsx` | ~32–35 | "Sales Returns" / "Sales Return Details" / "Sales Return #..." | Acceptable for invoice-based income; or "Income Returns" if preferred |
| `packages/workdo/Account/src/Resources/js/Pages/Reports/InvoiceAging.tsx` | — | "Invoice Aging" | "Receivables Aging" |
| `packages/workdo/Account/src/Resources/js/Pages/Reports/BillAging.tsx` | — | "Bill Aging" | "Payables Aging" |
| `packages/workdo/Account/src/Resources/js/Pages/Reports/CustomerBalance.tsx` | — | "Customer Balance" | "Debtor Balance" |
| `packages/workdo/Account/src/Resources/js/Pages/Reports/CustomerDetail.tsx` | — | "Customer Detail" | "Debtor Detail" |
| `packages/workdo/Account/src/Resources/js/Pages/Reports/VendorBalance.tsx` | — | "Vendor Balance" | "Supplier Balance" |
| `packages/workdo/Account/src/Resources/js/Pages/Reports/VendorDetail.tsx` | — | "Vendor Detail" | "Supplier Detail" |

### 7.5 Route Names

| Current Route Name | Should Be |
|---|---|
| `account.vendors.*` | `account.suppliers.*` |
| `account.vendor-payments.*` | `account.supplier-payments.*` |
| `account.customer-payments.*` | `account.income-receipts.*` or keep for now |
| `purchase-invoices.*` | `supplier-invoices.*` (or retain as is — procurement-neutral) |
| `sales-invoices.*` | `income-invoices.*` or `revenue-invoices.*` |
| `double-entry.profit-loss.*` | `double-entry.financial-performance.*` |
| `settings.company.*` | `settings.institution.*` |

### 7.6 Settings / Configuration Language

| File | Current | Should Be |
|---|---|---|
| `routes/web.php:119` | `settings.company.update` route | `settings.institution.update` |
| `resources/js/pages/SuperAdminDashboard.tsx` | `<ShoppingCart>` icon for revenue/orders | Replace with appropriate icon (e.g. `<Building2>`, `<Receipt>`) |
| `resources/js/pages/coupons/` | Coupon management for subscription sales | Entire coupon/plan/subscription system is commercial SaaS infrastructure — not relevant to university internal ERP use |

### 7.7 JournalService Internal Reference Types

File: `packages/workdo/Account/src/Services/JournalService.php`

These are stored as string values in `journal_entries.reference_type`:

| Current String | Should Be |
|---|---|
| `'purchase_invoice'` | `'supplier_invoice'` |
| `'sales_invoice'` | `'income_invoice'` (or retain) |
| `'vendor_payment'` | `'supplier_payment'` |
| `'customer_payment'` | `'income_receipt'` |
| Description: "Purchase Invoice posting for ..." | "Supplier Invoice posting for ..." |
| Description: "Sales Invoice posting for ..." | "Income Invoice posting for ..." |

**Note**: Changing `reference_type` string values will break any existing journal entry lookups that filter by this string. Migration required if changed after data exists.

---

## 8. Recommended Session Approach

### Suggested Order

**Session 1 — Chart of Accounts & Financial Statement Terminology** (low risk, high visibility)
- Rename commercial COA account names in `AccountUtility.php` (affects new tenants only; existing data is unaffected since account names are display strings)
- Rename "Retained Earnings" → "Accumulated Surplus/Deficit" and "Share Capital" → "General Fund / Net Assets"
- Update DoubleEntry P&L pages: "Profit & Loss" → "Statement of Financial Performance"; "Net Profit" → "Surplus"; "Net Loss" → "Deficit"
- Update Balance Sheet year-end close text

**Session 2 — Vendor/Customer Terminology** (medium risk — route renames require coordinated view updates)
- Rename Vendor → Supplier throughout: route names, UI labels, translation files, dashboard strings
- Rename Customer → Debtor/Payer in accounting context (note: if students are registered as "clients" in the system, this needs careful scoping)
- Update report names: Invoice Aging → Receivables Aging, Bill Aging → Payables Aging, etc.

**Session 3 — Budgeting Enhancements**
- Add revenue budget allocations (remove the 5000-5999 hardcoded restriction in `BudgetAllocationController`)
- Add budget amendment workflow with audit trail
- Add configurable budget overspend warning (soft block) on purchase invoice posting
- Add Budget Execution Statement view matching IPSAS 24 format

**Session 4 — Procurement Workflow** (highest risk — new tables, new workflows)
- Add Purchase Requisition model/controller/views
- Add Purchase Order model/controller/views
- Add Goods Receipt Note model/controller/views
- Wire three-way matching on invoice posting
- Add department/cost_centre_id to purchase invoice

**Session 5 — Commitment Accounting**
- Once PO exists: encumber budget on PO creation, relieve on invoice posting
- Add `encumbered_amount` to `budget_allocations`

### Dependencies & Risks

1. **Translation files**: All UI string changes should be made in the translation JSON files rather than directly in `.tsx` files, since the `t()` wrapper is consistently used. This makes Session 1 and 2 changes safer and reversible.

2. **`reference_type` strings in journal entries**: Do NOT change these until a migration is written to update existing data. Changing the string in JournalService but not in existing records will break journal lookups and the `reference_type`-based drilldown in reports.

3. **Budget allocation restriction** (5000–5999): This is a hardcoded filter in `BudgetAllocationController`. Removing it will immediately allow revenue budget lines — test carefully as `BudgetService` spending calculation logic also assumes expense accounts (debit-normal).

4. **Inventory reconciliation gap**: Purchase invoice posting currently does NOT update `warehouse_stocks`. Before adding a full procurement workflow, this bug should be fixed — otherwise receiving goods via GRN and via PO will produce double inventory in the GL vs single in the stock table.

5. **Single active period**: No code prevents two budget periods being simultaneously `active`. Before using the budget module in production, add a unique constraint or application-level check.

6. **Vendor/Customer = User record**: Vendors and customers are stored as `users` rows with role types. Renaming them in the UI must not alter the underlying `role` values (which are `vendor` and `client` in the users table) without a full migration — the `PlanModuleCheck` and permission system key off these role strings.

7. **SaaS infrastructure**: The plans/coupons/orders/subscriptions system (routes/web.php:98–106) is irrelevant to university internal use. It should be hidden or disabled in the university deployment but not deleted — the module system depends on it for activation tracking.

---

## 9. Anything Else Worth Knowing

### 9.1 PDF Generation is Browser-Side Only
Print routes render full-page Inertia views with a print stylesheet. PDF generation uses client-side JavaScript (`jsPDF` / `html2pdf`). This means:
- No server-side PDF generation (no DomPDF, Snappy, or similar).
- PDF filenames like `profit-loss-2025-01-01-to-2025-12-31.pdf` are set in the TSX component.
- Layout/formatting of printed documents is controlled by TSX + CSS, not Blade templates.
- To add letterhead, watermarks, or IPSAS-mandated statement headings, the Print TSX files must be modified.

### 9.2 No Audit Trail on Status Changes
The system uses `updated_at` and `approved_by` fields but there is no change history table. When a budget is approved, `approved_by` is set but the previous `approved_by` value is overwritten. When an invoice is posted, there is no record of who posted it or when (only `updated_at`). For IPSAS and public sector accountability, a proper audit log (who changed what, when, from what state, to what state) should be added.

### 9.3 Period Locking is Absent
Journal entries can be created with any date — past, present, or future. There is no mechanism to "close" a period and prevent back-dated entries. For IPSAS compliance and period-end reporting integrity, period locking must be added. The `budget_periods` table has a `status` field that could be extended for this purpose, but currently the journal system does not consult it.

### 9.4 No Multi-Currency Support
All monetary fields are plain `decimal(15,2)` with no currency code column. The currency is configured as a system-wide setting (symbol only, in `companyAllSetting`). Multi-currency is not supported. For a university receiving grants in foreign currencies, this will be a limitation.

### 9.5 Inventory / Stock Mismatch Bug
As noted above, when a purchase invoice is posted, `JournalService` debits the Inventory GL account (1200) but the `warehouse_stocks` pivot table is not updated. Goods receipt is only reflected in `warehouse_stocks` by the Transfer flow and by the Sales Invoice posting flow (which decrements stock). This means the GL Inventory balance and the physical warehouse stock count will diverge for purchases. This is a pre-existing bug that should be fixed before any procurement workflow is built on top of it.

### 9.6 Budget Auto-Approve Side Effect
In `BudgetAllocationController::store()`, if the parent budget is in `draft` status when the first allocation is created, the system automatically changes the budget status to `approved`. This silent state transition is undocumented in the UI and bypasses the formal approval workflow. It should be removed or made explicit.

### 9.7 Hardcoded Account Code Ranges
The DoubleEntry services and the Budget allocation filter rely on hardcoded account code ranges (e.g., `account_code BETWEEN 1000 AND 1399` for current assets). If the university restructures its COA to use a different numbering scheme (which IPSAS compliance may require), all these hardcoded ranges in `BalanceSheetService.php`, `ProfitLossService.php`, and `BudgetAllocationController.php` must be updated. Consider making these ranges configuration-driven rather than hardcoded.

### 9.8 SaaS Commercial Infrastructure
The following routes and controllers exist purely for the commercial SaaS business model and have no relevance to university internal use:
- `routes/web.php:98–106`: plans, coupons, orders, subscriptions
- `/resources/js/pages/plans/`, `/resources/js/pages/coupons/`, `/resources/js/pages/orders/`
- `resources/js/pages/SuperAdminDashboard.tsx`: uses `<ShoppingCart>` icon

These should be hidden from university staff users via the permission/role system rather than deleted.

### 9.9 Translation Infrastructure is an Asset
Because every visible string is wrapped in `t()` on the frontend, the university renaming task (customer → student/payer, vendor → supplier, profit → surplus, etc.) can largely be done in the JSON translation files under each package's `lang/` directory without touching TSX component logic. This is the safest approach for terminology changes — it is reversible, testable, and does not risk breaking component imports or type definitions. For the audit trail, backend PHP `__()` calls similarly point to translation files.
