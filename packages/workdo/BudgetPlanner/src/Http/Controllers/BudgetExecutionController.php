<?php

namespace Workdo\BudgetPlanner\Http\Controllers;

use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\PageSetup;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Workdo\BudgetPlanner\Models\BudgetPeriod;
use Workdo\BudgetPlanner\Models\VoteCostCentre;
use Workdo\BudgetPlanner\Services\BudgetService;

/**
 * IPSAS 24 Budget Performance Report
 *
 * Presents the original budget, revised budget, quarterly budget vs actual,
 * full-year actual, and variance — grouped by Vote / Fund / Economic
 * Classification — for Finance Committee performance reporting.
 */
class BudgetExecutionController extends Controller
{
    public function __construct(private BudgetService $budgetService) {}

    public function index()
    {
        if (Auth::user()->can('view-budget-execution')) {
            $periods = BudgetPeriod::where('created_by', creatorId())
                ->whereIn('status', ['active', 'closed'])
                ->orderByDesc('start_date')
                ->get(['id', 'period_name', 'financial_year', 'start_date', 'end_date', 'status']);

            $voteCostCentres = VoteCostCentre::where('created_by', creatorId())
                ->where('is_active', true)
                ->orderBy('code')
                ->get(['id', 'code', 'name']);

            $rows     = [];
            $periodId = request('period_id') ?? $periods->first()?->id;

            if ($periodId) {
                $rows = $this->budgetService->getBudgetExecutionStatement(
                    (int) $periodId,
                    creatorId()
                );
                $rows = array_values($this->applyFilters($rows));
            }

            $selectedPeriodObj = $periods->firstWhere('id', $periodId);

            return Inertia::render('BudgetPlanner/BudgetExecution/Index', [
                'rows'             => $rows,
                'totals'           => $this->computeTotals($rows),
                'periods'          => $periods,
                'voteCostCentres'  => $voteCostCentres,
                'selectedPeriod'   => $periodId,
                'selectedPeriodObj'=> $selectedPeriodObj,
                'filters'          => [
                    'period_id'               => request('period_id', ''),
                    'vote_cost_centre_id'     => request('vote_cost_centre_id', ''),
                    'fund_type'               => request('fund_type', ''),
                    'economic_classification' => request('economic_classification', ''),
                    'quarter'                 => request('quarter', ''),
                ],
            ]);
        }

        return back()->with('error', __('Permission denied'));
    }

    public function print()
    {
        if (Auth::user()->can('print-budget-execution')) {
            $periods = BudgetPeriod::where('created_by', creatorId())
                ->whereIn('status', ['active', 'closed'])
                ->orderByDesc('start_date')
                ->get(['id', 'period_name', 'financial_year', 'start_date', 'end_date', 'status']);

            $rows     = [];
            $periodId = request('period_id') ?? $periods->first()?->id;

            if ($periodId) {
                $rows = $this->budgetService->getBudgetExecutionStatement((int) $periodId, creatorId());
                $rows = array_values($this->applyFilters($rows));
            }

            $period = $periods->firstWhere('id', $periodId);

            return Inertia::render('BudgetPlanner/BudgetExecution/Print', [
                'rows'    => $rows,
                'totals'  => $this->computeTotals($rows),
                'period'  => $period,
                'filters' => request()->only([
                    'period_id', 'vote_cost_centre_id', 'fund_type',
                    'economic_classification', 'quarter',
                ]),
            ]);
        }

        return back()->with('error', __('Permission denied'));
    }

    public function exportExcel()
    {
        if (!Auth::user()->can('print-budget-execution')) {
            abort(403);
        }

        $periods = BudgetPeriod::where('created_by', creatorId())
            ->whereIn('status', ['active', 'closed'])
            ->orderByDesc('start_date')
            ->get();

        $periodId = request('period_id') ?? $periods->first()?->id;
        $period   = $periods->firstWhere('id', $periodId);

        $rows = $periodId
            ? array_values($this->applyFilters(
                $this->budgetService->getBudgetExecutionStatement((int) $periodId, creatorId())
            ))
            : [];

        $totals      = $this->computeTotals($rows);
        $isUnaudited = $period && $period->status !== 'closed';
        $companyName = company_setting('company_name') ?? '';

        $spreadsheet = new Spreadsheet();
        $sheet       = $spreadsheet->getActiveSheet();
        $sheet->setTitle('Budget Performance Report');

        // ── Title block ──────────────────────────────────────────────────────
        $sheet->setCellValue('A1', $companyName);
        $sheet->getStyle('A1')->getFont()->setBold(true)->setSize(14);

        $sheet->setCellValue('A2', 'BUDGET PERFORMANCE REPORT — IPSAS 24');
        $sheet->getStyle('A2')->getFont()->setBold(true)->setSize(12);

        $sheet->setCellValue('A3', 'Fiscal Year: ' . ($period?->financial_year ?? ''));
        $sheet->setCellValue('A4', 'Generated: ' . now()->format('d/m/Y'));
        $sheet->setCellValue('A5', 'Amounts in GHS' . ($isUnaudited ? '    [UNAUDITED]' : ''));

        // ── Column headers (row 7) ───────────────────────────────────────────
        $headers = [
            'A' => 'Vote / Department',
            'B' => 'Fund',
            'C' => 'Economic Classification',
            'D' => 'Account Code',
            'E' => 'Account Name',
            'F' => 'Original Budget',
            'G' => 'Revised Budget',
            'H' => 'Q1 Budget',
            'I' => 'Q1 Actual',
            'J' => 'Q2 Budget',
            'K' => 'Q2 Actual',
            'L' => 'Q3 Budget',
            'M' => 'Q3 Actual',
            'N' => 'Q4 Budget',
            'O' => 'Q4 Actual',
            'P' => 'Full Year Actual',
            'Q' => 'Variance (GHS)',
            'R' => 'Variance (%)',
        ];

        foreach ($headers as $col => $label) {
            $sheet->setCellValue("{$col}7", $label);
            $sheet->getStyle("{$col}7")->getFont()->setBold(true);
            $sheet->getStyle("{$col}7")->getFill()
                ->setFillType(Fill::FILL_SOLID)
                ->getStartColor()->setARGB('FFD9E1F2');
        }

        // ── Data rows ────────────────────────────────────────────────────────
        $rowNum = 8;
        $numFmt = '#,##0.00';

        foreach ($rows as $data) {
            $sheet->setCellValue("A{$rowNum}", ($data['vote_code'] ?? '-') . ' — ' . ($data['vote_name'] ?? ''));
            $sheet->setCellValue("B{$rowNum}", $data['fund_type'] ?? '');
            $sheet->setCellValue("C{$rowNum}", $data['economic_classification'] ?? '');
            $sheet->setCellValue("D{$rowNum}", $data['account_code'] ?? '');
            $sheet->setCellValue("E{$rowNum}", $data['account_name'] ?? '');
            $sheet->setCellValue("F{$rowNum}", $data['original_budget']);
            $sheet->setCellValue("G{$rowNum}", $data['revised_budget'] ?? $data['original_budget']);
            $sheet->setCellValue("H{$rowNum}", $data['q1_budget']);
            $sheet->setCellValue("I{$rowNum}", $data['q1_actual']);
            $sheet->setCellValue("J{$rowNum}", $data['q2_budget']);
            $sheet->setCellValue("K{$rowNum}", $data['q2_actual']);
            $sheet->setCellValue("L{$rowNum}", $data['q3_budget']);
            $sheet->setCellValue("M{$rowNum}", $data['q3_actual']);
            $sheet->setCellValue("N{$rowNum}", $data['q4_budget']);
            $sheet->setCellValue("O{$rowNum}", $data['q4_actual']);
            $sheet->setCellValue("P{$rowNum}", $data['full_year_actual']);
            $sheet->setCellValue("Q{$rowNum}", $data['variance']);
            // Store as decimal fraction so Excel % format renders correctly
            $sheet->setCellValue("R{$rowNum}", $data['variance_pct'] / 100);

            foreach (range('F', 'Q') as $col) {
                $sheet->getStyle("{$col}{$rowNum}")->getNumberFormat()->setFormatCode($numFmt);
            }
            $sheet->getStyle("R{$rowNum}")->getNumberFormat()->setFormatCode('0.00%');

            // Visual flags
            if ($data['full_year_actual'] > $data['final_budget'] && $data['final_budget'] > 0) {
                // Over-budget: red
                $sheet->getStyle("A{$rowNum}:R{$rowNum}")->getFill()
                    ->setFillType(Fill::FILL_SOLID)
                    ->getStartColor()->setARGB('FFFFC7CE');
            } elseif ($data['final_budget'] > 0 &&
                ($data['q1_actual'] + $data['q2_actual']) < 0.5 * $data['final_budget']
            ) {
                // Mid-year under-utilisation: amber
                $sheet->getStyle("A{$rowNum}:R{$rowNum}")->getFill()
                    ->setFillType(Fill::FILL_SOLID)
                    ->getStartColor()->setARGB('FFFFEB9C');
            }

            $rowNum++;
        }

        // ── Grand total row ──────────────────────────────────────────────────
        $sheet->setCellValue("A{$rowNum}", 'GRAND TOTAL');
        $sheet->getStyle("A{$rowNum}:R{$rowNum}")->getFont()->setBold(true);
        $sheet->getStyle("A{$rowNum}:R{$rowNum}")->getFill()
            ->setFillType(Fill::FILL_SOLID)
            ->getStartColor()->setARGB('FFD9E1F2');

        $totalMap = [
            'F' => 'original_budget',  'G' => 'revised_budget',
            'H' => 'q1_budget',        'I' => 'q1_actual',
            'J' => 'q2_budget',        'K' => 'q2_actual',
            'L' => 'q3_budget',        'M' => 'q3_actual',
            'N' => 'q4_budget',        'O' => 'q4_actual',
            'P' => 'full_year_actual', 'Q' => 'variance',
        ];
        foreach ($totalMap as $col => $key) {
            $sheet->setCellValue("{$col}{$rowNum}", $totals[$key]);
            $sheet->getStyle("{$col}{$rowNum}")->getNumberFormat()->setFormatCode($numFmt);
        }

        // ── Column sizing and page setup ─────────────────────────────────────
        foreach (range('A', 'R') as $col) {
            $sheet->getColumnDimension($col)->setAutoSize(true);
        }
        $sheet->getPageSetup()
            ->setOrientation(PageSetup::ORIENTATION_LANDSCAPE)
            ->setPaperSize(PageSetup::PAPERSIZE_A4)
            ->setFitToWidth(1)
            ->setFitToHeight(0);

        $filename = 'budget-performance-report-' . ($period?->financial_year ?? now()->year) . '.xlsx';
        $writer   = new Xlsx($spreadsheet);

        return response()->streamDownload(function () use ($writer) {
            $writer->save('php://output');
        }, $filename, [
            'Content-Type'        => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
            'Cache-Control'       => 'max-age=0',
            'Pragma'              => 'public',
        ]);
    }

    // ── Private helpers ──────────────────────────────────────────────────────

    private function applyFilters(array $rows): array
    {
        if (request('vote_cost_centre_id')) {
            $rows = array_filter($rows, fn($r) => $r['vote_id'] == request('vote_cost_centre_id'));
        }
        if (request('fund_type')) {
            $rows = array_filter($rows, fn($r) => $r['fund_type'] === request('fund_type'));
        }
        if (request('economic_classification')) {
            $rows = array_filter($rows, fn($r) => $r['economic_classification'] === request('economic_classification'));
        }
        return $rows;
    }

    private function computeTotals(array $rows): array
    {
        return [
            'original_budget'  => array_sum(array_column($rows, 'original_budget')),
            'revised_budget'   => array_sum(array_map(
                fn($r) => $r['revised_budget'] ?? $r['original_budget'], $rows
            )),
            'final_budget'     => array_sum(array_column($rows, 'final_budget')),
            'q1_budget'        => array_sum(array_column($rows, 'q1_budget')),
            'q1_actual'        => array_sum(array_column($rows, 'q1_actual')),
            'q2_budget'        => array_sum(array_column($rows, 'q2_budget')),
            'q2_actual'        => array_sum(array_column($rows, 'q2_actual')),
            'q3_budget'        => array_sum(array_column($rows, 'q3_budget')),
            'q3_actual'        => array_sum(array_column($rows, 'q3_actual')),
            'q4_budget'        => array_sum(array_column($rows, 'q4_budget')),
            'q4_actual'        => array_sum(array_column($rows, 'q4_actual')),
            'committed'        => array_sum(array_column($rows, 'committed')),
            'full_year_actual' => array_sum(array_column($rows, 'full_year_actual')),
            'variance'         => array_sum(array_column($rows, 'variance')),
        ];
    }
}
