<?php

namespace Workdo\Account\Http\Controllers;

use App\Models\SalesInvoiceReturn;
use App\Models\User;
use App\Models\PurchaseInvoice;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Workdo\Account\Models\Customer;
use Workdo\Account\Models\Vendor;
use Workdo\Account\Models\CustomerPayment;
use Workdo\Account\Models\VendorPayment;
use Workdo\Account\Models\Revenue;
use Workdo\Account\Models\Expense;
use Workdo\Account\Models\BankAccount;
use Workdo\Account\Models\JournalEntry;
use Workdo\Account\Models\JournalEntryItem;
use Workdo\Account\Models\ChartOfAccount;
use Carbon\Carbon;

class DashboardController extends Controller
{
    public function index(Request $request)
    {
        if(Auth::user()->can('manage-account-dashboard')){
            $user = Auth::user();
            $userType = $user->type;

            switch ($userType) {
                case 'company':
                    return $this->companyDashboard();
                case 'vendor':
                    return $this->vendorDashboard();
                case 'client':
                    return $this->clientDashboard();
                case 'staff':
                default:
                    return $this->staffDashboard();
            }
        }
        return back()->with('error', __('Permission denied'));
    }

    private function companyDashboard()
    {
        $creatorId = creatorId();
        $now       = Carbon::now();
        $yearStart = $now->copy()->startOfYear();
        $prevYearStart = $now->copy()->subYear()->startOfYear();
        $prevYearEnd   = $now->copy()->subYear();

        // ── 1. Active fiscal period (BudgetPlanner) ───────────────────────────
        $activePeriod = null;
        if (class_exists(\Workdo\BudgetPlanner\Models\BudgetPeriod::class)) {
            $activePeriod = \Workdo\BudgetPlanner\Models\BudgetPeriod::where('created_by', $creatorId)
                ->where('status', 'active')
                ->orderBy('start_date', 'desc')
                ->first();
        }

        // ── 2. BUDGET POSITION (current fiscal year) ──────────────────────────
        $budgetPosition = [
            'approved'  => 0,
            'committed' => 0,
            'actual'    => 0,
            'available' => 0,
            'by_fund'   => [],
        ];

        if ($activePeriod && class_exists(\Workdo\BudgetPlanner\Models\Budget::class)) {
            $allocations = \Workdo\BudgetPlanner\Models\BudgetAllocation::whereHas('budget', function ($q) use ($activePeriod, $creatorId) {
                $q->where('period_id', $activePeriod->id)
                  ->whereIn('status', ['active', 'approved', 'vc_authorised'])
                  ->where('created_by', $creatorId);
            })->with('budget')->where('created_by', $creatorId)->get();

            foreach ($allocations as $alloc) {
                $budgetPosition['approved']  += (float) $alloc->allocated_amount;
                $budgetPosition['committed'] += (float) $alloc->committed_amount;
                $budgetPosition['actual']    += (float) $alloc->spent_amount;

                $fund = $alloc->budget->fund_type ?? 'General';
                if (!isset($budgetPosition['by_fund'][$fund])) {
                    $budgetPosition['by_fund'][$fund] = ['approved' => 0, 'committed' => 0, 'actual' => 0, 'available' => 0];
                }
                $budgetPosition['by_fund'][$fund]['approved']  += (float) $alloc->allocated_amount;
                $budgetPosition['by_fund'][$fund]['committed'] += (float) $alloc->committed_amount;
                $budgetPosition['by_fund'][$fund]['actual']    += (float) $alloc->spent_amount;
            }

            $budgetPosition['available'] = $budgetPosition['approved']
                - $budgetPosition['committed']
                - $budgetPosition['actual'];

            foreach ($budgetPosition['by_fund'] as $fund => &$row) {
                $row['available'] = $row['approved'] - $row['committed'] - $row['actual'];
            }
            unset($row);

            // Convert associative to indexed array for JSON
            $budgetPosition['by_fund'] = collect($budgetPosition['by_fund'])
                ->map(fn ($v, $k) => array_merge(['fund' => $k], $v))
                ->values()
                ->toArray();
        }

        // ── 3. CASH & BANK ────────────────────────────────────────────────────
        $bankAccounts = BankAccount::where('created_by', $creatorId)
            ->where('is_active', true)
            ->select('id', 'account_name', 'bank_name', 'account_number', 'current_balance')
            ->get()
            ->map(fn ($b) => [
                'account_name'   => $b->account_name,
                'bank_name'      => $b->bank_name,
                'account_number' => $b->account_number,
                'balance'        => (float) $b->current_balance,
            ])
            ->toArray();

        $totalCashAndBank = collect($bankAccounts)->sum('balance');

        // ── 4. PROCUREMENT STATUS ─────────────────────────────────────────────
        $procurementStatus = [
            'open_lpos'              => ['count' => 0, 'value' => 0],
            'pending_match'          => ['count' => 0, 'value' => 0],
            'awaiting_payment'       => ['count' => 0, 'value' => 0],
            'overdue_payments'       => ['count' => 0, 'value' => 0],
        ];

        // Open LPOs awaiting GRN (status approved or emailed, no fully-received GRN)
        if (class_exists(\Workdo\Quotation\Models\LocalPurchaseOrder::class)) {
            $openLpos = \Workdo\Quotation\Models\LocalPurchaseOrder::where('created_by', $creatorId)
                ->whereIn('status', ['approved', 'emailed'])
                ->selectRaw('COUNT(*) as cnt, SUM(total_amount) as total')
                ->first();
            $procurementStatus['open_lpos'] = [
                'count' => (int) ($openLpos->cnt ?? 0),
                'value' => (float) ($openLpos->total ?? 0),
            ];
        }

        // Invoices pending three-way match resolution (match_status = 'pending' or 'fail')
        if (DB::getSchemaBuilder()->hasColumn('purchase_invoices', 'match_status')) {
            $pending = PurchaseInvoice::where('created_by', $creatorId)
                ->whereIn('match_status', ['pending', 'fail'])
                ->whereNotNull('lpo_id')
                ->selectRaw('COUNT(*) as cnt, SUM(total_amount) as total')
                ->first();
            $procurementStatus['pending_match'] = [
                'count' => (int) ($pending->cnt ?? 0),
                'value' => (float) ($pending->total ?? 0),
            ];
        }

        // Invoices approved (posted) awaiting payment (balance_amount > 0, not overdue)
        $awaitingPayment = PurchaseInvoice::where('created_by', $creatorId)
            ->whereIn('status', ['posted', 'partial'])
            ->where('balance_amount', '>', 0)
            ->where(fn ($q) => $q->whereNull('due_date')->orWhere('due_date', '>=', $now->toDateString()))
            ->selectRaw('COUNT(*) as cnt, SUM(balance_amount) as total')
            ->first();
        $procurementStatus['awaiting_payment'] = [
            'count' => (int) ($awaitingPayment->cnt ?? 0),
            'value' => (float) ($awaitingPayment->total ?? 0),
        ];

        // Overdue payments (past due_date, still outstanding)
        $overdue = PurchaseInvoice::where('created_by', $creatorId)
            ->whereIn('status', ['posted', 'partial'])
            ->where('balance_amount', '>', 0)
            ->where('due_date', '<', $now->toDateString())
            ->selectRaw('COUNT(*) as cnt, SUM(balance_amount) as total')
            ->first();
        $procurementStatus['overdue_payments'] = [
            'count' => (int) ($overdue->cnt ?? 0),
            'value' => (float) ($overdue->total ?? 0),
        ];

        // ── 5. FINANCIAL PERFORMANCE YTD ─────────────────────────────────────
        // Revenue: sum of revenue GL accounts (4000-4999) from posted journal entries YTD
        $revenueYTD = (float) JournalEntryItem::join('journal_entries', 'journal_entries.id', '=', 'journal_entry_items.journal_entry_id')
            ->join('chart_of_accounts', 'chart_of_accounts.id', '=', 'journal_entry_items.account_id')
            ->where('journal_entries.status', 'posted')
            ->where('journal_entries.created_by', $creatorId)
            ->whereBetween('journal_entries.journal_date', [$yearStart->toDateString(), $now->toDateString()])
            ->whereBetween('chart_of_accounts.account_code', ['4000', '4999'])
            ->sum('journal_entry_items.credit_amount');

        $revenuePriorYTD = (float) JournalEntryItem::join('journal_entries', 'journal_entries.id', '=', 'journal_entry_items.journal_entry_id')
            ->join('chart_of_accounts', 'chart_of_accounts.id', '=', 'journal_entry_items.account_id')
            ->where('journal_entries.status', 'posted')
            ->where('journal_entries.created_by', $creatorId)
            ->whereBetween('journal_entries.journal_date', [$prevYearStart->toDateString(), $prevYearEnd->toDateString()])
            ->whereBetween('chart_of_accounts.account_code', ['4000', '4999'])
            ->sum('journal_entry_items.credit_amount');

        // Expenditure: sum of expense GL accounts (5000-5999) YTD
        $expenditureYTD = (float) JournalEntryItem::join('journal_entries', 'journal_entries.id', '=', 'journal_entry_items.journal_entry_id')
            ->join('chart_of_accounts', 'chart_of_accounts.id', '=', 'journal_entry_items.account_id')
            ->where('journal_entries.status', 'posted')
            ->where('journal_entries.created_by', $creatorId)
            ->whereBetween('journal_entries.journal_date', [$yearStart->toDateString(), $now->toDateString()])
            ->whereBetween('chart_of_accounts.account_code', ['5000', '5999'])
            ->sum('journal_entry_items.debit_amount');

        $surplusDeficit = $revenueYTD - $expenditureYTD;

        $performance = [
            'revenue_ytd'        => $revenueYTD,
            'revenue_prior_ytd'  => $revenuePriorYTD,
            'expenditure_ytd'    => $expenditureYTD,
            'approved_budget'    => $budgetPosition['approved'],
            'surplus_deficit'    => $surplusDeficit,
        ];

        return Inertia::render('Account/Dashboard/CompanyDashboard', [
            'budgetPosition'    => $budgetPosition,
            'bankAccounts'      => $bankAccounts,
            'totalCashAndBank'  => $totalCashAndBank,
            'procurementStatus' => $procurementStatus,
            'performance'       => $performance,
            'fiscalPeriod'      => $activePeriod ? [
                'name'       => $activePeriod->period_name,
                'start_date' => $activePeriod->start_date,
                'end_date'   => $activePeriod->end_date,
            ] : null,
        ]);
    }

    private function vendorDashboard()
    {
        $user = Auth::user();

        $totalPayments = VendorPayment::where('vendor_id', $user->id)->sum('payment_amount');
        $totalExpenses = Expense::where('created_by', $user->created_by)->sum('amount');
        $paymentCount = VendorPayment::where('vendor_id', $user->id)->count();

        $isDemo = config('app.is_demo');
        $monthlyPayments = [];
        for ($i = 5; $i >= 0; $i--) {
            $date = Carbon::now()->subMonths($i);
            $monthName = $date->format('M');

            if ($isDemo) {
                $monthPayments = rand(1000, 10000) + rand(0, 99) / 100;
            } else {
                $monthPayments = VendorPayment::where('vendor_id', $user->id)
                    ->whereMonth('created_at', $date->month)
                    ->whereYear('created_at', $date->year)
                    ->sum('payment_amount');
            }

            $monthlyPayments[] = [
                'month' => $monthName,
                'payments' => $monthPayments
            ];
        }

        // Dynamic return purchase invoices
        $recentReturnInvoices = collect();
        if (class_exists('\\App\Models\\PurchaseReturn')) {
            $recentReturnInvoices = \App\Models\PurchaseReturn::where('vendor_id', $user->id)
                ->latest()
                ->limit(5)
                ->get()
                ->map(function($return) {
                    return [
                        'id' => $return->id,
                        'invoice_number' => $return->return_number ?? 'PUR-RET-' . $return->id,
                        'amount' => $return->total_amount ?? 0,
                        'date' => $return->created_at->format('M d, Y'),
                        'status' => $return->status ?? 'Pending'
                    ];
                });
        }

        // Dynamic debit notes
        $recentDebitNotes = collect();
        if (class_exists('\\Workdo\\Account\\Models\\DebitNote')) {
            $recentDebitNotes = \Workdo\Account\Models\DebitNote::where('vendor_id', $user->id)
                ->latest()
                ->limit(5)
                ->get()
                ->map(function($note) {
                    return [
                        'id' => $note->id,
                        'debit_note_number' => $note->debit_note_number ?? 'DN-' . $note->id,
                        'amount' => $note->total_amount ?? 0,
                        'date' => $note->created_at->format('M d, Y'),
                        'status' => $note->status ?? 'Pending'
                    ];
                });
        }

        return Inertia::render('Account/Dashboard/VendorDashboard', [
            'stats' => [
                'total_payments' => $totalPayments,
                'total_expenses' => $totalExpenses,
                'payment_count' => $paymentCount
            ],
            'monthlyPayments' => $monthlyPayments,
            'recentReturnInvoices' => $recentReturnInvoices,
            'recentDebitNotes' => $recentDebitNotes,
            'vendor' => ['name' => $user->name]
        ]);
    }

    private function clientDashboard()
    {
        $user = Auth::user();

        $totalPayments = CustomerPayment::where('customer_id', $user->id)->sum('payment_amount');
        $totalRevenues = Revenue::where('created_by', $user->created_by)->sum('amount');
        $paymentCount = CustomerPayment::where('customer_id', $user->id)->count();

        $isDemo = config('app.is_demo');
        $monthlyPayments = [];
        for ($i = 5; $i >= 0; $i--) {
            $date = Carbon::now()->subMonths($i);
            $monthName = $date->format('M');

            if ($isDemo) {
                $monthPayments = rand(2000, 15000) + rand(0, 99) / 100;
            } else {
                $monthPayments = CustomerPayment::where('customer_id', $user->id)
                    ->whereMonth('created_at', $date->month)
                    ->whereYear('created_at', $date->year)
                    ->sum('payment_amount');
            }

            $monthlyPayments[] = [
                'month' => $monthName,
                'payments' => $monthPayments
            ];
        }

        // Dynamic return invoices from SalesReturns
        $recentReturnInvoices = collect();
        if (class_exists('\\App\Models\\SalesInvoiceReturn')) {
            $recentReturnInvoices = SalesInvoiceReturn::where('customer_id', $user->id)
                ->latest()
                ->limit(5)
                ->get()
                ->map(function($return) {
                    return [
                        'id' => $return->id,
                        'invoice_number' => $return->return_number ?? 'RET-' . $return->id,
                        'amount' => $return->total_amount ?? 0,
                        'date' => $return->created_at->format('M d, Y'),
                        'status' => $return->status ?? 'Pending'
                    ];
                });
        }

        // Dynamic credit notes
        $recentCreditNotes = collect();
        if (class_exists('\\Workdo\\Account\\Models\\CreditNote')) {
            $recentCreditNotes = \Workdo\Account\Models\CreditNote::where('customer_id', $user->id)
                ->latest()
                ->limit(5)
                ->get()
                ->map(function($note) {
                    return [
                        'id' => $note->id,
                        'credit_note_number' => $note->credit_note_number ?? 'CN-' . $note->id,
                        'amount' => $note->total_amount ?? 0,
                        'date' => $note->created_at->format('M d, Y'),
                        'status' => $note->status ?? 'Pending'
                    ];
                });
        }

        return Inertia::render('Account/Dashboard/ClientDashboard', [
            'stats' => [
                'total_payments' => $totalPayments,
                'total_revenues' => $totalRevenues,
                'payment_count' => $paymentCount
            ],
            'monthlyPayments' => $monthlyPayments,
            'recentReturnInvoices' => $recentReturnInvoices,
            'recentCreditNotes' => $recentCreditNotes,
            'customer' => ['name' => $user->name]
        ]);
    }

    private function staffDashboard()
    {
        $user = Auth::user();
        $creatorId = $user->created_by;

        $totalClients = Customer::where('created_by', $creatorId)->count();
        $totalVendors = Vendor::where('created_by', $creatorId)->count();
        $monthlyRevenue = Revenue::where('created_by', $creatorId)
            ->whereMonth('created_at', Carbon::now()->month)
            ->sum('amount');
        $monthlyExpense = Expense::where('created_by', $creatorId)
            ->whereMonth('created_at', Carbon::now()->month)
            ->sum('amount');

        $recentActivities = collect()
            ->merge(Revenue::where('created_by', $creatorId)->latest()->limit(3)->get()->map(function($item) {
                return ['type' => 'Revenue', 'title' => $item->revenue_number, 'amount' => $item->amount, 'date' => $item->created_at];
            }))
            ->merge(Expense::where('created_by', $creatorId)->latest()->limit(3)->get()->map(function($item) {
                return ['type' => 'Expense', 'title' => $item->expense_number, 'amount' => $item->amount, 'date' => $item->created_at];
            }))
            ->sortByDesc('date')
            ->take(6)
            ->values();

        return Inertia::render('Account/Dashboard/StaffDashboard', [
            'stats' => [
                'total_clients' => $totalClients,
                'total_vendors' => $totalVendors,
                'monthly_revenue' => $monthlyRevenue,
                'monthly_expense' => $monthlyExpense
            ],
            'recentActivities' => $recentActivities
        ]);
    }
}
