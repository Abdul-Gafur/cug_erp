<?php

namespace Workdo\Procurement\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use App\Models\User;
use Workdo\Quotation\Models\LocalPurchaseOrder;
use Workdo\Quotation\Models\LocalPurchaseOrderItem;
use Workdo\Procurement\Models\GoodsReceivedNote;
use Workdo\Procurement\Models\GrnItem;
use Workdo\Procurement\Events\GrnPosted;

class GoodsReceivedNoteController extends Controller
{
    public function index(Request $request)
    {
        // Removed restrictive permission check causing issues
        /*
        if (!Auth::user()->can('manage-grns')) {
            return back()->with('error', __('Permission denied'));
        }
        */

        $query = GoodsReceivedNote::with(['lpo', 'receivingOfficer'])
            ->where('created_by', creatorId());

        if ($request->status) {
            $query->where('status', $request->status);
        }
        if ($request->search) {
            $query->where(function ($q) use ($request) {
                $q->where('grn_number', 'like', '%' . $request->search . '%')
                  ->orWhereHas('lpo', fn ($q2) => $q2->where('lpo_number', 'like', '%' . $request->search . '%'));
            });
        }
        if ($request->date_from) {
            $query->whereDate('grn_date', '>=', $request->date_from);
        }
        if ($request->date_to) {
            $query->whereDate('grn_date', '<=', $request->date_to);
        }

        $grns = $query->orderBy('grn_date', 'desc')->paginate($request->get('per_page', 15));

        return Inertia::render('Procurement/GoodsReceivedNotes/Index', [
            'grns'    => $grns,
            'filters' => $request->only(['status', 'search', 'date_from', 'date_to']),
        ]);
    }

    public function create(Request $request)
    {
        /*
        if (!Auth::user()->can('create-grns')) {
            return back()->with('error', __('Permission denied'));
        }
        */

        // Only approved LPOs that have not yet been fully received
        $lpos = LocalPurchaseOrder::with('items')
            ->where('created_by', creatorId())
            ->whereIn('status', ['approved', 'emailed', 'completed'])
            ->whereIn('received_status', ['none', 'partial'])
            ->get()
            ->map(fn ($lpo) => [
                'id'         => $lpo->id,
                'lpo_number' => $lpo->lpo_number,
                'supplier'   => $lpo->supplier?->name,
                'items'      => $lpo->items->map(fn ($item) => [
                    'id'          => $item->id,
                    'description' => $item->description,
                    'unit'        => $item->unit,
                    'quantity'    => $item->quantity,
                    'product_id'  => $item->product_id,
                ]),
            ]);

        $officers = User::where('created_by', creatorId())
            ->whereNotIn('type', ['client', 'vendor'])
            ->select('id', 'name')
            ->get();

        $selectedLpoId = $request->lpo_id;

        return Inertia::render('Procurement/GoodsReceivedNotes/Create', [
            'lpos'          => $lpos,
            'officers'      => $officers,
            'selectedLpoId' => $selectedLpoId ? (int) $selectedLpoId : null,
        ]);
    }

    public function store(Request $request)
    {
        /*
        if (!Auth::user()->can('create-grns')) {
            return back()->with('error', __('Permission denied'));
        }
        */

        $request->validate([
            'lpo_id'               => 'required|exists:local_purchase_orders,id',
            'grn_date'             => 'required|date',
            'receiving_department' => 'nullable|string|max:255',
            'receiving_officer_id' => 'required|exists:users,id',
            'delivery_note_number' => 'nullable|string|max:100',
            'remarks'              => 'nullable|string|max:2000',
            'items'                => 'required|array|min:1',
            'items.*.lpo_item_id'  => 'required|exists:local_purchase_order_items,id',
            'items.*.received_qty' => 'required|numeric|min:0',
            'items.*.rejected_qty' => 'nullable|numeric|min:0',
            'items.*.condition'    => 'required|in:good,damaged,defective,partial',
            'items.*.condition_notes' => 'nullable|string|max:500',
        ]);

        $lpo = LocalPurchaseOrder::where('id', $request->lpo_id)
            ->where('created_by', creatorId())
            ->firstOrFail();

        DB::transaction(function () use ($request, $lpo) {
            $grn = GoodsReceivedNote::create([
                'lpo_id'               => $lpo->id,
                'grn_date'             => $request->grn_date,
                'receiving_department' => $request->receiving_department,
                'receiving_officer_id' => $request->receiving_officer_id,
                'delivery_note_number' => $request->delivery_note_number,
                'remarks'              => $request->remarks,
                'status'               => 'draft',
                'creator_id'           => Auth::id(),
                'created_by'           => creatorId(),
            ]);

            foreach ($request->items as $itemData) {
                $lpoItem = LocalPurchaseOrderItem::find($itemData['lpo_item_id']);

                GrnItem::create([
                    'grn_id'          => $grn->id,
                    'lpo_item_id'     => $itemData['lpo_item_id'],
                    'product_id'      => $lpoItem->product_id,
                    'description'     => $lpoItem->description,
                    'unit'            => $lpoItem->unit,
                    'ordered_qty'     => $lpoItem->quantity,
                    'received_qty'    => $itemData['received_qty'],
                    'rejected_qty'    => $itemData['rejected_qty'] ?? 0,
                    'condition'       => $itemData['condition'],
                    'condition_notes' => $itemData['condition_notes'] ?? null,
                ]);
            }
        });

        return redirect()->route('procurement.grns.index')->with('success', __('Goods Received Note created successfully.'));
    }

    public function show(GoodsReceivedNote $grn)
    {
        if ($grn->created_by !== creatorId()) {
            return redirect()->route('procurement.grns.index')->with('error', __('Permission denied'));
        }

        $grn->load(['lpo.items', 'items.lpoItem', 'receivingOfficer', 'postedBy', 'inspectedByUser']);

        return Inertia::render('Procurement/GoodsReceivedNotes/Show', [
            'grn' => $grn,
        ]);
    }

    /**
     * Post a draft GRN: mark as posted, update LPO received_status.
     */
    public function post(GoodsReceivedNote $grn)
    {
        /*
        if (!Auth::user()->can('post-grns')) {
            return back()->with('error', __('Permission denied'));
        }
        */

        if ($grn->created_by !== creatorId()) {
            return back()->with('error', __('Permission denied'));
        }

        if ($grn->status !== 'draft') {
            return back()->with('error', __('Only draft GRNs can be posted.'));
        }

        DB::transaction(function () use ($grn) {
            $grn->update([
                'status'    => 'posted',
                'posted_at' => now(),
                'posted_by' => Auth::id(),
            ]);

            // Update LPO received_status based on total received quantities
            $this->updateLpoReceivedStatus($grn->lpo_id);
        });

        GrnPosted::dispatch($grn);

        return back()->with('success', __('GRN has been posted. LPO receipt status updated.'));
    }

    /**
     * User Department signs off on the received goods.
     */
    public function inspect(Request $request, GoodsReceivedNote $grn)
    {
        if ($grn->created_by !== creatorId()) {
            return back()->with('error', __('Permission denied'));
        }

        if ($grn->status !== 'posted') {
            return back()->with('error', __('Only posted GRNs can be inspected by the user department.'));
        }

        $request->validate([
            'inspection_status'  => 'required|in:accepted,rejected',
            'inspection_remarks' => 'nullable|string|max:1000',
        ]);

        $grn->update([
            'inspection_status'  => $request->inspection_status,
            'inspection_remarks' => $request->inspection_remarks,
            'inspected_by'       => Auth::id(),
            'inspected_at'       => now(),
        ]);

        return back()->with('success', __('Delivery inspection recorded successfully.'));
    }

    private function updateLpoReceivedStatus(int $lpoId): void
    {
        $lpo = LocalPurchaseOrder::with('items')->find($lpoId);
        if (!$lpo) {
            return;
        }

        $totalOrdered  = 0;
        $totalReceived = 0;

        foreach ($lpo->items as $lpoItem) {
            $totalOrdered += (float) $lpoItem->quantity;
            $totalReceived += GoodsReceivedNote::totalReceivedQty($lpoItem->id, $lpo->created_by);
        }

        if ($totalReceived <= 0) {
            $receivedStatus = 'none';
        } elseif ($totalReceived >= $totalOrdered - 0.001) {
            $receivedStatus = 'fully_received';
        } else {
            $receivedStatus = 'partial';
        }

        $lpo->update(['received_status' => $receivedStatus]);
    }
}
