import { useCallback, useEffect, useState } from 'react';
import { IconStar } from '@tabler/icons-react';
import { useAuth } from '../auth';
import { listDrivers, type Driver } from '../api';
import { Badge } from '../components/Badge';

export function Drivers() {
  const { token } = useAuth();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setDrivers(await listDrivers(token));
    setLoading(false);
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const onlineCount = drivers.filter((d) => d.status === 'ONLINE').length;

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 16, fontSize: 14, color: '#64748B' }}>
        {onlineCount} / {drivers.length} ຄົນ online
      </div>
      <div style={{ background: '#FFFFFF', borderRadius: 14, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
              {['ຊື່', 'ໂທລະສັບ', 'ສາຂາ', 'ຄະແນນ', 'ເທີ່ຍວ', 'ສະຖານະ'].map((h) => (
                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#475569', fontSize: 12, textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: '#94A3B8' }}>ກຳລັງໂຫຼດ...</td></tr>
            ) : drivers.map((d) => (
              <tr key={d.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#1D4ED8', fontSize: 14, flexShrink: 0 }}>
                      {d.name.charAt(0)}
                    </div>
                    <span style={{ fontWeight: 600, color: '#0F172A' }}>{d.name}</span>
                  </div>
                </td>
                <td style={{ padding: '12px 16px', color: '#64748B' }}>{d.phone}</td>
                <td style={{ padding: '12px 16px', color: '#64748B' }}>{d.branchName}</td>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <IconStar size={14} color="#F59E0B" fill="#F59E0B" />
                    <span style={{ fontWeight: 600, color: '#0F172A' }}>{d.rating.toFixed(1)}</span>
                  </div>
                </td>
                <td style={{ padding: '12px 16px', color: '#0F172A', fontWeight: 600 }}>{d.tripsTotal}</td>
                <td style={{ padding: '12px 16px' }}><Badge status={d.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
