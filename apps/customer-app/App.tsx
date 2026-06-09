/**
 * SmartWash customer app — Phase 1 minimal flow:
 *   token → service selection → branch list → machine list.
 * Intentionally tiny (no nav library); state machine via `step`.
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
import { api, type Branch, type Machine } from './src/api';

type Step = 'token' | 'service' | 'branches' | 'machines';
const SERVICES = [
  { id: 'self_service', label: 'Self-service wash' },
  { id: 'pickup', label: 'Pickup & wash' },
  { id: 'delivery', label: 'Pickup & delivery' },
] as const;

export default function App() {
  const [step, setStep] = useState<Step>('token');
  const [token, setToken] = useState('');
  const [service, setService] = useState<string | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branch, setBranch] = useState<Branch | null>(null);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadBranches = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setBranches(await api.listBranches(token));
      setStep('branches');
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [token]);

  const loadMachines = useCallback(
    async (b: Branch) => {
      setLoading(true);
      setError(null);
      try {
        setBranch(b);
        setMachines(await api.listMachines(token, b.id));
        setStep('machines');
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    },
    [token],
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <Text style={styles.title}>SmartWash</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? <ActivityIndicator color="#0EA5E9" /> : null}

      {step === 'token' && (
        <View style={styles.block}>
          <Text style={styles.label}>Paste your access token</Text>
          <TextInput
            style={styles.input}
            value={token}
            onChangeText={setToken}
            placeholder="Bearer token"
            autoCapitalize="none"
          />
          <Button
            label="Continue"
            disabled={token.length === 0}
            onPress={() => setStep('service')}
          />
        </View>
      )}

      {step === 'service' && (
        <View style={styles.block}>
          <Text style={styles.label}>Choose a service</Text>
          {SERVICES.map((s) => (
            <Button
              key={s.id}
              label={s.label}
              onPress={() => {
                setService(s.id);
                void loadBranches();
              }}
            />
          ))}
        </View>
      )}

      {step === 'branches' && (
        <View style={styles.flex}>
          <Text style={styles.label}>Nearby branches ({service})</Text>
          <FlatList
            data={branches}
            keyExtractor={(b) => b.id}
            renderItem={({ item }) => (
              <Pressable style={styles.row} onPress={() => void loadMachines(item)}>
                <Text style={styles.rowTitle}>{item.name}</Text>
                <Text style={styles.rowSub}>{item.nameLao ?? ''}</Text>
              </Pressable>
            )}
            ListEmptyComponent={<Text style={styles.rowSub}>No open branches</Text>}
          />
        </View>
      )}

      {step === 'machines' && (
        <View style={styles.flex}>
          <Text style={styles.label}>Machines at {branch?.name}</Text>
          <FlatList
            data={machines}
            keyExtractor={(m) => m.id}
            renderItem={({ item }) => (
              <View style={styles.row}>
                <Text style={styles.rowTitle}>
                  {item.code} · {item.type} · {item.capacityKg}kg
                </Text>
                <Text style={styles.rowSub}>
                  {item.price.toLocaleString()} ₭ · {item.state}
                </Text>
              </View>
            )}
            ListEmptyComponent={<Text style={styles.rowSub}>No machines</Text>}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

function Button(props: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      style={[styles.button, props.disabled && styles.buttonDisabled]}
      onPress={props.disabled ? undefined : props.onPress}
    >
      <Text style={styles.buttonText}>{props.label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A', padding: 20 },
  flex: { flex: 1, width: '100%' },
  block: { gap: 12 },
  title: { color: '#0EA5E9', fontSize: 28, fontWeight: '700', marginBottom: 16 },
  label: { color: '#E2E8F0', fontSize: 16, marginBottom: 8 },
  input: {
    backgroundColor: '#1E293B',
    color: '#F8FAFC',
    borderRadius: 8,
    padding: 12,
  },
  button: {
    backgroundColor: '#0EA5E9',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  buttonDisabled: { backgroundColor: '#334155' },
  buttonText: { color: '#fff', fontWeight: '600' },
  row: {
    backgroundColor: '#1E293B',
    borderRadius: 8,
    padding: 14,
    marginBottom: 8,
  },
  rowTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '600' },
  rowSub: { color: '#94A3B8', marginTop: 4 },
  error: { color: '#F87171', marginBottom: 8 },
});
