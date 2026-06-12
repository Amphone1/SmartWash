import { useCallback, useEffect, useState } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useAuth } from '../auth';
import { getDailySeries, getRecon, type DailySeries, type ReconRun } from '../api';
import { formatKip, formatDate } from '../utils';
import { COLORS } from '../theme';

export function Analytics() {
  const { token } = useAuth();
  const [daily, setDaily] = useState<DailySeries[]>([]);
  const [recon, setRecon] = useState<ReconRun[]>([]);

  const load = useCallback(async () => {
    const [d, r] = await Promise.all([getDailySeries(token), getRecon(token)]);
    setDaily(d);
    setRecon(r);
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Revenue trend */}
      <div style={{ background: '#FFFFFF', borderRadius: 14, border: '1px solid #E2E8F0', padding: 20 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: '#0F172A' }}>ລາຍຮັບ 7 ວັນ (₭)</h3>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={daily}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${(v / 1_000_000).toFixed(1)}M`} />
            <Tooltip formatter={(v: number) => [formatKip(v), 'ລາຍຮັບ']} />
            <Line type="monotone" dataKey="revenue" stroke={COLORS.primary} strokeWidth={2} dot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Orders trend */}
      <div style={{ background: '#FFFFFF', borderRadius: 14, border: '1px solid #E2E8F0', padding: 20 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: '#0F172A' }}>ການສັ່ງ 7 ວັນ</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={daily}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => [v, 'ການສັ່ງ']} />
            <Bar dataKey="orders" fill={COLORS.purple} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Recon table */}
      <div style={{ background: '#FFFFFF', borderRadius: 14, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0' }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0F172A' }}>Reconciliation Runs</h3>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
              {['ວັນທີ', 'ສາຂາ', 'ຖືກຕ້ອງ', 'ກວດ', 'ສົງໄສ', 'ຫາຍ', 'ສະຖານະ'].map((h) => (
                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#475569', fontSize: 12, textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {recon.map((r) => (
              <tr key={r.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                <td style={{ padding: '12px 16px', color: '#0F172A' }}>{formatDate(r.reconDate)}</td>
                <td style={{ padding: '12px 16px', color: '#64748B' }}>{r.branchId?.slice(0, 8) ?? '—'}</td>
                <td style={{ padding: '12px 16px', fontWeight: 600, color: '#16A34A' }}>{r.matched}</td>
                <td style={{ padding: '12px 16px', color: '#D97706' }}>{r.review}</td>
                <td style={{ padding: '12px 16px', color: '#DC2626' }}>{r.suspicious}</td>
                <td style={{ padding: '12px 16px', color: '#DC2626' }}>{r.orphan}</td>
                <td style={{ padding: '12px 16px', color: '#16A34A', fontWeight: 600 }}>{r.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
