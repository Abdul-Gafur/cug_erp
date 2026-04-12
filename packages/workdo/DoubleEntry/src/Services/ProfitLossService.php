<?php

namespace Workdo\DoubleEntry\Services;

use Workdo\Account\Models\ChartOfAccount;
use Illuminate\Support\Facades\DB;

class ProfitLossService
{
    // -------------------------------------------------------------------------
    // IPSAS 1 revenue categories (within 4000–4999)
    // Universities should assign GL accounts to these bands when setting up COA.
    // -------------------------------------------------------------------------
    private const REVENUE_GROUPS = [
        'government_grants'      => ['label' => 'Government Subvention / Grants-in-Aid', 'min' => 4000, 'max' => 4049],
        'internally_generated'   => ['label' => 'Internally Generated Funds',              'min' => 4050, 'max' => 4249],
        'research_grants'        => ['label' => 'Research Grants & Contracts',             'min' => 4250, 'max' => 4349],
        'donations_endowments'   => ['label' => 'Donations & Endowments',                  'min' => 4350, 'max' => 4449],
        'other_income'           => ['label' => 'Other Income',                            'min' => 4450, 'max' => 4999],
    ];

    // -------------------------------------------------------------------------
    // IPSAS 1 expense categories (within 5000–5999)
    // -------------------------------------------------------------------------
    private const EXPENSE_GROUPS = [
        'supplies_issued'        => ['label' => 'Cost of Goods / Supplies Issued',        'min' => 5000, 'max' => 5149],
        'personnel_emoluments'   => ['label' => 'Personnel Emoluments',                   'min' => 5150, 'max' => 5299],
        'administration_general' => ['label' => 'Administration & General',               'min' => 5300, 'max' => 5399],
        'depreciation'           => ['label' => 'Depreciation & Amortisation',            'min' => 5400, 'max' => 5499],
        'finance_costs'          => ['label' => 'Finance Costs',                          'min' => 5500, 'max' => 5599],
        'other_expenses'         => ['label' => 'Other Expenses',                         'min' => 5600, 'max' => 5999],
    ];

    /**
     * Generate the Statement of Financial Performance for a date range.
     * Returns both a flat list (backward-compat) and an IPSAS-grouped structure.
     * When $includeComparative is true a second pass is done for the prior year.
     */
    public function generateProfitLoss(string $fromDate, string $toDate, bool $includeComparative = false): array
    {
        $current = $this->fetchData($fromDate, $toDate);

        $result = array_merge($current, [
            'from_date'  => $fromDate,
            'to_date'    => $toDate,
            'prior_year' => null,
        ]);

        if ($includeComparative) {
            // Shift both dates back exactly one year
            $priorFrom = date('Y-m-d', strtotime($fromDate . ' -1 year'));
            $priorTo   = date('Y-m-d', strtotime($toDate   . ' -1 year'));
            $result['prior_year'] = $this->fetchData($priorFrom, $priorTo);
            $result['prior_year']['from_date'] = $priorFrom;
            $result['prior_year']['to_date']   = $priorTo;
        }

        return $result;
    }

    // -------------------------------------------------------------------------
    // Internal: query GL and classify into IPSAS groups
    // -------------------------------------------------------------------------
    private function fetchData(string $fromDate, string $toDate): array
    {
        $accounts = DB::select("
            SELECT
                coa.id,
                coa.account_code,
                coa.account_name,
                coa.normal_balance,
                COALESCE(
                    SUM(CASE WHEN (ob.effective_date IS NULL OR je.journal_date >= ob.effective_date)
                                  AND je.journal_date >= ? AND je.journal_date <= ?
                                  AND je.status = 'posted'
                             THEN (CASE WHEN coa.normal_balance = 'debit'
                                        THEN jei.debit_amount  - jei.credit_amount
                                        ELSE jei.credit_amount - jei.debit_amount END)
                             ELSE 0 END),
                0) as balance
            FROM chart_of_accounts coa
            LEFT JOIN opening_balances ob
                   ON coa.id = ob.account_id
                  AND ob.created_by = coa.created_by
                  AND ob.id = (SELECT MAX(id) FROM opening_balances
                               WHERE account_id = coa.id AND created_by = coa.created_by)
            LEFT JOIN journal_entry_items jei ON coa.id = jei.account_id
            LEFT JOIN journal_entries je ON jei.journal_entry_id = je.id
            WHERE coa.account_code >= '4000' AND coa.account_code <= '5999'
              AND coa.is_active = 1
              AND coa.created_by = ?
            GROUP BY coa.id, coa.account_code, coa.account_name, coa.normal_balance, coa.opening_balance, ob.effective_date
        ", [$fromDate, $toDate, creatorId()]);

        // ---- flat arrays (kept for backward compat) ----
        $revenue       = [];
        $expenses      = [];
        $totalRevenue  = 0;
        $totalExpenses = 0;

        // ---- IPSAS grouped arrays ----
        $groupedRevenue  = array_fill_keys(array_keys(self::REVENUE_GROUPS),  ['label' => '', 'accounts' => [], 'total' => 0]);
        $groupedExpenses = array_fill_keys(array_keys(self::EXPENSE_GROUPS), ['label' => '', 'accounts' => [], 'total' => 0]);

        foreach (self::REVENUE_GROUPS as $key => $cfg) {
            $groupedRevenue[$key]['label'] = $cfg['label'];
        }
        foreach (self::EXPENSE_GROUPS as $key => $cfg) {
            $groupedExpenses[$key]['label'] = $cfg['label'];
        }

        foreach ($accounts as $account) {
            if (abs($account->balance) <= 0.01) {
                continue;
            }

            $code = intval($account->account_code);
            $row  = [
                'id'           => $account->id,
                'account_code' => $account->account_code,
                'account_name' => $account->account_name,
                'balance'      => $account->balance,
            ];

            if ($code >= 4000 && $code <= 4999) {
                $revenue[]    = $row;
                $totalRevenue += $account->balance;

                // Place into the correct IPSAS revenue group
                foreach (self::REVENUE_GROUPS as $key => $cfg) {
                    if ($code >= $cfg['min'] && $code <= $cfg['max']) {
                        $groupedRevenue[$key]['accounts'][] = $row;
                        $groupedRevenue[$key]['total']     += $account->balance;
                        break;
                    }
                }
            } elseif ($code >= 5000 && $code <= 5999) {
                $expenses[]    = $row;
                $totalExpenses += $account->balance;

                foreach (self::EXPENSE_GROUPS as $key => $cfg) {
                    if ($code >= $cfg['min'] && $code <= $cfg['max']) {
                        $groupedExpenses[$key]['accounts'][] = $row;
                        $groupedExpenses[$key]['total']      += $account->balance;
                        break;
                    }
                }
            }
        }

        // Remove empty groups so the frontend doesn't render blank sections
        $groupedRevenue  = array_filter($groupedRevenue,  fn($g) => count($g['accounts']) > 0);
        $groupedExpenses = array_filter($groupedExpenses, fn($g) => count($g['accounts']) > 0);

        $netSurplus = $totalRevenue - $totalExpenses;

        return [
            // flat (backward compat)
            'revenue'          => $revenue,
            'expenses'         => $expenses,
            'total_revenue'    => $totalRevenue,
            'total_expenses'   => $totalExpenses,
            'net_profit'       => $netSurplus,   // kept for old code; semantically "surplus/(deficit)"
            // IPSAS grouped
            'grouped_revenue'  => array_values($groupedRevenue),
            'grouped_expenses' => array_values($groupedExpenses),
            'net_surplus'      => $netSurplus,
        ];
    }
}
