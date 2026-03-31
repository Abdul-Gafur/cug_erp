<?php

namespace Workdo\Recruitment\Database\Seeders;

use App\Models\User;
use Workdo\Recruitment\Models\Candidate;
use Illuminate\Database\Seeder;
use Workdo\Recruitment\Models\JobPosting;
use Workdo\Recruitment\Models\CandidateSources;

class DemoCandidateSeeder extends Seeder
{
    public function run($userId): void
    {
        $countryCodes = ['+1', '+44', '+91', '+61', '+81', '+49', '+33', '+39', '+55', '+97', '+86', '+7', '+27', '+82', '+34'];

        $candidates = [
            ['first_name' => 'John', 'last_name' => 'Smith', 'email' => 'john.smith@example.com', 'gender' => 'male', 'current_company' => 'Microsoft', 'current_position' => 'Senior Software Engineer', 'experience_years' => 8, 'current_salary' => 95000, 'expected_salary' => 110000, 'skills' => 'C#, .NET, Azure, SQL Server, JavaScript', 'education' => 'Bachelor of Computer Science'],
            ['first_name' => 'Sarah', 'last_name' => 'Johnson', 'email' => 'sarah.johnson@example.com', 'gender' => 'female', 'current_company' => 'Google', 'current_position' => 'UX Designer', 'experience_years' => 6, 'current_salary' => 85000, 'expected_salary' => 95000, 'skills' => 'Figma, Adobe XD, User Research, Prototyping, HTML/CSS', 'education' => 'Bachelor of Design'],
            ['first_name' => 'Michael', 'last_name' => 'Brown', 'email' => 'michael.brown@example.com', 'gender' => 'male', 'current_company' => 'Amazon', 'current_position' => 'Data Scientist', 'experience_years' => 5, 'current_salary' => 105000, 'expected_salary' => 120000, 'skills' => 'Python, R, Machine Learning, SQL, Tableau', 'education' => 'Master of Data Science'],
            ['first_name' => 'Emily', 'last_name' => 'Davis', 'email' => 'emily.davis@example.com', 'gender' => 'female', 'current_company' => 'Facebook', 'current_position' => 'Product Manager', 'experience_years' => 7, 'current_salary' => 115000, 'expected_salary' => 130000, 'skills' => 'Product Strategy, Agile, Analytics, User Research, SQL', 'education' => 'Master of Business Administration'],
            ['first_name' => 'David', 'last_name' => 'Wilson', 'email' => 'david.wilson@example.com', 'gender' => 'male', 'current_company' => 'Apple', 'current_position' => 'iOS Developer', 'experience_years' => 4, 'current_salary' => 90000, 'expected_salary' => 105000, 'skills' => 'Swift, Objective-C, Xcode, iOS SDK, Git', 'education' => 'Bachelor of Computer Engineering'],
            ['first_name' => 'Jessica', 'last_name' => 'Miller', 'email' => 'jessica.miller@example.com', 'gender' => 'female', 'current_company' => 'Netflix', 'current_position' => 'DevOps Engineer', 'experience_years' => 6, 'current_salary' => 100000, 'expected_salary' => 115000, 'skills' => 'AWS, Docker, Kubernetes, Jenkins, Python', 'education' => 'Bachelor of Information Technology'],
            ['first_name' => 'Robert', 'last_name' => 'Garcia', 'email' => 'robert.garcia@example.com', 'gender' => 'male', 'current_company' => 'Tesla', 'current_position' => 'Full Stack Developer', 'experience_years' => 5, 'current_salary' => 88000, 'expected_salary' => 100000, 'skills' => 'React, Node.js, MongoDB, Express, JavaScript', 'education' => 'Bachelor of Software Engineering'],
            ['first_name' => 'Lisa', 'last_name' => 'Anderson', 'email' => 'lisa.anderson@example.com', 'gender' => 'female', 'current_company' => 'Salesforce', 'current_position' => 'Marketing Manager', 'experience_years' => 8, 'current_salary' => 75000, 'expected_salary' => 85000, 'skills' => 'Digital Marketing, SEO, Google Analytics, Content Strategy', 'education' => 'Bachelor of Marketing'],
            ['first_name' => 'James', 'last_name' => 'Taylor', 'email' => 'james.taylor@example.com', 'gender' => 'male', 'current_company' => 'IBM', 'current_position' => 'Business Analyst', 'experience_years' => 4, 'current_salary' => 70000, 'expected_salary' => 80000, 'skills' => 'Business Analysis, SQL, Excel, Process Improvement', 'education' => 'Bachelor of Business Administration'],
            ['first_name' => 'Amanda', 'last_name' => 'Thomas', 'email' => 'amanda.thomas@example.com', 'gender' => 'female', 'current_company' => 'Oracle', 'current_position' => 'Database Administrator', 'experience_years' => 7, 'current_salary' => 85000, 'expected_salary' => 95000, 'skills' => 'Oracle, MySQL, PostgreSQL, Database Design, Performance Tuning', 'education' => 'Bachelor of Computer Science'],
            ['first_name' => 'Christopher', 'last_name' => 'Jackson', 'email' => 'christopher.jackson@example.com', 'gender' => 'male', 'current_company' => 'Adobe', 'current_position' => 'Frontend Developer', 'experience_years' => 3, 'current_salary' => 72000, 'expected_salary' => 82000, 'skills' => 'React, Vue.js, HTML5, CSS3, JavaScript, TypeScript', 'education' => 'Bachelor of Web Development'],
            ['first_name' => 'Michelle', 'last_name' => 'White', 'email' => 'michelle.white@example.com', 'gender' => 'female', 'current_company' => 'Uber', 'current_position' => 'QA Engineer', 'experience_years' => 5, 'current_salary' => 68000, 'expected_salary' => 78000, 'skills' => 'Selenium, TestNG, Java, API Testing, Automation', 'education' => 'Bachelor of Computer Science'],
            ['first_name' => 'Daniel', 'last_name' => 'Harris', 'email' => 'daniel.harris@example.com', 'gender' => 'male', 'current_company' => 'Spotify', 'current_position' => 'Backend Developer', 'experience_years' => 6, 'current_salary' => 92000, 'expected_salary' => 105000, 'skills' => 'Java, Spring Boot, Microservices, REST APIs, Docker', 'education' => 'Master of Computer Science'],
            ['first_name' => 'Nicole', 'last_name' => 'Martin', 'email' => 'nicole.martin@example.com', 'gender' => 'female', 'current_company' => 'LinkedIn', 'current_position' => 'HR Business Partner', 'experience_years' => 9, 'current_salary' => 82000, 'expected_salary' => 92000, 'skills' => 'HR Strategy, Talent Management, Employee Relations, HRIS', 'education' => 'Master of Human Resources'],
            ['first_name' => 'Kevin', 'last_name' => 'Thompson', 'email' => 'kevin.thompson@example.com', 'gender' => 'male', 'current_company' => 'Airbnb', 'current_position' => 'Security Analyst', 'experience_years' => 4, 'current_salary' => 78000, 'expected_salary' => 88000, 'skills' => 'Cybersecurity, Penetration Testing, SIEM, Risk Assessment', 'education' => 'Bachelor of Cybersecurity'],
            ['first_name' => 'Rachel', 'last_name' => 'Lee', 'email' => 'rachel.lee@example.com', 'gender' => 'female', 'current_company' => 'Slack', 'current_position' => 'Project Manager', 'experience_years' => 7, 'current_salary' => 85000, 'expected_salary' => 95000, 'skills' => 'Agile, Scrum, JIRA, Project Planning, Team Leadership', 'education' => 'Bachelor of Project Management'],
            ['first_name' => 'Brian', 'last_name' => 'Clark', 'email' => 'brian.clark@example.com', 'gender' => 'male', 'current_company' => 'Zoom', 'current_position' => 'Mobile Developer', 'experience_years' => 5, 'current_salary' => 87000, 'expected_salary' => 98000, 'skills' => 'Android, Kotlin, Java, Flutter, React Native', 'education' => 'Bachelor of Mobile Development'],
            ['first_name' => 'Stephanie', 'last_name' => 'Rodriguez', 'email' => 'stephanie.rodriguez@example.com', 'gender' => 'female', 'current_company' => 'Dropbox', 'current_position' => 'Financial Analyst', 'experience_years' => 4, 'current_salary' => 65000, 'expected_salary' => 75000, 'skills' => 'Financial Modeling, Excel, SQL, Budgeting, Forecasting', 'education' => 'Bachelor of Finance'],
            ['first_name' => 'Andrew', 'last_name' => 'Lewis', 'email' => 'andrew.lewis@example.com', 'gender' => 'male', 'current_company' => 'Square', 'current_position' => 'Solutions Architect', 'experience_years' => 10, 'current_salary' => 125000, 'expected_salary' => 140000, 'skills' => 'System Architecture, Cloud Computing, AWS, Microservices', 'education' => 'Master of Software Architecture'],
            ['first_name' => 'Megan', 'last_name' => 'Walker', 'email' => 'megan.walker@example.com', 'gender' => 'female', 'current_company' => 'Pinterest', 'current_position' => 'Content Strategist', 'experience_years' => 6, 'current_salary' => 72000, 'expected_salary' => 82000, 'skills' => 'Content Marketing, SEO, Social Media, Analytics', 'education' => 'Bachelor of Communications']
        ];

        foreach ($candidates as $candidate) {
            Candidate::create(array_merge($candidate, [
                'phone' => $countryCodes[array_rand($countryCodes)] . mt_rand(1000000000, 9999999999),
                'dob' => now()->subYears(rand(25, 45))->subDays(rand(1, 365))->format('Y-m-d'),
                'country' => 'United States',
                'state' => ['California', 'New York', 'Texas', 'Florida', 'Washington'][array_rand(['California', 'New York', 'Texas', 'Florida', 'Washington'])],
                'city' => ['San Francisco', 'New York', 'Austin', 'Miami', 'Seattle'][array_rand(['San Francisco', 'New York', 'Austin', 'Miami', 'Seattle'])],
                'notice_period' => ['Immediate', '2 weeks', '1 month', '2 months'][array_rand(['Immediate', '2 weeks', '1 month', '2 months'])],
                'portfolio_url' => 'https://portfolio.' . strtolower($candidate['first_name']) . strtolower($candidate['last_name']) . '.com',
                'linkedin_url' => 'https://linkedin.com/in/' . strtolower($candidate['first_name']) . '-' . strtolower($candidate['last_name']),
                'profile_path' => null,
                'resume_path' => null,
                'cover_letter_path' => null,
                'status' => ['0', '1', '2', '3', '4'][array_rand(['0', '1', '2', '3', '4'])],
                'application_date' => now()->subDays(rand(1, 90))->format('Y-m-d'),
                'custom_question' => null,
                'tracking_id' => Candidate::generateTrackingId($userId),
                'job_id' => JobPosting::where('created_by', $userId)->inRandomOrder()->first()?->id,
                'user_id' => User::emp()->where('created_by', $userId)->inRandomOrder()->first()?->id,
                'source_id' => CandidateSources::where('created_by', $userId)->inRandomOrder()->first()?->id,
                'creator_id' => $userId,
                'created_by' => $userId,
            ]));
        }
    }
}
