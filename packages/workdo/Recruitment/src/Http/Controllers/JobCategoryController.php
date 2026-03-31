<?php

namespace Workdo\Recruitment\Http\Controllers;

use Workdo\Recruitment\Models\JobCategory;
use Workdo\Recruitment\Http\Requests\StoreJobCategoryRequest;
use Workdo\Recruitment\Http\Requests\UpdateJobCategoryRequest;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Workdo\Recruitment\Events\CreateJobCategory;
use Workdo\Recruitment\Events\UpdateJobCategory;
use Workdo\Recruitment\Events\DestroyJobCategory;


class JobCategoryController extends Controller
{
    public function index()
    {
        if(Auth::user()->can('manage-job-categories')){
            $jobcategories = JobCategory::select('id', 'name', 'description', 'is_active', 'created_at')
                ->where(function($q) {
                    if(Auth::user()->can('manage-any-job-categories')) {
                        $q->where('created_by', creatorId());
                    } elseif(Auth::user()->can('manage-own-job-categories')) {
                        $q->where('creator_id', Auth::id());
                    } else {
                        $q->whereRaw('1 = 0');
                    }
                })
                ->latest()
                ->get();

            return Inertia::render('Recruitment/SystemSetup/JobCategories/Index', [
                'jobcategories' => $jobcategories,

            ]);
        }
        else{
            return back()->with('error', __('Permission denied'));
        }
    }

    public function store(StoreJobCategoryRequest $request)
    {
        if(Auth::user()->can('create-job-categories')){
            $validated = $request->validated();
            $validated['is_active'] = $request->boolean('is_active', true);
            $validated['is_active'] = $request->boolean('is_active', false);

            $jobcategory = new JobCategory();
            $jobcategory->name = $validated['name'];
            $jobcategory->description = $validated['description'];
            $jobcategory->is_active = $validated['is_active'];
            $jobcategory->is_active = $validated['is_active'];
            $jobcategory->creator_id = Auth::id();
            $jobcategory->created_by = creatorId();
            $jobcategory->save();

            CreateJobCategory::dispatch($request, $jobcategory);

            return redirect()->route('recruitment.job-categories.index')->with('success', __('The job category has been created successfully.'));
        }
        else{
            return redirect()->route('recruitment.job-categories.index')->with('error', __('Permission denied'));
        }
    }

    public function update(UpdateJobCategoryRequest $request, JobCategory $jobcategory)
    {
        if(Auth::user()->can('edit-job-categories')){
            $validated = $request->validated();
            $validated['is_active'] = $request->boolean('is_active', true);
            $validated['is_active'] = $request->boolean('is_active', false);

            $jobcategory->name = $validated['name'];
            $jobcategory->description = $validated['description'];
            $jobcategory->is_active = $validated['is_active'];
            $jobcategory->is_active = $validated['is_active'];
            $jobcategory->save();

            UpdateJobCategory::dispatch($request, $jobcategory);

            return back()->with('success', __('The job category details are updated successfully.'));
        }
        else{
            return redirect()->route('recruitment.job-categories.index')->with('error', __('Permission denied'));
        }
    }

    public function destroy(JobCategory $jobcategory)
    {
        if(Auth::user()->can('delete-job-categories')){
            DestroyJobCategory::dispatch($jobcategory);
            $jobcategory->delete();

            return redirect()->back()->with('success', __('The job category has been deleted.'));
        }
        else{
            return redirect()->route('recruitment.job-categories.index')->with('error', __('Permission denied'));
        }
    }


}