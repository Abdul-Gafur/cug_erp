import { DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useForm, router } from "@inertiajs/react";
import { useTranslation } from 'react-i18next';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import InputError from "@/components/ui/input-error";
import { PhoneInputComponent } from "@/components/ui/phone-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreateVendorProps, CreateVendorFormData, SUPPLIER_CATEGORIES } from './types';

export default function Create({ onSuccess, users = [], auth }: CreateVendorProps) {
    const { t } = useTranslation();
    const { data, setData, post, processing, errors } = useForm<CreateVendorFormData>({
        user_id: '0',
        company_name: '',
        registration_number: '',
        tin_number: '',
        supplier_category: '',
        contact_person_name: '',
        contact_person_email: '',
        contact_person_mobile: '',
        tax_number: '',
        payment_terms: '',
        bank_name: '',
        bank_branch: '',
        bank_account_number: '',
        bank_account_name: '',
        performance_rating: '',
        billing_address: {
            name: '',
            address_line_1: '',
            address_line_2: '',
            city: '',
            state: '',
            country: '',
            zip_code: ''
        },
        shipping_address: {
            name: '',
            address_line_1: '',
            address_line_2: '',
            city: '',
            state: '',
            country: '',
            zip_code: ''
        },
        same_as_billing: false,
        is_blacklisted: false,
        blacklist_reason: '',
        notes: '',
    });

    const handleUserSelect = (userId: string) => {
        const actualUserId = userId === '0' ? '' : userId;
        setData('user_id', actualUserId);
        if (userId !== '0') {
            const selectedUser = users.find(user => user.id.toString() === userId);
            if (selectedUser) {
                setData({
                    ...data,
                    user_id: actualUserId,
                    contact_person_name: selectedUser.name,
                    contact_person_email: selectedUser.email,
                    contact_person_mobile: selectedUser.mobile_no || '',
                });
            }
        }
    };

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        post(route('account.vendors.store'), {
            onSuccess: () => {
                onSuccess();
            }
        });
    };

    return (
        <DialogContent className="max-w-2xl">
            <DialogHeader>
                <DialogTitle>{t('Register Supplier')}</DialogTitle>
            </DialogHeader>
            <form onSubmit={submit} className="space-y-4">
                <div>
                    <Label htmlFor="user_id">{t('User')}</Label>
                    <Select value={data.user_id} onValueChange={handleUserSelect}>
                        <SelectTrigger>
                            <SelectValue placeholder={t('Select a user (optional)')} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="0">{t('No User Selected')}</SelectItem>
                            {users.map((user) => (
                                <SelectItem key={user.id} value={user.id.toString()}>
                                    {user.name} ({user.email})
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <InputError message={errors.user_id} />
                    {users.length === 0 && auth?.user?.permissions?.includes('create-users') && (
                        <p className="text-xs text-gray-500 mt-1">
                            {t('Create user here.')} <button onClick={() => router.get(route('users.index'))} className="text-blue-600 hover:underline">{t('Create user')}</button>
                        </p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                        {t('Note: Only users with vendor role who are not already assigned to other vendors will appear in this list.')}
                    </p>
                </div>
                <div>
                    <Label htmlFor="company_name">{t('Company / Supplier Name')}</Label>
                    <Input
                        id="company_name"
                        value={data.company_name}
                        onChange={(e) => setData('company_name', e.target.value)}
                        placeholder={t('Enter supplier name')}
                        required
                    />
                    <InputError message={errors.company_name} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <Label htmlFor="registration_number">{t('Registration Number')}</Label>
                        <Input
                            id="registration_number"
                            value={data.registration_number}
                            onChange={(e) => setData('registration_number', e.target.value)}
                            placeholder={t('Company registration no.')}
                        />
                        <InputError message={errors.registration_number} />
                    </div>
                    <div>
                        <Label htmlFor="tin_number">{t('TIN (Ghana Revenue Authority)')}</Label>
                        <Input
                            id="tin_number"
                            value={data.tin_number}
                            onChange={(e) => setData('tin_number', e.target.value)}
                            placeholder={t('GRA Tax Identification Number')}
                        />
                        <InputError message={errors.tin_number} />
                    </div>
                </div>
                <div>
                    <Label htmlFor="supplier_category">{t('Supplier Category')}</Label>
                    <Select value={data.supplier_category} onValueChange={(v) => setData('supplier_category', v)}>
                        <SelectTrigger>
                            <SelectValue placeholder={t('Select category…')} />
                        </SelectTrigger>
                        <SelectContent>
                            {Object.entries(SUPPLIER_CATEGORIES).map(([k, v]) => (
                                <SelectItem key={k} value={k}>{t(v)}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <InputError message={errors.supplier_category} />
                </div>
                <div>
                    <Label htmlFor="contact_person_name">{t('Contact Person')}</Label>
                    <Input
                        id="contact_person_name"
                        value={data.contact_person_name}
                        onChange={(e) => setData('contact_person_name', e.target.value)}
                        placeholder={t('Enter contact person name')}
                        required
                    />
                    <InputError message={errors.contact_person_name} />
                </div>
                <div>
                    <Label htmlFor="contact_person_email">{t('Email')}</Label>
                    <Input
                        id="contact_person_email"
                        type="email"
                        value={data.contact_person_email}
                        onChange={(e) => setData('contact_person_email', e.target.value)}
                        placeholder={t('Enter email address')}
                        required
                    />
                    <InputError message={errors.contact_person_email} />
                </div>
                <div>
                    <PhoneInputComponent
                        label={t('Mobile Number')}
                        value={data.contact_person_mobile}
                        onChange={(value) => setData('contact_person_mobile', value)}
                        placeholder="+1234567890"
                        error={errors.contact_person_mobile}
                    />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <Label htmlFor="tax_number">{t('Tax Number')}</Label>
                        <Input
                            id="tax_number"
                            value={data.tax_number}
                            onChange={(e) => setData('tax_number', e.target.value)}
                            placeholder={t('Enter tax number')}
                        />
                        <InputError message={errors.tax_number} />
                    </div>
                    <div>
                        <Label htmlFor="payment_terms">{t('Payment Terms')}</Label>
                        <Input
                            id="payment_terms"
                            value={data.payment_terms}
                            onChange={(e) => setData('payment_terms', e.target.value)}
                            placeholder={t('e.g., Net 30')}
                        />
                        <InputError message={errors.payment_terms} />
                    </div>
                </div>
                <div>
                    <Label htmlFor="billing_name">{t('Billing Name')}</Label>
                    <Input
                        id="billing_name"
                        value={data.billing_address.name}
                        onChange={(e) => setData('billing_address', {...data.billing_address, name: e.target.value})}
                        placeholder={t('Enter billing name')}
                        required
                    />
                    <InputError message={errors['billing_address.name']} />
                </div>
                <div>
                    <Label htmlFor="billing_address">{t('Billing Address')}</Label>
                    <Input
                        id="billing_address"
                        value={data.billing_address.address_line_1}
                        onChange={(e) => setData('billing_address', {...data.billing_address, address_line_1: e.target.value})}
                        placeholder={t('Enter address')}
                        required
                    />
                    <InputError message={errors['billing_address.address_line_1']} />
                </div>
                <div>
                    <Label htmlFor="billing_address_2">{t('Address Line 2')}</Label>
                    <Input
                        id="billing_address_2"
                        value={data.billing_address.address_line_2}
                        onChange={(e) => setData('billing_address', {...data.billing_address, address_line_2: e.target.value})}
                        placeholder={t('Apartment, suite, etc. (optional)')}
                    />
                    <InputError message={errors['billing_address.address_line_2']} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <Label htmlFor="billing_city">{t('City')}</Label>
                        <Input
                            id="billing_city"
                            value={data.billing_address.city}
                            onChange={(e) => setData('billing_address', {...data.billing_address, city: e.target.value})}
                            placeholder={t('Enter city')}
                            required
                        />
                        <InputError message={errors['billing_address.city']} />
                    </div>
                    <div>
                        <Label htmlFor="billing_state">{t('State')}</Label>
                        <Input
                            id="billing_state"
                            value={data.billing_address.state}
                            onChange={(e) => setData('billing_address', {...data.billing_address, state: e.target.value})}
                            placeholder={t('Enter state')}
                            required
                        />
                        <InputError message={errors['billing_address.state']} />
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <Label htmlFor="billing_country">{t('Country')}</Label>
                        <Input
                            id="billing_country"
                            value={data.billing_address.country}
                            onChange={(e) => setData('billing_address', {...data.billing_address, country: e.target.value})}
                            placeholder={t('Enter country')}
                            required
                        />
                        <InputError message={errors['billing_address.country']} />
                    </div>
                    <div>
                        <Label htmlFor="billing_zip">{t('Zip Code')}</Label>
                        <Input
                            id="billing_zip"
                            value={data.billing_address.zip_code}
                            onChange={(e) => setData('billing_address', {...data.billing_address, zip_code: e.target.value})}
                            placeholder={t('Enter zip code')}
                            required
                        />
                        <InputError message={errors['billing_address.zip_code']} />
                    </div>
                </div>
                <div className="flex items-center space-x-2">
                    <Checkbox
                        id="same_as_billing"
                        checked={data.same_as_billing}
                        onCheckedChange={(checked) => {
                            setData('same_as_billing', !!checked);
                            if (checked) {
                                setData('shipping_address', {...data.billing_address});
                            }
                        }}
                    />
                    <Label htmlFor="same_as_billing">{t('Shipping address same as billing')}</Label>
                </div>

                {!data.same_as_billing && (
                    <div className="space-y-4 border-t pt-4">
                        <h3 className="text-lg font-medium">{t('Shipping Address')}</h3>
                        <div>
                            <Label htmlFor="shipping_name">{t('Shipping Name')}</Label>
                            <Input
                                id="shipping_name"
                                value={data.shipping_address.name}
                                onChange={(e) => setData('shipping_address', {...data.shipping_address, name: e.target.value})}
                                placeholder={t('Enter shipping name')}
                                required
                            />
                            <InputError message={errors['shipping_address.name']} />
                        </div>
                        <div>
                            <Label htmlFor="shipping_address">{t('Shipping Address')}</Label>
                            <Input
                                id="shipping_address"
                                value={data.shipping_address.address_line_1}
                                onChange={(e) => setData('shipping_address', {...data.shipping_address, address_line_1: e.target.value})}
                                placeholder={t('Enter shipping address')}
                                required
                            />
                            <InputError message={errors['shipping_address.address_line_1']} />
                        </div>
                        <div>
                            <Label htmlFor="shipping_address_2">{t('Address Line 2')}</Label>
                            <Input
                                id="shipping_address_2"
                                value={data.shipping_address.address_line_2}
                                onChange={(e) => setData('shipping_address', {...data.shipping_address, address_line_2: e.target.value})}
                                placeholder={t('Apartment, suite, etc. (optional)')}
                            />
                            <InputError message={errors['shipping_address.address_line_2']} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="shipping_city">{t('City')}</Label>
                                <Input
                                    id="shipping_city"
                                    value={data.shipping_address.city}
                                    onChange={(e) => setData('shipping_address', {...data.shipping_address, city: e.target.value})}
                                    placeholder={t('Enter city')}
                                    required
                                />
                                <InputError message={errors['shipping_address.city']} />
                            </div>
                            <div>
                                <Label htmlFor="shipping_state">{t('State')}</Label>
                                <Input
                                    id="shipping_state"
                                    value={data.shipping_address.state}
                                    onChange={(e) => setData('shipping_address', {...data.shipping_address, state: e.target.value})}
                                    placeholder={t('Enter state')}
                                    required
                                />
                                <InputError message={errors['shipping_address.state']} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="shipping_country">{t('Country')}</Label>
                                <Input
                                    id="shipping_country"
                                    value={data.shipping_address.country}
                                    onChange={(e) => setData('shipping_address', {...data.shipping_address, country: e.target.value})}
                                    placeholder={t('Enter country')}
                                    required
                                />
                                <InputError message={errors['shipping_address.country']} />
                            </div>
                            <div>
                                <Label htmlFor="shipping_zip">{t('Zip Code')}</Label>
                                <Input
                                    id="shipping_zip"
                                    value={data.shipping_address.zip_code}
                                    onChange={(e) => setData('shipping_address', {...data.shipping_address, zip_code: e.target.value})}
                                    placeholder={t('Enter zip code')}
                                    required
                                />
                                <InputError message={errors['shipping_address.zip_code']} />
                            </div>
                        </div>
                    </div>
                )}
                {/* Bank details for payment processing */}
                <div className="border-t pt-4 space-y-3">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{t('Bank Details (for payment)')}</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="bank_name">{t('Bank Name')}</Label>
                            <Input
                                id="bank_name"
                                value={data.bank_name}
                                onChange={(e) => setData('bank_name', e.target.value)}
                                placeholder={t('e.g. GCB Bank')}
                            />
                        </div>
                        <div>
                            <Label htmlFor="bank_branch">{t('Branch')}</Label>
                            <Input
                                id="bank_branch"
                                value={data.bank_branch}
                                onChange={(e) => setData('bank_branch', e.target.value)}
                                placeholder={t('Branch name')}
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="bank_account_number">{t('Account Number')}</Label>
                            <Input
                                id="bank_account_number"
                                value={data.bank_account_number}
                                onChange={(e) => setData('bank_account_number', e.target.value)}
                                placeholder={t('Bank account number')}
                            />
                        </div>
                        <div>
                            <Label htmlFor="bank_account_name">{t('Account Name')}</Label>
                            <Input
                                id="bank_account_name"
                                value={data.bank_account_name}
                                onChange={(e) => setData('bank_account_name', e.target.value)}
                                placeholder={t('Name on bank account')}
                            />
                        </div>
                    </div>
                </div>

                <div>
                    <Label htmlFor="performance_rating">{t('Performance Rating (1–5)')}</Label>
                    <Select value={data.performance_rating || 'unrated'} onValueChange={(v) => setData('performance_rating', v === 'unrated' ? '' : v)}>
                        <SelectTrigger>
                            <SelectValue placeholder={t('Not yet rated')} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="unrated">{t('Not yet rated')}</SelectItem>
                            {[1, 2, 3, 4, 5].map(r => (
                                <SelectItem key={r} value={String(r)}>
                                    {r} — {['', t('Poor'), t('Below Average'), t('Average'), t('Good'), t('Excellent')][r]}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div>
                    <Label htmlFor="notes">{t('Notes')}</Label>
                    <Textarea
                        id="notes"
                        value={data.notes}
                        onChange={(e) => setData('notes', e.target.value)}
                        placeholder={t('Enter notes')}
                        rows={3}
                    />
                    <InputError message={errors.notes} />
                </div>

                <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={onSuccess}>
                        {t('Cancel')}
                    </Button>
                    <Button type="submit" disabled={processing}>
                        {processing ? t('Creating...') : t('Create')}
                    </Button>
                </div>
            </form>
        </DialogContent>
    );
}