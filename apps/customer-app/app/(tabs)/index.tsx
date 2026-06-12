import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/auth';
import { api, type Order } from '../../src/api';
import { COLORS } from '../../src/theme';
import Badge from '../../src/components/Badge';
import Button from '../../src/components/Button';
import { errorMessage } from '../../src/utils';

const TIMELINE_STEPS = [
  { key: 'placed', label: 'ວາງຄຳສັ່ງ', icon: 'checkmark-circle' as const },
  { key: 'washing', label: 'ກຳລັງຊັກ', icon: 'water' as const },
  { key: 'drying', label: 'ກຳລັງອົບ', icon: 'sunny' as const },
  { key: 'ready', label: 'ພ້ອມແລ້ວ', icon: 'checkmark-done-circle' as const },
  { key: 'delivered', label: 'ຈັດສົ່ງແລ້ວ', icon: 'home' as const },
];

function statusToStep(status: string): number {
  const map: Record<string, number> = {
    PENDING: 0,
    RESERVED: 0,
    WASHING: 1,
    DRYING: 2,
    READY: 3,
    DELIVERED: 4,
  };
  return map[status] ?? 0;
}

export default function HomeScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasUnread, setHasUnread] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const orders = await api.listOrders(token);
      const active = orders.find(
        (o) => !['DELIVERED', 'CANCELLED'].includes(o.status),
      );
      setOrder(active ?? null);

      const notifs = await api.listNotifications(token);
      setHasUnread(notifs.some((n) => n.readAt === null));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const currentStep = order ? statusToStep(order.status) : -1;
  const progress = order?.progressPct ?? 0;
  const minutesLeft = order?.estimatedMinutes ?? 0;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.greeting}>ສະບາຍດີ, ທ່ານລູກຄ້າ</Text>
        <Pressable
          style={styles.bellBtn}
          onPress={() => router.push('/notifications')}
        >
          <Ionicons name="notifications-outline" size={24} color={COLORS.textHeading} />
          {hasUnread && <View style={styles.bellDot} />}
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {loading && (
          <ActivityIndicator color={COLORS.primary} style={styles.loader} />
        )}
        {error && <Text style={styles.errorText}>{error}</Text>}

        {!loading && order && (
          <>
            {/* Hero card */}
            <View style={styles.heroCard}>
              <View style={styles.heroTop}>
                <Text style={styles.heroOrderId}>#{order.id.slice(0, 8).toUpperCase()}</Text>
                <View style={styles.heroBadge}>
                  <Text style={styles.heroBadgeText}>
                    {order.status.replace(/_/g, ' ')}
                  </Text>
                </View>
              </View>
              <Text style={styles.heroBranch}>{order.branchName}</Text>
              <View style={styles.progressBarBg}>
                <View
                  style={[styles.progressBarFill, { width: `${progress}%` as `${number}%` }]}
                />
              </View>
              <Text style={styles.heroProgressText}>
                {progress}% · {minutesLeft} ນາທີ ຍັງເຫຼືອ
              </Text>
            </View>

            {/* Timeline */}
            <Text style={styles.sectionTitle}>ຄວາມຄືບໜ້າ</Text>
            <View style={styles.timeline}>
              {TIMELINE_STEPS.map((step, idx) => {
                const isDone = idx < currentStep;
                const isCurrent = idx === currentStep;
                const isFuture = idx > currentStep;
                return (
                  <View key={step.key} style={styles.timelineRow}>
                    <View style={styles.timelineLeft}>
                      <View
                        style={[
                          styles.timelineIconWrap,
                          isDone && styles.timelineIconDone,
                          isCurrent && styles.timelineIconCurrent,
                          isFuture && styles.timelineIconFuture,
                        ]}
                      >
                        <Ionicons
                          name={isDone ? 'checkmark-circle' : step.icon}
                          size={20}
                          color={isDone ? COLORS.green : isCurrent ? COLORS.primary : COLORS.textHint}
                        />
                        {isCurrent && <View style={styles.halo} />}
                      </View>
                      {idx < TIMELINE_STEPS.length - 1 && (
                        <View
                          style={[
                            styles.timelineLine,
                            isDone && styles.timelineLineDone,
                          ]}
                        />
                      )}
                    </View>
                    <View style={styles.timelineContent}>
                      <Text
                        style={[
                          styles.timelineLabel,
                          isFuture && styles.timelineLabelFuture,
                          isCurrent && styles.timelineLabelCurrent,
                        ]}
                      >
                        {step.label}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Driver card */}
            {order.driverName && (
              <View style={styles.driverCard}>
                <View style={styles.driverAvatar}>
                  <Text style={styles.driverAvatarText}>
                    {order.driverName.slice(0, 2).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.driverInfo}>
                  <Text style={styles.driverName}>{order.driverName}</Text>
                  <View style={styles.driverStars}>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Ionicons
                        key={s}
                        name={s <= Math.round(order.driverRating ?? 0) ? 'star' : 'star-outline'}
                        size={14}
                        color={COLORS.amber}
                      />
                    ))}
                    <Text style={styles.driverRating}>
                      {order.driverRating?.toFixed(1) ?? '—'}
                    </Text>
                  </View>
                </View>
                <View style={styles.driverActions}>
                  <Pressable style={styles.driverActionBtn}>
                    <Ionicons name="chatbubble-outline" size={18} color={COLORS.primary} />
                  </Pressable>
                  <Pressable style={styles.driverActionBtn}>
                    <Ionicons name="call-outline" size={18} color={COLORS.primary} />
                  </Pressable>
                </View>
              </View>
            )}
          </>
        )}

        {!loading && !order && (
          <View style={styles.emptyState}>
            <Ionicons name="basket-outline" size={64} color={COLORS.textHint} />
            <Text style={styles.emptyTitle}>ຍັງບໍ່ມີການສັ່ງ</Text>
            <Text style={styles.emptyBody}>
              ເລີ່ມຊັກຜ້າຂອງທ່ານດ້ວຍການສ້າງການສັ່ງໃໝ່
            </Text>
            <Button
              label="ສ້າງການສັ່ງໃໝ່"
              onPress={() => router.push('/order/create')}
              variant="primary"
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: COLORS.pageBg,
  },
  greeting: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textHeading,
  },
  bellBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  bellDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.red,
  },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, gap: 16, paddingBottom: 40 },
  loader: { marginTop: 40 },
  errorText: { color: COLORS.red, fontSize: 13, textAlign: 'center' },
  heroCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    padding: 20,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  heroOrderId: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
  heroBadge: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  heroBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },
  heroBranch: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    marginBottom: 14,
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginBottom: 8,
  },
  progressBarFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.white,
  },
  heroProgressText: {
    color: COLORS.white,
    fontSize: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textHeading,
    marginBottom: 4,
  },
  timeline: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    gap: 0,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  timelineLeft: {
    alignItems: 'center',
    width: 32,
    marginRight: 12,
  },
  timelineIconWrap: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  timelineIconDone: {},
  timelineIconCurrent: {},
  timelineIconFuture: {},
  halo: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primaryLightBg2,
    opacity: 0.5,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    minHeight: 20,
    backgroundColor: COLORS.border,
    marginVertical: 2,
  },
  timelineLineDone: {
    backgroundColor: COLORS.green,
  },
  timelineContent: {
    flex: 1,
    paddingVertical: 6,
  },
  timelineLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textBody,
  },
  timelineLabelCurrent: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  timelineLabelFuture: {
    color: COLORS.textHint,
  },
  driverCard: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  driverAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primaryLightBg2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverAvatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primaryDarkText,
  },
  driverInfo: { flex: 1 },
  driverName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textHeading,
    marginBottom: 2,
  },
  driverStars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  driverRating: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginLeft: 4,
  },
  driverActions: {
    flexDirection: 'row',
    gap: 8,
  },
  driverActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primaryLightBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textHeading,
  },
  emptyBody: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 8,
    paddingHorizontal: 20,
  },
});
