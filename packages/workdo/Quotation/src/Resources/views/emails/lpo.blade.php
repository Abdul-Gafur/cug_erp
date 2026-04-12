<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Local Purchase Order #{{ $lpo->lpo_number }}</title>
    <style>
        body { font-family: Arial, sans-serif; color: #333; font-size: 14px; line-height: 1.6; }
        .header { background: #1a1a2e; color: #fff; padding: 20px 30px; }
        .header h1 { margin: 0; font-size: 20px; }
        .header p { margin: 4px 0 0; font-size: 13px; opacity: 0.85; }
        .body { padding: 30px; }
        .lpo-box { border: 2px solid #1a1a2e; padding: 12px 20px; margin-bottom: 24px; }
        .lpo-box h2 { margin: 0 0 4px; font-size: 18px; }
        .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px; font-size: 13px; }
        .meta-item label { font-weight: bold; display: block; color: #555; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 13px; }
        th { background: #1a1a2e; color: #fff; padding: 8px 10px; text-align: left; }
        td { padding: 7px 10px; border-bottom: 1px solid #e0e0e0; }
        tr:nth-child(even) td { background: #f7f7f7; }
        .total-row td { font-weight: bold; background: #f0f0f0; border-top: 2px solid #1a1a2e; }
        .footer { background: #f5f5f5; padding: 16px 30px; font-size: 12px; color: #777; border-top: 1px solid #ddd; }
        .notice { background: #fff8e1; border-left: 4px solid #f9a825; padding: 12px 16px; margin-bottom: 20px; font-size: 13px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>{{ $institutionName }}</h1>
        <p>Local Purchase Order</p>
    </div>

    <div class="body">
        <p>Dear <strong>{{ $lpo->supplier->name ?? 'Supplier' }}</strong>,</p>

        <p>
            Please find below the details of a Local Purchase Order issued to you by
            <strong>{{ $institutionName }}</strong>. Kindly acknowledge receipt and confirm
            your ability to fulfil this order within the specified timeframe.
        </p>

        <div class="lpo-box">
            <h2>LPO #{{ $lpo->lpo_number }}</h2>
            <p>Date: {{ \Carbon\Carbon::parse($lpo->lpo_date)->format('d F Y') }}</p>
        </div>

        <div class="notice">
            <strong>Important:</strong> This is an official procurement document.
            Please reference LPO #{{ $lpo->lpo_number }} on all correspondence, invoices, and delivery documentation.
        </div>

        <div class="meta-grid">
            <div class="meta-item">
                <label>Issuing Department</label>
                {{ $lpo->issuing_department }}
            </div>
            @if($lpo->delivery_location)
            <div class="meta-item">
                <label>Deliver To</label>
                {{ $lpo->delivery_location }}
            </div>
            @endif
            @if($lpo->delivery_date)
            <div class="meta-item">
                <label>Required By</label>
                {{ \Carbon\Carbon::parse($lpo->delivery_date)->format('d F Y') }}
            </div>
            @endif
            @if($lpo->payment_terms)
            <div class="meta-item">
                <label>Payment Terms</label>
                {{ $lpo->payment_terms }}
            </div>
            @endif
        </div>

        <h3 style="margin-bottom:8px;">Items Ordered</h3>
        <table>
            <thead>
                <tr>
                    <th>#</th>
                    <th>Description</th>
                    <th style="text-align:center;">Qty</th>
                    <th>Unit</th>
                    <th style="text-align:right;">Unit Price</th>
                    <th style="text-align:right;">Total</th>
                </tr>
            </thead>
            <tbody>
                @foreach($lpo->items as $i => $item)
                <tr>
                    <td>{{ $i + 1 }}</td>
                    <td>{{ $item->description }}</td>
                    <td style="text-align:center;">{{ $item->quantity }}</td>
                    <td>{{ $item->unit ?? '-' }}</td>
                    <td style="text-align:right;">{{ number_format($item->unit_price, 2) }}</td>
                    <td style="text-align:right;">{{ number_format($item->total_amount, 2) }}</td>
                </tr>
                @endforeach
                <tr class="total-row">
                    <td colspan="5" style="text-align:right;">TOTAL AMOUNT</td>
                    <td style="text-align:right;">{{ number_format($lpo->total_amount, 2) }}</td>
                </tr>
            </tbody>
        </table>

        @if($lpo->notes)
        <p><strong>Notes / Special Instructions:</strong><br>{{ $lpo->notes }}</p>
        @endif

        <p style="margin-top:24px;">
            Please confirm receipt of this order and your acceptance of the terms by
            replying to this email. A copy of the LPO document can be downloaded from
            the procurement portal.
        </p>

        <p>
            Regards,<br>
            <strong>Procurement Office</strong><br>
            {{ $institutionName }}
        </p>
    </div>

    <div class="footer">
        <p>
            This email and the attached LPO are confidential procurement documents of {{ $institutionName }}.
            If you have received this in error, please notify us immediately.
        </p>
    </div>
</body>
</html>
