import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/auth';
import { api, type Notification } from '../src/api';
import Card from '../src/components/Card';
import { COLORS } from '../src/theme';
import { errorMessage } from '../src/utils';

const TYPE_ICON: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  ORDER_STARTED: 'play-circle-outline',
  ORDER_COMPLETED: 'checkmark-circle-outline',
  PAYMENT_APPROVED: 'wallet-outline',
  PAYMENT_REJECTED: 'close-circle-outline',
  DELIVERY_ASSIGNED: 'car-outline',
  DELIVERY_ARRIVED: 'flag-outline',
};

function NotifCard({ notif }: { notif: Notification }) {
  const icon = TYPE_ICON[notif.type] ?? 'notifications-outline';
  const isUnread = !notif.readAt;

  return (
    <Card style={[styles.card, isUnread && styles.cardUnread]}>
      <View style={[styles.iconWrap, isUnread && styles.iconWrapUnread]}>
        <Ionicons
          name={icon}
          size={20}
          color={isUnread ? COLORS.primary : COLORS.textMuted}
        />
      </View>
      <View style={styles.body}>
        <Text style={[styles.notifTitle, isUnread && styles.notifTitleUnread]}>
          {notif.title}
        </Text>
        <Text style={styles.notifBody} numberOfLines={2}>{notif.body}</Text>
        <Text style={styles.notifTime}>
          {new Date(notif.createdAt).toLocaleString('lo-LA', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
          })}
        </Text>
      </View>
      {isUnread && <View style={styles.dot} />}
    </Card>
  );
}

export default function NotificationsScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setNotifs(await api.listNotifications(token));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  async function handleMarkAll() {
    if (!token) return;
    try {
      await api.markAllRead(token);
      setNotifs((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    } catch { /* silent */ }
  }

  const unreadCount = notifs.filter((n) => !n.readAt).length;
  const unread = notifs.filter((n) => !n.readAt);
  const read = notifs.filter((n) => n.readAt);

  type Section = { type: 'header'; label: string } | { type: 'item'; notif: Notification };
  const sections: Section[] = [
    ...(unread.length > 0
      ? [{ type: 'header' as const, label: `ໃໝ່ (${unread.length})` }, ...unread.map((n) => ({ type: 'item' as const, notif: n }))]
      : []),
    ...(read.length > 0
      ? [{ type: 'header' as const, label: 'ອ່ານແລ້ວ' }, ...read.map((n) => ({ type: 'item' as const, notif: n }))]
      : []),
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textHeading} />
        </Pressable>
        <Text style={styles.title}>ການແຈ້ງເຕືອນ</Text>
        {unreadCount > 0 && (
          <Pressable onPress={handleMarkAll} style={styles.markAllBtn}>
            <Text style={styles.markAllText}>ອ່ານທັງໝົດ</Text>
          </Pressable>
        )}
      </View>

      {loading && <ActivityIndicator color={COLORS.primary} style={styles.loader} />}
      {error && <Text style={styles.error}>{error}</Text>}

      <FlatList
        data={sections}
        keyExtractor={(item, idx) =>
          item.type === 'header' ? `h-${idx}` : item.notif.id
        }
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          if (item.type === 'header') {
            return <Text style={styles.sectionLabel}>{item.label}</Text>;
          }
          return <NotifCard notif={item.notif} />;
        }}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Ionicons name="notifications-off-outline" size={48} color={COLORS.textHint} />
              <Text style={styles.emptyText}>ບໍ່ມີການແຈ້ງເຕືອນ</Text>
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
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12,
  },
  backBtn: { padding: 4 },
  title: { flex: 1, fontSize: 18, fontWeight: '700', color: COLORS.textHeading },
  markAllBtn: { paddingVertical: 4, paddingHorizontal: 8 },
  markAllText: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },
  loader: { marginTop: 40 },
  error: { color: COLORS.red, textAlign: 'center', margin: 16 },
  list: { padding: 16, gap: 8, paddingBottom: 40 },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textHint, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 8, marginBottom: 4 },
  card: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14 },
  cardUnread: { borderColor: COLORS.primaryLightBg2 },
  iconWrap: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: COLORS.divider,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  iconWrapUnread: { backgroundColor: COLORS.primaryLightBg },
  body: { flex: 1, gap: 2 },
  notifTitle: { fontSize: 14, fontWeight: '500', color: COLORS.textBody },
  notifTitleUnread: { fontWeight: '700', color: COLORS.textHeading },
  notifBody: { fontSize: 13, color: COLORS.textMuted, lineHeight: 18 },
  notifTime: { fontSize: 11, color: COLORS.textHint, marginTop: 4 },
  dot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: COLORS.primary, marginTop: 4, flexShrink: 0,
  },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15, color: COLORS.textMuted },
});
