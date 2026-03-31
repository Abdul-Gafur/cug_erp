<?php

namespace Workdo\Recruitment\Events;

use Workdo\Recruitment\Models\JobCategory;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Http\Request;

class UpdateJobCategory
{
    use Dispatchable;

    public function __construct(
        public Request $request,
        public JobCategory $jobCategory
    ) {}
}