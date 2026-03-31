<?php

namespace Workdo\Recruitment\Database\Seeders;

use Illuminate\Database\Seeder;
use Workdo\Recruitment\Models\InterviewRound;
use Workdo\Recruitment\Models\JobPosting;

class InterviewRoundSeeder extends Seeder
{
    public function run()
    {
        $jobPostings = JobPosting::all();
        
        if ($jobPostings->isEmpty()) {
            return;
        }

        $interviewRounds = [
            [
                'name' => 'Initial Screening',
                'sequence_number' => 1,
                'description' => 'Initial phone/video screening to assess basic qualifications and cultural fit.',
                'status' => 'active'
            ],
            [
                'name' => 'Technical Assessment',
                'sequence_number' => 2,
                'description' => 'Technical skills evaluation including coding challenges and problem-solving exercises.',
                'status' => 'active'
            ],
            [
                'name' => 'Team Interview',
                'sequence_number' => 3,
                'description' => 'Interview with potential team members to assess collaboration and technical expertise.',
                'status' => 'active'
            ],
            [
                'name' => 'Manager Interview',
                'sequence_number' => 4,
                'description' => 'Interview with hiring manager to discuss role expectations and career goals.',
                'status' => 'active'
            ],
            [
                'name' => 'Final Interview',
                'sequence_number' => 5,
                'description' => 'Final interview with senior leadership to make the hiring decision.',
                'status' => 'active'
            ],
            [
                'name' => 'HR Discussion',
                'sequence_number' => 6,
                'description' => 'HR discussion about compensation, benefits, and onboarding process.',
                'status' => 'active'
            ]
        ];

        foreach ($jobPostings as $jobPosting) {
            // Create 3-5 random interview rounds for each job posting
            $selectedRounds = collect($interviewRounds)->random(rand(3, 5));
            
            foreach ($selectedRounds as $index => $round) {
                InterviewRound::create([
                    'job_id' => $jobPosting->id,
                    'name' => $round['name'],
                    'sequence_number' => $index + 1,
                    'description' => $round['description'],
                    'status' => $round['status'],
                    'creator_id' => $jobPosting->creator_id,
                    'created_by' => $jobPosting->created_by,
                ]);
            }
        }
    }
}