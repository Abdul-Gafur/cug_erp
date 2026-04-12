<?php

namespace Workdo\Account\Database\Seeders;

use Illuminate\Database\Seeder;
use Workdo\Account\Models\ChartOfAccount;
use Workdo\Account\Models\JournalEntry;
use Workdo\Account\Models\JournalEntryItem;

class DemoJournalEntrySeeder extends Seeder
{
    public function run($userId): void
    {
        if (JournalEntry::where('created_by', $userId)->exists()) {
            return;
        }

        // Resolve GL accounts by code (seeded by AccountUtility::defaultdata)
        $accounts = ChartOfAccount::where('created_by', $userId)
            ->whereIn('account_code', ['1010', '1020', '1100', '2000', '2110', '4100', '4200', '5100', '5110', '5300', '5310', '5360'])
            ->pluck('id', 'account_code');

        if ($accounts->isEmpty()) {
            return;
        }

        $entries = [
            // ─── JE1: Annual Government Subvention Received ───────────────────
            [
                'journal_date'    => '2025-01-15',
                'description'     => 'Receipt of Annual Government Subvention — FY 2025 Q1 instalment',
                'fund_code'       => 'GF',
                'status'          => 'posted',
                'approval_status' => 'approved',
                'total_debit'     => 850000.00,
                'total_credit'    => 850000.00,
                'lines' => [
                    ['account_code' => '1010', 'description' => 'Bank — General Fund (GoG subvention deposit)',   'debit' => 850000.00, 'credit' => 0.00],
                    ['account_code' => '4100', 'description' => 'Government Subvention — Annual Block Grant',     'debit' => 0.00,      'credit' => 850000.00],
                ],
            ],
            // ─── JE2: First-semester Student Fees Collected ──────────────────
            [
                'journal_date'    => '2025-02-03',
                'description'     => 'First-semester tuition fees collected via student portals',
                'fund_code'       => 'IGF',
                'status'          => 'posted',
                'approval_status' => 'approved',
                'total_debit'     => 320000.00,
                'total_credit'    => 320000.00,
                'lines' => [
                    ['account_code' => '1020', 'description' => 'Bank — IGF Account (fees received)',            'debit' => 320000.00, 'credit' => 0.00],
                    ['account_code' => '4200', 'description' => 'Student Tuition & Programme Fees — Sem 1',      'debit' => 0.00,      'credit' => 320000.00],
                ],
            ],
            // ─── JE3: Monthly Staff Salaries & Allowances ────────────────────
            [
                'journal_date'    => '2025-03-28',
                'description'     => 'March 2025 staff salaries and housing/transport allowances',
                'fund_code'       => 'GF',
                'status'          => 'posted',
                'approval_status' => 'approved',
                'total_debit'     => 215000.00,
                'total_credit'    => 215000.00,
                'lines' => [
                    ['account_code' => '5100', 'description' => 'Basic Salaries — Academic & Non-Academic Staff',  'debit' => 185000.00, 'credit' => 0.00],
                    ['account_code' => '5110', 'description' => 'Staff Allowances — Housing & Transport',           'debit' => 30000.00,  'credit' => 0.00],
                    ['account_code' => '1010', 'description' => 'Bank — General Fund (salary disbursement)',        'debit' => 0.00,      'credit' => 215000.00],
                ],
            ],
            // ─── JE4: Quarterly Utilities Invoice Accrual ────────────────────
            [
                'journal_date'    => '2025-03-31',
                'description'     => 'Q1 2025 utilities accrual — ECG, Ghana Water, and internet service provider',
                'fund_code'       => 'IGF',
                'status'          => 'posted',
                'approval_status' => 'approved',
                'total_debit'     => 18500.00,
                'total_credit'    => 18500.00,
                'lines' => [
                    ['account_code' => '5310', 'description' => 'Utilities — Electricity, Water & Internet Q1',   'debit' => 18500.00,  'credit' => 0.00],
                    ['account_code' => '2000', 'description' => 'Accounts Payable — ECG / GWC / ISP invoices',    'debit' => 0.00,      'credit' => 18500.00],
                ],
            ],
            // ─── JE5: Office Supplies & Stationery Purchase ──────────────────
            [
                'journal_date'    => '2025-04-10',
                'description'     => 'Office consumables and examination stationery for Second Semester 2025',
                'fund_code'       => 'IGF',
                'status'          => 'draft',
                'approval_status' => 'prepared',
                'total_debit'     => 9800.00,
                'total_credit'    => 9800.00,
                'lines' => [
                    ['account_code' => '5300', 'description' => 'Office Supplies — stationery and toner cartridges', 'debit' => 9800.00,   'credit' => 0.00],
                    ['account_code' => '2000', 'description' => 'Accounts Payable — office supplies vendor',          'debit' => 0.00,      'credit' => 9800.00],
                ],
            ],
        ];

        foreach ($entries as $entry) {
            $lines = $entry['lines'];
            unset($entry['lines']);

            $je = JournalEntry::create(array_merge($entry, [
                'entry_type'    => 'manual',
                'reference_type'=> 'manual',
                'reference_id'  => null,
                'prepared_by'   => $userId,
                'creator_id'    => $userId,
                'created_by'    => $userId,
            ]));

            foreach ($lines as $line) {
                $accountId = $accounts[$line['account_code']] ?? null;
                if (!$accountId) {
                    continue;
                }

                JournalEntryItem::create([
                    'journal_entry_id' => $je->id,
                    'account_id'       => $accountId,
                    'description'      => $line['description'],
                    'debit_amount'     => $line['debit'],
                    'credit_amount'    => $line['credit'],
                    'creator_id'       => $userId,
                    'created_by'       => $userId,
                ]);
            }
        }
    }
}
