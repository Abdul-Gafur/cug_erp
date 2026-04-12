import React, { useState } from 'react';
import { Head, usePage, router, useForm } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import AuthenticatedLayout from '@/layouts/authenticated-layout';
import { Rfq, RfqEvaluation, EvaluationCriterion, EvaluationScore, RfqSupplier, User } from '../Quotations/types';
import { formatCurrency, formatDate } from '@/utils/helpers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Award, Download, Save, CheckCircle, Edit3, Printer, FileText, ExternalLink } from 'lucide-react';

interface ScorecardProps {
    quotation: Rfq;
    evaluation: RfqEvaluation;
    matrix: Record<number, Record<number, EvaluationScore>>;
    totals: Record<number, number>;
    auth: any;
    [key: string]: any;
}

export default function Scorecard() {
    const { t } = useTranslation();
    const { quotation, evaluation, matrix, totals, auth } = usePage<ScorecardProps>().props;
    const permissions: string[] = auth?.user?.permissions ?? [];
    const canEdit = permissions.includes('approve-quotations') && evaluation.status === 'draft';

    const respondedSuppliers = quotation.suppliers?.filter(s => s.status === 'responded') ?? [];
    const criteria = evaluation.criteria ?? [];

    // ── Score editing state ────────────────────────────────────────────────
    const [editingSupplier, setEditingSupplier] = useState<RfqSupplier | null>(null);
    const [localScores, setLocalScores] = useState<Record<number, { score: string; notes: string }>>({});

    const openScoreEdit = (supplier: RfqSupplier) => {
        const init: Record<number, { score: string; notes: string }> = {};
        criteria.forEach(c => {
            const existing = matrix[c.id]?.[supplier.supplier_id];
            init[c.id] = { score: existing?.score?.toString() ?? '', notes: existing?.notes ?? '' };
        });
        setLocalScores(init);
        setEditingSupplier(supplier);
    };

    const saveScoresForm = useForm<any>({ supplier_id: '', scores: [] });

    const handleSaveScores = () => {
        if (!editingSupplier) return;
        
        const payload = {
            supplier_id: editingSupplier.supplier_id,
            scores: criteria.map(c => ({
                criterion_id: c.id,
                score: parseFloat(localScores[c.id]?.score ?? '0'),
                notes: localScores[c.id]?.notes ?? '',
            })),
        };

        router.post(route('rfq.evaluation.scores', quotation.id), payload, {
            onSuccess: () => {
                setEditingSupplier(null);
                router.reload({ only: ['matrix', 'totals', 'evaluation'] });
            },
        });
    };

    // ── Criteria weight editing ────────────────────────────────────────────
    const [showCriteriaEdit, setShowCriteriaEdit] = useState(false);
    const [localCriteria, setLocalCriteria] = useState(criteria.map(c => ({ ...c, weight: c.weight.toString() })));

    const criteriaForm = useForm<any>({ criteria: [] });

    const saveCriteria = () => {
        const payload = { 
            criteria: localCriteria.map(c => ({ 
                id: c.id, 
                criterion_name: c.criterion_name, 
                weight: parseFloat(c.weight), 
                sort_order: c.sort_order 
            })) 
        };

        router.put(route('rfq.evaluation.criteria', quotation.id), payload, {
            onSuccess: () => {
                setShowCriteriaEdit(false);
                router.reload({ only: ['evaluation', 'matrix', 'totals'] });
            },
        });
    };

    const totalWeight = localCriteria.reduce((s, c) => s + (parseFloat(c.weight) || 0), 0);

    // ── Finalise ───────────────────────────────────────────────────────────
    const [showFinalise, setShowFinalise] = useState(false);
    const finaliseForm = useForm({ recommended_supplier_id: '', recommendation_notes: '' });

    // ── Committee Sign-off ────────────────────────────────────────────────
    const [showCommitteeSignoff, setShowCommitteeSignoff] = useState(false);
    const committeeForm = useForm<any>({
        committee_members: '',
        signed_document: null,
    });

    const handleCommitteeApprove = () => {
        committeeForm.post(route('rfq.evaluation.committee-approve', quotation.id), {
            onSuccess: () => setShowCommitteeSignoff(false),
        });
    };

    // Sort suppliers by score descending
    const ranked = Object.entries(totals)
        .map(([sid, score]) => ({ supplierId: parseInt(sid), score: score as number }))
        .sort((a, b) => b.score - a.score);

    const getSupplierById = (id: number) =>
        quotation.suppliers?.find(s => s.supplier_id === id)?.supplier;

    return (
        <AuthenticatedLayout
            breadcrumbs={[
                { label: t('Requests for Quotations / Tenders'), url: route('quotations.index') },
                { label: quotation.quotation_number, url: route('quotations.show', quotation.id) },
                { label: t('Tender Evaluation Report') },
            ]}
            pageTitle={`${t('Tender Evaluation Report')} — RFQ #${quotation.quotation_number}`}
        >
            <Head title={`Tender Evaluation Report — ${quotation.quotation_number}`} />

            <div className="space-y-6">
                {/* Status bar */}
                <div className="flex flex-wrap justify-between items-center gap-3">
                    <div className="flex items-center gap-3">
                        <Badge className={
                            evaluation.status === 'committee_approved' ? 'bg-blue-100 text-blue-800' :
                            evaluation.status === 'finalised' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                        }>
                            {evaluation.status === 'committee_approved' ? t('Approved by Committee') :
                             evaluation.status === 'finalised' ? t('Report Finalised') : t('Draft')}
                        </Badge>
                        {evaluation.finalised_at && (
                            <span className="text-sm text-muted-foreground">
                                {t('Finalised')}: {formatDate(evaluation.finalised_at)}
                            </span>
                        )}
                        {evaluation.committee_approved_at && (
                            <div className="flex items-center gap-2 ml-2 px-2 border-l border-gray-300">
                                <span className="text-sm text-muted-foreground whitespace-nowrap">
                                    {t('Committee Sign-off')}: {formatDate(evaluation.committee_approved_at)}
                                </span>
                                {evaluation.signed_document && (
                                    <a 
                                        href={`/storage/${evaluation.signed_document}`} 
                                        target="_blank" 
                                        className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 underline underline-offset-2"
                                    >
                                        <FileText className="h-3 w-3" />
                                        {t('View Signed Document')}
                                        <ExternalLink className="h-2 w-2" />
                                    </a>
                                )}
                            </div>
                        )}
                    </div>
                    <div className="flex gap-2">
                        {canEdit && (
                            <Button variant="outline" size="sm" onClick={() => setShowCriteriaEdit(true)}>
                                <Edit3 className="h-4 w-4 mr-1" />{t('Edit Criteria')}
                            </Button>
                        )}
                        {permissions.includes('print-quotations') && (
                            <Button variant="outline" size="sm"
                                onClick={() => window.open(route('rfq.evaluation.print', quotation.id), '_blank')}>
                                <Printer className="h-4 w-4 mr-1" />{t('Print / PDF Report')}
                            </Button>
                        )}
                        {/* Award Contract / Issue Purchase Order — visible ONLY after Tender Committee Approval */}
                        {evaluation.status === 'committee_approved' && permissions.includes('approve-quotations') && quotation.status === 'under_evaluation' && (
                            <Button size="sm" variant="default" className="bg-blue-600 hover:bg-blue-700"
                                onClick={() => router.post(route('quotations.award', quotation.id), {
                                    awarded_supplier_id: evaluation.recommended_supplier_id,
                                })}>
                                <Award className="h-4 w-4 mr-1" />{t('Award Contract / Issue Purchase Order')}
                            </Button>
                        )}
                        {evaluation.status === 'finalised' && permissions.includes('approve-quotations') && (
                            <Button size="sm" variant="default" className="bg-green-600 hover:bg-green-700"
                                onClick={() => setShowCommitteeSignoff(true)}>
                                <CheckCircle className="h-4 w-4 mr-1" />{t('Committee Sign-off')}
                            </Button>
                        )}
                        {canEdit && ranked.length > 0 && (
                            <Button size="sm" onClick={() => {
                                finaliseForm.setData({ recommended_supplier_id: ranked[0].supplierId.toString(), recommendation_notes: '' });
                                setShowFinalise(true);
                            }}>
                                <CheckCircle className="h-4 w-4 mr-1" />{t('Finalise Evaluation')}
                            </Button>
                        )}
                    </div>
                </div>

                {/* Scorecard grid */}
                <Card>
                    <CardHeader>
                        <CardTitle>{t('Tender Evaluation Scorecard')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {respondedSuppliers.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                                {t('No supplier responses recorded yet. Go back to the RFQ and record supplier responses before evaluating.')}
                            </p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm border-collapse">
                                    <thead>
                                        <tr>
                                            <th className="border px-3 py-2 text-left bg-muted font-semibold">{t('Criterion')}</th>
                                            <th className="border px-3 py-2 text-center bg-muted font-semibold w-20">{t('Weight %')}</th>
                                            {respondedSuppliers.map(s => (
                                                <th key={s.supplier_id} className="border px-3 py-2 text-center bg-muted font-semibold">
                                                    <div>{s.supplier?.name}</div>
                                                    <div className="text-xs font-normal text-muted-foreground">{formatCurrency(s.quoted_amount ?? 0)}</div>
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {criteria.map(c => (
                                            <tr key={c.id} className="hover:bg-muted/30">
                                                <td className="border px-3 py-2 font-medium">{c.criterion_name}</td>
                                                <td className="border px-3 py-2 text-center">{c.weight}%</td>
                                                {respondedSuppliers.map(s => {
                                                    const score = matrix[c.id]?.[s.supplier_id];
                                                    return (
                                                        <td key={s.supplier_id} className="border px-3 py-2 text-center">
                                                            {score ? (
                                                                <div>
                                                                    <div className="font-semibold">{score.score}/100</div>
                                                                    <div className="text-xs text-muted-foreground">
                                                                        weighted: {Number(score.weighted_score).toFixed(2)}
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <span className="text-muted-foreground">—</span>
                                                            )}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))}
                                        {/* Total row */}
                                        <tr className="bg-muted font-bold">
                                            <td className="border px-3 py-2" colSpan={2}>{t('Total Weighted Score')}</td>
                                            {respondedSuppliers.map(s => (
                                                <td key={s.supplier_id} className="border px-3 py-2 text-center text-base">
                                                    {(totals[s.supplier_id] ?? 0).toFixed(2)}
                                                    {ranked[0]?.supplierId === s.supplier_id && ranked[0].score > 0 && (
                                                        <Award className="inline h-4 w-4 ml-1 text-green-600" />
                                                    )}
                                                </td>
                                            ))}
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Score entry per supplier */}
                {canEdit && respondedSuppliers.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle>{t('Enter Scores')}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-wrap gap-2">
                                {respondedSuppliers.map(s => (
                                    <Button key={s.supplier_id} variant="outline" onClick={() => openScoreEdit(s)}>
                                        <Edit3 className="h-4 w-4 mr-2" />
                                        {t('Score')} {s.supplier?.name}
                                    </Button>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Ranking summary */}
                {ranked.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle>{t('Ranking Summary')}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ol className="space-y-2">
                                {ranked.map((r, i) => {
                                    const supplier = getSupplierById(r.supplierId);
                                    const rfqSup = respondedSuppliers.find(s => s.supplier_id === r.supplierId);
                                    return (
                                        <li key={r.supplierId} className={`flex items-center gap-4 p-3 rounded-lg border ${i === 0 ? 'border-green-300 bg-green-50' : 'border-gray-200'}`}>
                                            <span className={`text-xl font-bold w-8 ${i === 0 ? 'text-green-700' : 'text-muted-foreground'}`}>
                                                #{i + 1}
                                            </span>
                                            <div className="flex-1">
                                                <div className="font-semibold">{supplier?.name}</div>
                                                <div className="text-sm text-muted-foreground">
                                                    Quoted: {formatCurrency(rfqSup?.quoted_amount ?? 0)} |
                                                    Delivery: {rfqSup?.delivery_days ?? '?'} days
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-lg font-bold">{r.score.toFixed(2)}</div>
                                                <div className="text-xs text-muted-foreground">{t('points')}</div>
                                            </div>
                                            {i === 0 && <Award className="h-5 w-5 text-green-600" />}
                                        </li>
                                    );
                                })}
                            </ol>
                        </CardContent>
                    </Card>
                )}

                {/* Recommendation notes */}
                {evaluation.recommendation_notes && (
                    <Card>
                        <CardHeader><CardTitle>{t('Recommendation Notes')}</CardTitle></CardHeader>
                        <CardContent>
                            <p className="text-sm">{evaluation.recommendation_notes}</p>
                            {evaluation.finalised_by_user && (
                                <p className="text-xs text-muted-foreground mt-2">
                                    {t('Finalised by')} {evaluation.finalised_by_user.name} on {formatDate(evaluation.finalised_at!)}
                                </p>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* Committee details */}
                {evaluation.committee_approved_at && (
                    <Card className="border-blue-200 bg-blue-50/20">
                        <CardHeader><CardTitle className="text-blue-900">{t('Tender Committee Approval')}</CardTitle></CardHeader>
                        <CardContent className="space-y-3">
                            <div>
                                <Label className="text-xs text-blue-700 uppercase tracking-wider">{t('Committee Members')}</Label>
                                <p className="text-sm font-medium">{evaluation.committee_members}</p>
                            </div>
                            <div className="flex gap-10">
                                <div>
                                    <Label className="text-xs text-blue-700 uppercase tracking-wider">{t('Approved By')}</Label>
                                    <p className="text-sm font-medium">{evaluation.committee_approved_by_user?.name}</p>
                                </div>
                                <div>
                                    <Label className="text-xs text-blue-700 uppercase tracking-wider">{t('Date')}</Label>
                                    <p className="text-sm font-medium">{formatDate(evaluation.committee_approved_at)}</p>
                                </div>
                            </div>
                            {evaluation.signed_document && (
                                <div className="pt-2 border-t border-blue-100">
                                    <Label className="text-xs text-blue-700 uppercase tracking-wider">{t('Signed Evaluation Report')}</Label>
                                    <div className="mt-2">
                                        <a 
                                            href={`/storage/${evaluation.signed_document}`} 
                                            target="_blank" 
                                            className="inline-flex items-center gap-3 px-4 py-2 bg-white border border-blue-200 rounded-lg shadow-sm hover:shadow-md hover:border-blue-300 transition-all group"
                                        >
                                            <FileText className="h-5 w-5 text-blue-600 group-hover:scale-110 transition-transform" />
                                            <div className="text-left">
                                                <div className="text-xs font-bold text-slate-900 leading-tight">{t('View Attachment')}</div>
                                                <div className="text-[10px] text-muted-foreground truncate max-w-[150px]">
                                                    {evaluation.signed_document.split('/').pop()}
                                                </div>
                                            </div>
                                            <ExternalLink className="h-3 w-3 text-slate-400 group-hover:text-blue-600 ml-2" />
                                        </a>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Score entry dialog */}
            <Dialog open={!!editingSupplier} onOpenChange={() => setEditingSupplier(null)}>
                <DialogContent className="max-w-xl">
                    <DialogHeader>
                        <DialogTitle>{t('Score')} — {editingSupplier?.supplier?.name}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2 max-h-96 overflow-y-auto">
                        {criteria.map(c => (
                            <div key={c.id} className="border rounded p-3">
                                <div className="flex justify-between items-center mb-2">
                                    <Label className="font-semibold">{c.criterion_name}</Label>
                                    <span className="text-xs text-muted-foreground">Weight: {c.weight}%</span>
                                </div>
                                <div className="flex gap-3">
                                    <div className="flex-1">
                                        <Label className="text-xs">{t('Score (0–100)')}</Label>
                                        <Input
                                            type="number"
                                            min={0}
                                            max={100}
                                            value={localScores[c.id]?.score ?? ''}
                                            onChange={e => setLocalScores(prev => ({
                                                ...prev,
                                                [c.id]: { ...prev[c.id], score: e.target.value },
                                            }))}
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <Label className="text-xs">{t('Notes')}</Label>
                                        <Input
                                            value={localScores[c.id]?.notes ?? ''}
                                            onChange={e => setLocalScores(prev => ({
                                                ...prev,
                                                [c.id]: { ...prev[c.id], notes: e.target.value },
                                            }))}
                                            placeholder={t('Optional notes...')}
                                        />
                                    </div>
                                </div>
                                {localScores[c.id]?.score && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Weighted: {((parseFloat(localScores[c.id].score) / 100) * c.weight).toFixed(2)} pts
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingSupplier(null)}>{t('Cancel')}</Button>
                        <Button onClick={handleSaveScores} disabled={saveScoresForm.processing}>
                            <Save className="h-4 w-4 mr-1" />{t('Save Scores')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Criteria edit dialog */}
            <Dialog open={showCriteriaEdit} onOpenChange={setShowCriteriaEdit}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{t('Edit Evaluation Criteria')}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <p className="text-sm text-muted-foreground">{t('Weights must sum to 100%.')}</p>
                        {localCriteria.map((c, i) => (
                            <div key={c.id} className="flex gap-2 items-center">
                                <Input
                                    className="flex-1"
                                    value={c.criterion_name}
                                    onChange={e => setLocalCriteria(prev => prev.map((x, j) => j === i ? { ...x, criterion_name: e.target.value } : x))}
                                />
                                <div className="w-24 flex items-center gap-1">
                                    <Input
                                        type="number"
                                        min={0}
                                        max={100}
                                        value={c.weight}
                                        onChange={e => setLocalCriteria(prev => prev.map((x, j) => j === i ? { ...x, weight: e.target.value } : x))}
                                    />
                                    <span className="text-sm">%</span>
                                </div>
                            </div>
                        ))}
                        <p className={`text-sm font-medium ${Math.abs(totalWeight - 100) < 0.01 ? 'text-green-600' : 'text-red-600'}`}>
                            {t('Total')}: {totalWeight.toFixed(2)}% {Math.abs(totalWeight - 100) < 0.01 ? '✓' : `(${t('must be 100%')})`}
                        </p>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowCriteriaEdit(false)}>{t('Cancel')}</Button>
                        <Button onClick={saveCriteria} disabled={criteriaForm.processing || Math.abs(totalWeight - 100) > 0.01}>
                            {t('Save Criteria')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Finalise dialog */}
            <Dialog open={showFinalise} onOpenChange={setShowFinalise}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t('Finalise Tender Evaluation Report')}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <p className="text-sm">{t('Once finalised, scores and criteria cannot be changed. The recommended supplier will be recorded.')}</p>
                        <div>
                            <Label required>{t('Recommended Supplier')}</Label>
                            <Select value={finaliseForm.data.recommended_supplier_id}
                                onValueChange={v => finaliseForm.setData('recommended_supplier_id', v)}>
                                <SelectTrigger>
                                    <SelectValue placeholder={t('Select...')} />
                                </SelectTrigger>
                                <SelectContent>
                                    {ranked.map(r => (
                                        <SelectItem key={r.supplierId} value={r.supplierId.toString()}>
                                            {getSupplierById(r.supplierId)?.name} — {r.score.toFixed(2)} pts
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>{t('Recommendation Notes')}</Label>
                            <Textarea
                                value={finaliseForm.data.recommendation_notes}
                                onChange={e => finaliseForm.setData('recommendation_notes', e.target.value)}
                                rows={3}
                                placeholder={t('Narrative justification for the award recommendation...')}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowFinalise(false)}>{t('Cancel')}</Button>
                        <Button onClick={() => finaliseForm.post(route('rfq.evaluation.finalise', quotation.id), { onSuccess: () => setShowFinalise(false) })}
                            disabled={finaliseForm.processing || !finaliseForm.data.recommended_supplier_id}>
                            <CheckCircle className="h-4 w-4 mr-1" />{t('Finalise Evaluation Report')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            {/* Committee Sign-off dialog */}
            <Dialog open={showCommitteeSignoff} onOpenChange={setShowCommitteeSignoff}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t('Tender Committee Sign-off')}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <p className="text-sm text-muted-foreground">
                            {t('Please enter the names of the Tender Committee members who have approved this evaluation report.')}
                        </p>
                        <div>
                            <Label required>{t('Committee Members')}</Label>
                            <Textarea
                                value={committeeForm.data.committee_members}
                                onChange={e => committeeForm.setData('committee_members', e.target.value)}
                                placeholder={t('Enter names separated by commas (e.g. John Doe, Jane Smith)...')}
                                rows={3}
                            />
                        </div>
                        <div>
                            <Label>{t('Upload Signed Evaluation Report')}</Label>
                            <Input
                                type="file"
                                onChange={e => committeeForm.setData('signed_document', e.target.files?.[0])}
                                accept=".pdf,.jpg,.png,.jpeg"
                                className="cursor-pointer"
                            />
                            <p className="text-[10px] text-muted-foreground mt-1">
                                {t('PDF or Images, Max 20MB')}
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowCommitteeSignoff(false)}>{t('Cancel')}</Button>
                        <Button 
                            onClick={handleCommitteeApprove} 
                            disabled={committeeForm.processing || !committeeForm.data.committee_members}
                            className="bg-green-600 hover:bg-green-700"
                        >
                            <CheckCircle className="h-4 w-4 mr-1" />{t('Sign-off & Approve')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AuthenticatedLayout>
    );
}
