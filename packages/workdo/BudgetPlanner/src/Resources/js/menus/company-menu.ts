import { DollarSign, Building2, BarChart3, FileText, GitPullRequest, ShieldCheck } from 'lucide-react';

declare global {
    function route(name: string): string;
}

export const budgetplannerCompanyMenu = (t: (key: string) => string) => [
    {
        title: t('Budget Planner'),
        icon: DollarSign,
        permission: 'manage-budget-planner',
        order: 420,
        children: [
            {
                title: t('Vote / Cost Centres'),
                href: route('budget-planner.vote-cost-centres.index'),
                permission: 'manage-vote-cost-centres',
            },
            {
                title: t('Budget Periods'),
                href: route('budget-planner.budget-periods.index'),
                permission: 'manage-budget-periods',
            },
            {
                title: t('Budget'),
                href: route('budget-planner.budgets.index'),
                permission: 'manage-budgets',
            },
            {
                title: t('Budget Allocations'),
                href: route('budget-planner.budget-allocations.index'),
                permission: 'manage-budget-allocations',
            },
            {
                title: t('Budget Amendments'),
                href: route('budget-planner.budget-amendments.index'),
                permission: 'manage-budget-amendments',
            },
            {
                title: t('Budget Monitoring'),
                href: route('budget-planner.budget-monitorings.index'),
                permission: 'manage-budget-monitoring',
            },
            {
                title: t('Budget Variance Analysis'),
                href: route('budget-planner.budget-variances.index'),
                permission: 'view-budget-variances',
            },
            {
                title: t('Budget Execution Statement'),
                href: route('budget-planner.budget-execution.index'),
                permission: 'view-budget-execution',
            },
            {
                title: t('Budget Control Settings'),
                href: route('budget-planner.budget-control-settings.index'),
                permission: 'manage-budget-control-settings',
            },
        ],
    },

];
