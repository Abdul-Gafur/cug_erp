<?php

namespace Workdo\Account\Listeners;

use Workdo\Procurement\Events\GrnPosted;
use Workdo\Account\Models\InvoiceSubmission;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Facades\Log;

class GrnPostedListener
{
    /**
     * Handle the event.
     * When a Goods Received Note is posted, we want to see if an Invoice Submission
     * was already initiated for this LPO, and if so, auto-link the GRN ID and number
     * to fulfill the 3-Way Match requirement.
     */
    public function handle(GrnPosted $event): void
    {
        try {
            $grn = $event->grn;

            if (!$grn->lpo_id) {
                return;
            }

            // Find any pending Invoice Submissions for this LPO that are missing
            // a formal GRN link, and attach it to speed up the 3-Way Match process.
            $submissions = InvoiceSubmission::where('lpo_id', $grn->lpo_id)
                ->whereNull('grn_id')
                ->get();

            foreach ($submissions as $submission) {
                $submission->update([
                    'grn_id' => $grn->id,
                    'grn_number' => $grn->grn_number,
                    'delivery_note_number' => $grn->delivery_note_number ?? $submission->delivery_note_number,
                ]);
            }
        } catch (\Exception $e) {
            Log::error('GrnPostedListener Error: ' . $e->getMessage());
        }
    }
}
