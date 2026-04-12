import { DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useForm, usePage } from "@inertiajs/react";
import { useTranslation } from 'react-i18next';
import { Button } from "@/components/ui/button";
import { Label } from '@/components/ui/label';
import InputError from '@/components/ui/input-error';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Lock, FileText, LayoutList, Calculator } from 'lucide-react';
import { CurrencyInput } from '@/components/ui/currency-input';

interface EditProps {
    budget: any;
    onSuccess: () => void;
}

export default function Edit({ budget, onSuccess }: EditProps) {
    const { budgetPeriods, voteCostCentres } = usePage<any>().props;
    const { t } = useTranslation();
    const isLocked = !!budget.locked_at;

    const { data, setData, post, processing, errors } = useForm({
        budget_name:          budget.budget_name ?? '',
        period_id:            budget.period_id?.toString() ?? '',
        budget_type:          budget.budget_type ?? '',
        budget_subtype:       budget.budget_subtype ?? 'original',
        vote_cost_centre_id:  budget.vote_cost_centre_id?.toString() ?? '',
        fund_type:            budget.fund_type ?? '',
        revision_reason:      budget.revision_reason ?? '',
        total_budget_amount:  budget.total_budget_amount?.toString() ?? '',
        programme_name:       budget.programme_name ?? '',
        strategic_objective:  budget.strategic_objective ?? '',
        justification:        budget.justification ?? '',
        document:             null as File | null,
        _method:              'put',
    });

    const needsParent = data.budget_subtype === 'revised' || data.budget_subtype === 'supplementary';

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        post(route('budget-planner.budgets.update', budget.id), {
            onSuccess: () => { onSuccess(); },
            forceFormData: true,
        });
    };

    return (
        <DialogContent className="max-w-2xl">
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                    {t('Edit Budget')}
                    {isLocked && (
                        <span className="inline-flex items-center gap-1 text-xs font-normal text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                            <Lock className="h-3 w-3" /> {t('Locked')}
                        </span>
                    )}
                </DialogTitle>
                <p className="text-xs text-gray-500 mt-0.5">{t('Step 2: Departmental Budget Preparation — complete all sections below')}</p>
            </DialogHeader>

            {isLocked ? (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
                    {t('This budget is locked. Submit a budget amendment for changes.')}
                </div>
            ) : (
                <form onSubmit={submit} className="max-h-[78vh] overflow-y-auto pr-1 space-y-0">

                    {/* ── Section A: Budget Request Form ────────────────── */}
                    <div className="border rounded-lg overflow-hidden mb-4">
                        <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 border-b">
                            <FileText className="h-4 w-4 text-gray-600 shrink-0" />
                            <div>
                                <span className="text-sm font-semibold text-gray-800">{t('A. Budget Request Form')}</span>
                                <span className="ml-2 text-xs text-gray-500">{t('Identification & classification of the budget')}</span>
                            </div>
                        </div>
                        <div className="p-4 space-y-4">
                            <div>
                                <Label htmlFor="budget_name" required>{t('Budget Name')}</Label>
                                <Input
                                    id="budget_name"
                                    value={data.budget_name}
                                    onChange={(e) => setData('budget_name', e.target.value)}
                                    placeholder={t('Enter Budget Name')}
                                    required
                                />
                                <InputError message={errors.budget_name} />
                            </div>
                                <div>
                                    <Label htmlFor="document">{t('Supporting Document (PDF, Word)')}</Label>
                                    {budget.document && (
                                        <div className="mb-2">
                                            <a href={`/storage/${budget.document}`} target="_blank" className="text-blue-600 text-sm hover:underline flex items-center gap-1">
                                                <FileText className="h-4 w-4" /> {t('View Current Document')}
                                            </a>
                                        </div>
                                    )}
                                    <Input
                                        id="document"
                                        type="file"
                                        accept=".pdf,.doc,.docx"
                                        className="mt-1"
                                        onChange={(e) => setData('document', e.target.files ? e.target.files[0] : null)}
                                    />
                                    <InputError message={errors.document} />
                                </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>{t('Budget Subtype')}</Label>
                                    <Select value={data.budget_subtype} onValueChange={(v) => setData('budget_subtype', v)}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="original">{t('Original')}</SelectItem>
                                            <SelectItem value="revised">{t('Revised')}</SelectItem>
                                            <SelectItem value="supplementary">{t('Supplementary')}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <InputError message={errors.budget_subtype} />
                                </div>
                                <div>
                                    <Label required>{t('Budget Type')}</Label>
                                    <Select value={data.budget_type} onValueChange={(v) => setData('budget_type', v)}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="operational">{t('Operational')}</SelectItem>
                                            <SelectItem value="capital">{t('Capital')}</SelectItem>
                                            <SelectItem value="cash_flow">{t('Cash Flow')}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <InputError message={errors.budget_type} />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label required>{t('Budget Period')}</Label>
                                    <Select value={data.period_id} onValueChange={(v) => setData('period_id', v)}>
                                        <SelectTrigger><SelectValue placeholder={t('Select Budget Period')} /></SelectTrigger>
                                        <SelectContent>
                                            {budgetPeriods?.map((period: any) => (
                                                <SelectItem key={period.id} value={period.id.toString()}>
                                                    {period.period_name} ({period.financial_year})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <InputError message={errors.period_id} />
                                </div>
                                <div>
                                    <Label>{t('Fund Type')}</Label>
                                    <Select value={data.fund_type} onValueChange={(v) => setData('fund_type', v)}>
                                        <SelectTrigger><SelectValue placeholder={t('Select Fund Type')} /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="general_fund">{t('General Fund')}</SelectItem>
                                            <SelectItem value="igf">{t('IGF')}</SelectItem>
                                            <SelectItem value="research_grants">{t('Research & Grants')}</SelectItem>
                                            <SelectItem value="donor_endowment">{t('Donor \/ Endowment')}</SelectItem>
                                            <SelectItem value="capital_development">{t('Capital Development')}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <InputError message={errors.fund_type} />
                                </div>
                            </div>

                            <div>
                                <Label>{t('Vote \/ Cost Centre')}</Label>
                                <Select value={data.vote_cost_centre_id} onValueChange={(v) => setData('vote_cost_centre_id', v)}>
                                    <SelectTrigger><SelectValue placeholder={t('Select Vote \/ Cost Centre')} /></SelectTrigger>
                                    <SelectContent>
                                        {voteCostCentres?.map((v: any) => (
                                            <SelectItem key={v.id} value={v.id.toString()}>
                                                {v.code} — {v.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <InputError message={errors.vote_cost_centre_id} />
                            </div>

                            {needsParent && (
                                <div>
                                    <Label>{t('Reason for Change')}</Label>
                                    <Textarea
                                        value={data.revision_reason}
                                        onChange={(e) => setData('revision_reason', e.target.value)}
                                        placeholder={t('Explain the reason for this revision or supplementary budget')}
                                        rows={2}
                                    />
                                    <InputError message={errors.revision_reason} />
                                </div>
                            )}


                        </div>
                    </div>

                    {/* ── Section B: Programme / Activity Plan ──────────── */}
                    <div className="border rounded-lg overflow-hidden mb-4">
                        <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 border-b">
                            <LayoutList className="h-4 w-4 text-gray-600 shrink-0" />
                            <div>
                                <span className="text-sm font-semibold text-gray-800">{t('B. Programme / Activity Plan')}</span>
                                <span className="ml-2 text-xs text-gray-500">{t('Link to institutional strategy & national development plans')}</span>
                            </div>
                        </div>
                        <div className="p-4 space-y-4">
                            <div>
                                <Label htmlFor="programme_name">{t('Programme / Activity Name')}</Label>
                                <Input
                                    id="programme_name"
                                    value={data.programme_name}
                                    onChange={(e) => setData('programme_name', e.target.value)}
                                    placeholder={t('e.g. Academic Quality Improvement Programme')}
                                />
                                <InputError message={errors.programme_name} />
                            </div>
                            <div>
                                <Label htmlFor="strategic_objective">{t('Strategic Objective / Alignment')}</Label>
                                <Textarea
                                    id="strategic_objective"
                                    value={data.strategic_objective}
                                    onChange={(e) => setData('strategic_objective', e.target.value)}
                                    placeholder={t('Which institutional or national development plan objective does this budget support?')}
                                    rows={3}
                                />
                                <InputError message={errors.strategic_objective} />
                            </div>
                        </div>
                    </div>

                    {/* ── Section C: Cost Estimates ─────────────────────── */}
                    <div className="border rounded-lg overflow-hidden mb-4">
                        <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 border-b">
                            <Calculator className="h-4 w-4 text-gray-600 shrink-0" />
                            <div>
                                <span className="text-sm font-semibold text-gray-800">{t('C. Cost Estimates')}</span>
                                <span className="ml-2 text-xs text-gray-500">{t('Basis and justification for the amounts requested')}</span>
                            </div>
                        </div>
                        <div className="p-4 space-y-4">
                            <div>
                                <CurrencyInput
                                    label={t('Total Requested Budget Amount')}
                                    value={data.total_budget_amount}
                                    onChange={(v) => setData('total_budget_amount', v)}
                                    error={errors.total_budget_amount}
                                />
                                <p className="text-xs text-gray-400 mt-1">{t('Once line-item allocations exist, the total is driven by their sum.')}</p>
                            </div>
                            <div>
                            <Label htmlFor="justification">{t('Cost Estimates Basis / Justification')}</Label>
                            <Textarea
                                id="justification"
                                value={data.justification}
                                onChange={(e) => setData('justification', e.target.value)}
                                placeholder={t('Describe the methodology used to arrive at the cost estimates (e.g. historical actuals, price quotations, headcount projections)')}
                                rows={4}
                            />
                            <InputError message={errors.justification} />
                            </div>
                    </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 pb-1">
                    <Button type="button" variant="outline" onClick={onSuccess}>{t('Cancel')}</Button>
                        <Button type="submit" disabled={processing}>
                            {processing ? t('Updating...') : t('Update')}
                        </Button>
                    </div>
                </form>
            )}
        </DialogContent>
    );
}
