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
import { useAuth } from '../../src/auth';
import { COLORS } from '../../src/theme';

function decodeJwt(token: string): Record<string, unknown> {
  try {
    const part = token.split('.')[1] ?? '';
    const padded = part + '=='.slice(0, (4 - (part.length % 4)) % 4);
    return JSON.parse(atob(padded.replace(/-/g, '+').replace(/_/g, '/'))) as Record<string, unknown>;
  } catch { return {}; }
}

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

interface MenuRow { icon: IoniconsName; label: string; danger?: boolean }

const MENU: MenuRow[] = [
  { icon: 'document-text-outline', label: 'ເງື່ອນໄຂ & ນະໂຍບາຍ' },
  { icon: 'help-circle-outline', label: 'ຊ່ວຍເຫຼືອ' },
  { icon: 'star-outline', label: 'ໃຫ້ຄະແນນແອັບ' },
];

export default function DriverProfileScreen() {
  const { token, logout } = useAuth();
  const jwtData = token ? decodeJwt(token) : {};
  const name = (jwtData.name ?? jwtData.preferred_username ?? 'ໄດຣເວີ') as string;
  const phone = (jwtData.phone_number ?? '+856 20 XX XXX XXX') as string;

  function handleLogout() {
    Alert.alert('ອອກຈາກລະບົບ', 'ທ່ານແນ່ໃຈບໍ?', [
      { text: 'ຍົກເລີກ', style: 'cancel' },
      { text: 'ອອກ', style: 'destructive', onPress: () => void logout() },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>ໂປຣໄຟລ໌</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.phone}>{phone}</Text>
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={16} color={COLORS.warning} />
            <Text style={styles.rating}>4.8</Text>
            <Text style={styles.ratingCount}>(124 ຄຳຕິຊົມ)</Text>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          {[
            { label: 'ເທີ່ຍວທັງໝົດ', value: '312' },
            { label: 'ເດືອນນີ້', value: '28' },
            { label: 'ຍົກເລີກ', value: '2' },
          ].map((s) => (
            <View key={s.label} style={styles.statTile}>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Vehicle info */}
        <View style={styles.vehicleCard}>
          <Ionicons name="bicycle-outline" size={22} color={COLORS.primary} />
          <View style={styles.vehicleText}>
            <Text style={styles.vehicleName}>Honda Wave 125</Text>
            <Text style={styles.vehiclePlate}>ທ 1234 ວຈ</Text>
          </View>
        </View>

        {/* Menu */}
        <View style={styles.menuSection}>
          {MENU.map((row) => (
            <Pressable key={row.label} style={styles.menuRow}>
              <View style={styles.menuIconWrap}>
                <Ionicons name={row.icon} size={20} color={COLORS.body} />
              </View>
              <Text style={styles.menuLabel}>{row.label}</Text>
              <Ionicons name="chevron-forward" size={16} color={COLORS.hint} />
            </Pressable>
          ))}
        </View>

        <Pressable style={styles.signOutRow} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color={COLORS.danger} />
          <Text style={styles.signOutText}>ອອກຈາກລະບົບ</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  title: { fontSize: 20, fontWeight: '700', color: COLORS.heading },
  content: { padding: 20, gap: 16, paddingBottom: 48 },
  avatarSection: { alignItems: 'center', paddingVertical: 8, gap: 6 },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 28, fontWeight: '700', color: COLORS.primary },
  name: { fontSize: 20, fontWeight: '700', color: COLORS.heading },
  phone: { fontSize: 14, color: COLORS.muted },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  rating: { fontSize: 16, fontWeight: '700', color: COLORS.heading },
  ratingCount: { fontSize: 13, color: COLORS.muted },
  statsRow: { flexDirection: 'row', gap: 10 },
  statTile: {
    flex: 1, backgroundColor: COLORS.card,
    borderRadius: 12, borderWidth: 1, borderColor: COLORS.border,
    padding: 14, alignItems: 'center', gap: 4,
  },
  statValue: { fontSize: 18, fontWeight: '700', color: COLORS.heading },
  statLabel: { fontSize: 12, color: COLORS.muted },
  vehicleCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.card, borderRadius: 14,
    borderWidth: 1, borderColor: COLORS.border, padding: 16,
  },
  vehicleText: { flex: 1 },
  vehicleName: { fontSize: 14, fontWeight: '700', color: COLORS.heading },
  vehiclePlate: { fontSize: 13, color: COLORS.muted },
  menuSection: {
    backgroundColor: COLORS.card, borderRadius: 14,
    borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden',
  },
  menuRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderBottomWidth: 1, borderBottomColor: COLORS.divider,
  },
  menuIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: COLORS.divider, alignItems: 'center', justifyContent: 'center',
  },
  menuLabel: { flex: 1, fontSize: 14, fontWeight: '500', color: COLORS.heading },
  signOutRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FEF2F2', borderRadius: 12, padding: 14,
  },
  signOutText: { color: COLORS.danger, fontWeight: '600', fontSize: 15 },
});
