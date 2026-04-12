import { useState } from 'react';
import { Head, usePage, router } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import AuthenticatedLayout from "@/layouts/authenticated-layout";
import { Button } from '@/components/ui/button';
import { Card, CardContent } from "@/components/ui/card";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import SystemSetupSidebar from "../SystemSetupSidebar";

export default function Index() {
    const { t } = useTranslation();
    const { auth, geofenceRestrictEnabled, companyLatitude, companyLongitude, companyRadius } = usePage<any>().props;

    const [formData, setFormData] = useState({
        geofence_restrict: geofenceRestrictEnabled === 'on',
        company_latitude: companyLatitude || '',
        company_longitude: companyLongitude || '',
        company_radius: companyRadius || '100',
    });

    const [saving, setSaving] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        router.post(route('hrm.attendance-settings.store'), {
            geofence_restrict: formData.geofence_restrict ? 'on' : 'off',
            company_latitude: formData.company_latitude,
            company_longitude: formData.company_longitude,
            company_radius: formData.company_radius,
        }, {
            preserveScroll: true,
            onFinish: () => setSaving(false)
        });
    };

    return (
        <TooltipProvider>
            <AuthenticatedLayout
                breadcrumbs={[
                    { label: t('Hrm') },
                    { label: t('System Setup') },
                    { label: t('Attendance Settings') }
                ]}
                pageTitle={t('System Setup')}
            >
                <Head title={t('Attendance Settings')} />

                <div className="flex flex-col md:flex-row gap-8">
                    <div className="md:w-64 flex-shrink-0">
                        <SystemSetupSidebar activeItem="attendance-settings" />
                    </div>

                    <div className="flex-1">
                        <Card className="shadow-sm">
                            <CardContent className="p-6">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-lg font-medium">{t('Attendance Settings')}</h3>
                                </div>

                                <form onSubmit={handleSubmit} className="space-y-6 max-w-xl">
                                    <div className="flex items-center space-x-2 pb-4 border-b">
                                        <Switch
                                            id="geofence-restrict-toggle"
                                            checked={formData.geofence_restrict}
                                            onCheckedChange={(checked) => setFormData({ ...formData, geofence_restrict: checked })}
                                        />
                                        <Label htmlFor="geofence-restrict-toggle" className="text-base font-medium">
                                            {t('Enable Geofencing Restriction')}
                                        </Label>
                                    </div>

                                    {formData.geofence_restrict && (
                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="company_latitude">{t('Company Latitude')}</Label>
                                                <Input
                                                    id="company_latitude"
                                                    type="number"
                                                    step="any"
                                                    value={formData.company_latitude}
                                                    onChange={(e) => setFormData({ ...formData, company_latitude: e.target.value })}
                                                    placeholder="e.g. 5.6037"
                                                    required
                                                />
                                            </div>

                                            <div className="space-y-2">
                                                <Label htmlFor="company_longitude">{t('Company Longitude')}</Label>
                                                <Input
                                                    id="company_longitude"
                                                    type="number"
                                                    step="any"
                                                    value={formData.company_longitude}
                                                    onChange={(e) => setFormData({ ...formData, company_longitude: e.target.value })}
                                                    placeholder="e.g. -0.1870"
                                                    required
                                                />
                                            </div>

                                            <div className="space-y-2">
                                                <Label htmlFor="company_radius">{t('Allowed Radius (meters)')}</Label>
                                                <Input
                                                    id="company_radius"
                                                    type="number"
                                                    value={formData.company_radius}
                                                    onChange={(e) => setFormData({ ...formData, company_radius: e.target.value })}
                                                    min="1"
                                                    placeholder="e.g. 100"
                                                    required
                                                />
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex justify-end pt-4">
                                        <Button
                                            type="submit"
                                            disabled={saving || !auth.user?.permissions?.includes('manage-attendances')}
                                        >
                                            {saving ? t('Saving...') : t('Save Settings')}
                                        </Button>
                                    </div>
                                </form>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </AuthenticatedLayout>
        </TooltipProvider>
    );
}
