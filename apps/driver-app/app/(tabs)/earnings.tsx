import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api, type EarningsData } from '../../src/api';
import { COLORS } from '../../src/theme';
import { formatKip } from '../../src/utils';

interface PeriodCard {
  label: string;
  amount: number;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  accent: string;
}

export default function EarningsScreen() {
  const [earnings, setEarnings] = useState<EarningsData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setEarnings(await api.getEarnings());
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const cards: PeriodCard[] = earnings
    ? [
        { label: 'ມື້ນີ້', amount: earnings.todayKip, icon: 'today-outline', accent: COLORS.primary },
        { label: 'ອາທິດ', amount: earnings.weekKip, icon: 'calendar-outline', accent: COLORS.success },
        { label: 'ເດືອນ', amount: earnings.monthKip, icon: 'wallet-outline', accent: '#7C3AED' },
      ]
    : [];

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>ລາຍໄດ້</Text>
      </View>

      {loading && <ActivityIndicator color={COLORS.primary} style={styles.loader} />}

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Period cards */}
        <View style={styles.cardsCol}>
          {cards.map((c) => (
            <View key={c.label} style={[styles.periodCard, { borderLeftColor: c.accent }]}>
              <View style={[styles.cardIcon, { backgroundColor: c.accent + '20' }]}>
                <Ionicons name={c.icon} size={22} color={c.accent} />
              </View>
              <View style={styles.cardText}>
                <Text style={styles.cardLabel}>{c.label}</Text>
                <Text style={[styles.cardAmount, { color: c.accent }]}>
                  {formatKip(c.amount)}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Trips today */}
        {earnings && (
          <View style={styles.tripsRow}>
            <Ionicons name="bicycle-outline" size={20} color={COLORS.muted} />
            <Text style={styles.tripsText}>
              ເທີ່ຍວໄດ້ {earnings.tripsToday} ເທີ່ຍວວັນນີ້
            </Text>
          </View>
        )}

        {/* Placeholder chart area */}
        <View style={styles.chartPlaceholder}>
          <Ionicons name="bar-chart-outline" size={40} color={COLORS.hint} />
          <Text style={styles.chartHint}>ກຣາຟລາຍໄດ້ (7 ມື້)</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  title: { fontSize: 20, fontWeight: '700', color: COLORS.heading },
  loader: { marginTop: 40 },
  content: { padding: 20, gap: 16, paddingBottom: 48 },
  cardsCol: { gap: 12 },
  periodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderLeftWidth: 4,
    padding: 16,
  },
  cardIcon: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  cardText: { flex: 1, gap: 2 },
  cardLabel: { fontSize: 13, color: COLORS.muted },
  cardAmount: { fontSize: 24, fontWeight: '700' },
  tripsRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.card, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.border, padding: 14,
  },
  tripsText: { fontSize: 14, color: COLORS.body },
  chartPlaceholder: {
    height: 160, borderRadius: 14,
    borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  chartHint: { fontSize: 13, color: COLORS.hint },
});
