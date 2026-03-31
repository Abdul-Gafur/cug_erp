<?php

namespace Workdo\Recruitment\Database\Seeders;

use Workdo\Recruitment\Models\Interview;
use Illuminate\Database\Seeder;
use Workdo\Recruitment\Models\Candidate;
use Workdo\Recruitment\Models\JobPosting;
use Workdo\Recruitment\Models\InterviewRound;
use Workdo\Recruitment\Models\InterviewType;
use App\Models\User;


class DemoInterviewSeeder extends Seeder
{
    public function run($userId): void
    {
        $candidates = Candidate::where('created_by', $userId)->get();
        $jobPostings = JobPosting::where('created_by', $userId)->get();
        $interviewRounds = InterviewRound::where('created_by', $userId)->get();
        $interviewTypes = InterviewType::where('created_by', $userId)->get();
        $employees = User::emp()->where('created_by', $userId)->get();

        if ($candidates->isEmpty() || $jobPostings->isEmpty() || $interviewRounds->isEmpty() || $interviewTypes->isEmpty()) {
            return;
        }

        $interviewData = [
            [
                'type' => 'Technical Interview',
                'location' => 'Conference Room A',
                'meeting_link' => null,
                'duration' => 90,
                'status' => '1', // Completed
                'feedback_submitted' => true
            ],
            [
                'type' => 'HR Interview', 
                'location' => 'HR Office',
                'meeting_link' => null,
                'duration' => 45,
                'status' => '1', // Completed
                'feedback_submitted' => true
            ],
            [
                'type' => 'Final Round',
                'location' => 'Online',
                'meeting_link' => 'https://meet.google.com/xyz-abc-def',
                'duration' => 60,
                'status' => '0', // Scheduled
                'feedback_submitted' => false
            ],
            [
                'type' => 'Technical Assessment',
                'location' => 'Conference Room B',
                'meeting_link' => null,
                'duration' => 120,
                'status' => '1', // Completed
                'feedback_submitted' => true
            ],
            [
                'type' => 'Panel Interview',
                'location' => 'Online',
                'meeting_link' => 'https://zoom.us/j/123456789',
                'duration' => 75,
                'status' => '0', // Scheduled
                'feedback_submitted' => false
            ],
            [
                'type' => 'Behavioral Interview',
                'location' => 'Executive Conference Room',
                'meeting_link' => null,
                'duration' => 60,
                'status' => '2', // Cancelled
                'feedback_submitted' => false
            ],
            [
                'type' => 'Code Review',
                'location' => 'Online',
                'meeting_link' => 'https://teams.microsoft.com/l/meetup-join/abc123',
                'duration' => 90,
                'status' => '1', // Completed
                'feedback_submitted' => true
            ],
            [
                'type' => 'Cultural Fit Interview',
                'location' => 'Conference Room C',
                'meeting_link' => null,
                'duration' => 45,
                'status' => '0', // Scheduled
                'feedback_submitted' => false
            ],
            [
                'type' => 'System Design Interview',
                'location' => 'Online',
                'meeting_link' => 'https://meet.google.com/system-design-123',
                'duration' => 120,
                'status' => '1', // Completed
                'feedback_submitted' => true
            ],
            [
                'type' => 'Manager Interview',
                'location' => 'Manager Office',
                'meeting_link' => null,
                'duration' => 60,
                'status' => '3', // No-show
                'feedback_submitted' => false
            ]
        ];

        foreach ($interviewData as $index => $data) {
            $candidate = $candidates->random();
            $candidateJobId = $candidate ? $candidate->job_id : $jobPostings->random()?->id;
            
            // Get interview rounds for this specific job
            $jobInterviewRounds = $interviewRounds->where('job_id', $candidateJobId);
            $selectedRound = $jobInterviewRounds->isNotEmpty() ? $jobInterviewRounds->random() : $interviewRounds->random();
            
            // Select 1-3 random employees as interviewers
            $selectedEmployees = $employees->random(fake()->numberBetween(1, min(3, $employees->count())));
            $interviewerIds = $selectedEmployees->pluck('id')->toArray();
            $interviewerNames = $selectedEmployees->pluck('name')->toArray();

            // Generate realistic dates
            $scheduledDate = fake()->dateTimeBetween('-10 days', '+20 days')->format('Y-m-d');
            $scheduledTime = fake()->randomElement(['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '14:00', '14:30', '15:00', '15:30', '16:00']);

            Interview::create([
                'scheduled_date' => $scheduledDate,
                'scheduled_time' => $scheduledTime,
                'duration' => $data['duration'],
                'location' => $data['location'],
                'meeting_link' => $data['meeting_link'],
                'interviewer_ids' => $interviewerIds,
                'status' => $data['status'],
                'feedback_submitted' => $data['feedback_submitted'],
                'candidate_id' => $candidate?->id,
                'job_id' => $candidateJobId,
                'round_id' => $selectedRound?->id,
                'interview_type_id' => $interviewTypes->random()?->id,
                'creator_id' => $userId,
                'created_by' => $userId,
            ]);
        }
    }
}