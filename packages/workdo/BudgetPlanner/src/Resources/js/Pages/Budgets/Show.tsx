import { Head, Link, router, usePage } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import AuthenticatedLayout from "@/layouts/authenticated-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/utils/helpers';
import { ArrowLeft, Lock, CheckCircle, ClipboardCheck, Users, Crown, Upload, X } from 'lucide-react';

// ── Label maps ────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
    draft:              'bg-gray-100 text-gray-700 border-gray-300',
    dept_approved:      'bg-yellow-50 text-yellow-800 border-yellow-300',
    finance_reviewed:   'bg-blue-50 text-blue-800 border-blue-300',
    committee_approved: 'bg-indigo-50 text-indigo-800 border-indigo-300',
    vc_authorised:      'bg-emerald-50 text-emerald-800 border-emerald-300',
    approved:           'bg-green-50 text-green-800 border-green-300',
    active:             'bg-green-100 text-green-900 border-green-400 font-semibold',
    closed:             'bg-red-50 text-red-800 border-red-300',
};

const STATUS_LABELS: Record<string, string> = {
    draft:              'Draft — Preparation',
    dept_approved:      'Dept. Submitted — Awaiting Finance Review (Step 3)',
    finance_reviewed:   'Finance Reviewed — Awaiting Committee Consolidation (Step 4)',
    committee_approved: 'Committee Consolidated — Awaiting VC Authorisation (Step 5)',
    vc_authorised:      'VC Authorised — Ready to Upload to System (Step 6)',
    approved:           'Approved',
    active:             'Active — In Financial System',
    closed:             'Closed',
};

const FUND_LABELS: Record<string, string> = {
    general_fund:        'General Fund',
    igf:                 'IGF',
    research_grants:     'Research & Grants',
    donor_endowment:     'Donor / Endowment',
    capital_development: 'Capital Development',
};

const ECON_LABELS: Record<string, string> = {
    personnel_emoluments: 'Personnel Emoluments',
    goods_services:       'Goods & Services',
    capital_expenditure:  'Capital Expenditure',
    transfers_grants:     'Transfers & Grants',
};

const TYPE_LABELS: Record<string, string> = { operational: 'Operational', capital: 'Capital', cash_flow: 'Cash Flow' };

// ── Small helpers ─────────────────────────────────────────────────────────────

function Row({ label, value, span = false }: { label: string; value?: string | null; span?: boolean }) {
    return (
        <div className={span ? 'col-span-2' : ''}>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
            <p className="mt-0.5 text-sm text-gray-900">{value || <span className="italic text-gray-300">—</span>}</p>
        </div>
    );
}

function DocSection({ letter, title, sublabel, children }: {
    letter: string; title: string; sublabel: string; children: React.ReactNode;
}) {
    return (
        <div className="border rounded-lg overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-2.5 bg-gray-50 border-b">
                <span className="flex-shrink-0 h-6 w-6 rounded-full bg-gray-700 text-white text-xs font-bold flex items-center justify-center">{letter}</span>
                <div>
                    <span className="text-sm font-semibold text-gray-800">{title}</span>
                    <span className="ml-2 text-xs text-gray-400">{sublabel}</span>
                </div>
            </div>
            <div className="p-4">{children}</div>
        </div>
    );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Show() {
    const { t } = useTranslation();
    const { budget, auth } = usePage<any>().props;
    const perms: string[] = auth?.user?.permissions || [];

    const post = (name: string) => router.post(route(name, budget.id));

    const allocs: any[] = budget.allocations ?? [];
    const totalAllocated = allocs.reduce((s, a) => s + parseFloat(a.allocated_amount || 0), 0);
    const totalCommitted = allocs.reduce((s, a) => s + parseFloat(a.committed_amount || 0), 0);
    const totalSpent     = allocs.reduce((s, a) => s + parseFloat(a.spent_amount || 0), 0);

    const st = budget.status;

    return (
        <AuthenticatedLayout
            breadcrumbs={[
                { label: t('Budget Planner') },
                { label: t('Budgets'), href: route('budget-planner.budgets.index') },
                { label: budget.budget_name },
            ]}
            pageTitle={budget.budget_name}
            pageActions={
                <Link href={route('budget-planner.budgets.index')}>
                    <Button size="sm" variant="outline" className="gap-1">
                        <ArrowLeft className="h-4 w-4" />{t('Back')}
                    </Button>
                </Link>
            }
        >
            <Head title={budget.budget_name} />

            {/* ── Status banner + workflow actions ─────────────────────── */}
            <Card className="mb-4 shadow-sm">
                <CardContent className="p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium border ${STATUS_COLORS[st] ?? 'bg-gray-100 text-gray-700 border-gray-300'}`}>
                                {STATUS_LABELS[st] ?? st}
                            </span>
                            {budget.locked_at && (
                                <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-300 px-2 py-0.5 rounded-full">
                                    <Lock className="h-3 w-3" />{t('Budget Locked')}
                                </span>
                            )}
                        </div>

                        {/* Approval action buttons — shown to users with the right permission for this step */}
                        <div className="flex flex-wrap gap-2">
                            {st === 'draft' && perms.includes('approve-budgets') && (
                                <Button size="sm" className="gap-1 bg-yellow-600 hover:bg-yellow-700 text-white"
                                    onClick={() => post('budget-planner.budgets.approve')}>
                                    <CheckCircle className="h-4 w-4" />
                                    {t('Step 3: Submit for Finance Review')}
                                </Button>
                            )}
                            {st === 'dept_approved' && perms.includes('finance-review-budgets') && (
                                <Button size="sm" className="gap-1 bg-blue-600 hover:bg-blue-700 text-white"
                                    onClick={() => post('budget-planner.budgets.finance-review')}>
                                    <ClipboardCheck className="h-4 w-4" />
                                    {t('Step 3b: Finance Office — Mark Reviewed')}
                                </Button>
                            )}
                            {st === 'finance_reviewed' && perms.includes('committee-approve-budgets') && (
                                <Button size="sm" className="gap-1 bg-indigo-600 hover:bg-indigo-700 text-white"
                                    onClick={() => post('budget-planner.budgets.committee-approve')}>
                                    <Users className="h-4 w-4" />
                                    {t('Step 4: Finance Committee — Consolidate & Approve')}
                                </Button>
                            )}
                            {st === 'committee_approved' && perms.includes('vc-authorise-budgets') && (
                                <Button size="sm" className="gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                                    onClick={() => post('budget-planner.budgets.vc-authorise')}>
                                    <Crown className="h-4 w-4" />
                                    {t('Step 5: VC — Authorise Budget')}
                                </Button>
                            )}
                            {['vc_authorised', 'approved'].includes(st) && perms.includes('active-budgets') && (
                                <Button size="sm" className="gap-1 bg-green-600 hover:bg-green-700 text-white"
                                    onClick={() => post('budget-planner.budgets.active')}>
                                    <Upload className="h-4 w-4" />
                                    {t('Step 6: Upload to Financial System')}
                                </Button>
                            )}
                            {st === 'active' && perms.includes('close-budgets') && (
                                <Button size="sm" variant="outline" className="gap-1 text-red-700 border-red-300 hover:bg-red-50"
                                    onClick={() => post('budget-planner.budgets.close')}>
                                    <X className="h-4 w-4" />{t('Close Budget')}
                                </Button>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

                {/* ── Left: Budget documents (2/3 width) ─────────────── */}
                <div className="lg:col-span-2 space-y-4">

                    {/* Doc A — Budget Request Form */}
                    <DocSection letter="A" title={t('Budget Request Form')} sublabel={t('Step 2 — Identification & classification')}>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                            <Row label={t('Budget Name')}    value={budget.budget_name} span />
                            <Row label={t('Budget Type')}    value={TYPE_LABELS[budget.budget_type] ?? budget.budget_type} />
                            <Row label={t('Budget Subtype')} value={budget.budget_subtype ? budget.budget_subtype.charAt(0).toUpperCase() + budget.budget_subtype.slice(1) : null} />
                            <Row label={t('Budget Period')}  value={budget.budget_period?.period_name} />
                            <Row label={t('Fund Type')}      value={FUND_LABELS[budget.fund_type] ?? budget.fund_type} />
                            <Row label={t('Vote / Cost Centre')} value={budget.vote_cost_centre ? `${budget.vote_cost_centre.code} — ${budget.vote_cost_centre.name}` : null} />
                            <Row label={t('Prepared by')}    value={budget.creator?.name} />
                            {budget.parent_budget && (
                                <Row label={t('Parent Budget (Original)')} value={`${budget.parent_budget.budget_name} (${budget.parent_budget.budget_period?.period_name ?? ''})`} span />
                            )}
                            {budget.revision_reason && (
                                <Row label={t('Reason for Change')} value={budget.revision_reason} span />
                            )}
                            {budget.document && (
                                <div className="col-span-2">
                                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">{t('Supporting Document')}</p>
                                    <a href={`/storage/${budget.document}`} target="_blank" className="text-blue-600 text-sm hover:underline mt-0.5 inline-block">
                                        {t('View Document')}
                                    </a>
                                </div>
                            )}
                        </div>
                    </DocSection>

                    {/* Doc B — Programme / Activity Plan */}
                    <DocSection letter="B" title={t('Programme / Activity Plan')} sublabel={t('Step 1–2 — Strategic alignment & activity description')}>
                        <div className="space-y-4">
                            <Row label={t('Programme / Activity Name')} value={budget.programme_name} />
                            <div>
                                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">{t('Strategic Objective / Alignment')}</p>
                                {budget.strategic_objective
                                    ? <p className="text-sm text-gray-900 whitespace-pre-wrap">{budget.strategic_objective}</p>
                                    : <p className="text-sm italic text-gray-300">{t('Not provided — department head should state which institutional or national plan objective this budget supports.')}</p>
                                }
                            </div>
                        </div>
                    </DocSection>

                    {/* Doc C — Cost Estimates */}
                    <DocSection letter="C" title={t('Cost Estimates')} sublabel={t('Step 2 — Requested amounts & basis')}>
                        <div className="space-y-4">
                            {/* Total requested */}
                            <div className="flex items-center justify-between p-3 rounded-lg bg-blue-50 border border-blue-200">
                                <div>
                                    <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">{t('Total Requested Budget Amount')}</p>
                                    <p className="text-xs text-blue-500 mt-0.5">{t('Submitted by department for approval')}</p>
                                </div>
                                <p className="text-2xl font-bold text-blue-900">{formatCurrency(budget.total_budget_amount)}</p>
                            </div>

                            {/* Justification */}
                            <div>
                                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">{t('Cost Estimates Basis / Justification')}</p>
                                {budget.justification
                                    ? <p className="text-sm text-gray-900 whitespace-pre-wrap">{budget.justification}</p>
                                    : <p className="text-sm italic text-gray-300">{t('Not provided — department head should document how the cost estimates were derived (historical actuals, price quotations, headcount projections, etc.).')}</p>
                                }
                            </div>

                            {/* Line-item allocations */}
                            <div>
                                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">{t('Line-Item Allocation Breakdown')}</p>
                                {allocs.length === 0 ? (
                                    <p className="text-sm italic text-gray-300">{t('No line-item allocations entered yet. These are added via Budget Allocations after the budget is created.')}</p>
                                ) : (
                                    <>
                                        <div className="overflow-x-auto rounded border">
                                            <table className="w-full text-xs">
                                                <thead className="bg-gray-50 border-b">
                                                    <tr>
                                                        <th className="px-3 py-2 text-left font-semibold text-gray-600">{t('Account')}</th>
                                                        <th className="px-3 py-2 text-left font-semibold text-gray-600">{t('Classification')}</th>
                                                        <th className="px-3 py-2 text-right font-semibold text-gray-600">{t('Q1')}</th>
                                                        <th className="px-3 py-2 text-right font-semibold text-gray-600">{t('Q2')}</th>
                                                        <th className="px-3 py-2 text-right font-semibold text-gray-600">{t('Q3')}</th>
                                                        <th className="px-3 py-2 text-right font-semibold text-gray-600">{t('Q4')}</th>
                                                        <th className="px-3 py-2 text-right font-semibold text-gray-600">{t('Allocated')}</th>
                                                        <th className="px-3 py-2 text-right font-semibold text-gray-600">{t('Committed')}</th>
                                                        <th className="px-3 py-2 text-right font-semibold text-gray-600">{t('Spent')}</th>
                                                        <th className="px-3 py-2 text-right font-semibold text-gray-600">{t('Remaining')}</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y">
                                                    {allocs.map((a: any) => {
                                                        const rem = parseFloat(a.remaining_amount || 0);
                                                        return (
                                                            <tr key={a.id} className="hover:bg-gray-50">
                                                                <td className="px-3 py-2 font-mono text-gray-700">{a.account?.account_code} — {a.account?.account_name}</td>
                                                                <td className="px-3 py-2 text-gray-600">{ECON_LABELS[a.economic_classification] ?? a.economic_classification ?? '—'}</td>
                                                                <td className="px-3 py-2 text-right">{formatCurrency(a.q1_amount)}</td>
                                                                <td className="px-3 py-2 text-right">{formatCurrency(a.q2_amount)}</td>
                                                                <td className="px-3 py-2 text-right">{formatCurrency(a.q3_amount)}</td>
                                                                <td className="px-3 py-2 text-right">{formatCurrency(a.q4_amount)}</td>
                                                                <td className="px-3 py-2 text-right font-semibold">{formatCurrency(a.allocated_amount)}</td>
                                                                <td className="px-3 py-2 text-right text-amber-700">{formatCurrency(a.committed_amount)}</td>
                                                                <td className="px-3 py-2 text-right">{formatCurrency(a.spent_amount)}</td>
                                                                <td className={`px-3 py-2 text-right font-semibold ${rem < 0 ? 'text-red-600' : 'text-green-700'}`}>{formatCurrency(rem)}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                                <tfoot className="border-t-2 bg-gray-50 font-semibold">
                                                    <tr>
                                                        <td colSpan={6} className="px-3 py-2 text-right text-xs">{t('Totals')}</td>
                                                        <td className="px-3 py-2 text-right text-xs">{formatCurrency(totalAllocated)}</td>
                                                        <td className="px-3 py-2 text-right text-xs text-amber-700">{formatCurrency(totalCommitted)}</td>
                                                        <td className="px-3 py-2 text-right text-xs">{formatCurrency(totalSpent)}</td>
                                                        <td className="px-3 py-2 text-right text-xs">{formatCurrency(totalAllocated - totalSpent)}</td>
                                                    </tr>
                                                </tfoot>
                                            </table>
                                        </div>
                                        {Math.abs(totalAllocated - parseFloat(budget.total_budget_amount || 0)) > 0.01 && (
                                            <p className="text-xs text-amber-600 mt-1">
                                                {t('Requested total')} ({formatCurrency(budget.total_budget_amount)}) {t('differs from line-item sum')} ({formatCurrency(totalAllocated)})
                                            </p>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    </DocSection>
                </div>

                {/* ── Right: Approval trail (1/3 width) ──────────────── */}
                <div className="space-y-4">
                    <div className="border rounded-lg overflow-hidden">
                        <div className="px-4 py-2.5 bg-gray-50 border-b">
                            <p className="text-sm font-semibold text-gray-700">{t('Approval Trail')}</p>
                            <p className="text-xs text-gray-400">{t('Steps 3 → 6 governance chain')}</p>
                        </div>
                        <div className="p-3 space-y-2">
                            <TrailStep
                                step={t('Step 2 — Prepared')}
                                actor={budget.creator?.name}
                                date={budget.created_at}
                                done
                                current={st === 'draft'}
                            />
                            <TrailStep
                                step={t('Step 3a — Dept. Submitted')}
                                actor={budget.approved_by?.name}
                                date={null}
                                done={budget.approved_by != null}
                                current={st === 'dept_approved'}
                            />
                            <TrailStep
                                step={t('Step 3b — Finance Reviewed')}
                                actor={budget.finance_office_reviewed_by?.name}
                                date={budget.finance_office_reviewed_at}
                                done={budget.finance_office_reviewed_by != null}
                                current={st === 'finance_reviewed'}
                            />
                            <TrailStep
                                step={t('Step 4 — Committee Consolidated & Approved')}
                                actor={budget.finance_committee_approved_by?.name}
                                date={budget.finance_committee_approved_at}
                                done={budget.finance_committee_approved_by != null}
                                current={st === 'committee_approved'}
                            />
                            <TrailStep
                                step={t('Step 5 — VC Authorised')}
                                actor={budget.vc_authorised_by?.name}
                                date={budget.vc_authorised_at}
                                done={budget.vc_authorised_by != null}
                                current={['vc_authorised', 'approved'].includes(st)}
                            />
                            <TrailStep
                                step={t('Step 6 — Uploaded to Financial System')}
                                actor={null}
                                date={null}
                                done={['active', 'closed'].includes(st)}
                                current={st === 'active'}
                            />
                        </div>
                    </div>

                    {/* Budget summary card */}
                    <div className="border rounded-lg overflow-hidden">
                        <div className="px-4 py-2.5 bg-gray-50 border-b">
                            <p className="text-sm font-semibold text-gray-700">{t('Budget Summary')}</p>
                        </div>
                        <div className="p-4 space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-500">{t('Requested')}</span>
                                <span className="font-semibold">{formatCurrency(budget.total_budget_amount)}</span>
                            </div>
                            {allocs.length > 0 && (
                                <>
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">{t('Allocated (lines)')}</span>
                                        <span className="font-semibold">{formatCurrency(totalAllocated)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">{t('Committed')}</span>
                                        <span className="font-semibold text-amber-700">{formatCurrency(totalCommitted)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">{t('Spent')}</span>
                                        <span className="font-semibold">{formatCurrency(totalSpent)}</span>
                                    </div>
                                    <div className="flex justify-between border-t pt-2">
                                        <span className="text-gray-500">{t('Remaining')}</span>
                                        <span className={`font-bold ${(totalAllocated - totalSpent) < 0 ? 'text-red-600' : 'text-green-700'}`}>
                                            {formatCurrency(totalAllocated - totalSpent)}
                                        </span>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

function TrailStep({ step, actor, date, done, current }: {
    step: string; actor?: string | null; date?: string | null; done: boolean; current?: boolean;
}) {
    return (
        <div className={`flex gap-2.5 p-2 rounded border text-xs ${current ? 'border-blue-300 bg-blue-50' : done ? 'border-green-200 bg-green-50' : 'border-gray-100 bg-gray-50/50'}`}>
            <div className={`mt-0.5 h-4 w-4 rounded-full shrink-0 flex items-center justify-center ${current ? 'bg-blue-500' : done ? 'bg-green-500' : 'bg-gray-200'}`}>
                {done && !current && <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                {current && <div className="h-2 w-2 rounded-full bg-white" />}
            </div>
            <div>
                <p className={`font-semibold leading-tight ${current ? 'text-blue-800' : done ? 'text-green-800' : 'text-gray-400'}`}>{step}</p>
                {actor && <p className="text-gray-600 mt-0.5">{actor}</p>}
                {date && <p className="text-gray-400">{new Date(date).toLocaleDateString('en-GB')}</p>}
            </div>
        </div>
    );
}
