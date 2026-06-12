import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import Card from '../../src/components/Card';
import Button from '../../src/components/Button';
import { COLORS } from '../../src/theme';
import { formatKip } from '../../src/utils';

type ServiceType = 'self_service' | 'pickup' | 'delivery';
type Cycle = 'quick' | 'normal' | 'heavy';

interface ServiceOption {
  type: ServiceType;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  pricePerKg: number;
}

const SERVICES: ServiceOption[] = [
  { type: 'self_service', icon: 'water-outline', label: 'ຊັກເອງ', pricePerKg: 8_000 },
  { type: 'pickup', icon: 'car-outline', label: 'ຮັບ-ສົ່ງ', pricePerKg: 12_000 },
  { type: 'delivery', icon: 'bicycle-outline', label: 'ຮັບ+ຈັດສົ່ງ', pricePerKg: 15_000 },
];

const CYCLES: { key: Cycle; label: string; multiplier: number }[] = [
  { key: 'quick', label: 'ໄວ (30 ນາທີ)', multiplier: 1 },
  { key: 'normal', label: 'ປົກກະຕິ (45 ນາທີ)', multiplier: 1.2 },
  { key: 'heavy', label: 'ໜັກ (60 ນາທີ)', multiplier: 1.5 },
];

const MACHINE_LOAD_KG = 8;

export default function CreateOrderScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const [service, setService] = useState<ServiceType>('self_service');
  const [cycle, setCycle] = useState<Cycle>('normal');
  const [weightKg, setWeightKg] = useState(5);
  const [loading, setLoading] = useState(false);

  const selectedService = SERVICES.find((s) => s.type === service)!;
  const selectedCycle = CYCLES.find((c) => c.key === cycle)!;
  const loadsEstimate = Math.ceil(weightKg / MACHINE_LOAD_KG);
  const totalPrice = Math.round(selectedService.pricePerKg * weightKg * selectedCycle.multiplier);

  function stepWeight(delta: number) {
    setWeightKg((w) => Math.max(1, Math.min(30, w + delta)));
  }

  function handleConfirm() {
    if (!token) return;
    // Navigate to machine selection; carry service + cycle as params
    router.push(
      `/order/machines?service=${service}&cycle=${cycle}&weight=${weightKg}`,
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textHeading} />
        </Pressable>
        <Text style={styles.title}>ສ້າງການສັ່ງ</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Service selection */}
        <Text style={styles.sectionLabel}>ເລືອກບໍລິການ</Text>
        <View style={styles.serviceRow}>
          {SERVICES.map((s) => (
            <Pressable
              key={s.type}
              style={[styles.serviceCard, service === s.type && styles.serviceCardSelected]}
              onPress={() => setService(s.type)}
            >
              <View
                style={[
                  styles.serviceIcon,
                  service === s.type && styles.serviceIconSelected,
                ]}
              >
                <Ionicons
                  name={s.icon}
                  size={22}
                  color={service === s.type ? COLORS.primary : COLORS.textMuted}
                />
              </View>
              <Text
                style={[styles.serviceName, service === s.type && styles.serviceNameSelected]}
              >
                {s.label}
              </Text>
              <Text style={styles.servicePrice}>{formatKip(s.pricePerKg)}/kg</Text>
            </Pressable>
          ))}
        </View>

        {/* Cycle selection */}
        <Text style={styles.sectionLabel}>ໂຄງການຊັກ</Text>
        <View style={styles.cycleRow}>
          {CYCLES.map((c) => (
            <Pressable
              key={c.key}
              style={[styles.cycleChip, cycle === c.key && styles.cycleChipSelected]}
              onPress={() => setCycle(c.key)}
            >
              <Text style={[styles.cycleLabel, cycle === c.key && styles.cycleLabelSelected]}>
                {c.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Weight stepper */}
        <Text style={styles.sectionLabel}>ນ້ຳໜັກ</Text>
        <Card style={styles.stepperCard}>
          <Pressable style={styles.stepBtn} onPress={() => stepWeight(-1)}>
            <Text style={styles.stepBtnText}>−</Text>
          </Pressable>
          <View style={styles.stepCenter}>
            <Text style={styles.weightValue}>{weightKg} kg</Text>
            <Text style={styles.loadHint}>≈ {loadsEstimate} ຮອບ</Text>
          </View>
          <Pressable
            style={[styles.stepBtn, styles.stepBtnPlus]}
            onPress={() => stepWeight(1)}
          >
            <Text style={[styles.stepBtnText, styles.stepBtnPlusText]}>+</Text>
          </Pressable>
        </Card>

        {/* Pickup rows */}
        {service !== 'self_service' && (
          <>
            <Pressable style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Ionicons name="location-outline" size={18} color={COLORS.primary} />
              </View>
              <View style={styles.infoText}>
                <Text style={styles.infoLabel}>ທີ່ຢູ່ຮັບ</Text>
                <Text style={styles.infoSub}>18 ຖ. ສາຍລົມ, ວຽງຈັນ</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={COLORS.textHint} />
            </Pressable>
            <Pressable style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Ionicons name="time-outline" size={18} color={COLORS.primary} />
              </View>
              <View style={styles.infoText}>
                <Text style={styles.infoLabel}>ເວລາຮັບ</Text>
                <Text style={styles.infoSub}>ມື້ອື່ນ 09:00–11:00</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={COLORS.textHint} />
            </Pressable>
          </>
        )}

        {/* Price summary */}
        <View style={styles.priceDivider} />
        <Card style={styles.priceCard}>
          <View style={styles.priceRow}>
            <Text style={styles.priceRowLabel}>ຄ່າບໍລິການ ({weightKg} kg)</Text>
            <Text style={styles.priceRowValue}>
              {formatKip(selectedService.pricePerKg * weightKg)}
            </Text>
          </View>
          {selectedCycle.multiplier > 1 && (
            <View style={styles.priceRow}>
              <Text style={styles.priceRowLabel}>ໂຄງການ {selectedCycle.label}</Text>
              <Text style={styles.priceRowValue}>+{Math.round((selectedCycle.multiplier - 1) * 100)}%</Text>
            </View>
          )}
          <View style={[styles.priceRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>ລວມທັງໝົດ</Text>
            <Text style={styles.totalValue}>{formatKip(totalPrice)}</Text>
          </View>
        </Card>

        <Button
          label={loading ? 'ກຳລັງດຳເນີນ...' : 'ເລືອກເຄື່ອງ →'}
          onPress={handleConfirm}
          variant="primary"
          disabled={loading}
        />
      </ScrollView>
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
    backgroundColor: COLORS.pageBg,
  },
  backBtn: { padding: 4 },
  title: { fontSize: 18, fontWeight: '700', color: COLORS.textHeading },
  content: { padding: 20, gap: 12, paddingBottom: 48 },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textMuted, marginBottom: -4 },
  serviceRow: { flexDirection: 'row', gap: 10 },
  serviceCard: {
    flex: 1,
    backgroundColor: COLORS.cardBg,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    gap: 6,
  },
  serviceCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLightBg,
  },
  serviceIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: COLORS.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceIconSelected: { backgroundColor: COLORS.primaryLightBg2 },
  serviceName: { fontSize: 13, fontWeight: '600', color: COLORS.textBody, textAlign: 'center' },
  serviceNameSelected: { color: COLORS.primary },
  servicePrice: { fontSize: 11, color: COLORS.textHint },
  cycleRow: { gap: 8 },
  cycleChip: {
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: COLORS.cardBg,
  },
  cycleChipSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLightBg },
  cycleLabel: { fontSize: 13, color: COLORS.textBody },
  cycleLabelSelected: { color: COLORS.primary, fontWeight: '600' },
  stepperCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: COLORS.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnPlus: { backgroundColor: COLORS.primary },
  stepBtnText: { fontSize: 22, fontWeight: '700', color: COLORS.textBody },
  stepBtnPlusText: { color: COLORS.white },
  stepCenter: { alignItems: 'center', gap: 2 },
  weightValue: { fontSize: 24, fontWeight: '700', color: COLORS.textHeading },
  loadHint: { fontSize: 12, color: COLORS.textHint },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.cardBg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 14,
  },
  infoIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.primaryLightBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoText: { flex: 1, gap: 2 },
  infoLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textHeading },
  infoSub: { fontSize: 12, color: COLORS.textMuted },
  priceDivider: {
    borderTopWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    marginVertical: 4,
  },
  priceCard: { gap: 8 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  priceRowLabel: { fontSize: 14, color: COLORS.textBody },
  priceRowValue: { fontSize: 14, color: COLORS.textBody },
  totalRow: { borderTopWidth: 1, borderColor: COLORS.border, paddingTop: 8, marginTop: 4 },
  totalLabel: { fontSize: 15, fontWeight: '700', color: COLORS.textHeading },
  totalValue: { fontSize: 18, fontWeight: '700', color: COLORS.textHeading },
});
