import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { api, type DriverTask } from '../../src/api';
import { Badge } from '../../src/components/Badge';
import { Button } from '../../src/components/Button';
import { COLORS } from '../../src/theme';
import { errorMessage, formatKip } from '../../src/utils';

const STATUS_LABEL: Record<string, string> = {
  NEW: 'ໃໝ່',
  ASSIGNED: 'ໃໝ່',
  EN_ROUTE_PICKUP: 'ກຳລັງໄປຮັບ',
  PICKED_UP: 'ຮັບແລ້ວ',
  IN_TRANSIT: 'ກຳລັງສົ່ງ',
  DELIVERED: 'ສົ່ງແລ້ວ',
  CANCELLED: 'ຍົກເລີກ',
};

const NEXT_STATE: Record<string, { to: string; label: string }> = {
  ASSIGNED: { to: 'EN_ROUTE_PICKUP', label: 'ອອກເດີນທາງ →' },
  EN_ROUTE_PICKUP: { to: 'PICKED_UP', label: 'ຮັບສິນຄ້າແລ້ວ →' },
  PICKED_UP: { to: 'IN_TRANSIT', label: 'ກຳລັງສົ່ງ →' },
  IN_TRANSIT: { to: 'DELIVERED', label: 'ສົ່ງສຳເລັດ →' },
};

const NEW_STATUSES = new Set(['NEW', 'ASSIGNED']);
const IN_PROGRESS_STATUSES = new Set(['EN_ROUTE_PICKUP', 'PICKED_UP', 'IN_TRANSIT']);

function TaskTypeLabel({ type }: { type: string }) {
  return (
    <Text style={styles.typeLabel}>
      ປະເພດ: {type === 'PICKUP' ? 'ຮັບສິນຄ້າ' : 'ສົ່ງສິນຄ້າ'}
    </Text>
  );
}

export default function TasksScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [tasks, setTasks] = useState<DriverTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [todayKip, setTodayKip] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const locationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchTasks = useCallback(async () => {
    try {
      const data = await api.listTasks();
      setTasks(data);
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);

  const fetchEarnings = useCallback(async () => {
    try {
      const data = await api.getEarnings();
      setTodayKip(data.todayKip);
    } catch {
      // non-critical
    }
  }, []);

  const startLocationTracking = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;

    locationIntervalRef.current = setInterval(async () => {
      try {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        await api.updateLocation(loc.coords.latitude, loc.coords.longitude);
      } catch {
        // silent — location update failure shouldn't disrupt UX
      }
    }, 30000);
  }, []);

  useEffect(() => {
    void fetchTasks().finally(() => setLoading(false));
    void fetchEarnings();
    void startLocationTracking();

    intervalRef.current = setInterval(() => {
      void fetchTasks();
    }, 30000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (locationIntervalRef.current) clearInterval(locationIntervalRef.current);
    };
  }, [fetchTasks, fetchEarnings, startLocationTracking]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchTasks();
    await fetchEarnings();
    setRefreshing(false);
  }, [fetchTasks, fetchEarnings]);

  const handleAccept = useCallback(
    async (id: string) => {
      setActionLoading(id + '_accept');
      try {
        await api.acceptTask(id);
        await fetchTasks();
      } catch (e) {
        Alert.alert('ຜິດພາດ', errorMessage(e));
      } finally {
        setActionLoading(null);
      }
    },
    [fetchTasks],
  );

  const handleReject = useCallback(
    async (id: string) => {
      Alert.alert('ປະຕິເສດວຽກ', 'ທ່ານແນ່ໃຈບໍ່ທີ່ຈະປະຕິເສດວຽກນີ້?', [
        { text: 'ຍົກເລີກ', style: 'cancel' },
        {
          text: 'ປະຕິເສດ',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(id + '_reject');
            try {
              await api.rejectTask(id);
              await fetchTasks();
            } catch (e) {
              Alert.alert('ຜິດພາດ', errorMessage(e));
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]);
    },
    [fetchTasks],
  );

  const handleAdvance = useCallback(
    async (task: DriverTask) => {
      const next = NEXT_STATE[task.status];
      if (!next) return;

      const isDelivery = next.to === 'DELIVERED';
      const doAdvance = async () => {
        setActionLoading(task.id + '_advance');
        try {
          await api.advanceTask(task.id, next.to);
          await fetchTasks();
        } catch (e) {
          Alert.alert('ຜິດພາດ', errorMessage(e));
        } finally {
          setActionLoading(null);
        }
      };

      if (isDelivery) {
        Alert.alert(
          'ຢືນຢັນການສົ່ງ',
          `ທ່ານໄດ້ສົ່ງສິນຄ້າໃຫ້ ${task.customerName} ແລ້ວບໍ?`,
          [
            { text: 'ຍັງບໍ່', style: 'cancel' },
            { text: 'ສົ່ງແລ້ວ', style: 'default', onPress: doAdvance },
          ],
        );
      } else {
        await doAdvance();
      }
    },
    [fetchTasks],
  );

  const newTasks = tasks.filter((t) => NEW_STATUSES.has(t.status));
  const inProgressTasks = tasks.filter((t) => IN_PROGRESS_STATUSES.has(t.status));

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>ຄລ</Text>
          </View>
          <View>
            <Text style={styles.greeting}>ສວັດດີ, ຄຳລາ</Text>
            <View style={styles.statusRow}>
              <View style={styles.greenDot} />
              <Text style={styles.statusText}>Online · GPS active</Text>
            </View>
          </View>
        </View>
        <Text style={styles.earningsToday}>ໄດ້ {formatKip(todayKip)} ມື້ນີ້</Text>
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
          />
        }
      >
        {loading && (
          <ActivityIndicator
            color={COLORS.primary}
            style={{ marginTop: 40 }}
          />
        )}

        {!loading && error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={() => void fetchTasks()}>
              <Text style={styles.retryText}>ລອງໃໝ່</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* New tasks */}
        {newTasks.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ມອບໝາຍໃໝ່</Text>
            {newTasks.map((task) => (
              <View key={task.id} style={styles.newTaskCard}>
                <View style={styles.cardTopRow}>
                  <Text style={styles.taskId} numberOfLines={1}>
                    #{task.id.slice(0, 8)}
                  </Text>
                  <TaskTypeLabel type={task.type} />
                  <Badge label={STATUS_LABEL[task.status] ?? task.status} status={task.status} />
                </View>

                <View style={styles.addressRow}>
                  <Ionicons name="location-outline" size={16} color={COLORS.primary} />
                  <Text style={styles.addressText} numberOfLines={2}>
                    {task.pickupAddress}
                  </Text>
                </View>

                <View style={styles.addressRow}>
                  <Ionicons name="location-outline" size={16} color={COLORS.muted} />
                  <Text style={[styles.addressText, { color: COLORS.body }]} numberOfLines={2}>
                    {task.dropoffAddress}
                  </Text>
                </View>

                <View style={styles.feeRow}>
                  <Ionicons name="cash-outline" size={16} color={COLORS.success} />
                  <Text style={styles.feeText}>{formatKip(task.feeKip)}</Text>
                  <Text style={styles.distanceText}> · {task.distanceKm} km</Text>
                </View>

                <View style={styles.actionRow}>
                  <Button
                    label="ຮັບວຽກ"
                    onPress={() => void handleAccept(task.id)}
                    loading={actionLoading === task.id + '_accept'}
                    style={styles.actionBtnHalf}
                  />
                  <Button
                    label="ປະຕິເສດ"
                    onPress={() => void handleReject(task.id)}
                    variant="danger-outline"
                    loading={actionLoading === task.id + '_reject'}
                    style={styles.actionBtnHalf}
                  />
                </View>
              </View>
            ))}
          </View>
        )}

        {/* In-progress tasks */}
        {inProgressTasks.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ກຳລັງດຳເນີນ</Text>
            {inProgressTasks.map((task) => {
              const next = NEXT_STATE[task.status];
              return (
                <TouchableOpacity
                  key={task.id}
                  style={styles.progressCard}
                  activeOpacity={0.8}
                  onPress={() => router.push(`/delivery/${task.id}`)}
                >
                  <View style={styles.progressCardTop}>
                    <View style={styles.flex}>
                      <Text style={styles.customerName}>{task.customerName}</Text>
                      <Text style={styles.orderIdText}>
                        ຄຳສັ່ງ #{task.orderId.slice(0, 8)} · {task.distanceKm} km
                      </Text>
                    </View>
                    <Badge
                      label={STATUS_LABEL[task.status] ?? task.status}
                      status={task.status}
                    />
                  </View>

                  {next && (
                    <Button
                      label={`ດຳເນີນການຕໍ່: ${next.label}`}
                      onPress={() => void handleAdvance(task)}
                      variant="success"
                      loading={actionLoading === task.id + '_advance'}
                      style={styles.advanceBtn}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {!loading && newTasks.length === 0 && inProgressTasks.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="checkmark-circle-outline" size={56} color={COLORS.hint} />
            <Text style={styles.emptyTitle}>ບໍ່ມີວຽກໃໝ່</Text>
            <Text style={styles.emptySubtitle}>ລໍຖ້າການມອບໝາຍ...</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.card,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#1D4ED8',
    fontWeight: '700',
    fontSize: 14,
  },
  greeting: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.heading,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  greenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.success,
  },
  statusText: { fontSize: 12, color: COLORS.muted },
  earningsToday: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.success,
  },
  listContent: { padding: 16, gap: 0, paddingBottom: 32 },
  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  newTaskCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    flexWrap: 'wrap',
  },
  taskId: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.muted,
    fontFamily: 'monospace',
  },
  typeLabel: {
    fontSize: 12,
    color: COLORS.body,
    flex: 1,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: 6,
  },
  addressText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.muted,
    lineHeight: 18,
  },
  feeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    marginBottom: 12,
  },
  feeText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.success,
  },
  distanceText: {
    fontSize: 13,
    color: COLORS.muted,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtnHalf: { flex: 1, paddingVertical: 11 },
  progressCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  progressCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 10,
  },
  customerName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.heading,
  },
  orderIdText: {
    fontSize: 12,
    color: COLORS.muted,
    marginTop: 2,
  },
  advanceBtn: { paddingVertical: 14 },
  errorBox: {
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
    alignItems: 'center',
    gap: 8,
  },
  errorText: { color: COLORS.danger, fontSize: 14, textAlign: 'center' },
  retryText: { color: COLORS.primary, fontWeight: '600', fontSize: 14 },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 10,
  },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: COLORS.body },
  emptySubtitle: { fontSize: 14, color: COLORS.hint },
});
