import { useCallback, useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import {
  IconCurrencyDollar,
  IconShoppingCart,
  IconWashMachine,
  IconClockHour4,
} from '@tabler/icons-react';
import { useAuth } from '../auth';
import {
  getSummary, listMachines, listSlips, getHourlyStats,
  type OwnerSummary, type MachineCard, type Slip, type HourlyBucket,
} from '../api';
import { KpiCard } from '../components/KpiCard';
import { Badge } from '../components/Badge';
import { formatKip, formatDate } from '../utils';
import { COLORS } from '../theme';


export function Dashboard() {
  const { token } = useAuth();
  const [summary, setSummary] = useState<OwnerSummary | null>(null);
  const [machines, setMachines] = useState<MachineCard[]>([]);
  const [slips, setSlips] = useState<Slip[]>([]);
  const [hourly, setHourly] = useState<HourlyBucket[]>([]);

  const load = useCallback(async () => {
    const [s, m, sl, h] = await Promise.all([
      getSummary(token),
      listMachines(token),
      listSlips(token),
      getHourlyStats(token),
    ]);
    setSummary(s);
    setMachines(m);
    setSlips(sl);
    setHourly(h);
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
        <KpiCard
          label="ລາຍຮັບມື້ນີ້"
          value={summary ? formatKip(summary.revenueToday) : '—'}
          accentColor={COLORS.primary}
          icon={<IconCurrencyDollar size={20} />}
        />
        <KpiCard
          label="ການສັ່ງມື້ນີ້"
          value={summary?.ordersToday ?? '—'}
          accentColor="#7C3AED"
          icon={<IconShoppingCart size={20} />}
        />
        <KpiCard
          label="ການໃຊ້ງານເຄື່ອງ"
          value={summary ? `${summary.machineUtilPct}%` : '—'}
          accentColor="#0EA5E9"
          icon={<IconWashMachine size={20} />}
        />
        <KpiCard
          label="ການຊຳລະຄັ້ງຕໍ່ໄປ"
          value={summary ? formatKip(summary.nextSettlementKip) : '—'}
          delta={summary ? formatDate(summary.nextSettlementDate) : undefined}
          accentColor="#16A34A"
          icon={<IconClockHour4 size={20} />}
        />
      </div>

      {/* Machines grid + Hourly chart row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20 }}>
        {/* Machine grid */}
        <div style={{ background: '#FFFFFF', borderRadius: 14, border: '1px solid #E2E8F0', padding: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: '#0F172A' }}>
            ເຄື່ອງ ({machines.length})
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
            {machines.map((m) => (
              <MachineCell key={m.id} machine={m} />
            ))}
          </div>
        </div>

        {/* Hourly bar chart */}
        <div style={{ background: '#FFFFFF', borderRadius: 14, border: '1px solid #E2E8F0', padding: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: '#0F172A' }}>
            ການສັ່ງຕາມຊົ່ວໂມງ
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={hourly} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
              <XAxis dataKey="hour" tick={{ fontSize: 11 }} tickFormatter={(h: number) => `${h}h`} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => [v, 'ການສັ່ງ']} labelFormatter={(l) => `${l}:00`} />
              <Bar dataKey="ordersCount" fill={COLORS.primary} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Pending slips */}
      {slips.length > 0 && (
        <div style={{ background: '#FFFFFF', borderRadius: 14, border: '1px solid #E2E8F0', padding: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: '#0F172A' }}>
            ສະລິບລໍຖ້າ ({slips.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {slips.slice(0, 4).map((slip) => (
              <SlipRow key={slip.id} slip={slip} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MachineCell({ machine }: { machine: MachineCard }) {
  return (
    <div
      style={{
        borderRadius: 12, border: '1.5px solid',
        borderColor: machine.state === 'IDLE' ? '#16A34A'
          : machine.state === 'ERROR' ? '#DC2626'
          : '#E2E8F0',
        backgroundColor: machine.state === 'IDLE' ? '#F0FDF4'
          : machine.state === 'ERROR' ? '#FEF2F2'
          : '#FFFFFF',
        padding: '12px 14px',
        display: 'flex', flexDirection: 'column', gap: 6,
        opacity: machine.state === 'MAINTENANCE' ? 0.6 : 1,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 700, fontSize: 14, color: '#0F172A' }}>{machine.code}</span>
        <Badge status={machine.state} />
      </div>
      <span style={{ fontSize: 12, color: '#64748B' }}>
        {machine.type === 'WASHER' ? 'ຊັກ' : 'ອົບ'} {machine.capacityKg}kg
      </span>
      {machine.state === 'RUNNING' && machine.progressPct != null && (
        <div>
          <div style={{ height: 4, borderRadius: 2, backgroundColor: '#DBEAFE' }}>
            <div
              style={{ height: 4, borderRadius: 2, backgroundColor: '#2563EB', width: `${machine.progressPct}%` }}
            />
          </div>
          <span style={{ fontSize: 11, color: '#64748B' }}>{machine.minutesLeft}ນ ເຫຼືອ</span>
        </div>
      )}
      {machine.errorCode && (
        <span style={{ fontSize: 11, color: '#DC2626' }}>{machine.errorCode}</span>
      )}
    </div>
  );
}

function SlipRow({ slip }: { slip: Slip }) {
  const conf = slip.ocrConfidence;
  const confColor = conf >= 90 ? '#16A34A' : conf >= 75 ? '#D97706' : '#DC2626';
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '10px 14px', borderRadius: 10,
        border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC',
      }}
    >
      <div style={{ flex: 1 }}>
        <span style={{ fontWeight: 600, color: '#0F172A', fontSize: 14 }}>{slip.customerName}</span>
        <span style={{ color: '#64748B', fontSize: 13, marginLeft: 8 }}>{formatKip(slip.amount)}</span>
      </div>
      <span style={{ fontSize: 12, color: confColor, fontWeight: 600 }}>OCR {conf}%</span>
      <span style={{ fontSize: 12, color: '#94A3B8' }}>{slip.bank}</span>
    </div>
  );
}
