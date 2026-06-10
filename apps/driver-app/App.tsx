/**
 * SmartWash driver app — Phase 4 minimal flow:
 *   token → list assigned deliveries → accept/advance/complete + report location.
 */
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { api, type Delivery } from './src/api';

// Next driver-driven state for a given delivery state.
const NEXT: Record<string, { to: string; label: string } | undefined> = {
  ACCEPTED: { to: 'EN_ROUTE_PICKUP', label: 'Head to pickup' },
  EN_ROUTE_PICKUP: { to: 'PICKED_UP', label: 'Picked up' },
  PICKED_UP: { to: 'IN_TRANSIT', label: 'In transit' },
  IN_TRANSIT: { to: 'DELIVERED', label: 'Delivered' },
};

export default function App() {
  const [token, setToken] = useState('');
  const [signedIn, setSignedIn] = useState(false);
  const [items, setItems] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await api.deliveries(token));
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [token]);

  const act = useCallback(
    async (fn: () => Promise<unknown>) => {
      setError(null);
      try {
        await fn();
        await refresh();
      } catch (e) {
        setError(String(e));
      }
    },
    [refresh],
  );

  if (!signedIn) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <Text style={styles.title}>SmartWash Driver</Text>
        <Text style={styles.label}>Paste your access token</Text>
        <TextInput
          style={styles.input}
          value={token}
          onChangeText={setToken}
          placeholder="Bearer token"
          autoCapitalize="none"
        />
        <Button
          label="Sign in"
          disabled={token.length === 0}
          onPress={() => {
            setSignedIn(true);
            void refresh();
          }}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.headerRow}>
        <Text style={styles.title}>My Deliveries</Text>
        <Button label="↻" onPress={() => void refresh()} small />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? <ActivityIndicator color="#16A34A" /> : null}
      <Button
        label="Report location (demo)"
        onPress={() => void act(() => api.reportLocation(token, 17.97, 102.61))}
        small
      />
      <FlatList
        style={styles.flex}
        data={items}
        keyExtractor={(d) => d.id}
        renderItem={({ item }) => {
          const next = NEXT[item.state];
          return (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                {item.state} · {item.fee.toLocaleString()} ₭
              </Text>
              <Text style={styles.cardSub}>
                {item.pickup.addr ?? 'pickup'} → {item.dropoff.addr ?? 'dropoff'}
              </Text>
              <View style={styles.actions}>
                {item.state === 'ASSIGNED' && (
                  <>
                    <Button label="Accept" onPress={() => void act(() => api.accept(token, item.id))} small />
                    <Button label="Reject" onPress={() => void act(() => api.reject(token, item.id))} small />
                  </>
                )}
                {next && (
                  <Button
                    label={next.label}
                    onPress={() => void act(() => api.advance(token, item.id, next.to))}
                    small
                  />
                )}
                {item.state === 'DELIVERED' && (
                  <Button label="Complete" onPress={() => void act(() => api.complete(token, item.id))} small />
                )}
              </View>
            </View>
          );
        }}
        ListEmptyComponent={<Text style={styles.cardSub}>No deliveries</Text>}
      />
    </SafeAreaView>
  );
}

function Button(props: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  small?: boolean;
}) {
  return (
    <Pressable
      style={[
        styles.button,
        props.small && styles.buttonSmall,
        props.disabled && styles.buttonDisabled,
      ]}
      onPress={props.disabled ? undefined : props.onPress}
    >
      <Text style={styles.buttonText}>{props.label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A', padding: 20, gap: 10 },
  flex: { flex: 1, width: '100%' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: '#16A34A', fontSize: 24, fontWeight: '700' },
  label: { color: '#E2E8F0', fontSize: 16 },
  input: { backgroundColor: '#1E293B', color: '#F8FAFC', borderRadius: 8, padding: 12 },
  button: { backgroundColor: '#16A34A', borderRadius: 8, padding: 12, alignItems: 'center' },
  buttonSmall: { paddingVertical: 8, paddingHorizontal: 12 },
  buttonDisabled: { backgroundColor: '#334155' },
  buttonText: { color: '#fff', fontWeight: '600' },
  card: { backgroundColor: '#1E293B', borderRadius: 8, padding: 14, marginBottom: 8 },
  cardTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '600' },
  cardSub: { color: '#94A3B8', marginTop: 4 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  error: { color: '#F87171' },
});
