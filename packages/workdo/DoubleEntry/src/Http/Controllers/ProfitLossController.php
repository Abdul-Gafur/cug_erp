<?php

namespace Workdo\DoubleEntry\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Workdo\DoubleEntry\Models\BalanceSheet;
use Workdo\DoubleEntry\Services\ProfitLossService;

class ProfitLossController extends Controller
{
    protected $profitLossService;

    public function __construct(ProfitLossService $profitLossService)
    {
        $this->profitLossService = $profitLossService;
    }

    public function index(Request $request)
    {
        if (Auth::user()->can('manage-profit-loss')) {
            [$fromDate, $toDate, $financialYear] = $this->resolveDates($request);

            $profitLoss = $this->profitLossService->generateProfitLoss($fromDate, $toDate, includeComparative: true);
            $isAudited  = $this->isFiscalYearAudited($financialYear);

            return Inertia::render('DoubleEntry/ProfitLoss/Index', [
                'profitLoss'    => $profitLoss,
                'financialYear' => $financialYear,
                'isAudited'     => $isAudited,
            ]);
        }

        return back()->with('error', __('Permission denied'));
    }

    public function print(Request $request)
    {
        if (Auth::user()->can('print-profit-loss')) {
            [$fromDate, $toDate, $financialYear] = $this->resolveDates($request);

            $profitLoss = $this->profitLossService->generateProfitLoss($fromDate, $toDate, includeComparative: true);
            $isAudited  = $this->isFiscalYearAudited($financialYear);

            return Inertia::render('DoubleEntry/ProfitLoss/Print', [
                'profitLoss'    => $profitLoss,
                'financialYear' => $financialYear,
                'isAudited'     => $isAudited,
            ]);
        }

        return back()->with('error', __('Permission denied'));
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    /**
     * Resolve from/to dates from request.
     * Supports either explicit from_date/to_date or a financial_year param
     * (maps to Jan 1 – Dec 31 of that year).
     *
     * @return array{0: string, 1: string, 2: string}  [fromDate, toDate, financialYear]
     */
    private function resolveDates(Request $request): array
    {
        if ($request->filled('financial_year')) {
            $year     = $request->financial_year;
            $fromDate = "$year-01-01";
            $toDate   = "$year-12-31";
            return [$fromDate, $toDate, $year];
        }

        $currentYear = date('Y');
        $fromDate    = $request->from_date ?: "$currentYear-01-01";
        $toDate      = $request->to_date   ?: "$currentYear-12-31";
        // Derive year from the to-date for the audit check
        $financialYear = date('Y', strtotime($toDate));

        return [$fromDate, $toDate, $financialYear];
    }

    /**
     * A fiscal year is "audited" (formally closed) when at least one finalized
     * balance sheet exists for that year.
     */
    private function isFiscalYearAudited(string $financialYear): bool
    {
        return BalanceSheet::where('created_by', creatorId())
            ->where('financial_year', $financialYear)
            ->where('status', 'finalized')
            ->exists();
    }
}
