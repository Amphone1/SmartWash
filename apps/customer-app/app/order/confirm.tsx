import { useState } from 'react';
import {
  Alert,
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
import { api } from '../../src/api';
import Card from '../../src/components/Card';
import Button from '../../src/components/Button';
import Badge from '../../src/components/Badge';
import { COLORS } from '../../src/theme';
import { errorMessage, formatKip } from '../../src/utils';

const PRICE_MAP: Record<string, number> = {
  self_service: 8_000,
  pickup: 12_000,
  delivery: 15_000,
};
const CYCLE_MULT: Record<string, number> = { quick: 1, normal: 1.2, heavy: 1.5 };
const SERVICE_LABEL: Record<string, string> = {
  self_service: 'ຊັກເອງ', pickup: 'ຮັບ-ສົ່ງ', delivery: 'ຮັບ+ຈັດສົ່ງ',
};

export default function ConfirmOrderScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{
    machineId?: string;
    branchId?: string;
    service?: string;
    cycle?: string;
    weight?: string;
  }>();

  const service = (params.service ?? 'self_service') as 'self_service' | 'pickup' | 'delivery';
  const cycle = (params.cycle ?? 'normal') as 'quick' | 'normal' | 'heavy';
  const weightKg = Number(params.weight ?? 5);
  const pricePerKg = PRICE_MAP[service] ?? 8_000;
  const total = Math.round(pricePerKg * weightKg * (CYCLE_MULT[cycle] ?? 1));

  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    if (!token || !params.machineId || !params.branchId) return;
    setLoading(true);
    try {
      const order = await api.createOrder(token, {
        branchId: params.branchId,
        machineId: params.machineId,
        type: service,
        cycle,
      });
      router.replace(`/(tabs)/orders`);
      // Short delay then show order if needed
      void order;
    } catch (e) {
      Alert.alert('ຜິດພາດ', errorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textHeading} />
        </Pressable>
        <Text style={styles.title}>ຢືນຢັນການສັ່ງ</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.summaryCard}>
          <Text style={styles.cardTitle}>ລາຍລະອຽດ</Text>
          <Row label="ບໍລິການ" value={SERVICE_LABEL[service] ?? service} />
          <Row label="ໂຄງການ" value={cycle === 'quick' ? 'ໄວ 30ນ' : cycle === 'heavy' ? 'ໜັກ 60ນ' : 'ປົກກະຕິ 45ນ'} />
          <Row label="ນ້ຳໜັກ" value={`${weightKg} kg`} />
          <Row label="ເຄື່ອງ" value={params.machineId?.slice(0, 8).toUpperCase() ?? '—'} />
        </Card>

        <Card style={styles.priceCard}>
          <Text style={styles.cardTitle}>ລາຄາ</Text>
          <Row label={`ຄ່າຊັກ (${formatKip(pricePerKg)}/kg × ${weightKg}kg)`} value={formatKip(pricePerKg * weightKg)} />
          {cycle !== 'quick' && (
            <Row label="ໂຄງການ" value={`+${Math.round((CYCLE_MULT[cycle] - 1) * 100)}%`} />
          )}
          <View style={styles.divider} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>ລວມທັງໝົດ</Text>
            <Text style={styles.totalValue}>{formatKip(total)}</Text>
          </View>
        </Card>

        <View style={styles.walletNote}>
          <Ionicons name="wallet-outline" size={16} color={COLORS.primary} />
          <Text style={styles.walletNoteText}>ຈ່າຍຈາກກະເປົ໋າ SmartWash</Text>
          <Badge status="SUCCESS" />
        </View>

        <Button
          label={loading ? 'ກຳລັງດຳເນີນ...' : 'ຢືນຢັນ ແລະ ເລີ່ມ'}
          onPress={handleConfirm}
          variant="primary"
          disabled={loading}
        />
        <Button label="ຍົກເລີກ" onPress={() => router.back()} variant="ghost" />
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12,
  },
  backBtn: { padding: 4 },
  title: { fontSize: 18, fontWeight: '700', color: COLORS.textHeading },
  content: { padding: 20, gap: 16, paddingBottom: 48 },
  summaryCard: { gap: 10 },
  priceCard: { gap: 10 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textHeading, marginBottom: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowLabel: { fontSize: 14, color: COLORS.textBody },
  rowValue: { fontSize: 14, fontWeight: '600', color: COLORS.textHeading },
  divider: { borderTopWidth: 1, borderColor: COLORS.border, marginVertical: 4 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 15, fontWeight: '700', color: COLORS.textHeading },
  totalValue: { fontSize: 20, fontWeight: '700', color: COLORS.primary },
  walletNote: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.primaryLightBg, borderRadius: 12, padding: 12,
  },
  walletNoteText: { flex: 1, fontSize: 13, color: COLORS.primary, fontWeight: '500' },
});
