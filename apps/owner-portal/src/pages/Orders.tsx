import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth';
import { listOrders, type Order } from '../api';
import { Badge } from '../components/Badge';
import { formatKip, formatDate } from '../utils';
import { COLORS } from '../theme';

const STATUS_OPTIONS = ['ALL', 'PENDING', 'WASHING', 'DONE', 'CANCELLED'];

const SERVICE_LABEL: Record<string, string> = {
  WASH: 'ຊັກ', DRY: 'ອົບ', WASH_DRY: 'ຊັກ+ອົບ',
  self_service: 'ຊັກເອງ', pickup: 'ຮັບ-ສົ່ງ', delivery: 'ຮັບ+ຈັດສົ່ງ',
};

export function Orders() {
  const { token } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (status: string) => {
    setLoading(true);
    setOrders(await listOrders(token, status));
    setLoading(false);
  }, [token]);

  useEffect(() => { void load(statusFilter); }, [load, statusFilter]);

  return (
    <div style={{ padding: 24 }}>
      {/* Filter row */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {STATUS_OPTIONS.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            style={{
              padding: '7px 14px', borderRadius: 20, border: 'none',
              cursor: 'pointer', fontSize: 13, fontWeight: 600,
              backgroundColor: statusFilter === s ? COLORS.primary : '#F1F5F9',
              color: statusFilter === s ? '#fff' : '#475569',
            }}
          >
            {s === 'ALL' ? 'ທັງໝົດ' : s}
          </button>
        ))}
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
              {['Order #', 'ລູກຄ້າ', 'ບໍລິການ', 'ນ້ຳໜັກ', 'ລາຄາ', 'ວັນທີ', 'ສະຖານະ'].map((h) => (
                <th
                  key={h}
                  style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#475569', fontSize: 12, textTransform: 'uppercase' }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: 40, color: '#94A3B8' }}>
                  ກຳລັງໂຫຼດ...
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: 40, color: '#94A3B8' }}>
                  ບໍ່ພົບການສັ່ງ
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr
                  key={order.id}
                  style={{ borderBottom: '1px solid #F1F5F9' }}
                >
                  <td style={{ padding: '12px 16px', fontWeight: 700, color: '#0F172A', fontVariantNumeric: 'tabular-nums' }}>
                    {order.id}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#0F172A' }}>{order.customerName}</td>
                  <td style={{ padding: '12px 16px', color: '#475569' }}>
                    {SERVICE_LABEL[order.serviceType] ?? order.serviceType}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#475569' }}>{order.weightKg} kg</td>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: '#0F172A' }}>
                    {formatKip(order.pricePaid)}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#94A3B8', fontSize: 12 }}>
                    {formatDate(order.createdAt)}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <Badge status={order.status} />
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
