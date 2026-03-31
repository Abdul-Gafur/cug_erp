<?php

namespace Workdo\Recruitment\Events;

use Workdo\Recruitment\Models\JobCategory;
use Illuminate\Foundation\Events\Dispatchable;

class DestroyJobCategory
{
    use Dispatchable;

    public function __construct(
        public JobCategory $jobCategory
    ) {}
}