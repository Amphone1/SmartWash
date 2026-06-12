import { useCallback, useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { api } from '../../src/api';
import { COLORS } from '../../src/theme';

export default function MapScreen() {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [permDenied, setPermDenied] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const updateLocation = useCallback(async () => {
    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = loc.coords;
      setCoords({ lat: latitude, lng: longitude });
      await api.updateLocation(latitude, longitude).catch(() => null);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    void (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setPermDenied(true);
        return;
      }
      await updateLocation();
      intervalRef.current = setInterval(() => void updateLocation(), 30_000);
    })();
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [updateLocation]);

  return (
    <SafeAreaView style={styles.safe}>
      {/* Map placeholder — replace with MapView once react-native-maps is added */}
      <View style={styles.mapArea}>
        <Ionicons name="map-outline" size={64} color={COLORS.hint} />
        {permDenied ? (
          <Text style={styles.hintText}>ຕ້ອງການສິດ GPS</Text>
        ) : coords ? (
          <Text style={styles.hintText}>
            {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
          </Text>
        ) : (
          <Text style={styles.hintText}>ກຳລັງຫາຕຳແໜ່ງ...</Text>
        )}
      </View>

      {/* Status pill */}
      <View style={styles.statusPill}>
        <View style={[styles.statusDot, coords && styles.statusDotOnline]} />
        <Text style={styles.statusText}>{coords ? 'Online' : 'Offline'}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  mapArea: {
    flex: 1,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  hintText: { fontSize: 14, color: COLORS.muted },
  statusPill: {
    position: 'absolute',
    bottom: 32,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.card,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  statusDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.hint },
  statusDotOnline: { backgroundColor: COLORS.success },
  statusText: { fontSize: 14, fontWeight: '600', color: COLORS.heading },
});
