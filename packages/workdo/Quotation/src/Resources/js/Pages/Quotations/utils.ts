import { RfqStatus, RFQ_STATUS_LABELS } from './types';

const STATUS_COLORS: Record<string, string> = {
    draft:            'bg-gray-100 text-gray-800',
    issued:           'bg-blue-100 text-blue-800',
    closed:           'bg-yellow-100 text-yellow-800',
    under_evaluation: 'bg-purple-100 text-purple-800',
    awarded:          'bg-green-100 text-green-800',
    lpo_issued:       'bg-teal-100 text-teal-800',
    rejected:         'bg-red-100 text-red-800',
    // legacy values (safe fallback)
    sent:             'bg-blue-100 text-blue-800',
    accepted:         'bg-green-100 text-green-800',
    expired:          'bg-orange-100 text-orange-800',
};

export const getStatusBadgeClasses = (status: string): string => {
    const color = STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-800';
    return `px-2 py-1 rounded-full text-xs font-medium ${color}`;
};

export const getStatusLabel = (status: string): string => {
    if (!status) return '—';
    return RFQ_STATUS_LABELS[status as RfqStatus] ?? status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};
