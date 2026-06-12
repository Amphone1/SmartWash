import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { api, type TaskDetail } from '../../src/api';
import { Badge } from '../../src/components/Badge';
import { COLORS, STATUS_COLORS } from '../../src/theme';
import { errorMessage, formatKip } from '../../src/utils';

const NEXT_STATE: Record<string, string> = {
  ASSIGNED: 'EN_ROUTE_PICKUP',
  EN_ROUTE_PICKUP: 'PICKED_UP',
  PICKED_UP: 'IN_TRANSIT',
  IN_TRANSIT: 'DELIVERED',
};

const STATE_ACTION_LABEL: Record<string, string> = {
  ASSIGNED: 'ເລີ່ມໄປຮັບ →',
  EN_ROUTE_PICKUP: 'ຢືນຢັນຮັບຜ້າ →',
  PICKED_UP: 'ເລີ່ມສົ່ງ →',
  IN_TRANSIT: 'ຢືນຢັນຈັດສົ່ງ',
};

export default function DeliveryDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [advancing, setAdvancing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setTask(await api.getTask(id));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  async function handleAdvance() {
    if (!task) return;
    const next = NEXT_STATE[task.status];
    if (!next) return;

    const isDelivered = next === 'DELIVERED';
    if (isDelivered) {
      Alert.alert('ຢືນຢັນ', 'ຢືນຢັນການຈັດສົ່ງສຳເລັດ?', [
        { text: 'ຍົກເລີກ', style: 'cancel' },
        { text: 'ຢືນຢັນ', onPress: () => void doAdvance(next) },
      ]);
    } else {
      await doAdvance(next);
    }
  }

  async function doAdvance(nextState: string) {
    if (!task) return;
    setAdvancing(true);
    try {
      await api.advanceTask(task.id, nextState);
      setTask((t) => t ? { ...t, status: nextState } : t);
      if (nextState === 'DELIVERED') router.back();
    } catch (e) {
      Alert.alert('ຜິດພາດ', errorMessage(e));
    } finally {
      setAdvancing(false);
    }
  }

  const nextAction = task ? STATE_ACTION_LABEL[task.status] : null;
  const statusColor = task ? STATUS_COLORS[task.status] : null;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.heading} />
        </Pressable>
        <Text style={styles.title}>ລາຍລະອຽດ</Text>
        {task && <Badge status={task.status} label={task.status.replace(/_/g, ' ')} />}
      </View>

      {loading && <ActivityIndicator color={COLORS.primary} style={styles.loader} />}
      {error && <Text style={styles.error}>{error}</Text>}

      {task && (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Map placeholder */}
          <View style={styles.mapArea}>
            <Ionicons name="map-outline" size={40} color={COLORS.hint} />
            <Text style={styles.mapHint}>Google Maps — {task.distanceKm} km</Text>
          </View>

          {/* Addresses */}
          <View style={styles.addrCard}>
            <View style={styles.addrRow}>
              <View style={[styles.addrDot, { backgroundColor: COLORS.primary }]} />
              <View style={styles.addrText}>
                <Text style={styles.addrType}>ຮັບ</Text>
                <Text style={styles.addrValue}>{task.pickupAddress}</Text>
              </View>
            </View>
            <View style={styles.addrLine} />
            <View style={styles.addrRow}>
              <View style={[styles.addrDot, { backgroundColor: COLORS.success }]} />
              <View style={styles.addrText}>
                <Text style={styles.addrType}>ສົ່ງ</Text>
                <Text style={styles.addrValue}>{task.dropoffAddress}</Text>
              </View>
            </View>
          </View>

          {/* Customer */}
          <View style={styles.customerCard}>
            <View style={styles.customerAvatar}>
              <Text style={styles.customerAvatarText}>
                {task.customerName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.customerInfo}>
              <Text style={styles.customerName}>{task.customerName}</Text>
              <Text style={styles.customerId}>Order #{task.orderId.slice(0, 8).toUpperCase()}</Text>
            </View>
            <Pressable
              style={styles.callBtn}
              onPress={() => Linking.openURL(`tel:${task.customerPhone}`)}
            >
              <Ionicons name="call-outline" size={20} color={COLORS.primary} />
            </Pressable>
          </View>

          {/* Items */}
          {task.items.length > 0 && (
            <View style={styles.itemsCard}>
              <Text style={styles.itemsTitle}>ສິ່ງຂອງ</Text>
              {task.items.map((item, i) => (
                <View key={i} style={styles.itemRow}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemQty}>×{item.qty}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Fee */}
          <View style={styles.feeRow}>
            <Text style={styles.feeLabel}>ຄ່າດຳເນີນ</Text>
            <Text style={styles.feeAmount}>{formatKip(task.feeKip)}</Text>
          </View>

          {/* Notes */}
          {task.notes && (
            <View style={styles.notesCard}>
              <Ionicons name="information-circle-outline" size={16} color={COLORS.muted} />
              <Text style={styles.notesText}>{task.notes}</Text>
            </View>
          )}

          {/* Action button */}
          {nextAction && (
            <Pressable
              style={[
                styles.actionBtn,
                statusColor && { backgroundColor: statusColor.text },
                advancing && styles.actionBtnDisabled,
              ]}
              onPress={handleAdvance}
              disabled={advancing}
            >
              <Text style={styles.actionBtnText}>
                {advancing ? 'ກຳລັງດຳເນີນ...' : nextAction}
              </Text>
            </Pressable>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12,
  },
  backBtn: { padding: 4 },
  title: { flex: 1, fontSize: 18, fontWeight: '700', color: COLORS.heading },
  loader: { marginTop: 40 },
  error: { color: COLORS.danger, textAlign: 'center', margin: 16 },
  content: { padding: 16, gap: 14, paddingBottom: 48 },
  mapArea: {
    height: 180, borderRadius: 16, backgroundColor: '#E2E8F0',
    alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  mapHint: { fontSize: 13, color: COLORS.muted },
  addrCard: {
    backgroundColor: COLORS.card, borderRadius: 14,
    borderWidth: 1, borderColor: COLORS.border, padding: 16, gap: 8,
  },
  addrRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  addrDot: { width: 12, height: 12, borderRadius: 6, marginTop: 4 },
  addrLine: { width: 2, height: 20, backgroundColor: COLORS.border, marginLeft: 5 },
  addrText: { flex: 1, gap: 2 },
  addrType: { fontSize: 11, fontWeight: '700', color: COLORS.muted, textTransform: 'uppercase' },
  addrValue: { fontSize: 14, color: COLORS.heading },
  customerCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.card, borderRadius: 14,
    borderWidth: 1, borderColor: COLORS.border, padding: 14,
  },
  customerAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center',
  },
  customerAvatarText: { fontSize: 18, fontWeight: '700', color: COLORS.primary },
  customerInfo: { flex: 1 },
  customerName: { fontSize: 15, fontWeight: '700', color: COLORS.heading },
  customerId: { fontSize: 12, color: COLORS.muted },
  callBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center',
  },
  itemsCard: {
    backgroundColor: COLORS.card, borderRadius: 14,
    borderWidth: 1, borderColor: COLORS.border, padding: 14, gap: 8,
  },
  itemsTitle: { fontSize: 13, fontWeight: '700', color: COLORS.muted },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between' },
  itemName: { fontSize: 14, color: COLORS.heading },
  itemQty: { fontSize: 14, fontWeight: '600', color: COLORS.muted },
  feeRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.card, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.border, padding: 14,
  },
  feeLabel: { fontSize: 14, color: COLORS.muted },
  feeAmount: { fontSize: 18, fontWeight: '700', color: COLORS.heading },
  notesCard: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    backgroundColor: '#FFF7ED', borderRadius: 10, padding: 12,
  },
  notesText: { flex: 1, fontSize: 13, color: COLORS.body },
  actionBtn: {
    backgroundColor: COLORS.primary, borderRadius: 14,
    padding: 16, alignItems: 'center',
  },
  actionBtnDisabled: { opacity: 0.6 },
  actionBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
