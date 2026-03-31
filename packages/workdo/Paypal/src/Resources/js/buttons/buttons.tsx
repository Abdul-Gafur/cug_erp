import { RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useTranslation } from 'react-i18next';
import { usePage } from '@inertiajs/react';
import { getAdminSetting, getCompanySetting, isPackageActive, getPackageFavicon } from '@/utils/helpers';

export const paymentMethodBtn = (data?: any) => {

    const { t } = useTranslation();
    const { auth } = usePage().props as any;

    const paypalEnabled = getAdminSetting('paypal_enabled');

    if (paypalEnabled === 'on') {
        return [{
            id: 'paypal-payment',
            dataUrl: route('payment.paypal.store'),
            onFormSubmit: data?.onFormSubmit,
            component: (
                <div className="flex items-center space-x-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg w-full">
                    <RadioGroupItem value="paypal" id="paypal" />
                    <Label htmlFor="paypal" className="cursor-pointer flex items-center space-x-2">
                        <div>
                            <div className="font-medium text-gray-900 dark:text-white">{t('PayPal')}</div>
                        </div>
                        <img src={getPackageFavicon('Paypal')} alt="PayPal" className="h-10 w-10" />
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

    const paypalEnabled = getCompanySetting('paypal_enabled');
    if (paypalEnabled === 'on') {
        return [{
            id: 'paypal-booking-payment',
            dataUrl: route('booking.payment.paypal.store', { userSlug: userSlug }),
            onFormSubmit: data?.onFormSubmit,
            component: (
                <div className="flex items-center space-x-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg w-full">
                    <Label htmlFor="paypal-booking" className="cursor-pointer flex items-center space-x-2">
                        <img src={getPackageFavicon('Paypal')} alt="PayPal" className="h-10 w-10" />
                        <div>
                            <div className="font-medium text-gray-900 dark:text-white">{t('PayPal')}</div>
                        </div>
                    </Label>
                    <RadioGroupItem value="paypal" id="paypal-booking" />
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

    const paypalEnabled = getCompanySetting('paypal_enabled');
    if (paypalEnabled === 'on') {
        return [{
            id: 'paypal-beauty-spa-payment',
            dataUrl: route('beauty-spa.payment.paypal.store', { userSlug: userSlug }),
            onFormSubmit: data?.onFormSubmit,
            component: (
                <Label htmlFor="paypal-beauty-payment"
                    className="block border border-gray-200 rounded-lg p-4 hover:border-[#df9896] cursor-pointer transition-all duration-200">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full overflow-hidden bg-white border">
                                <img src={getPackageFavicon('Paypal')} alt="PayPal Logo" className="object-contain w-full h-full" />
                            </div>
                            <div>
                                <h5 className="text-base font-medium text-gray-800">{t('PayPal')}</h5>
                            </div>
                        </div>
                        <RadioGroupItem value="paypal" id="paypal-beauty-payment" />
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

    const paypalEnabled = getCompanySetting('paypal_enabled');
    if (paypalEnabled === 'on') {
        return [{
            id: 'paypal-lms-payment',
            dataUrl: route('lms.payment.paypal.store', { userSlug: userSlug }),
            onFormSubmit: data?.onFormSubmit,
            component: (
                <div className="flex items-center space-x-3 p-3 border-2 border-gray-200 rounded-lg w-full hover:border-blue-300 transition-colors cursor-pointer">
                    <RadioGroupItem value="paypal" id="paypal-lms" />
                    <Label htmlFor="paypal-lms" className="cursor-pointer flex items-center space-x-3 flex-1">
                        <img src={getPackageFavicon('Paypal')} alt="PayPal" className="h-8 w-8" />
                        <div>
                            <div className="font-medium text-gray-900">{t('PayPal')}</div>
                            <div className="text-sm text-gray-500">{t('Pay securely with PayPal')}</div>
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

    const paypalEnabled = getCompanySetting('paypal_enabled');
    if (paypalEnabled === 'on') {
        return [{
            id: 'paypal-parking-payment',
            dataUrl: route('parking.payment.paypal.store', { userSlug: userSlug }),
            onFormSubmit: data?.onFormSubmit,
            component: (
                <div className="flex items-center space-x-3 p-3 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-teal-600 transition-colors">
                    <RadioGroupItem value="paypal" id="paypal-parking" />
                    <Label htmlFor="paypal-parking" className="cursor-pointer flex items-center space-x-3 flex-1">
                        <img src={getPackageFavicon('Paypal')} alt="PayPal" className="h-8 w-8" />
                        <div>
                            <div className="font-medium text-gray-900">{t('PayPal')}</div>
                        </div>
                    </Label>
                </div>
            )
        }];
    }
    return [];
};

export const laundryPayment = (data?: any) => {
    const { t } = useTranslation();
    const { userSlug } = usePage().props as any;

    const paypalEnabled = getCompanySetting('paypal_enabled');
    if (paypalEnabled === 'on') {
        return [{
            id: 'paypal-laundry-payment',
            dataUrl: route('laundry.payment.paypal.store', { userSlug: userSlug }),
            component: (
                <Label htmlFor="paypal-laundry-payment"
                    className="block border border-gray-200 rounded-lg p-4 hover:border-primary cursor-pointer transition-all duration-200">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full overflow-hidden bg-white border">
                                <img src={getPackageFavicon('Paypal')} alt="PayPal Logo" className="object-contain w-full h-full" />
                            </div>
                            <div>
                                <h5 className="text-base font-medium text-gray-800">{t('PayPal')}</h5>
                            </div>
                        </div>
                        <RadioGroupItem value="paypal" id="paypal-laundry-payment" />
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

    const paypalEnabled = getCompanySetting('paypal_enabled');
    if (paypalEnabled === 'on') {
        return [{
            id: 'paypal-events-payment',
            dataUrl: route('events-management.payment.paypal.store', {userSlug: userSlug}),
            onFormSubmit: data?.onFormSubmit,
            component: (
                <label className="cursor-pointer">
                    <input
                        type="radio"
                        name="paymentMethod"
                        value="paypal"
                        className="hidden"
                        onChange={() => data?.onMethodChange?.('paypal')}
                    />
                    <div className={`p-4 border-2 rounded-lg transition-all hover:border-red-200 flex items-center ${data?.selectedMethod === 'paypal' ? 'border-red-500 bg-red-50' : 'border-gray-200'}`}>
                        <div className={`w-4 h-4 rounded-full border-2 mr-3 flex-shrink-0 ${data?.selectedMethod === 'paypal' ? 'border-red-500 bg-red-500' : 'border-gray-300'}`}>
                            {data?.selectedMethod === 'paypal' && <div className="w-2 h-2 bg-white rounded-full m-auto mt-0.5"></div>}
                        </div>
                        <img src={getPackageFavicon('Paypal')} alt="PayPal" className="h-8 w-8 mr-3" />
                        <span className="font-semibold">{t('PayPal')}</span>
                    </div>
                </label>
            )
        }];
    }
    else {
        return [];
    }
};
