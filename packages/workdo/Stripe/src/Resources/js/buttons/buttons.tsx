import { RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useTranslation } from 'react-i18next';
import { usePage } from '@inertiajs/react';
import { getAdminSetting, getCompanySetting, isPackageActive, getPackageFavicon } from '@/utils/helpers';

export const paymentMethodBtn = (data?: any) => {

    const { t } = useTranslation();
    const { auth } = usePage().props as any;

    const stripeEnabled = getAdminSetting('stripe_enabled');

    if (stripeEnabled === 'on') {
        return [{
            id: 'stripe-payment',
            dataUrl: route('payment.stripe.store'),
            onFormSubmit: data?.onFormSubmit,
            component: (
                <div className="flex items-center space-x-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg w-full">
                    <RadioGroupItem value="stripe" id="stripe" />
                    <Label htmlFor="stripe" className="cursor-pointer flex items-center space-x-2">
                        <div>
                            <div className="font-medium text-gray-900 dark:text-white">{t('Stripe')}</div>
                        </div>
                        <img src={getPackageFavicon('Stripe')} alt="Stripe" className="h-10 w-10" />
                    </Label>
                </div>
            )
        }];
    }
    else {
        return [];
    }
};

export const bookingPayment = (data?: any) => {

    const { t } = useTranslation();
    const { auth, userSlug } = usePage().props as any;

    const stripeEnabled = getCompanySetting('stripe_enabled');
    if (stripeEnabled === 'on') {
        return [{
            id: 'stripe-booking-payment',
            dataUrl: route('booking.payment.stripe.store', { userSlug: userSlug }),
            onFormSubmit: data?.onFormSubmit,
            component: (
                <div className="flex items-center space-x-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg w-full">
                    <Label htmlFor="stripe-booking" className="cursor-pointer flex items-center space-x-2">
                        <img src={getPackageFavicon('Stripe')} alt="Stripe" className="h-10 w-10" />
                        <div>
                            <div className="font-medium text-gray-900 dark:text-white">{t('Stripe')}</div>
                        </div>
                    </Label>
                    <RadioGroupItem value="stripe" id="stripe-booking" />
                </div>
            )
        }];
    }
    else {
        return [];
    }
};



export const beautySpaPayment = (data?: any) => {

    const { t } = useTranslation();
    const { auth, userSlug } = usePage().props as any;

    const stripeEnabled = getCompanySetting('stripe_enabled');
    if (stripeEnabled === 'on') {
        return [{
            id: 'stripe-beauty-spa-payment',
            dataUrl: route('beauty-spa.payment.stripe.store', { userSlug: userSlug }),
            onFormSubmit: data?.onFormSubmit,
            component: (
                <Label htmlFor="stripe-beauty-payment"
                    className="block border border-gray-200 rounded-lg p-4 hover:border-[#df9896] cursor-pointer transition-all duration-200">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full overflow-hidden bg-white border">
                                <img src={getPackageFavicon('Stripe')} alt="Stripe Logo" className="object-contain w-full h-full" />
                            </div>
                            <div>
                                <h5 className="text-base font-medium text-gray-800">{t('Stripe')}</h5>
                            </div>
                        </div>
                        <RadioGroupItem value="stripe" id="stripe-beauty-payment" />

                    </div>
                </Label>
            )
        }];
    }
    else {
        return [];
    }
};

export const lmsPayment = (data?: any) => {
    const { t } = useTranslation();
    const { auth, userSlug } = usePage().props as any;

    const stripeEnabled = getCompanySetting('stripe_enabled');
    if (stripeEnabled === 'on') {
        return [{
            id: 'stripe-lms-payment',
            dataUrl: route('lms.payment.stripe.store', { userSlug: userSlug }),
            onFormSubmit: data?.onFormSubmit,
            component: (
                <div className="flex items-center space-x-3 p-3 border-2 border-gray-200 rounded-lg w-full hover:border-blue-300 transition-colors cursor-pointer">
                    <RadioGroupItem value="stripe" id="stripe-lms" />
                    <Label htmlFor="stripe-lms" className="cursor-pointer flex items-center space-x-3 flex-1">
                        <img src={getPackageFavicon('Stripe')} alt="Stripe" className="h-8 w-8" />
                        <div>
                            <div className="font-medium text-gray-900">{t('Credit/Debit Card')}</div>
                            <div className="text-sm text-gray-500">{t('Pay securely with Stripe')}</div>
                        </div>
                    </Label>
                </div>
            )
        }];
    }
    else {
        return [];
    }
};

export const parkingPayment = (data?: any) => {
    const { t } = useTranslation();
    const { auth, userSlug } = usePage().props as any;

    const stripeEnabled = getCompanySetting('stripe_enabled');
    if (stripeEnabled === 'on') {
        return [{
            id: 'stripe-parking-payment',
            dataUrl: route('parking.payment.stripe.store', { userSlug: userSlug }),
            onFormSubmit: data?.onFormSubmit,
            component: (
                <div className="flex items-center space-x-3 p-3 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-teal-600 transition-colors">
                    <RadioGroupItem value="stripe" id="stripe-parking" />
                    <Label htmlFor="stripe-parking" className="cursor-pointer flex items-center space-x-3 flex-1">
                        <img src={getPackageFavicon('Stripe')} alt="Stripe" className="h-8 w-8" />
                        <div>
                            <div className="font-medium text-gray-900">{t('Stripe')}</div>
                        </div>
                    </Label>
                </div>
            )
        }];
    }
    else {
        return [];
    }
};

export const laundryPayment = (data?: any) => {
    const { t } = useTranslation();
    const { userSlug } = usePage().props as any;

    const stripeEnabled = getCompanySetting('stripe_enabled');
    if (stripeEnabled === 'on') {
        return [{
            id: 'stripe-laundry-payment',
            dataUrl: route('laundry.payment.stripe.store', { userSlug: userSlug }),
            component: (
                <Label htmlFor="stripe-laundry-payment"
                    className="block border border-gray-200 rounded-lg p-4 hover:border-primary cursor-pointer transition-all duration-200">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full overflow-hidden bg-white border">
                                <img src={getPackageFavicon('Stripe')} alt="Stripe Logo" className="object-contain w-full h-full" />
                            </div>
                            <div>
                                <h5 className="text-base font-medium text-gray-800">Stripe</h5>
                            </div>
                        </div>
                        <RadioGroupItem value="stripe" id="stripe-laundry-payment" />
                    </div>
                </Label>
            )
        }];
    }
    return [];
};

export const eventsPayment = (data?: any) => {
    const { t } = useTranslation();
    const { auth, userSlug } = usePage().props as any;

    const stripeEnabled = getCompanySetting('stripe_enabled');
    const isSelected = data?.selectedMethod === 'stripe';

    if (stripeEnabled === 'on') {
        return [{
            id: 'stripe-events-payment',
            dataUrl: route('events-management.payment.stripe.store', {userSlug: userSlug}),
            onFormSubmit: data?.onFormSubmit,
            component: (
                <label className="cursor-pointer">
                    <input
                        type="radio"
                        name="paymentMethod"
                        value="stripe"
                        className="hidden"
                        checked={isSelected}
                        onChange={() => data?.onMethodChange?.('stripe')}
                        required
                    />
                    <div className={`p-4 border-2 rounded-lg transition-all hover:border-red-200 flex items-center ${
                        isSelected ? 'border-red-500 bg-red-50' : 'border-gray-200'
                    }`}>
                        <div className={`w-4 h-4 rounded-full border-2 mr-3 flex-shrink-0 ${
                            isSelected ? 'border-red-500 bg-red-500' : 'border-gray-300'
                        }`}>
                            {isSelected && <div className="w-2 h-2 bg-white rounded-full m-auto mt-0.5"></div>}
                        </div>
                        <img src={getPackageFavicon('Stripe')} alt="Stripe" className="h-8 w-8  mr-3" />
                        <span className="font-semibold">{t('Stripe')}</span>
                    </div>
                </label>
            )
        }];
    }
    else {
        return [];
    }
};
