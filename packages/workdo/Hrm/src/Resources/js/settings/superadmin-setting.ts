import { MapPin } from 'lucide-react';

export const getHrmSuperAdminSettings = (t: (key: string) => string) => [
  {
    order: 600,
    title: t('Attendance Settings'),
    href: '#attendance-settings',
    icon: MapPin,
    permission: 'manage-hrm',
    component: 'attendance-settings'
  }
];
