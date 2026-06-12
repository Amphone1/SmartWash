import { useCallback, useEffect, useState } from 'react';
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
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/auth';
import { api, type WalletBalance } from '../../src/api';
import { COLORS } from '../../src/theme';
import { formatKip } from '../../src/utils';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

interface MenuRow {
  icon: IoniconsName;
  label: string;
  route?: string;
  badge?: number;
  danger?: boolean;
}

const MENU_ROWS: MenuRow[] = [
  { icon: 'location-outline', label: 'ທີ່ຢູ່ຂອງຂ້ອຍ' },
  { icon: 'receipt-outline', label: 'ປະຫວັດການສັ່ງ', route: '/(tabs)/orders' },
  { icon: 'notifications-outline', label: 'ການແຈ້ງເຕືອນ', badge: 3, route: '/notifications' },
  { icon: 'help-circle-outline', label: 'ຊ່ວຍເຫຼືອ' },
];

export default function ProfileScreen() {
  const { token, logout } = useAuth();
  const router = useRouter();
  const [wallet, setWallet] = useState<WalletBalance | null>(null);

  const loadWallet = useCallback(async () => {
    if (!token) return;
    try {
      setWallet(await api.getWallet(token));
    } catch {
      // non-critical
    }
  }, [token]);

  useEffect(() => { void loadWallet(); }, [loadWallet]);

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
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>ລຄ</Text>
          </View>
          <Text style={styles.name}>ທ. ລູກຄ້າ</Text>
          <Text style={styles.phone}>+856 20 XX XXX XXX</Text>
        </View>

        {/* Wallet card */}
        <Pressable style={styles.walletCard} onPress={() => router.push('/topup')}>
          <View>
            <Text style={styles.walletLabel}>ຍອດຄົງເຫຼືອ</Text>
            <Text style={styles.walletBalance}>
              {wallet ? formatKip(wallet.balanceKip) : '—'}
            </Text>
          </View>
          <Pressable
            style={styles.topupBtn}
            onPress={() => router.push('/topup')}
          >
            <Ionicons name="add" size={16} color={COLORS.primary} />
            <Text style={styles.topupBtnText}>ເຕີມເງິນ</Text>
          </Pressable>
        </Pressable>

        {/* Stats */}
        <View style={styles.statsRow}>
          {[
            { label: 'ການສັ່ງ', value: '24' },
            { label: 'ເດືອນນີ້', value: '3' },
            { label: 'ທັງໝົດ', value: '₭2.4M' },
          ].map((s) => (
            <View key={s.label} style={styles.statTile}>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Menu */}
        <View style={styles.menuSection}>
          {MENU_ROWS.map((row) => (
            <Pressable
              key={row.label}
              style={styles.menuRow}
              onPress={() => row.route && router.push(row.route as never)}
            >
              <View style={styles.menuIconWrap}>
                <Ionicons name={row.icon} size={20} color={COLORS.textBody} />
              </View>
              <Text style={styles.menuLabel}>{row.label}</Text>
              {row.badge != null && (
                <View style={styles.notifBadge}>
                  <Text style={styles.notifBadgeText}>{row.badge}</Text>
                </View>
              )}
              <Ionicons name="chevron-forward" size={16} color={COLORS.textHint} />
            </Pressable>
          ))}
        </View>

        {/* Sign out */}
        <Pressable style={styles.signOutRow} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color={COLORS.red} />
          <Text style={styles.signOutText}>ອອກຈາກລະບົບ</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  title: { fontSize: 20, fontWeight: '700', color: COLORS.textHeading },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  avatarSection: { alignItems: 'center', paddingVertical: 8, gap: 6 },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.primaryLightBg2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 22, fontWeight: '700', color: COLORS.primaryDarkText },
  name: { fontSize: 18, fontWeight: '700', color: COLORS.textHeading },
  phone: { fontSize: 14, color: COLORS.textMuted },
  walletCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  walletLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginBottom: 4 },
  walletBalance: { color: COLORS.white, fontSize: 28, fontWeight: '700' },
  topupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.white,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  topupBtnText: { color: COLORS.primary, fontWeight: '700', fontSize: 14 },
  statsRow: { flexDirection: 'row', gap: 12 },
  statTile: {
    flex: 1,
    backgroundColor: COLORS.cardBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    alignItems: 'center',
    gap: 4,
  },
  statValue: { fontSize: 18, fontWeight: '700', color: COLORS.textHeading },
  statLabel: { fontSize: 12, color: COLORS.textMuted },
  menuSection: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  menuIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: { flex: 1, fontSize: 14, fontWeight: '500', color: COLORS.textHeading },
  notifBadge: {
    backgroundColor: COLORS.red,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  notifBadgeText: { color: COLORS.white, fontSize: 11, fontWeight: '700' },
  signOutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 14,
  },
  signOutText: { color: COLORS.red, fontWeight: '600', fontSize: 15 },
});
