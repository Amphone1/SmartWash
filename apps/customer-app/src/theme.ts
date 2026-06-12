export const COLORS = {
  // Primary
  primary: '#2563EB',
  primaryLightBg: '#EFF6FF',
  primaryLightBg2: '#DBEAFE',
  primaryDarkText: '#1D4ED8',

  // Text
  textHeading: '#0F172A',
  textBody: '#475569',
  textMuted: '#64748B',
  textHint: '#94A3B8',
  textDisabled: '#CBD5E1',

  // Surfaces
  pageBg: '#F8FAFC',
  cardBg: '#FFFFFF',
  border: '#E2E8F0',
  divider: '#F1F5F9',

  // Status raw values
  pendingBg: '#FEF3C7',
  pendingText: '#92400E',
  washingBg: '#DBEAFE',
  washingText: '#1D4ED8',
  inTransitBg: '#F3E8FF',
  inTransitText: '#7E22CE',
  deliveredBg: '#DCFCE7',
  deliveredText: '#166534',
  cancelledBg: '#FEE2E2',
  cancelledText: '#B91C1C',

  // Misc
  white: '#FFFFFF',
  black: '#0F172A',
  red: '#DC2626',
  amber: '#F59E0B',
  green: '#16A34A',
  cyan: '#38BDF8',
  darkSurface: '#1E293B',
  darkPage: '#0F172A',
} as const;

export const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  PENDING: { bg: COLORS.pendingBg, text: COLORS.pendingText },
  RESERVED: { bg: COLORS.pendingBg, text: COLORS.pendingText },
  WASHING: { bg: COLORS.washingBg, text: COLORS.washingText },
  RUNNING: { bg: COLORS.washingBg, text: COLORS.washingText },
  NEW: { bg: COLORS.washingBg, text: COLORS.washingText },
  IN_TRANSIT: { bg: COLORS.inTransitBg, text: COLORS.inTransitText },
  DELIVERED: { bg: COLORS.deliveredBg, text: COLORS.deliveredText },
  IDLE: { bg: COLORS.deliveredBg, text: COLORS.deliveredText },
  SUCCESS: { bg: COLORS.deliveredBg, text: COLORS.deliveredText },
  CANCELLED: { bg: COLORS.cancelledBg, text: COLORS.cancelledText },
  ERROR: { bg: COLORS.cancelledBg, text: COLORS.cancelledText },
  OFFLINE: { bg: COLORS.cancelledBg, text: COLORS.cancelledText },
};
