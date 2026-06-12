import { useCallback, useEffect, useState } from 'react';
import { IconRefresh } from '@tabler/icons-react';
import { useAuth } from '../auth';
import { listMachines, type MachineCard } from '../api';
import { Badge } from '../components/Badge';
import { COLORS } from '../theme';

const FILTERS = ['ALL', 'IDLE', 'RUNNING', 'RESERVED', 'ERROR', 'MAINTENANCE'] as const;
type Filter = (typeof FILTERS)[number];

const FILTER_LABEL: Record<Filter, string> = {
  ALL: 'ທັງໝົດ', IDLE: 'ວ່າງ', RUNNING: 'ກຳລັງຊັກ',
  RESERVED: 'ຈອງ', ERROR: 'ຜິດພາດ', MAINTENANCE: 'ບຳລຸງ',
};

export function Machines() {
  const { token } = useAuth();
  const [machines, setMachines] = useState<MachineCard[]>([]);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setMachines(await listMachines(token));
    setLoading(false);
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const displayed = filter === 'ALL' ? machines : machines.filter((m) => m.state === filter);

  return (
    <div style={{ padding: 24 }}>
      {/* Filter bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '7px 14px', borderRadius: 20, border: 'none',
                cursor: 'pointer', fontSize: 13, fontWeight: 600,
                backgroundColor: filter === f ? COLORS.primary : '#F1F5F9',
                color: filter === f ? '#fff' : '#475569',
              }}
            >
              {FILTER_LABEL[f]}
            </button>
          ))}
        </div>
        <button
          onClick={() => void load()}
          disabled={loading}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 10, border: '1px solid #E2E8F0',
            backgroundColor: '#fff', cursor: 'pointer', fontSize: 13, color: '#475569',
          }}
        >
          <IconRefresh size={16} />
          ອັບເດດ
        </button>
      </div>

      {/* Machine grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
        {displayed.map((machine) => (
          <MachineDetailCard key={machine.id} machine={machine} />
        ))}
      </div>

      {!loading && displayed.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#94A3B8', fontSize: 15 }}>
          ບໍ່ພົບເຄື່ອງ
        </div>
      )}
    </div>
  );
}

function MachineDetailCard({ machine }: { machine: MachineCard }) {
  return (
    <div
      style={{
        background: '#FFFFFF', borderRadius: 14,
        border: `2px solid ${machine.state === 'IDLE' ? '#16A34A' : machine.state === 'ERROR' ? '#DC2626' : '#E2E8F0'}`,
        padding: 18, display: 'flex', flexDirection: 'column', gap: 10,
        opacity: machine.state === 'MAINTENANCE' ? 0.65 : 1,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#0F172A' }}>{machine.code}</div>
          <div style={{ fontSize: 12, color: '#64748B' }}>
            {machine.type === 'WASHER' ? 'ເຄື່ອງຊັກ' : 'ເຄື່ອງອົບ'} · {machine.capacityKg} kg
          </div>
        </div>
        <Badge status={machine.state} />
      </div>

      {machine.state === 'RUNNING' && machine.progressPct != null && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ height: 6, borderRadius: 3, backgroundColor: '#DBEAFE' }}>
            <div
              style={{
                height: 6, borderRadius: 3, backgroundColor: '#2563EB',
                width: `${machine.progressPct}%`,
                transition: 'width 0.5s ease',
              }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#64748B' }}>
            <span>{machine.progressPct}%</span>
            <span>{machine.minutesLeft} ນາທີ ເຫຼືອ</span>
          </div>
          {machine.currentOrderId && (
            <span style={{ fontSize: 12, color: '#94A3B8' }}>{machine.currentOrderId}</span>
          )}
        </div>
      )}

      {machine.errorCode && (
        <div
          style={{
            backgroundColor: '#FEF2F2', borderRadius: 8,
            padding: '8px 10px', fontSize: 12, color: '#DC2626', fontWeight: 500,
          }}
        >
          {machine.errorCode}
        </div>
      )}
    </div>
  );
}
