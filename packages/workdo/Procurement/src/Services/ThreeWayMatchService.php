<?php

namespace Workdo\Procurement\Services;

use Illuminate\Support\Facades\Auth;
use App\Models\PurchaseInvoice;
use Workdo\Quotation\Models\LocalPurchaseOrder;
use Workdo\Procurement\Models\GoodsReceivedNote;
use Workdo\Procurement\Models\ThreeWayMatchLog;

/**
 * ThreeWayMatchService
 *
 * Compares LPO (agreed qty and price) vs GRN (received qty) vs Invoice
 * (billed qty and price) for each line item before an invoice may be posted.
 *
 * Tolerance: price variance within 0.01% is acceptable (floating-point rounding).
 *
 * Returns an array:
 *   [
 *     'status'       => 'pass' | 'fail',
 *     'discrepancies' => [],       // empty on pass
 *     'grn_id'       => int|null,  // latest posted GRN used
 *   ]
 */
class ThreeWayMatchService
{
    private const PRICE_TOLERANCE = 0.0001; // 0.01 %

    /**
     * Run the three-way match and write an audit log entry.
     *
     * @param  PurchaseInvoice $invoice  Must have lpo_id populated
     * @return array{status: string, discrepancies: array, grn_id: int|null}
     */
    public function performMatch(PurchaseInvoice $invoice): array
    {
        $lpo = LocalPurchaseOrder::with('items')->find($invoice->lpo_id);

        if (!$lpo) {
            // No LPO linked — cannot three-way match; caller must handle
            return ['status' => 'no_lpo', 'discrepancies' => [], 'grn_id' => null];
        }

        // Load invoice items
        $invoice->loadMissing('items');

        // Get all posted GRNs for this LPO
        $grns = GoodsReceivedNote::with('items')
            ->where('lpo_id', $lpo->id)
            ->where('status', 'posted')
            ->where('created_by', creatorId())
            ->get();

        $latestGrnId = $grns->sortByDesc('posted_at')->first()?->id;

        if ($grns->isEmpty()) {
            $discrepancy = [[
                'type'    => 'no_grn',
                'message' => 'No posted Goods Received Note exists for LPO ' . $lpo->lpo_number,
            ]];

            $this->writeLog($invoice, $lpo->id, null, 'fail', $discrepancy);
            return ['status' => 'fail', 'discrepancies' => $discrepancy, 'grn_id' => null];
        }

        // Separate pending inspections for discrepancy report
        $pendingInspections = $grns->filter(fn($g) => $g->inspection_status === 'pending');
        $rejectedInspections = $grns->filter(fn($g) => $g->inspection_status === 'rejected');
        $acceptedGrns = $grns->filter(fn($g) => $g->inspection_status === 'accepted');

        if ($acceptedGrns->isEmpty() && (!$pendingInspections->isEmpty() || !$rejectedInspections->isEmpty())) {
             $discrepancy = [[
                'type'    => 'inspection_required',
                'message' => 'Goods Received Notes exist but require User Department inspection acceptance before payment processing.',
            ]];

            $this->writeLog($invoice, $lpo->id, $latestGrnId, 'fail', $discrepancy);
            return ['status' => 'fail', 'discrepancies' => $discrepancy, 'grn_id' => $latestGrnId];
        }

        // Build a map of lpo_item_id → total accepted qty across all ACCEPTED GRNs
        $grnReceivedMap = [];
        foreach ($acceptedGrns as $grn) {
            foreach ($grn->items as $gItem) {
                $lpoItemId = $gItem->lpo_item_id;
                $accepted  = max(0, (float)$gItem->received_qty - (float)$gItem->rejected_qty);
                $grnReceivedMap[$lpoItemId] = ($grnReceivedMap[$lpoItemId] ?? 0) + $accepted;
            }
        }

        // Index invoice items by product_id for comparison
        $invoiceItemsByProduct = [];
        foreach ($invoice->items as $iItem) {
            $invoiceItemsByProduct[$iItem->product_id][] = $iItem;
        }

        $discrepancies = [];

        foreach ($lpo->items as $lpoItem) {
            $lpoItemId  = $lpoItem->id;
            $productId  = $lpoItem->product_id;
            $lpoQty     = (float) $lpoItem->quantity;
            $lpoPrice   = (float) $lpoItem->unit_price;
            $grnQty     = $grnReceivedMap[$lpoItemId] ?? 0.0;

            // Sum billed quantities and prices from invoice for this product
            $invoiceQty   = 0.0;
            $invoicePrice = 0.0;
            if ($productId && isset($invoiceItemsByProduct[$productId])) {
                foreach ($invoiceItemsByProduct[$productId] as $ii) {
                    $invoiceQty   += (float) $ii->quantity;
                    $invoicePrice  = (float) $ii->unit_price; // last one wins (same product)
                }
            }

            $desc = $lpoItem->description;

            // Check 1: Invoice qty must not exceed GRN accepted qty
            if ($invoiceQty > $grnQty + 0.001) {
                $discrepancies[] = [
                    'type'        => 'qty_exceeds_grn',
                    'item'        => $desc,
                    'lpo_qty'     => $lpoQty,
                    'grn_qty'     => $grnQty,
                    'invoice_qty' => $invoiceQty,
                    'message'     => "Invoice bills {$invoiceQty} but only {$grnQty} was received and accepted.",
                ];
            }

            // Check 2: Invoice qty must not exceed LPO qty
            if ($invoiceQty > $lpoQty + 0.001) {
                $discrepancies[] = [
                    'type'        => 'qty_exceeds_lpo',
                    'item'        => $desc,
                    'lpo_qty'     => $lpoQty,
                    'invoice_qty' => $invoiceQty,
                    'message'     => "Invoice bills {$invoiceQty} but LPO ordered only {$lpoQty}.",
                ];
            }

            // Check 3: Unit price must match LPO price within tolerance
            if ($invoiceQty > 0 && $lpoPrice > 0) {
                $priceVariance = abs($invoicePrice - $lpoPrice) / $lpoPrice;
                if ($priceVariance > self::PRICE_TOLERANCE) {
                    $discrepancies[] = [
                        'type'          => 'price_mismatch',
                        'item'          => $desc,
                        'lpo_price'     => $lpoPrice,
                        'invoice_price' => $invoicePrice,
                        'variance_pct'  => round($priceVariance * 100, 4),
                        'message'       => "Invoice unit price {$invoicePrice} differs from LPO price {$lpoPrice}.",
                    ];
                }
            }
        }

        $status = empty($discrepancies) ? 'pass' : 'fail';

        $this->writeLog($invoice, $lpo->id, $latestGrnId, $status, $discrepancies);

        return [
            'status'        => $status,
            'discrepancies' => $discrepancies,
            'grn_id'        => $latestGrnId,
        ];
    }

    /**
     * Record an override decision made by a Finance Officer.
     * Returns the updated match log.
     */
    public function recordOverride(
        PurchaseInvoice $invoice,
        string $reason
    ): ThreeWayMatchLog {
        // Find the most recent fail log for this invoice
        $log = ThreeWayMatchLog::where('invoice_id', $invoice->id)
            ->where('match_status', 'fail')
            ->where('created_by', creatorId())
            ->latest()
            ->firstOrFail();

        $log->update([
            'match_status'  => 'override',
            'override_reason' => $reason,
            'override_by'   => Auth::id(),
            'override_at'   => now(),
        ]);

        return $log;
    }

    private function writeLog(
        PurchaseInvoice $invoice,
        ?int $lpoId,
        ?int $grnId,
        string $status,
        array $discrepancies
    ): ThreeWayMatchLog {
        return ThreeWayMatchLog::create([
            'invoice_id'    => $invoice->id,
            'lpo_id'        => $lpoId,
            'grn_id'        => $grnId,
            'match_status'  => $status,
            'discrepancies' => $discrepancies,
            'performed_by'  => Auth::id(),
            'creator_id'    => Auth::id(),
            'created_by'    => creatorId(),
        ]);
    }
}
