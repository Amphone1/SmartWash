import { useEffect, useState } from 'react';
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
import { COLORS } from '../../src/theme';
import { errorMessage } from '../../src/utils';

type DeliveryOption = 'standard' | 'express';

const OPTIONS: { key: DeliveryOption; label: string; eta: string; price: number }[] = [
  { key: 'standard', label: 'ມາດຕະຖານ', eta: '2–4 ຊົ່ວໂມງ', price: 15_000 },
  { key: 'express', label: 'ດ່ວນ', eta: '1 ຊົ່ວໂມງ', price: 30_000 },
];

const TIME_SLOTS = ['08:00–10:00', '10:00–12:00', '13:00–15:00', '15:00–17:00', '17:00–19:00'];

interface AddressItem {
  id: string;
  label: string;
  address: string;
  lat: number;
  lng: number;
}

// Shown until the user saves real addresses (GET /bff/addresses).
const DEFAULT_ADDRESSES: AddressItem[] = [
  { id: 'a1', label: 'ບ້ານ', address: '18 ຖ. ສາຍລົມ, ວຽງຈັນ', lat: 17.975, lng: 102.633 },
  { id: 'a2', label: 'ຫ້ອງການ', address: '5 ຖ. ລ້ານຊ້າງ, ວຽງຈັນ', lat: 17.968, lng: 102.612 },
];

export default function RequestDeliveryScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const { orderId } = useLocalSearchParams<{ orderId?: string }>();

  const [option, setOption] = useState<DeliveryOption>('standard');
  const [addresses, setAddresses] = useState<AddressItem[]>(DEFAULT_ADDRESSES);
  const [addressId, setAddressId] = useState(DEFAULT_ADDRESSES[0].id);
  const [slot, setSlot] = useState(TIME_SLOTS[0]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) return;
    api
      .listAddresses(token)
      .then((saved) => {
        if (saved.length > 0) {
          setAddresses(saved);
          setAddressId(saved.find((a) => a.isDefault)?.id ?? saved[0].id);
        }
      })
      .catch(() => {
        // keep the defaults when the address list is unavailable
      });
  }, [token]);

  const selectedAddr = addresses.find((a) => a.id === addressId) ?? addresses[0];

  async function handleRequest() {
    if (!token || !orderId) {
      Alert.alert('ຂໍ້ຜິດພາດ', 'ບໍ່ພົບ Order ID');
      return;
    }
    setLoading(true);
    try {
      const delivery = await api.requestDelivery(token, orderId, {
        pickup: { addr: selectedAddr.address, lat: selectedAddr.lat, lng: selectedAddr.lng },
        dropoff: { addr: selectedAddr.address, lat: selectedAddr.lat, lng: selectedAddr.lng },
      });
      router.replace(`/delivery/track?deliveryId=${delivery.id}`);
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
        <Text style={styles.title}>ຂໍຮັບ-ສົ່ງ</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Delivery options */}
        <Text style={styles.sectionLabel}>ປະເພດການຈັດສົ່ງ</Text>
        <View style={styles.optionRow}>
          {OPTIONS.map((o) => (
            <Pressable
              key={o.key}
              style={[styles.optCard, option === o.key && styles.optCardSelected]}
              onPress={() => setOption(o.key)}
            >
              <Ionicons
                name={o.key === 'express' ? 'flash-outline' : 'bicycle-outline'}
                size={24}
                color={option === o.key ? COLORS.primary : COLORS.textMuted}
              />
              <Text style={[styles.optLabel, option === o.key && styles.optLabelSelected]}>
                {o.label}
              </Text>
              <Text style={styles.optEta}>{o.eta}</Text>
              <Text style={[styles.optPrice, option === o.key && styles.optPriceSelected]}>
                ₭{o.price.toLocaleString()}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Address */}
        <Text style={styles.sectionLabel}>ທີ່ຢູ່ຈັດສົ່ງ</Text>
        <View style={styles.addrList}>
          {addresses.map((addr) => (
            <Pressable
              key={addr.id}
              style={[styles.addrRow, addressId === addr.id && styles.addrRowSelected]}
              onPress={() => setAddressId(addr.id)}
            >
              <View style={[styles.addrIcon, addressId === addr.id && styles.addrIconSelected]}>
                <Ionicons
                  name="location-outline"
                  size={18}
                  color={addressId === addr.id ? COLORS.primary : COLORS.textMuted}
                />
              </View>
              <View style={styles.addrText}>
                <Text style={styles.addrLabel}>{addr.label}</Text>
                <Text style={styles.addrSub} numberOfLines={1}>{addr.address}</Text>
              </View>
              {addressId === addr.id && (
                <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />
              )}
            </Pressable>
          ))}
          <Pressable style={styles.addAddrRow}>
            <Ionicons name="add-circle-outline" size={20} color={COLORS.primary} />
            <Text style={styles.addAddrText}>ເພີ່ມທີ່ຢູ່ໃໝ່</Text>
          </Pressable>
        </View>

        {/* Time slot */}
        <Text style={styles.sectionLabel}>ເວລາຮັບ</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.slotRow}>
          {TIME_SLOTS.map((s) => (
            <Pressable
              key={s}
              style={[styles.slotChip, slot === s && styles.slotChipSelected]}
              onPress={() => setSlot(s)}
            >
              <Text style={[styles.slotText, slot === s && styles.slotTextSelected]}>{s}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Map placeholder */}
        <Card style={styles.mapCard}>
          <Ionicons name="map-outline" size={32} color={COLORS.textHint} />
          <Text style={styles.mapHint}>ແຜນທີ່ (Google Maps integration)</Text>
        </Card>

        <Button
          label={loading ? 'ກຳລັງດຳເນີນ...' : 'ຢືນຢັນການຮັບ-ສົ່ງ'}
          onPress={handleRequest}
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
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12,
  },
  backBtn: { padding: 4 },
  title: { fontSize: 18, fontWeight: '700', color: COLORS.textHeading },
  content: { padding: 20, gap: 16, paddingBottom: 48 },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textMuted },
  optionRow: { flexDirection: 'row', gap: 12 },
  optCard: {
    flex: 1, backgroundColor: COLORS.cardBg,
    borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: 14, padding: 14, alignItems: 'center', gap: 6,
  },
  optCardSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLightBg },
  optLabel: { fontSize: 14, fontWeight: '600', color: COLORS.textBody },
  optLabelSelected: { color: COLORS.primary },
  optEta: { fontSize: 12, color: COLORS.textHint },
  optPrice: { fontSize: 15, fontWeight: '700', color: COLORS.textHeading },
  optPriceSelected: { color: COLORS.primary },
  addrList: {
    backgroundColor: COLORS.cardBg, borderRadius: 14,
    borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden',
  },
  addrRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderBottomWidth: 1, borderBottomColor: COLORS.divider,
  },
  addrRowSelected: { backgroundColor: COLORS.primaryLightBg },
  addrIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: COLORS.divider, alignItems: 'center', justifyContent: 'center',
  },
  addrIconSelected: { backgroundColor: COLORS.primaryLightBg2 },
  addrText: { flex: 1 },
  addrLabel: { fontSize: 14, fontWeight: '600', color: COLORS.textHeading },
  addrSub: { fontSize: 12, color: COLORS.textMuted },
  addAddrRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 14,
  },
  addAddrText: { fontSize: 14, color: COLORS.primary, fontWeight: '500' },
  slotRow: { gap: 8, paddingBottom: 4 },
  slotChip: {
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 20, borderWidth: 1.5, borderColor: COLORS.border,
    backgroundColor: COLORS.cardBg,
  },
  slotChipSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLightBg },
  slotText: { fontSize: 13, color: COLORS.textBody },
  slotTextSelected: { color: COLORS.primary, fontWeight: '600' },
  mapCard: { height: 140, alignItems: 'center', justifyContent: 'center', gap: 8 },
  mapHint: { fontSize: 13, color: COLORS.textHint },
});
