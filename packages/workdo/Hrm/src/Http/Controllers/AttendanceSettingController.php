<?php

namespace Workdo\Hrm\Http\Controllers;

use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Illuminate\Http\Request;

class AttendanceSettingController extends Controller
{
    public function index()
    {
        if (Auth::user()->can('manage-system-setup') || Auth::user()->can('manage-attendances') || Auth::user()->can('manage-hrm')) {
            $globalSettings = getCompanyAllSetting();
            $geofenceRestrictEnabled = $globalSettings['geofence_restrict'] ?? 'off';
            $companyLatitude = $globalSettings['company_latitude'] ?? '';
            $companyLongitude = $globalSettings['company_longitude'] ?? '';
            $companyRadius = $globalSettings['company_radius'] ?? '100';

            return Inertia::render('Hrm/SystemSetup/AttendanceSettings/Index', [
                'geofenceRestrictEnabled' => $geofenceRestrictEnabled,
                'companyLatitude' => $companyLatitude,
                'companyLongitude' => $companyLongitude,
                'companyRadius' => $companyRadius,
            ]);
        } else {
            return back()->with('error', __('Permission denied'));
        }
    }

    public function store(Request $request)
    {
        if (Auth::user()->can('manage-system-setup') || Auth::user()->can('manage-attendances') || Auth::user()->can('manage-hrm')) {
            $request->validate([
                'geofence_restrict' => 'required|in:on,off',
                'company_latitude' => 'nullable|numeric',
                'company_longitude' => 'nullable|numeric',
                'company_radius' => 'nullable|numeric',
            ]);

            setSetting('geofence_restrict', $request->geofence_restrict);
            if ($request->has('company_latitude')) {
                setSetting('company_latitude', $request->company_latitude);
            }
            if ($request->has('company_longitude')) {
                setSetting('company_longitude', $request->company_longitude);
            }
            if ($request->has('company_radius')) {
                setSetting('company_radius', $request->company_radius);
            }

            return redirect()->back()->with('success', __('Attendance settings updated successfully.'));
        } else {
            return redirect()->back()->with('error', __('Permission denied'));
        }
    }
}
