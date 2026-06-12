import { useCallback, useEffect, useState } from 'react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import {
  IconCurrencyDollar, IconShoppingCart, IconBuilding, IconBike,
} from '@tabler/icons-react';
import { useAuth } from '../auth';
import {
  getSummary, getDailySeries, getActivity,
  type AdminSummary, type DailySeries, type ActivityEvent,
} from '../api';
import { KpiCard } from '../components/KpiCard';
import { formatKip, timeAgo } from '../utils';
import { COLORS } from '../theme';

const LEVEL_COLOR = { info: '#2563EB', warn: '#D97706', error: '#DC2626' };
const RECON_PIE_COLORS = ['#16A34A', '#D97706', '#DC2626', '#94A3B8'];

export function Dashboard() {
  const { token } = useAuth();
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [daily, setDaily] = useState<DailySeries[]>([]);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);

  const load = useCallback(async () => {
    const [s, d, a] = await Promise.all([getSummary(token), getDailySeries(token), getActivity(token)]);
    setSummary(s);
    setDaily(d);
    setActivity(a);
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const reconPie = summary
    ? [
        { name: 'ຖືກຕ້ອງ', value: summary.recon.matched },
        { name: 'ກວດສອບ', value: summary.recon.review },
        { name: 'ສົງໄສ', value: summary.recon.suspicious },
        { name: 'ຫາຍ', value: summary.recon.orphan },
      ]
    : [];

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
        <KpiCard label="ລາຍຮັບມື້ນີ້" value={summary ? formatKip(summary.revenueToday) : '—'} accentColor={COLORS.primary} icon={<IconCurrencyDollar size={20} />} />
        <KpiCard label="ການສັ່ງ (active)" value={summary?.activeOrders ?? '—'} accentColor={COLORS.purple} icon={<IconShoppingCart size={20} />} />
        <KpiCard label="ສາຂາ" value={summary?.branches ?? '—'} accentColor={COLORS.cyan} icon={<IconBuilding size={20} />} />
        <KpiCard label="ໄດຣເວີ (online)" value={summary?.driversAvailable ?? '—'} accentColor="#16A34A" icon={<IconBike size={20} />} />
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 20 }}>
        {/* Revenue line chart */}
        <div style={{ background: '#FFFFFF', borderRadius: 14, border: '1px solid #E2E8F0', padding: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: '#0F172A' }}>ລາຍຮັບ 7 ວັນ</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={daily}>
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${(v / 1_000_000).toFixed(1)}M`} />
              <Tooltip formatter={(v: number) => [formatKip(v), 'ລາຍຮັບ']} />
              <Line type="monotone" dataKey="revenue" stroke={COLORS.primary} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Recon donut */}
        <div style={{ background: '#FFFFFF', borderRadius: 14, border: '1px solid #E2E8F0', padding: 20 }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 700, color: '#0F172A' }}>ສະລິບ Recon</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={reconPie} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value">
                {reconPie.map((_, i) => <Cell key={i} fill={RECON_PIE_COLORS[i]} />)}
              </Pie>
              <Legend iconType="circle" iconSize={10} />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Orders bar + Activity feed */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }}>
        {/* Orders bar chart */}
        <div style={{ background: '#FFFFFF', borderRadius: 14, border: '1px solid #E2E8F0', padding: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: '#0F172A' }}>ການສັ່ງ 7 ວັນ</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={daily}>
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => [v, 'ການສັ່ງ']} />
              <Bar dataKey="orders" fill={COLORS.purple} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Activity feed */}
        <div style={{ background: '#FFFFFF', borderRadius: 14, border: '1px solid #E2E8F0', padding: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: '#0F172A' }}>ກິດຈະກຳ</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {activity.map((ev) => (
              <div key={ev.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: LEVEL_COLOR[ev.level], marginTop: 6, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: '#0F172A' }}>{ev.message}</div>
                  <div style={{ fontSize: 11, color: '#94A3B8' }}>{timeAgo(ev.at)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
