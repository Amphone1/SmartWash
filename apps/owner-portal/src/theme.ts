export const COLORS = {
  // Primary
  primary: '#2563EB',
  primaryLight: '#EFF6FF',
  primaryLighter: '#DBEAFE',
  primaryDark: '#1D4ED8',

  // Text
  heading: '#0F172A',
  body: '#475569',
  muted: '#64748B',
  hint: '#94A3B8',
  disabled: '#CBD5E1',

  // Surfaces
  pageBg: '#F8FAFC',
  card: '#FFFFFF',
  border: '#E2E8F0',
  divider: '#F1F5F9',

  // Status
  successBg: '#DCFCE7',
  successText: '#166534',
  warningBg: '#FEF3C7',
  warningText: '#92400E',
  errorBg: '#FEE2E2',
  errorText: '#B91C1C',
  infoBg: '#DBEAFE',
  infoText: '#1D4ED8',
  purpleBg: '#F3E8FF',
  purpleText: '#7E22CE',
  grayBg: '#F1F5F9',
  grayText: '#475569',
} as const;

export const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  // Order statuses
  PENDING: { bg: COLORS.warningBg, text: COLORS.warningText },
  RESERVED: { bg: COLORS.warningBg, text: COLORS.warningText },
  RUNNING: { bg: COLORS.infoBg, text: COLORS.infoText },
  ACTIVE: { bg: COLORS.infoBg, text: COLORS.infoText },
  IN_TRANSIT: { bg: COLORS.purpleBg, text: COLORS.purpleText },
  DELIVERED: { bg: COLORS.successBg, text: COLORS.successText },
  IDLE: { bg: COLORS.successBg, text: COLORS.successText },
  DONE: { bg: COLORS.successBg, text: COLORS.successText },
  COMPLETED: { bg: COLORS.successBg, text: COLORS.successText },
  CANCELLED: { bg: COLORS.errorBg, text: COLORS.errorText },
  ERROR: { bg: COLORS.errorBg, text: COLORS.errorText },
  OFFLINE: { bg: COLORS.errorBg, text: COLORS.errorText },
  MAINTENANCE: { bg: COLORS.grayBg, text: COLORS.grayText },
  // Settlement statuses
  PAID: { bg: COLORS.successBg, text: COLORS.successText },
  // Slip statuses
  APPROVED: { bg: COLORS.successBg, text: COLORS.successText },
  REJECTED: { bg: COLORS.errorBg, text: COLORS.errorText },
  WASHING: { bg: COLORS.infoBg, text: COLORS.infoText },
};

export const RADIUS = {
  sidebar: '10px',
  card: '14px',
  button: '10px',
  input: '10px',
  pill: '20px',
} as const;
