import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { MapPin, Save } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { router } from '@inertiajs/react';

interface AttendanceSettingsProps {
  userSettings?: Record<string, string>;
  auth?: any;
}

export default function AttendanceSettings({ userSettings, auth }: AttendanceSettingsProps) {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const canManage = auth?.user?.permissions?.includes('manage-hrm');

  const [settings, setSettings] = useState({
    geofence_restrict: userSettings?.geofence_restrict === 'on',
    company_latitude: userSettings?.company_latitude || '',
    company_longitude: userSettings?.company_longitude || '',
    company_radius: userSettings?.company_radius || '100',
  });

  useEffect(() => {
    if (userSettings) {
      setSettings({
        geofence_restrict: userSettings?.geofence_restrict === 'on',
        company_latitude: userSettings?.company_latitude || '',
        company_longitude: userSettings?.company_longitude || '',
        company_radius: userSettings?.company_radius || '100',
      });
    }
  }, [userSettings]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSettings(prev => ({ ...prev, [name]: value }));
  };

  const handleSwitchChange = (checked: boolean) => {
    setSettings(prev => ({ ...prev, geofence_restrict: checked }));
  };

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert(t('Geolocation is not supported by your browser'));
      return;
    }

    setIsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setSettings(prev => ({
          ...prev,
          company_latitude: position.coords.latitude.toString(),
          company_longitude: position.coords.longitude.toString(),
        }));
        setIsLoading(false);
      },
      (error) => {
        setIsLoading(false);
        alert(t('Error getting location: ') + error.message);
      }
    );
  };

  const saveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    router.post(route('hrm.attendance-settings.store'), {
      geofence_restrict: settings.geofence_restrict ? 'on' : 'off',
      company_latitude: settings.company_latitude,
      company_longitude: settings.company_longitude,
      company_radius: settings.company_radius,
    }, {
      preserveScroll: true,
      onSuccess: () => {
        setIsLoading(false);
        router.reload({ only: ['globalSettings'] });
      },
      onError: () => {
        setIsLoading(false);
      }
    });
  };

  return (
    <Card id="attendance-settings">
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="order-1 rtl:order-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <MapPin className="h-5 w-5" />
            {t('Attendance Settings')}
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {t('Configure geofencing and other attendance related restrictions')}
          </p>
        </div>
        {canManage && (
          <Button className="order-2 rtl:order-1" onClick={saveSettings} disabled={isLoading} size="sm">
            <Save className="h-4 w-4 mr-2" />
            {isLoading ? t('Saving...') : t('Save Changes')}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="flex items-center justify-between space-x-2 pb-4 border-b">
            <div className="space-y-0.5">
              <Label htmlFor="geofence-restrict-toggle" className="text-base font-medium">
                {t('Enable Geofencing Restriction')}
              </Label>
              <p className="text-sm text-muted-foreground">
                {t('Employees will only be able to clock in/out within the specified radius of the office.')}
              </p>
            </div>
            <Switch
              id="geofence-restrict-toggle"
              checked={settings.geofence_restrict}
              onCheckedChange={handleSwitchChange}
              disabled={!canManage}
            />
          </div>

          {settings.geofence_restrict && (
            <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex flex-col md:flex-row gap-4 items-end bg-muted/50 p-4 rounded-lg border border-dashed">
                <div className="flex-1 space-y-2">
                   <Label className="text-sm font-semibold">{t('Auto-detect Coordinates')}</Label>
                   <p className="text-xs text-muted-foreground">
                     {t('If you are currently at the office, you can automatically capture the coordinates.')}
                   </p>
                </div>
                <Button variant="secondary" type="button" onClick={getCurrentLocation} className="shrink-0">
                  <MapPin className="h-4 w-4 mr-2" />
                  {t('Get My Current Location')}
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-3">
                  <Label htmlFor="company_latitude">{t('Company Latitude')}</Label>
                  <Input
                    id="company_latitude"
                    name="company_latitude"
                    type="number"
                    step="any"
                    value={settings.company_latitude}
                    onChange={handleInputChange}
                    placeholder="e.g. 5.6037"
                    disabled={!canManage}
                  />
                </div>

                <div className="space-y-3">
                  <Label htmlFor="company_longitude">{t('Company Longitude')}</Label>
                  <Input
                    id="company_longitude"
                    name="company_longitude"
                    type="number"
                    step="any"
                    value={settings.company_longitude}
                    onChange={handleInputChange}
                    placeholder="e.g. -0.1870"
                    disabled={!canManage}
                  />
                </div>

                <div className="space-y-3">
                  <Label htmlFor="company_radius">{t('Allowed Radius (meters)')}</Label>
                  <Input
                    id="company_radius"
                    name="company_radius"
                    type="number"
                    value={settings.company_radius}
                    onChange={handleInputChange}
                    min="1"
                    placeholder="e.g. 100"
                    disabled={!canManage}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground italic">
                {t('Tip: You can also find these by right-clicking your office location on Google Maps and copying the numbers.')}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
