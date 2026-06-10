/** SmartWash Admin Portal — Phase 5 ops dashboard incl. reconciliation status. */
import { useState, type CSSProperties } from 'react';
import { api, type AdminSummary, type ReconRun } from './api';

export function App() {
  const [token, setToken] = useState('');
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [runs, setRuns] = useState<ReconRun[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [s, r] = await Promise.all([api.summary(token), api.reconciliation(token)]);
      setSummary(s);
      setRuns(r);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <h1 style={styles.h1}>SmartWash · Admin</h1>
      <div style={styles.row}>
        <input
          style={styles.input}
          placeholder="Access token"
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
        <button style={styles.button} onClick={load} disabled={!token}>
          Load
        </button>
      </div>
      {loading && <p style={styles.muted}>Loading…</p>}
      {error && <p style={styles.error}>{error}</p>}
      {summary && (
        <>
          <div style={styles.grid}>
            <Kpi label="Revenue today (₭)" value={summary.revenueToday.toLocaleString()} />
            <Kpi label="Active orders" value={summary.activeOrders} />
            <Kpi label="Branches" value={summary.branches} />
            <Kpi label="Drivers available" value={summary.driversAvailable} />
          </div>
          <h2 style={styles.h2}>Reconciliation (latest)</h2>
          <div style={styles.grid}>
            <Kpi label="Verified" value={summary.recon.matched} />
            <Kpi label="Review" value={summary.recon.review} accent="#FBBF24" />
            <Kpi label="Suspicious" value={summary.recon.suspicious} accent="#F87171" />
            <Kpi label="Orphan" value={summary.recon.orphan} accent="#F87171" />
          </div>
          <h2 style={styles.h2}>Recent recon runs</h2>
          <table style={styles.table}>
            <thead>
              <tr>
                {['Date', 'Branch', 'Verified', 'Review', 'Suspicious', 'Orphan', 'Status'].map((h) => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id}>
                  <td style={styles.td}>{r.reconDate.slice(0, 10)}</td>
                  <td style={styles.td}>{r.branchId?.slice(0, 8) ?? '—'}</td>
                  <td style={styles.td}>{r.matched}</td>
                  <td style={styles.td}>{r.review}</td>
                  <td style={styles.td}>{r.suspicious}</td>
                  <td style={styles.td}>{r.orphan}</td>
                  <td style={styles.td}>{r.status}</td>
                </tr>
              ))}
              {runs.length === 0 && (
                <tr><td style={styles.td} colSpan={7}>No runs yet</td></tr>
              )}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div style={styles.card}>
      <div style={{ ...styles.kpiValue, color: accent ?? '#F8FAFC' }}>{value}</div>
      <div style={styles.kpiLabel}>{label}</div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: { fontFamily: 'system-ui, sans-serif', background: '#0F172A', color: '#E2E8F0', minHeight: '100vh', margin: 0, padding: 24 },
  h1: { color: '#0EA5E9' },
  h2: { color: '#E2E8F0', marginTop: 28 },
  row: { display: 'flex', gap: 8, marginBottom: 20 },
  input: { background: '#1E293B', color: '#F8FAFC', border: '1px solid #334155', borderRadius: 8, padding: '10px 12px', minWidth: 280 },
  button: { background: '#0EA5E9', color: '#fff', border: 0, borderRadius: 8, padding: '10px 16px', cursor: 'pointer' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 },
  card: { background: '#1E293B', borderRadius: 12, padding: 20 },
  kpiValue: { fontSize: 30, fontWeight: 700 },
  kpiLabel: { color: '#94A3B8', marginTop: 6 },
  table: { width: '100%', borderCollapse: 'collapse', marginTop: 12 },
  th: { textAlign: 'left', color: '#94A3B8', borderBottom: '1px solid #334155', padding: 8 },
  td: { borderBottom: '1px solid #1E293B', padding: 8 },
  muted: { color: '#94A3B8' },
  error: { color: '#F87171' },
};
