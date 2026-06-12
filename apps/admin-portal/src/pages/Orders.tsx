import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth';
import { listOrders, type AdminOrder } from '../api';
import { Badge } from '../components/Badge';
import { formatKip, formatDate } from '../utils';
import { COLORS } from '../theme';

const STATUS_OPTIONS = ['ALL', 'PENDING', 'WASHING', 'IN_TRANSIT', 'DONE', 'CANCELLED'];
const SERVICE_LABEL: Record<string, string> = {
  WASH: 'ຊັກ', DRY: 'ອົບ', WASH_DRY: 'ຊັກ+ອົບ',
  self_service: 'ຊັກເອງ', pickup: 'ຮັບ-ສົ່ງ', delivery: 'ຮັບ+ຈັດສົ່ງ',
};

export function Orders() {
  const { token } = useAuth();
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (s: string) => {
    setLoading(true);
    setOrders(await listOrders(token, s));
    setLoading(false);
  }, [token]);

  useEffect(() => { void load(statusFilter); }, [load, statusFilter]);

  const displayed = search
    ? orders.filter((o) =>
        o.id.toLowerCase().includes(search.toLowerCase()) ||
        o.customerName.toLowerCase().includes(search.toLowerCase())
      )
    : orders;

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          placeholder="ຄົ້ນຫາ Order # ຫຼື ລູກຄ້າ..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ padding: '8px 14px', borderRadius: 10, border: '1px solid #E2E8F0', fontSize: 14, color: '#0F172A', width: 240 }}
        />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {STATUS_OPTIONS.map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)} style={{ padding: '7px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, backgroundColor: statusFilter === s ? COLORS.primary : '#F1F5F9', color: statusFilter === s ? '#fff' : '#475569' }}>
              {s === 'ALL' ? 'ທັງໝົດ' : s}
            </button>
          ))}
        </div>
      </div>
      <div style={{ background: '#FFFFFF', borderRadius: 14, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
              {['Order #', 'ລູກຄ້າ', 'ສາຂາ', 'ບໍລິການ', 'ນ້ຳໜັກ', 'ລາຄາ', 'ວັນທີ', 'ສະຖານະ'].map((h) => (
                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#475569', fontSize: 12, textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: '#94A3B8' }}>ກຳລັງໂຫຼດ...</td></tr>
            ) : displayed.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: '#94A3B8' }}>ບໍ່ພົບການສັ່ງ</td></tr>
            ) : displayed.map((o) => (
              <tr key={o.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                <td style={{ padding: '12px 16px', fontWeight: 700, color: '#0F172A' }}>{o.id}</td>
                <td style={{ padding: '12px 16px', color: '#0F172A' }}>{o.customerName}</td>
                <td style={{ padding: '12px 16px', color: '#64748B' }}>{o.branchName}</td>
                <td style={{ padding: '12px 16px', color: '#64748B' }}>{SERVICE_LABEL[o.serviceType] ?? o.serviceType}</td>
                <td style={{ padding: '12px 16px', color: '#64748B' }}>{o.weightKg} kg</td>
                <td style={{ padding: '12px 16px', fontWeight: 600, color: '#0F172A' }}>{formatKip(o.pricePaid)}</td>
                <td style={{ padding: '12px 16px', color: '#94A3B8', fontSize: 12 }}>{formatDate(o.createdAt)}</td>
                <td style={{ padding: '12px 16px' }}><Badge status={o.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
