import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth';
import { listSettlements, type Settlement } from '../api';
import { Badge } from '../components/Badge';
import { formatKip, formatDate } from '../utils';

export function Settlements() {
  const { token } = useAuth();
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setSettlements(await listSettlements(token));
    setLoading(false);
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const totalPaid = settlements
    .filter((s) => s.status === 'PAID')
    .reduce((sum, s) => sum + s.netKip, 0);

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Summary */}
      <div
        style={{
          background: '#FFFFFF', borderRadius: 14,
          border: '1px solid #E2E8F0', padding: '18px 22px',
          display: 'flex', gap: 32,
        }}
      >
        <div>
          <div style={{ fontSize: 12, color: '#64748B', marginBottom: 4 }}>ຊຳລະແລ້ວທັງໝົດ</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#0F172A' }}>{formatKip(totalPaid)}</div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: '#64748B', marginBottom: 4 }}>ຈຳນວນຮອບ</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#0F172A' }}>{settlements.length}</div>
        </div>
      </div>

      {/* Table */}
      <div
        style={{
          background: '#FFFFFF', borderRadius: 14,
          border: '1px solid #E2E8F0', overflow: 'hidden',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
              {['ໄລຍະ', 'ລາຍຮັບ', 'ຄ່ານາຍ (10%)', 'ສຸດທິ', 'ສະຖານະ', 'ວັນທີຊຳລະ'].map((h) => (
                <th
                  key={h}
                  style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#475569', fontSize: 12 }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: 40, color: '#94A3B8' }}>
                  ກຳລັງໂຫຼດ...
                </td>
              </tr>
            ) : (
              settlements.map((s) => (
                <tr key={s.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '12px 16px', color: '#0F172A' }}>
                    {formatDate(s.periodStart)} – {formatDate(s.periodEnd)}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#475569' }}>{formatKip(s.revenueKip)}</td>
                  <td style={{ padding: '12px 16px', color: '#DC2626' }}>-{formatKip(s.commissionKip)}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 700, color: '#0F172A' }}>{formatKip(s.netKip)}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <Badge status={s.status} />
                  </td>
                  <td style={{ padding: '12px 16px', color: '#94A3B8', fontSize: 12 }}>
                    {s.paidAt ? formatDate(s.paidAt) : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
