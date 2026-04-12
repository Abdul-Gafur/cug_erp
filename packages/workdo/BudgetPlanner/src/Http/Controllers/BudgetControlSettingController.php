<?php

namespace Workdo\BudgetPlanner\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Workdo\BudgetPlanner\Models\BudgetControlSetting;

class BudgetControlSettingController extends Controller
{
    private const CLASSIFICATIONS = [
        'all',
        'personnel_emoluments',
        'goods_services',
        'capital_expenditure',
        'transfers_grants',
    ];

    public function index()
    {
        if (Auth::user()->can('manage-budget-control-settings')) {
            // Fetch existing settings; fill defaults for any missing classifications
            $existing = BudgetControlSetting::where('created_by', creatorId())
                ->get()
                ->keyBy('economic_classification');

            $settings = collect(self::CLASSIFICATIONS)->map(function ($cls) use ($existing) {
                return $existing->has($cls)
                    ? $existing[$cls]
                    : [
                        'id'                      => null,
                        'economic_classification' => $cls,
                        'control_mode'            => 'hard_block',
                    ];
            })->values();

            return Inertia::render('BudgetPlanner/BudgetControlSettings/Index', [
                'settings' => $settings,
            ]);
        }

        return back()->with('error', __('Permission denied'));
    }

    public function upsert(Request $request)
    {
        if (Auth::user()->can('manage-budget-control-settings')) {
            $request->validate([
                'settings'                          => ['required', 'array'],
                'settings.*.economic_classification' => ['required', 'in:' . implode(',', self::CLASSIFICATIONS)],
                'settings.*.control_mode'           => ['required', 'in:hard_block,warning'],
            ]);

            foreach ($request->settings as $row) {
                BudgetControlSetting::updateOrCreate(
                    [
                        'economic_classification' => $row['economic_classification'],
                        'created_by'              => creatorId(),
                    ],
                    [
                        'control_mode' => $row['control_mode'],
                        'creator_id'   => Auth::id(),
                        'created_by'   => creatorId(),
                    ]
                );
            }

            return back()->with('success', __('Budget control settings saved.'));
        }

        return back()->with('error', __('Permission denied'));
    }
}
