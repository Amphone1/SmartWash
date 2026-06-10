/** SmartWash Owner Portal — Phase 5 minimal KPI dashboard. */
import { useState, type CSSProperties } from 'react';
import { fetchOwnerSummary, type OwnerSummary } from './api';

export function App() {
  const [token, setToken] = useState('');
  const [branchId, setBranchId] = useState('');
  const [summary, setSummary] = useState<OwnerSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setSummary(await fetchOwnerSummary(token, branchId));
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <h1 style={styles.h1}>SmartWash · Owner</h1>
      <div style={styles.row}>
        <input
          style={styles.input}
          placeholder="Access token"
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
        <input
          style={styles.input}
          placeholder="Branch ID (uuid)"
          value={branchId}
          onChange={(e) => setBranchId(e.target.value)}
        />
        <button style={styles.button} onClick={load} disabled={!token || !branchId}>
          Load
        </button>
      </div>
      {loading && <p style={styles.muted}>Loading…</p>}
      {error && <p style={styles.error}>{error}</p>}
      {summary && (
        <div style={styles.grid}>
          <Kpi label="Revenue today (₭)" value={summary.revenueToday.toLocaleString()} />
          <Kpi label="Orders today" value={summary.ordersToday} />
          <Kpi label="Machines active" value={`${summary.machinesActive}/${summary.machinesTotal}`} />
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={styles.card}>
      <div style={styles.kpiValue}>{value}</div>
      <div style={styles.kpiLabel}>{label}</div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: { fontFamily: 'system-ui, sans-serif', background: '#0F172A', color: '#E2E8F0', minHeight: '100vh', margin: 0, padding: 24 },
  h1: { color: '#0EA5E9' },
  row: { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 },
  input: { background: '#1E293B', color: '#F8FAFC', border: '1px solid #334155', borderRadius: 8, padding: '10px 12px', minWidth: 240 },
  button: { background: '#0EA5E9', color: '#fff', border: 0, borderRadius: 8, padding: '10px 16px', cursor: 'pointer' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 },
  card: { background: '#1E293B', borderRadius: 12, padding: 20 },
  kpiValue: { fontSize: 32, fontWeight: 700, color: '#F8FAFC' },
  kpiLabel: { color: '#94A3B8', marginTop: 6 },
  muted: { color: '#94A3B8' },
  error: { color: '#F87171' },
};
