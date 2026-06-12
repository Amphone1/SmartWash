export const COLORS = {
  primary: '#2563EB',
  primaryLight: '#EFF6FF',
  primaryDark: '#1D4ED8',
  heading: '#0F172A',
  body: '#475569',
  muted: '#64748B',
  hint: '#94A3B8',
  disabled: '#CBD5E1',
  bg: '#F8FAFC',
  card: '#FFFFFF',
  border: '#E2E8F0',
  divider: '#F1F5F9',
  success: '#16A34A',
  warning: '#F59E0B',
  danger: '#DC2626',
};

export const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  NEW: { bg: '#DBEAFE', text: '#1D4ED8' },
  ASSIGNED: { bg: '#DBEAFE', text: '#1D4ED8' },
  EN_ROUTE_PICKUP: { bg: '#F3E8FF', text: '#7E22CE' },
  PICKED_UP: { bg: '#F3E8FF', text: '#7E22CE' },
  IN_TRANSIT: { bg: '#F3E8FF', text: '#7E22CE' },
  DELIVERED: { bg: '#DCFCE7', text: '#166534' },
  CANCELLED: { bg: '#FEE2E2', text: '#B91C1C' },
};
