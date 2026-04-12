<?php

namespace Workdo\Quotation\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;
use Workdo\Quotation\Models\LocalPurchaseOrder;

class LpoMailable extends Mailable
{
    use Queueable, SerializesModels;

    public LocalPurchaseOrder $lpo;

    public function __construct(LocalPurchaseOrder $lpo)
    {
        $this->lpo = $lpo;
    }

    public function build(): static
    {
        $institutionName = company_setting('company_name', $this->lpo->created_by) ?? config('app.name');

        return $this
            ->from(
                company_setting('email_fromAddress', $this->lpo->created_by) ?? config('mail.from.address'),
                $institutionName
            )
            ->subject("Local Purchase Order #{$this->lpo->lpo_number} — {$institutionName}")
            ->view('quotation::emails.lpo')
            ->with([
                'lpo'             => $this->lpo,
                'institutionName' => $institutionName,
            ]);
    }
}
