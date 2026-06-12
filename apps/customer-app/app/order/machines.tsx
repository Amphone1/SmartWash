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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../src/auth';
import { api, type Machine } from '../../src/api';
import Badge from '../../src/components/Badge';
import { COLORS } from '../../src/theme';
import { errorMessage } from '../../src/utils';

type MachineFilter = 'ALL' | 'IDLE' | 'WASHER' | 'DRYER';

const FILTERS: { key: MachineFilter; label: string }[] = [
  { key: 'ALL', label: 'ທັງໝົດ' },
  { key: 'IDLE', label: 'ວ່າງ' },
  { key: 'WASHER', label: 'ເຄື່ອງຊັກ' },
  { key: 'DRYER', label: 'ເຄື່ອງອົບ' },
];

const DEMO_BRANCH_ID = 'branch-001';
const DEMO_BRANCH_NAME = 'ສາຂາ ດົງດອກ';

function MachineCard({
  machine,
  onSelect,
}: {
  machine: Machine;
  onSelect: (m: Machine) => void;
}) {
  const isIdle = machine.state === 'IDLE';
  const isRunning = machine.state === 'RUNNING';
  const isReserved = machine.state === 'RESERVED';
  const isOffline = machine.state === 'OFFLINE';

  return (
    <Pressable
      style={[
        styles.machineCard,
        isIdle && styles.machineCardIdle,
        isOffline && styles.machineCardOffline,
      ]}
      onPress={() => !isOffline && onSelect(machine)}
      disabled={isOffline}
    >
      <View style={styles.machineHeader}>
        <Text style={styles.machineCode}>{machine.code}</Text>
        <Badge status={machine.state} />
      </View>
      <Text style={styles.machineType}>
        {machine.type === 'washer' ? 'ເຄື່ອງຊັກ' : 'ເຄື່ອງອົບ'} {machine.capacityKg}kg
      </Text>

      {isIdle && (
        <Text style={styles.startNow}>ເລີ່ມໄດ້ເລີຍ →</Text>
      )}

      {isRunning && (
        <View style={styles.progressSection}>
          <View style={styles.progressBg}>
            <View style={[styles.progressFill, { width: `${machine.progressPct ?? 0}%` as `${number}%` }]} />
          </View>
          <Text style={styles.progressHint}>
            {machine.minutesLeft} ນາທີ · ຕໍ່ຄິວ
          </Text>
        </View>
      )}

      {isReserved && (
        <Text style={styles.reservedHint}>ຄິວ ~15 ນາທີ</Text>
      )}
    </Pressable>
  );
}

export default function MachinesScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{
    service?: string;
    cycle?: string;
    weight?: string;
    code?: string;
    branchId?: string;
  }>();

  const branchId = params.branchId ?? DEMO_BRANCH_ID;
  const [machines, setMachines] = useState<Machine[]>([]);
  const [filter, setFilter] = useState<MachineFilter>('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setMachines(await api.listMachines(token, branchId));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [token, branchId]);

  useEffect(() => { void load(); }, [load]);

  // If came from QR scan, auto-highlight matching machine
  useEffect(() => {
    if (params.code && machines.length > 0) {
      const matched = machines.find(
        (m) => m.code.toLowerCase() === params.code?.toLowerCase(),
      );
      if (matched && matched.state === 'IDLE') handleSelect(matched);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.code, machines]);

  const displayed = machines.filter((m) => {
    if (filter === 'ALL') return true;
    if (filter === 'IDLE') return m.state === 'IDLE';
    if (filter === 'WASHER') return m.type === 'washer';
    if (filter === 'DRYER') return m.type === 'dryer';
    return true;
  });

  function handleSelect(machine: Machine) {
    if (!token) return;
    if (machine.state === 'IDLE') {
      // Create order then start — for now go to confirmation page
      router.push(
        `/order/confirm?machineId=${machine.id}&branchId=${branchId}&service=${params.service ?? 'self_service'}&cycle=${params.cycle ?? 'normal'}`,
      );
    } else if (machine.state === 'RUNNING' || machine.state === 'RESERVED') {
      void api.joinQueue(token, machine.id).catch(() => null);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textHeading} />
        </Pressable>
        <Text style={styles.title}>ເລືອກເຄື່ອງ</Text>
      </View>

      {/* Branch summary */}
      <View style={styles.branchRow}>
        <View style={styles.branchInfo}>
          <Text style={styles.branchName}>{DEMO_BRANCH_NAME}</Text>
          <Text style={styles.branchMeta}>1.2 km · 08:00–21:00</Text>
        </View>
        <Pressable>
          <Text style={styles.changeLink}>ປ່ຽນ</Text>
        </Pressable>
      </View>

      {/* Filters */}
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
        keyExtractor={(m) => m.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <MachineCard machine={item} onSelect={handleSelect} />
        )}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Ionicons name="construct-outline" size={48} color={COLORS.textHint} />
              <Text style={styles.emptyText}>ບໍ່ພົບເຄື່ອງ</Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  backBtn: { padding: 4 },
  title: { fontSize: 18, fontWeight: '700', color: COLORS.textHeading },
  branchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
  },
  branchInfo: { flex: 1 },
  branchName: { fontSize: 15, fontWeight: '700', color: COLORS.textHeading },
  branchMeta: { fontSize: 12, color: COLORS.textMuted },
  changeLink: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },
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
  loader: { marginTop: 32 },
  error: { color: COLORS.red, textAlign: 'center', margin: 16 },
  list: { padding: 12, paddingBottom: 40 },
  row: { gap: 12, marginBottom: 12 },
  machineCard: {
    flex: 1,
    backgroundColor: COLORS.cardBg,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },
  machineCardIdle: {
    borderColor: COLORS.green,
    backgroundColor: '#F0FDF4',
  },
  machineCardOffline: { opacity: 0.5 },
  machineHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  machineCode: { fontSize: 14, fontWeight: '700', color: COLORS.textHeading },
  machineType: { fontSize: 12, color: COLORS.textMuted },
  startNow: { fontSize: 13, color: COLORS.green, fontWeight: '600', marginTop: 4 },
  progressSection: { gap: 4 },
  progressBg: {
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.primaryLightBg2,
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.primary,
  },
  progressHint: { fontSize: 11, color: COLORS.textMuted },
  reservedHint: { fontSize: 12, color: '#92400E', fontWeight: '500' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15, color: COLORS.textMuted },
});
