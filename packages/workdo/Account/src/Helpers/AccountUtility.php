<?php

namespace Workdo\Account\Helpers;

use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Workdo\Account\Models\AccountCategory;
use Workdo\Account\Models\AccountType;
use Workdo\Account\Models\ChartOfAccount;
use Workdo\Account\Models\OpeningBalance;
use Workdo\Account\Models\UniversityFund;
use Workdo\Account\Models\FixedAssetCategory;

class AccountUtility
{
    public static function defaultdata($company_id = null)
    {
        self::seedUniversityFunds($company_id);
        self::createAccountCategories($company_id);
        self::createAccountTypes($company_id);
        self::createChartOfAccounts($company_id);
        self::seedFixedAssetCategories($company_id);
    }

    // -------------------------------------------------------------------------
    // University Funds
    // -------------------------------------------------------------------------

    private static function seedUniversityFunds($company_id)
    {
        $exist = UniversityFund::where('created_by', $company_id)->first();
        if ($exist) return;

        $funds = [
            ['code' => 'GF',       'name' => 'General Fund',               'description' => 'Government subvention and recurrent appropriation'],
            ['code' => 'IGF',      'name' => 'Internally Generated Fund',   'description' => 'Student fees, consultancy, rentals, and other internally generated income'],
            ['code' => 'RESEARCH', 'name' => 'Research & Grants Fund',      'description' => 'Research grants and contracts from external bodies'],
            ['code' => 'DONOR',    'name' => 'Donor / Endowment Fund',      'description' => 'Donations, endowments, and restricted gifts'],
            ['code' => 'CAPITAL',  'name' => 'Capital Development Fund',    'description' => 'Capital project financing including GETFUND and development grants'],
        ];

        foreach ($funds as $fund) {
            $fund['creator_id'] = $company_id;
            $fund['created_by'] = $company_id;
            UniversityFund::create($fund);
        }
    }

    // -------------------------------------------------------------------------
    // IPSAS Account Categories (IPSAS 1 — five elements)
    // -------------------------------------------------------------------------

    private static function createAccountCategories($company_id)
    {
        $exist = AccountCategory::where('created_by', $company_id)->first();
        if ($exist) return;

        $categories = [
            ['name' => 'Assets',     'code' => 'AST', 'type' => 'assets',     'description' => 'Resources controlled by the university as a result of past events'],
            ['name' => 'Liabilities','code' => 'LIB', 'type' => 'liabilities','description' => 'Present obligations of the university arising from past events'],
            ['name' => 'Net Assets', 'code' => 'NET', 'type' => 'net_asset',  'description' => 'Residual interest in assets after deducting liabilities (IPSAS 1)'],
            ['name' => 'Revenue',    'code' => 'REV', 'type' => 'revenue',    'description' => 'Increases in economic benefits or service potential during the reporting period'],
            ['name' => 'Expenses',   'code' => 'EXP', 'type' => 'expenses',   'description' => 'Decreases in economic benefits or service potential during the reporting period'],
        ];

        foreach ($categories as $category) {
            $category['creator_id'] = $company_id;
            $category['created_by'] = $company_id;
            AccountCategory::create($category);
        }
    }

    // -------------------------------------------------------------------------
    // IPSAS Account Types
    // -------------------------------------------------------------------------

    private static function createAccountTypes($company_id)
    {
        $exist = AccountType::where('created_by', $company_id)->first();
        if ($exist) return;

        $categories = AccountCategory::where('created_by', $company_id)->get()->keyBy('code');
        if (count($categories) == 0) return;

        $accountTypes = [
            // Assets
            ['category_code' => 'AST', 'name' => 'Current Assets',              'code' => 'CA',     'normal_balance' => 'debit',  'description' => 'Cash, receivables, and other assets expected to be realised within 12 months'],
            ['category_code' => 'AST', 'name' => 'Non-Current Assets (PPE)',     'code' => 'NCA',    'normal_balance' => 'debit',  'description' => 'Property, plant, equipment, and long-term investments (IPSAS 17)'],
            ['category_code' => 'AST', 'name' => 'Other Assets',                 'code' => 'OA',     'normal_balance' => 'debit',  'description' => 'Intangible assets and other non-current assets'],
            // Liabilities
            ['category_code' => 'LIB', 'name' => 'Current Liabilities',          'code' => 'CL',     'normal_balance' => 'credit', 'description' => 'Obligations expected to be settled within 12 months'],
            ['category_code' => 'LIB', 'name' => 'Non-Current Liabilities',      'code' => 'NCL',    'normal_balance' => 'credit', 'description' => 'Long-term borrowings and other obligations due after 12 months'],
            // Net Assets
            ['category_code' => 'NET', 'name' => 'General Fund / Net Assets',    'code' => 'NA',     'normal_balance' => 'credit', 'description' => 'University net assets — government endowment and general fund balance'],
            ['category_code' => 'NET', 'name' => 'Accumulated Surplus/Deficit',  'code' => 'ACCSD',  'normal_balance' => 'credit', 'description' => 'Cumulative surplus or deficit from prior periods (IPSAS 1 — replaces Retained Earnings)'],
            ['category_code' => 'NET', 'name' => 'Statutory Reserves',           'code' => 'RES',    'normal_balance' => 'credit', 'description' => 'Reserves required by statute or governing instrument'],
            // Revenue
            ['category_code' => 'REV', 'name' => 'Government Revenue',           'code' => 'GOVREV','normal_balance' => 'credit', 'description' => 'Annual block grant, subventions, and government transfers (IPSAS 23 — non-exchange)'],
            ['category_code' => 'REV', 'name' => 'IGF Revenue',                  'code' => 'IGFREV','normal_balance' => 'credit', 'description' => 'Internally generated fund income: fees, consultancy, rentals (IPSAS 9 — exchange)'],
            ['category_code' => 'REV', 'name' => 'Research & Grants Revenue',    'code' => 'RGREV', 'normal_balance' => 'credit', 'description' => 'Income from research grants and contracts (IPSAS 23)'],
            ['category_code' => 'REV', 'name' => 'Other Income',                 'code' => 'OI',    'normal_balance' => 'credit', 'description' => 'Donations, interest, sundry income'],
            // Expenses
            ['category_code' => 'EXP', 'name' => 'Personnel Emoluments',         'code' => 'PE',    'normal_balance' => 'debit',  'description' => 'Basic salaries, allowances, and employer social security contributions'],
            ['category_code' => 'EXP', 'name' => 'Goods & Services',             'code' => 'GS',    'normal_balance' => 'debit',  'description' => 'Academic services, administration, supplies, utilities, and operational costs'],
            ['category_code' => 'EXP', 'name' => 'Depreciation & Amortisation',  'code' => 'DEPR',  'normal_balance' => 'debit',  'description' => 'Systematic allocation of PPE cost over useful life (IPSAS 17)'],
            ['category_code' => 'EXP', 'name' => 'Finance Costs',                'code' => 'FC',    'normal_balance' => 'debit',  'description' => 'Interest on borrowings and bank charges'],
            ['category_code' => 'EXP', 'name' => 'Transfers & Grants',           'code' => 'TG',    'normal_balance' => 'debit',  'description' => 'Transfers to affiliated institutions and grant disbursements'],
            ['category_code' => 'EXP', 'name' => 'Other Expenses',               'code' => 'OX',    'normal_balance' => 'debit',  'description' => 'Miscellaneous expenditure not classified elsewhere'],
        ];

        foreach ($accountTypes as $type) {
            $categoryCode = $type['category_code'];
            unset($type['category_code']);

            if (isset($categories[$categoryCode])) {
                $type['category_id'] = $categories[$categoryCode]->id;
                $type['is_system_type'] = 1;
                $type['creator_id'] = $company_id;
                $type['created_by'] = $company_id;
                AccountType::create($type);
            }
        }
    }

    // -------------------------------------------------------------------------
    // IPSAS Chart of Accounts — Ghanaian Public University
    // Code ranges deliberately preserved so DoubleEntry hardcoded range queries
    // (1000–1999 assets, 2000–2999 liabilities, 3000–3999 net assets,
    //  4000–4999 revenue, 5000–5999 expenses) continue to work without change.
    // -------------------------------------------------------------------------

    private static function createChartOfAccounts($company_id)
    {
        $exist = ChartOfAccount::where('created_by', $company_id)->first();
        if ($exist) return;

        $accountTypes = AccountType::where('created_by', $company_id)->get()->keyBy('code');
        if (count($accountTypes) == 0) return;

        // Columns: type_code, account_code, account_name, normal_balance,
        //          description, economic_classification (null for balance sheet items)
        $chartOfAccounts = [

            // =================================================================
            // ASSETS (1000–1999)
            // =================================================================

            // Cash & Bank
            ['type_code' => 'CA',  'account_code' => '1000', 'account_name' => 'Cash on Hand',
             'normal_balance' => 'debit',
             'description' => 'Physical cash held in the Bursary and sub-cashier offices'],

            ['type_code' => 'CA',  'account_code' => '1005', 'account_name' => 'Petty Cash',
             'normal_balance' => 'debit',
             'description' => 'Petty cash float for minor operational payments'],

            ['type_code' => 'CA',  'account_code' => '1010', 'account_name' => 'Bank — General Fund Account',
             'normal_balance' => 'debit',
             'description' => 'Main bank account for government subvention receipts and recurrent expenditure'],

            ['type_code' => 'CA',  'account_code' => '1020', 'account_name' => 'Bank — IGF Account',
             'normal_balance' => 'debit',
             'description' => 'Bank account for internally generated fund receipts (fees, consultancy, rentals)'],

            ['type_code' => 'CA',  'account_code' => '1030', 'account_name' => 'Bank — Research & Grants Account',
             'normal_balance' => 'debit',
             'description' => 'Dedicated account for research grant receipts and disbursements'],

            ['type_code' => 'CA',  'account_code' => '1040', 'account_name' => 'Bank — Donor / Endowment Account',
             'normal_balance' => 'debit',
             'description' => 'Account for donations, endowments, and restricted gifts'],

            ['type_code' => 'CA',  'account_code' => '1050', 'account_name' => 'Bank — Capital Development Account',
             'normal_balance' => 'debit',
             'description' => 'Account for capital project funding including GETFUND disbursements'],

            ['type_code' => 'CA',  'account_code' => '1060', 'account_name' => 'Cash in Transit',
             'normal_balance' => 'debit',
             'description' => 'Funds in transit between university accounts or to the bank'],

            // Receivables
            ['type_code' => 'CA',  'account_code' => '1100', 'account_name' => 'Debtors — Student Fees Receivable',
             'normal_balance' => 'debit',
             'description' => 'Outstanding student tuition and programme fees owed to the university'],

            ['type_code' => 'CA',  'account_code' => '1110', 'account_name' => 'Debtors — Government Subvention Receivable',
             'normal_balance' => 'debit',
             'description' => 'Annual block grant and subvention amounts due from Government of Ghana'],

            ['type_code' => 'CA',  'account_code' => '1120', 'account_name' => 'Debtors — Research Grants Receivable',
             'normal_balance' => 'debit',
             'description' => 'Research grant instalments approved but not yet received'],

            ['type_code' => 'CA',  'account_code' => '1130', 'account_name' => 'Other Receivables',
             'normal_balance' => 'debit',
             'description' => 'Miscellaneous amounts owed to the university by external parties'],

            // Prepayments & Advances
            ['type_code' => 'CA',  'account_code' => '1200', 'account_name' => 'Prepayments & Advances',
             'normal_balance' => 'debit',
             'description' => 'Expenditure paid in advance: insurance, rent, subscriptions'],

            ['type_code' => 'CA',  'account_code' => '1210', 'account_name' => 'Staff Salary Advances',
             'normal_balance' => 'debit',
             'description' => 'Salary advances granted to staff, recoverable through payroll deductions'],

            // Inventories
            ['type_code' => 'CA',  'account_code' => '1300', 'account_name' => 'Inventories — Consumable Stores',
             'normal_balance' => 'debit',
             'description' => 'Goods and supplies held for use in university operations (IPSAS 12)'],

            // Short-term Investments
            ['type_code' => 'OA',  'account_code' => '1400', 'account_name' => 'Short-term Investments',
             'normal_balance' => 'debit',
             'description' => 'Treasury bills and short-term fixed deposits maturing within 12 months'],

            // Tax Receivable (kept at 1500 for system journal compatibility)
            ['type_code' => 'OA',  'account_code' => '1500', 'account_name' => 'PAYE & Withholding Tax Receivable',
             'normal_balance' => 'debit',
             'description' => 'Tax credits and refunds receivable from Ghana Revenue Authority'],

            // Property, Plant & Equipment (IPSAS 17)
            ['type_code' => 'NCA', 'account_code' => '1600', 'account_name' => 'Equipment & Machinery',
             'normal_balance' => 'debit',
             'description' => 'Laboratory equipment, IT infrastructure, office machinery, and vehicles'],

            ['type_code' => 'NCA', 'account_code' => '1610', 'account_name' => 'Accumulated Depreciation — Equipment & Machinery',
             'normal_balance' => 'credit',
             'description' => 'Cumulative depreciation charged on equipment and machinery (IPSAS 17)'],

            ['type_code' => 'NCA', 'account_code' => '1700', 'account_name' => 'Buildings & Civil Works',
             'normal_balance' => 'debit',
             'description' => 'Academic buildings, halls of residence, and other university structures'],

            ['type_code' => 'NCA', 'account_code' => '1710', 'account_name' => 'Accumulated Depreciation — Buildings & Civil Works',
             'normal_balance' => 'credit',
             'description' => 'Cumulative depreciation charged on buildings and civil works (IPSAS 17)'],

            ['type_code' => 'NCA', 'account_code' => '1800', 'account_name' => 'Motor Vehicles',
             'normal_balance' => 'debit',
             'description' => 'University-owned vehicles including buses, utility vehicles, and official cars'],

            ['type_code' => 'NCA', 'account_code' => '1810', 'account_name' => 'Accumulated Depreciation — Motor Vehicles',
             'normal_balance' => 'credit',
             'description' => 'Cumulative depreciation charged on motor vehicles (IPSAS 17)'],

            ['type_code' => 'NCA', 'account_code' => '1900', 'account_name' => 'Land',
             'normal_balance' => 'debit',
             'description' => 'University land — not subject to depreciation (IPSAS 17)'],

            ['type_code' => 'NCA', 'account_code' => '1950', 'account_name' => 'Construction in Progress',
             'normal_balance' => 'debit',
             'description' => 'Capital projects under construction not yet ready for use (IPSAS 17)'],

            // =================================================================
            // LIABILITIES (2000–2999)
            // =================================================================

            // Creditors / Payables
            ['type_code' => 'CL',  'account_code' => '2000', 'account_name' => 'Accounts Payable — Suppliers',
             'normal_balance' => 'credit',
             'description' => 'Amounts owed to suppliers for goods and services received but not yet paid'],

            ['type_code' => 'CL',  'account_code' => '2100', 'account_name' => 'Accrued Liabilities',
             'normal_balance' => 'credit',
             'description' => 'Expenditure incurred but not yet invoiced or paid at period end'],

            ['type_code' => 'CL',  'account_code' => '2110', 'account_name' => 'Accrued Salaries & Allowances',
             'normal_balance' => 'credit',
             'description' => 'Salary and allowance arrears owing to staff at period end'],

            // Statutory deductions payable
            ['type_code' => 'CL',  'account_code' => '2200', 'account_name' => 'PAYE Tax Payable',
             'normal_balance' => 'credit',
             'description' => 'Pay-As-You-Earn income tax deducted from staff salaries and due to GRA'],

            ['type_code' => 'CL',  'account_code' => '2210', 'account_name' => 'SSNIT Contributions Payable',
             'normal_balance' => 'credit',
             'description' => 'Employee and employer SSNIT pension contributions due for remittance'],

            ['type_code' => 'CL',  'account_code' => '2220', 'account_name' => 'Withholding Tax Payable',
             'normal_balance' => 'credit',
             'description' => 'Withholding tax deducted from supplier payments and due to GRA'],

            // Deferred income
            ['type_code' => 'CL',  'account_code' => '2300', 'account_name' => 'Deferred Income — Advance Student Fees',
             'normal_balance' => 'credit',
             'description' => 'Student fees received in advance for future academic periods (IPSAS 9)'],

            ['type_code' => 'CL',  'account_code' => '2310', 'account_name' => 'Deferred Income — Research Grants Received in Advance',
             'normal_balance' => 'credit',
             'description' => 'Research grant funds received but not yet expended or earned (IPSAS 23)'],

            // Loans
            ['type_code' => 'CL',  'account_code' => '2400', 'account_name' => 'Short-term Loans & Borrowings',
             'normal_balance' => 'credit',
             'description' => 'Loan principal due for repayment within 12 months'],

            ['type_code' => 'NCL', 'account_code' => '2500', 'account_name' => 'Long-term Loans & Borrowings',
             'normal_balance' => 'credit',
             'description' => 'Loan principal due for repayment after 12 months'],

            ['type_code' => 'NCL', 'account_code' => '2600', 'account_name' => 'Lease Liabilities',
             'normal_balance' => 'credit',
             'description' => 'Finance lease obligations recognised on the Statement of Financial Position'],

            // =================================================================
            // NET ASSETS (3000–3999)
            // =================================================================

            ['type_code' => 'NA',    'account_code' => '3100', 'account_name' => 'General Fund — Net Assets',
             'normal_balance' => 'credit',
             'description' => 'University general fund representing net assets funded by government appropriation (IPSAS 1)'],

            // Year-end close target account — kept at 3200 for compatibility with
            // DoubleEntry YearEndCloseService which transfers net income here
            ['type_code' => 'ACCSD', 'account_code' => '3200', 'account_name' => 'Accumulated Surplus / (Deficit)',
             'normal_balance' => 'credit',
             'description' => 'Cumulative surplus or deficit carried forward from prior reporting periods (IPSAS 1)'],

            ['type_code' => 'RES',   'account_code' => '3300', 'account_name' => 'IGF Reserve',
             'normal_balance' => 'credit',
             'description' => 'Portion of IGF surplus set aside as a reserve by Council resolution'],

            ['type_code' => 'NA',    'account_code' => '3400', 'account_name' => 'Endowment Fund Capital',
             'normal_balance' => 'credit',
             'description' => 'Capital contributed by donors for endowment purposes — principal is restricted'],

            ['type_code' => 'RES',   'account_code' => '3500', 'account_name' => 'Statutory Reserves',
             'normal_balance' => 'credit',
             'description' => 'Reserves created pursuant to the university\'s statutes or Act of Parliament'],

            // =================================================================
            // REVENUE (4000–4999)
            // =================================================================

            // Government Revenue (non-exchange — IPSAS 23)
            ['type_code' => 'GOVREV', 'account_code' => '4100', 'account_name' => 'Government Subvention — Annual Block Grant',
             'normal_balance' => 'credit',
             'description' => 'Annual government subvention allocated through the Ghana Education Trust Fund and MoF'],

            ['type_code' => 'GOVREV', 'account_code' => '4110', 'account_name' => 'GETFUND Academic Facilities Levy',
             'normal_balance' => 'credit',
             'description' => 'Allocations from the Ghana Education Trust Fund for academic infrastructure'],

            ['type_code' => 'GOVREV', 'account_code' => '4120', 'account_name' => 'Other Government Grants',
             'normal_balance' => 'credit',
             'description' => 'Specific-purpose grants from government ministries, departments, and agencies'],

            // IGF Revenue (exchange — IPSAS 9)
            ['type_code' => 'IGFREV', 'account_code' => '4200', 'account_name' => 'Student Tuition & Programme Fees',
             'normal_balance' => 'credit',
             'description' => 'Tuition fees for undergraduate and postgraduate programmes'],

            ['type_code' => 'IGFREV', 'account_code' => '4210', 'account_name' => 'Accommodation Fees',
             'normal_balance' => 'credit',
             'description' => 'Hall of residence and other on-campus accommodation charges'],

            ['type_code' => 'IGFREV', 'account_code' => '4220', 'account_name' => 'Examination & Certification Fees',
             'normal_balance' => 'credit',
             'description' => 'Fees charged for examinations, transcripts, and certificate processing'],

            ['type_code' => 'IGFREV', 'account_code' => '4230', 'account_name' => 'Application & Admissions Fees',
             'normal_balance' => 'credit',
             'description' => 'Non-refundable application and admissions processing fees'],

            ['type_code' => 'IGFREV', 'account_code' => '4240', 'account_name' => 'Sundry Student Fees',
             'normal_balance' => 'credit',
             'description' => 'Other student levies: ID card, library, sports, SRC, and activities fees'],

            ['type_code' => 'IGFREV', 'account_code' => '4300', 'account_name' => 'Consultancy Income',
             'normal_balance' => 'credit',
             'description' => 'Revenue from academic and professional consultancy services rendered'],

            ['type_code' => 'IGFREV', 'account_code' => '4310', 'account_name' => 'Rentals & Facilities Income',
             'normal_balance' => 'credit',
             'description' => 'Income from renting university facilities to external parties'],

            ['type_code' => 'IGFREV', 'account_code' => '4320', 'account_name' => 'Sales of Publications & Materials',
             'normal_balance' => 'credit',
             'description' => 'Income from sale of academic publications, course materials, and merchandise'],

            // Research & Grants Revenue (IPSAS 23)
            ['type_code' => 'RGREV', 'account_code' => '4400', 'account_name' => 'Research Grant Income — Local',
             'normal_balance' => 'credit',
             'description' => 'Research grants received from Ghanaian funding bodies and government agencies'],

            ['type_code' => 'RGREV', 'account_code' => '4410', 'account_name' => 'Research Grant Income — International',
             'normal_balance' => 'credit',
             'description' => 'Research grants and contracts from international agencies and development partners'],

            // Other Income
            ['type_code' => 'OI',    'account_code' => '4500', 'account_name' => 'Donations & Endowment Income',
             'normal_balance' => 'credit',
             'description' => 'Voluntary donations received and endowment fund distributions'],

            ['type_code' => 'OI',    'account_code' => '4510', 'account_name' => 'Alumni Donations',
             'normal_balance' => 'credit',
             'description' => 'Financial contributions from university alumni associations and individuals'],

            ['type_code' => 'OI',    'account_code' => '4600', 'account_name' => 'Interest & Investment Income',
             'normal_balance' => 'credit',
             'description' => 'Interest earned on bank deposits, treasury bills, and short-term investments'],

            ['type_code' => 'OI',    'account_code' => '4700', 'account_name' => 'Sundry & Miscellaneous Income',
             'normal_balance' => 'credit',
             'description' => 'Other income not classified under the above revenue accounts'],

            // IPSAS 17 — Gain on Disposal of Assets
            ['type_code' => 'OI',    'account_code' => '4800', 'account_name' => 'Gain on Disposal of Assets',
             'normal_balance' => 'credit',
             'description' => 'Gain recognised when proceeds from asset disposal exceed carrying amount (IPSAS 17)'],

            // =================================================================
            // EXPENSES (5000–5999)
            // =================================================================

            // Personnel Emoluments
            ['type_code' => 'PE', 'account_code' => '5100',
             'account_name' => 'Personnel Emoluments — Basic Salaries',
             'normal_balance' => 'debit',
             'description' => 'Gross basic salaries of academic and non-academic staff',
             'economic_classification' => 'personnel_emoluments'],

            ['type_code' => 'PE', 'account_code' => '5110',
             'account_name' => 'Personnel Emoluments — Allowances',
             'normal_balance' => 'debit',
             'description' => 'Housing, transport, responsibility, and other staff allowances',
             'economic_classification' => 'personnel_emoluments'],

            ['type_code' => 'PE', 'account_code' => '5120',
             'account_name' => 'Personnel Emoluments — SSNIT Employer Contribution',
             'normal_balance' => 'debit',
             'description' => 'University employer contribution to SSNIT pension scheme',
             'economic_classification' => 'personnel_emoluments'],

            ['type_code' => 'PE', 'account_code' => '5130',
             'account_name' => 'Personnel Emoluments — Other Staff Costs',
             'normal_balance' => 'debit',
             'description' => 'Overtime, casual labour, staff welfare, and other employment costs',
             'economic_classification' => 'personnel_emoluments'],

            // Academic & Student Services
            ['type_code' => 'GS', 'account_code' => '5200',
             'account_name' => 'Teaching Materials & Academic Consumables',
             'normal_balance' => 'debit',
             'description' => 'Examination materials, course supplies, and teaching consumables',
             'economic_classification' => 'goods_services'],

            ['type_code' => 'GS', 'account_code' => '5210',
             'account_name' => 'Library Resources & Subscriptions',
             'normal_balance' => 'debit',
             'description' => 'Books, journals, online databases, and library system licences',
             'economic_classification' => 'goods_services'],

            ['type_code' => 'GS', 'account_code' => '5220',
             'account_name' => 'Laboratory Supplies & Chemicals',
             'normal_balance' => 'debit',
             'description' => 'Reagents, consumables, and supplies for academic laboratories',
             'economic_classification' => 'goods_services'],

            ['type_code' => 'GS', 'account_code' => '5230',
             'account_name' => 'Student Welfare & Bursaries',
             'normal_balance' => 'debit',
             'description' => 'Scholarships, bursaries, and student welfare expenditure',
             'economic_classification' => 'goods_services'],

            // Administration & General
            ['type_code' => 'GS', 'account_code' => '5300',
             'account_name' => 'Office Supplies & Consumables',
             'normal_balance' => 'debit',
             'description' => 'Stationery, printing materials, and general administrative supplies',
             'economic_classification' => 'goods_services'],

            ['type_code' => 'GS', 'account_code' => '5310',
             'account_name' => 'Utilities — Electricity, Water & Internet',
             'normal_balance' => 'debit',
             'description' => 'Electricity, water, internet, and other utility charges',
             'economic_classification' => 'goods_services'],

            ['type_code' => 'GS', 'account_code' => '5320',
             'account_name' => 'Repairs & Maintenance',
             'normal_balance' => 'debit',
             'description' => 'Routine maintenance and repairs to buildings, equipment, and vehicles',
             'economic_classification' => 'goods_services'],

            ['type_code' => 'GS', 'account_code' => '5330',
             'account_name' => 'Cleaning & Security Services',
             'normal_balance' => 'debit',
             'description' => 'Contracted cleaning, janitorial, and security guard services',
             'economic_classification' => 'goods_services'],

            ['type_code' => 'GS', 'account_code' => '5340',
             'account_name' => 'Communications & Postage',
             'normal_balance' => 'debit',
             'description' => 'Telephone, postage, courier, and other communication expenses',
             'economic_classification' => 'goods_services'],

            ['type_code' => 'GS', 'account_code' => '5350',
             'account_name' => 'Publicity & Outreach',
             'normal_balance' => 'debit',
             'description' => 'Advertising, publications, public relations, and community outreach',
             'economic_classification' => 'goods_services'],

            ['type_code' => 'GS', 'account_code' => '5360',
             'account_name' => 'Travel & Transport',
             'normal_balance' => 'debit',
             'description' => 'Local and international travel, per diems, and transport costs',
             'economic_classification' => 'goods_services'],

            ['type_code' => 'GS', 'account_code' => '5370',
             'account_name' => 'Insurance Premiums',
             'normal_balance' => 'debit',
             'description' => 'Property, vehicles, and liability insurance for the university',
             'economic_classification' => 'goods_services'],

            ['type_code' => 'GS', 'account_code' => '5380',
             'account_name' => 'Professional & Audit Fees',
             'normal_balance' => 'debit',
             'description' => 'External audit fees, legal fees, and specialist consultancy costs',
             'economic_classification' => 'goods_services'],

            // Research Expenses
            ['type_code' => 'GS', 'account_code' => '5400',
             'account_name' => 'Research Materials & Supplies',
             'normal_balance' => 'debit',
             'description' => 'Expenditure on research consumables, field equipment, and data collection',
             'economic_classification' => 'goods_services'],

            ['type_code' => 'GS', 'account_code' => '5410',
             'account_name' => 'Research Personnel & Subcontracts',
             'normal_balance' => 'debit',
             'description' => 'Research assistants, collaborators, and subcontracted research services',
             'economic_classification' => 'goods_services'],

            // Finance Costs
            ['type_code' => 'FC', 'account_code' => '5500',
             'account_name' => 'Interest on Borrowings',
             'normal_balance' => 'debit',
             'description' => 'Interest charged on loans, overdrafts, and finance leases',
             'economic_classification' => 'goods_services'],

            ['type_code' => 'FC', 'account_code' => '5510',
             'account_name' => 'Bank Charges & Commissions',
             'normal_balance' => 'debit',
             'description' => 'Bank service fees, transfer charges, and commission on transactions',
             'economic_classification' => 'goods_services'],

            // Depreciation (IPSAS 17)
            ['type_code' => 'DEPR', 'account_code' => '5600',
             'account_name' => 'Depreciation — Equipment & Machinery',
             'normal_balance' => 'debit',
             'description' => 'Annual depreciation charge on equipment and machinery (IPSAS 17)',
             'economic_classification' => 'capital_expenditure'],

            ['type_code' => 'DEPR', 'account_code' => '5610',
             'account_name' => 'Depreciation — Buildings & Civil Works',
             'normal_balance' => 'debit',
             'description' => 'Annual depreciation charge on university buildings (IPSAS 17)',
             'economic_classification' => 'capital_expenditure'],

            ['type_code' => 'DEPR', 'account_code' => '5620',
             'account_name' => 'Depreciation — Motor Vehicles',
             'normal_balance' => 'debit',
             'description' => 'Annual depreciation charge on university motor vehicles (IPSAS 17)',
             'economic_classification' => 'capital_expenditure'],

            // Transfers & Grants
            ['type_code' => 'TG', 'account_code' => '5700',
             'account_name' => 'Transfers to Affiliated Institutions',
             'normal_balance' => 'debit',
             'description' => 'Subventions and transfers to affiliated colleges and constituent institutions',
             'economic_classification' => 'transfers_grants'],

            ['type_code' => 'TG', 'account_code' => '5710',
             'account_name' => 'Grant Disbursements',
             'normal_balance' => 'debit',
             'description' => 'Grants disbursed to research collaborators and sponsored programmes',
             'economic_classification' => 'transfers_grants'],

            // Other Expenses
            // IPSAS 17 — Loss on Disposal of Assets
            ['type_code' => 'OX', 'account_code' => '5850',
             'account_name' => 'Loss on Disposal of Assets',
             'normal_balance' => 'debit',
             'description' => 'Loss recognised when carrying amount of a disposed asset exceeds proceeds received (IPSAS 17)',
             'economic_classification' => null],

            ['type_code' => 'OX', 'account_code' => '5800',
             'account_name' => 'Impairment & Write-offs',
             'normal_balance' => 'debit',
             'description' => 'Write-off of irrecoverable debts and impairment of assets',
             'economic_classification' => null],

            ['type_code' => 'OX', 'account_code' => '5900',
             'account_name' => 'Miscellaneous Expenditure',
             'normal_balance' => 'debit',
             'description' => 'Other expenditure not classified under the above heads',
             'economic_classification' => null],
        ];

        foreach ($chartOfAccounts as $account) {
            $typeCode = $account['type_code'];
            unset($account['type_code']);

            if (isset($accountTypes[$typeCode])) {
                $account['account_type_id'] = $accountTypes[$typeCode]->id;
                $account['is_system_account'] = 1;
                $account['creator_id'] = $company_id;
                $account['created_by'] = $company_id;
                // economic_classification defaults to null if not set
                $account['economic_classification'] = $account['economic_classification'] ?? null;
                ChartOfAccount::create($account);
            }
        }
    }


    // -------------------------------------------------------------------------
    // Default Fixed Asset Categories — IPSAS 17
    // -------------------------------------------------------------------------

    private static function seedFixedAssetCategories($company_id)
    {
        $exist = FixedAssetCategory::where('created_by', $company_id)->first();
        if ($exist) return;

        // Each category maps to the PPE GL accounts already seeded above.
        // asset_account_code, accumulated_depreciation_account_code, and
        // depreciation_expense_account_code use the codes from createChartOfAccounts().
        // default_useful_life_months follows IPSAS 17 / typical university practice.
        $categories = [
            [
                'name'                                  => 'Land',
                'description'                           => 'University land — not subject to depreciation per IPSAS 17',
                'asset_account_code'                    => '1900',
                'accumulated_depreciation_account_code' => null,
                'depreciation_expense_account_code'     => null,
                'default_useful_life_months'            => 0,
                'depreciation_method'                   => 'straight_line',
                'is_depreciable'                        => false,
            ],
            [
                'name'                                  => 'Buildings & Civil Works',
                'description'                           => 'Academic buildings, administrative blocks, halls of residence, and other university structures',
                'asset_account_code'                    => '1700',
                'accumulated_depreciation_account_code' => '1710',
                'depreciation_expense_account_code'     => '5610',
                'default_useful_life_months'            => 600, // 50 years
                'depreciation_method'                   => 'straight_line',
                'is_depreciable'                        => true,
            ],
            [
                'name'                                  => 'Lecture Halls & Facilities',
                'description'                           => 'Lecture theatres, seminar rooms, multipurpose halls, and teaching facilities',
                'asset_account_code'                    => '1700',
                'accumulated_depreciation_account_code' => '1710',
                'depreciation_expense_account_code'     => '5610',
                'default_useful_life_months'            => 600, // 50 years
                'depreciation_method'                   => 'straight_line',
                'is_depreciable'                        => true,
            ],
            [
                'name'                                  => 'Laboratory Equipment',
                'description'                           => 'Scientific instruments, lab bench equipment, and specialised research apparatus',
                'asset_account_code'                    => '1600',
                'accumulated_depreciation_account_code' => '1610',
                'depreciation_expense_account_code'     => '5600',
                'default_useful_life_months'            => 120, // 10 years
                'depreciation_method'                   => 'straight_line',
                'is_depreciable'                        => true,
            ],
            [
                'name'                                  => 'Library Books & Resources',
                'description'                           => 'Physical books, journals, reference materials, and library collections',
                'asset_account_code'                    => '1600',
                'accumulated_depreciation_account_code' => '1610',
                'depreciation_expense_account_code'     => '5600',
                'default_useful_life_months'            => 60, // 5 years
                'depreciation_method'                   => 'straight_line',
                'is_depreciable'                        => true,
            ],
            [
                'name'                                  => 'IT Equipment & Software',
                'description'                           => 'Computers, servers, networking infrastructure, and licensed software',
                'asset_account_code'                    => '1600',
                'accumulated_depreciation_account_code' => '1610',
                'depreciation_expense_account_code'     => '5600',
                'default_useful_life_months'            => 48, // 4 years
                'depreciation_method'                   => 'straight_line',
                'is_depreciable'                        => true,
            ],
            [
                'name'                                  => 'Furniture & Fittings',
                'description'                           => 'Office and lecture furniture, shelving, blinds, and built-in fixtures',
                'asset_account_code'                    => '1600',
                'accumulated_depreciation_account_code' => '1610',
                'depreciation_expense_account_code'     => '5600',
                'default_useful_life_months'            => 120, // 10 years
                'depreciation_method'                   => 'straight_line',
                'is_depreciable'                        => true,
            ],
            [
                'name'                                  => 'Motor Vehicles',
                'description'                           => 'University-owned buses, official vehicles, utility vans, and motorcycles',
                'asset_account_code'                    => '1800',
                'accumulated_depreciation_account_code' => '1810',
                'depreciation_expense_account_code'     => '5620',
                'default_useful_life_months'            => 60, // 5 years
                'depreciation_method'                   => 'straight_line',
                'is_depreciable'                        => true,
            ],
            [
                'name'                                  => 'Office Equipment',
                'description'                           => 'Photocopiers, printers, projectors, telephone systems, and general office machinery',
                'asset_account_code'                    => '1600',
                'accumulated_depreciation_account_code' => '1610',
                'depreciation_expense_account_code'     => '5600',
                'default_useful_life_months'            => 60, // 5 years
                'depreciation_method'                   => 'straight_line',
                'is_depreciable'                        => true,
            ],
        ];

        foreach ($categories as $category) {
            $category['creator_id'] = $company_id;
            $category['created_by'] = $company_id;
            FixedAssetCategory::create($category);
        }
    }

    public static function GivePermissionToVendor($company_id = null)
    {
        $vendor_permission = [
            'manage-dashboard',
            'manage-account',
            'manage-account-dashboard',
            'manage-vendor-payments',
            'manage-own-vendor-payments',
            'view-vendor-payments',
            'manage-debit-notes',
            'manage-own-debit-notes',
            'view-debit-notes',
        ];

        $vendor_role = Role::where('name', 'vendor')->where('created_by', $company_id)->first();
        foreach ($vendor_permission as $permission_v) {
            $permission = Permission::where('name', $permission_v)->first();
            if (!empty($permission)) {
                if (!$vendor_role->hasPermissionTo($permission_v)) {
                    $vendor_role->givePermissionTo($permission);
                }
            }
        }
    }

    public static function GivePermissionToRoles($role_id = null, $rolename = null)
    {
        $client_permission = [
            'manage-dashboard',
            'manage-account',
            'manage-account-dashboard',
            'manage-customer-payments',
            'manage-own-customer-payments',
            'view-customer-payments',
            'manage-credit-notes',
            'manage-own-credit-notes',
            'view-credit-notes'
        ];

        if ($rolename == 'client') {
            $roles_v = Role::where('name', 'client')->where('id', $role_id)->first();
            foreach ($client_permission as $permission_v) {
                $permission = Permission::where('name', $permission_v)->first();
                if (!empty($permission)) {
                    if (!$roles_v->hasPermissionTo($permission_v)) {
                        $roles_v->givePermissionTo($permission);
                    }
                }
            }
        }
    }
}
