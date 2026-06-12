import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth';
import { listBranches, type Branch } from '../api';
import { formatKip } from '../utils';

export function Branches() {
  const { token } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setBranches(await listBranches(token));
    setLoading(false);
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {branches.map((b) => (
          <div key={b.id} style={{ background: '#FFFFFF', borderRadius: 14, border: '1px solid #E2E8F0', padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: '#2563EB' }}>
                {b.name.charAt(0)}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, color: '#0F172A' }}>{b.name}</div>
                <div style={{ fontSize: 12, color: '#64748B' }}>{b.city}</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Row label="ເຄື່ອງ" value={String(b.machineCount)} />
              <Row label="ການສັ່ງ (active)" value={String(b.activeOrders)} />
              <Row label="ລາຍຮັບເດືອນ" value={formatKip(b.revenueMonth)} bold />
            </div>
          </div>
        ))}
        {!loading && branches.length === 0 && (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px 0', color: '#94A3B8' }}>ບໍ່ພົບສາຂາ</div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 13, color: '#64748B' }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: bold ? 700 : 500, color: '#0F172A' }}>{value}</span>
    </div>
  );
}
