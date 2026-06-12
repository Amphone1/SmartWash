import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api, type Order } from '../../src/api';
import { useAuth } from '../../src/auth';
import Badge from '../../src/components/Badge';
import Card from '../../src/components/Card';
import { COLORS } from '../../src/theme';
import { errorMessage, formatKip } from '../../src/utils';

const FILTERS = [
  { key: 'ALL', label: 'ທັງໝົດ' },
  { key: 'ACTIVE', label: 'ກຳລັງດຳເນີນ' },
  { key: 'DONE', label: 'ສຳເລັດ' },
  { key: 'CANCELLED', label: 'ຍົກເລີກ' },
] as const;
type Filter = (typeof FILTERS)[number]['key'];

const ACTIVE_STATES = new Set(['CREATED','RESERVED','PAYMENT_PENDING','AWAITING_APPROVAL','PAID','RUNNING']);
const DONE_STATES = new Set(['COMPLETED','REFUNDED']);
const CANCELLED_STATES = new Set(['CANCELLED','EXPIRED','REJECTED']);

function filterOrders(orders: Order[], filter: Filter): Order[] {
  if (filter === 'ALL') return orders;
  if (filter === 'ACTIVE') return orders.filter((o) => ACTIVE_STATES.has(o.status));
  if (filter === 'DONE') return orders.filter((o) => DONE_STATES.has(o.status));
  return orders.filter((o) => CANCELLED_STATES.has(o.status));
}

const SERVICE_LABEL: Record<string, string> = {
  self_service: 'ຊັກເອງ',
  pickup: 'ຮັບ-ສົ່ງ',
  delivery: 'ຮັບ+ຈັດສົ່ງ',
};

function OrderCard({ order }: { order: Order }) {
  const router = useRouter();
  const isActive = ACTIVE_STATES.has(order.status);
  const isDone = DONE_STATES.has(order.status);
  const isCancelled = CANCELLED_STATES.has(order.status);

  return (
    <Card style={[styles.orderCard, isActive ? styles.activeCard : undefined]}>
      <View style={styles.cardHeader}>
        <Text style={styles.orderId}>#{order.id.slice(0, 8).toUpperCase()}</Text>
        <Badge status={order.status} />
      </View>
      <Text style={styles.orderMeta}>
        {SERVICE_LABEL[order.serviceType] ?? order.serviceType} · {order.branchName}
      </Text>
      <View style={styles.cardFooter}>
        <Text style={styles.orderDate}>
          {new Date(order.createdAt).toLocaleDateString('lo-LA')}
        </Text>
        <Text style={[styles.orderPrice, isCancelled && styles.strikethrough]}>
          {order.pricePaid != null ? formatKip(order.pricePaid) : '—'}
        </Text>
      </View>
      {isCancelled && (
        <Text style={styles.refundNote}>ຄືນເງິນຄ່ານາຍ</Text>
      )}
      {isActive && (
        <Pressable
          style={styles.trackBtn}
          onPress={() => router.push(`/delivery/track?orderId=${order.id}`)}
        >
          <Ionicons name="navigate-outline" size={14} color={COLORS.primary} />
          <Text style={styles.trackBtnText}>ຕິດຕາມສົດ →</Text>
        </Pressable>
      )}
      {isDone && (
        <View style={styles.doneActions}>
          <Pressable style={styles.ghostBtn}>
            <Ionicons name="receipt-outline" size={14} color={COLORS.textMuted} />
            <Text style={styles.ghostBtnText}>ໃບຮັບ</Text>
          </Pressable>
          <Pressable
            style={styles.ghostBtn}
            onPress={() => router.push('/order/create')}
          >
            <Ionicons name="refresh-outline" size={14} color={COLORS.primary} />
            <Text style={[styles.ghostBtnText, { color: COLORS.primary }]}>ສັ່ງໃໝ່</Text>
          </Pressable>
        </View>
      )}
    </Card>
  );
}

export default function OrdersScreen() {
  const { token } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setOrders(await api.listOrders(token));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const displayed = filterOrders(orders, filter);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>ການສັ່ງຂອງຂ້ອຍ</Text>
      </View>

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {FILTERS.map((f) => (
          <Pressable
            key={f.key}
            style={[styles.chip, filter === f.key && styles.chipActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.chipText, filter === f.key && styles.chipTextActive]}>
              {f.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {loading && <ActivityIndicator color={COLORS.primary} style={styles.loader} />}
      {error && <Text style={styles.error}>{error}</Text>}

      <FlatList
        data={displayed}
        keyExtractor={(o) => o.id}
        renderItem={({ item }) => <OrderCard order={item} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Ionicons name="receipt-outline" size={48} color={COLORS.textHint} />
              <Text style={styles.emptyText}>ຍັງບໍ່ມີການສັ່ງ</Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  title: { fontSize: 20, fontWeight: '700', color: COLORS.textHeading },
  filterRow: { paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: COLORS.divider,
  },
  chipActive: { backgroundColor: COLORS.textHeading },
  chipText: { fontSize: 13, fontWeight: '500', color: COLORS.textMuted },
  chipTextActive: { color: COLORS.white },
  loader: { marginTop: 40 },
  error: { color: COLORS.red, textAlign: 'center', margin: 16 },
  list: { padding: 16, gap: 12, paddingBottom: 40 },
  orderCard: { gap: 8 },
  activeCard: { borderWidth: 2, borderColor: COLORS.primary },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderId: { fontSize: 14, fontWeight: '700', color: COLORS.textHeading, fontVariant: ['tabular-nums'] },
  orderMeta: { fontSize: 13, color: COLORS.textMuted },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderDate: { fontSize: 12, color: COLORS.textHint },
  orderPrice: { fontSize: 15, fontWeight: '700', color: COLORS.textHeading },
  strikethrough: { textDecorationLine: 'line-through', color: COLORS.textHint },
  refundNote: { fontSize: 12, color: COLORS.green },
  trackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primaryLightBg,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    alignSelf: 'flex-start',
  },
  trackBtnText: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },
  doneActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  ghostBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  ghostBtnText: { fontSize: 13, color: COLORS.textMuted },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15, color: COLORS.textMuted },
});
