import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../src/auth';
import { api, type Delivery } from '../../src/api';
import Badge from '../../src/components/Badge';
import { COLORS } from '../../src/theme';
import { errorMessage } from '../../src/utils';

const STATUS_STEPS = [
  { key: 'ASSIGNED', label: 'ຮັບງານ' },
  { key: 'PICKED_UP', label: 'ຮັບຜ້າ' },
  { key: 'IN_TRANSIT', label: 'ກຳລັງສົ່ງ' },
  { key: 'ARRIVED', label: 'ຮອດແລ້ວ' },
];

function stepIndex(status: string): number {
  return STATUS_STEPS.findIndex((s) => s.key === status);
}

export default function TrackDeliveryScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const { deliveryId } = useLocalSearchParams<{ deliveryId?: string }>();

  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || !deliveryId) return;
    try {
      setDelivery(await api.getDeliveryTracking(token, deliveryId));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [token, deliveryId]);

  useEffect(() => { void load(); }, [load]);

  // Poll every 20s for live updates
  useEffect(() => {
    const interval = setInterval(() => void load(), 20_000);
    return () => clearInterval(interval);
  }, [load]);

  const currentStep = delivery ? stepIndex(delivery.status) : -1;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textHeading} />
        </Pressable>
        <Text style={styles.title}>ຕິດຕາມການຈັດສົ່ງ</Text>
        {delivery && <Badge status={delivery.status} />}
      </View>

      {loading && <ActivityIndicator color={COLORS.primary} style={styles.loader} />}
      {error && <Text style={styles.error}>{error}</Text>}

      {delivery && (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Map placeholder */}
          <View style={styles.mapPlaceholder}>
            <Ionicons name="map-outline" size={48} color={COLORS.textHint} />
            <Text style={styles.mapText}>{delivery.distanceKm.toFixed(1)} km ຫ່າງ</Text>
          </View>

          {/* ETA banner */}
          <View style={styles.etaBanner}>
            <Ionicons name="time-outline" size={20} color={COLORS.primary} />
            <Text style={styles.etaText}>
              ຄາດວ່າຈະຮອດ:{' '}
              {new Date(delivery.estimatedArrival).toLocaleTimeString('lo-LA', {
                hour: '2-digit', minute: '2-digit',
              })}
            </Text>
          </View>

          {/* Progress timeline */}
          <View style={styles.timeline}>
            {STATUS_STEPS.map((step, idx) => {
              const isDone = idx < currentStep;
              const isCurrent = idx === currentStep;
              return (
                <View key={step.key} style={styles.timelineRow}>
                  <View style={styles.timelineLeft}>
                    <View style={[
                      styles.dot,
                      isDone && styles.dotDone,
                      isCurrent && styles.dotCurrent,
                    ]}>
                      {isDone && <Ionicons name="checkmark" size={12} color={COLORS.white} />}
                      {isCurrent && <View style={styles.dotInner} />}
                    </View>
                    {idx < STATUS_STEPS.length - 1 && (
                      <View style={[styles.line, isDone && styles.lineDone]} />
                    )}
                  </View>
                  <Text style={[
                    styles.stepLabel,
                    isDone && styles.stepDone,
                    isCurrent && styles.stepCurrent,
                  ]}>
                    {step.label}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* Driver card */}
          <View style={styles.driverCard}>
            <View style={styles.driverAvatar}>
              <Text style={styles.driverAvatarText}>
                {delivery.driverName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.driverInfo}>
              <Text style={styles.driverName}>{delivery.driverName}</Text>
              <Text style={styles.driverVehicle}>
                {delivery.driverVehicle} · {delivery.driverPlate}
              </Text>
              <View style={styles.ratingRow}>
                <Ionicons name="star" size={14} color={COLORS.amber} />
                <Text style={styles.rating}>{delivery.driverRating.toFixed(1)}</Text>
              </View>
            </View>
            <View style={styles.driverActions}>
              <Pressable
                style={styles.actionBtn}
                onPress={() => Linking.openURL(`tel:+85620000000`)}
              >
                <Ionicons name="call-outline" size={20} color={COLORS.primary} />
              </Pressable>
              <Pressable style={styles.actionBtn}>
                <Ionicons name="chatbubble-outline" size={20} color={COLORS.primary} />
              </Pressable>
            </View>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12,
  },
  backBtn: { padding: 4 },
  title: { flex: 1, fontSize: 18, fontWeight: '700', color: COLORS.textHeading },
  loader: { marginTop: 40 },
  error: { color: COLORS.red, textAlign: 'center', margin: 16 },
  content: { padding: 20, gap: 16, paddingBottom: 48 },
  mapPlaceholder: {
    height: 200, borderRadius: 16,
    backgroundColor: COLORS.divider,
    alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  mapText: { fontSize: 14, color: COLORS.textMuted },
  etaBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.primaryLightBg, borderRadius: 12, padding: 14,
  },
  etaText: { fontSize: 15, fontWeight: '600', color: COLORS.primary },
  timeline: { gap: 0 },
  timelineRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  timelineLeft: { alignItems: 'center', width: 24 },
  dot: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: COLORS.divider, borderWidth: 2, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  dotDone: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  dotCurrent: { borderColor: COLORS.primary },
  dotInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary },
  line: { width: 2, height: 28, backgroundColor: COLORS.divider, marginTop: 2 },
  lineDone: { backgroundColor: COLORS.primary },
  stepLabel: { fontSize: 14, color: COLORS.textMuted, paddingTop: 4, paddingBottom: 24 },
  stepDone: { color: COLORS.textBody },
  stepCurrent: { color: COLORS.primary, fontWeight: '700' },
  driverCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: COLORS.cardBg, borderRadius: 16,
    borderWidth: 1, borderColor: COLORS.border, padding: 16,
  },
  driverAvatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: COLORS.primaryLightBg2,
    alignItems: 'center', justifyContent: 'center',
  },
  driverAvatarText: { fontSize: 20, fontWeight: '700', color: COLORS.primaryDarkText },
  driverInfo: { flex: 1, gap: 2 },
  driverName: { fontSize: 15, fontWeight: '700', color: COLORS.textHeading },
  driverVehicle: { fontSize: 12, color: COLORS.textMuted },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  rating: { fontSize: 13, fontWeight: '600', color: COLORS.textBody },
  driverActions: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.primaryLightBg,
    alignItems: 'center', justifyContent: 'center',
  },
});
