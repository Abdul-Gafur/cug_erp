<?php

namespace Workdo\Account\Listeners;

use App\Events\PostPurchaseInvoice;
use Workdo\Account\Services\JournalService;

class PostPurchaseInvoiceListener
{
    protected $journalService;

    public function __construct(JournalService $journalService)
    {
        $this->journalService = $journalService;
    }

    public function handle(PostPurchaseInvoice $event)
    {
        if (!Module_is_active('Account')) {
            return;
        }

        $invoice = $event->purchaseInvoice;
        $invoice->loadMissing('vendor');

        // ── Three-way-match pathway: invoice was raised against an LPO ────────
        // When an LPO is linked we debit the vote/expense account from the LPO
        // rather than the generic Inventory account, so expenditure hits the
        // correct budget vote line.
        if ($invoice->lpo_id) {
            $lpo = \Workdo\Quotation\Models\LocalPurchaseOrder::find($invoice->lpo_id);

            if ($lpo && $lpo->vote_account_id) {
                // GL: DR Expense/Vote account, CR Accounts Payable
                $this->journalService->createSupplierInvoiceExpenseJournal(
                    $invoice,
                    $lpo->vote_account_id
                );

                // Relieve the budget commitment that was raised when the LPO was issued.
                // Commitments are stored with source_type='lpo' and source_id=lpo.id —
                // use those same keys so the reversal actually finds the records.
                if (Module_is_active('BudgetPlanner')) {
                    try {
                        $commitmentService = app(\Workdo\BudgetPlanner\Services\CommitmentService::class);
                        $commitmentService->onInvoicePosted('lpo', $lpo->id);
                    } catch (\Throwable $th) {
                        // Log but do not block posting — the GL entry is already created
                        \Illuminate\Support\Facades\Log::warning(
                            'CommitmentService::onInvoicePosted failed for invoice ' .
                            $invoice->invoice_number . ': ' . $th->getMessage()
                        );
                    }
                }

                return;
            }
        }

        // ── Standard pathway: no LPO, use original inventory journal ─────────
        $this->journalService->createPurchaseInventoryJournal($invoice);
    }
}
