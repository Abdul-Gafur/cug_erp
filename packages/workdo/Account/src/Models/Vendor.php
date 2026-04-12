<?php

namespace Workdo\Account\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use App\Models\User;

class Vendor extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'vendor_code',
        'company_name',
        'registration_number',
        'tin_number',
        'supplier_category',
        'contact_person_name',
        'contact_person_email',
        'contact_person_mobile',
        'primary_email',
        'primary_mobile',
        'tax_number',
        'payment_terms',
        'currency_code',
        'credit_limit',
        'bank_name',
        'bank_branch',
        'bank_account_number',
        'bank_account_name',
        'performance_rating',
        'billing_address',
        'shipping_address',
        'same_as_billing',
        'is_active',
        'is_blacklisted',
        'blacklist_reason',
        'blacklisted_at',
        'blacklisted_by',
        'notes',
        'creator_id',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'billing_address'   => 'array',
            'shipping_address'  => 'array',
            'same_as_billing'   => 'boolean',
            'is_active'         => 'boolean',
            'is_blacklisted'    => 'boolean',
            'credit_limit'      => 'decimal:2',
            'performance_rating'=> 'integer',
            'blacklisted_at'    => 'datetime',
        ];
    }

    /**
     * University procurement supplier categories.
     */
    public static function supplierCategories(): array
    {
        return [
            'academic_laboratory'     => 'Academic & Laboratory Supplies',
            'it_equipment_services'   => 'IT Equipment & Services',
            'construction_maintenance'=> 'Construction & Maintenance',
            'catering_hospitality'    => 'Catering & Hospitality',
            'professional_services'   => 'Professional Services',
            'general_supplies'        => 'General Supplies & Services',
            'books_publications'      => 'Books & Publications',
        ];
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($vendor) {
            if (empty($vendor->vendor_code)) {
                $vendor->vendor_code = self::generateVendorCode();
            }
        });
    }

    public static function generateVendorCode()
    {
        if (auth()->check()) {
            $lastVendor = static::where('vendor_code', 'like', 'VEN-%')
                ->where('created_by', creatorId())
                ->orderBy('vendor_code', 'desc')
                ->first();

            if ($lastVendor) {
                $lastNumber = (int) substr($lastVendor->vendor_code, 4);
                $nextNumber = $lastNumber + 1;
            } else {
                $nextNumber = 1;
            }
        } else {
            // For seeding or when no user is authenticated
            $lastVendor = static::orderBy('id', 'desc')->first();
            $nextNumber = $lastVendor ? (int) substr($lastVendor->vendor_code, 4) + 1 : 1;
        }

        return 'VEN-' . str_pad($nextNumber, 4, '0', STR_PAD_LEFT);
    }
}