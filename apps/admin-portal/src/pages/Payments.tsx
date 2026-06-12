import { useCallback, useEffect, useState } from 'react';
import { IconCheck, IconX } from '@tabler/icons-react';
import { useAuth } from '../auth';
import { listPayments, approvePayment, rejectPayment, type Payment } from '../api';
import { Badge } from '../components/Badge';
import { formatKip, timeAgo } from '../utils';
import { COLORS } from '../theme';

export function Payments() {
  const { token } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'REVIEW' | 'ALL'>('REVIEW');

  const load = useCallback(async () => {
    setLoading(true);
    setPayments(await listPayments(token));
    setLoading(false);
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  async function handleApprove(id: string) {
    setProcessingId(id);
    await approvePayment(token, id);
    setPayments((prev) => prev.map((p) => p.id === id ? { ...p, status: 'APPROVED' } : p));
    setProcessingId(null);
  }

  async function handleReject(id: string) {
    setProcessingId(id);
    await rejectPayment(token, id, rejectReasons[id] ?? 'Manual rejection');
    setPayments((prev) => prev.map((p) => p.id === id ? { ...p, status: 'REJECTED' } : p));
    setProcessingId(null);
  }

  const displayed = activeTab === 'REVIEW' ? payments.filter((p) => p.status === 'REVIEW') : payments;

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {(['REVIEW', 'ALL'] as const).map((t) => (
          <button key={t} onClick={() => setActiveTab(t)} style={{ padding: '7px 16px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, backgroundColor: activeTab === t ? COLORS.primary : '#F1F5F9', color: activeTab === t ? '#fff' : '#475569' }}>
            {t === 'REVIEW' ? `ລໍຖ້າກວດ (${payments.filter((p) => p.status === 'REVIEW').length})` : 'ທັງໝົດ'}
          </button>
        ))}
      </div>

      {loading && <div style={{ color: '#94A3B8', textAlign: 'center', padding: 40 }}>ກຳລັງໂຫຼດ...</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {displayed.map((payment) => {
          const isProcessing = processingId === payment.id;
          const conf = payment.ocrConfidence;
          const confColor = conf == null ? '#94A3B8' : conf >= 90 ? '#16A34A' : conf >= 75 ? '#D97706' : '#DC2626';
          const needsAction = payment.status === 'REVIEW';

          return (
            <div key={payment.id} style={{ background: '#FFFFFF', borderRadius: 14, border: '1px solid #E2E8F0', padding: 18, display: 'flex', flexDirection: 'column', gap: 12, opacity: isProcessing ? 0.5 : 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: '#0F172A' }}>{formatKip(payment.amount)}</div>
                  <div style={{ fontSize: 13, color: '#64748B' }}>{payment.customerName} · {payment.bank} · {timeAgo(payment.submittedAt)}</div>
                </div>
                <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                  <Badge status={payment.status} />
                  {conf != null && <span style={{ fontSize: 12, fontWeight: 700, color: confColor }}>OCR {conf}%</span>}
                </div>
              </div>

              {needsAction && (
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <input placeholder="ເຫດຜົນປະຕິເສດ..." value={rejectReasons[payment.id] ?? ''} onChange={(e) => setRejectReasons((prev) => ({ ...prev, [payment.id]: e.target.value }))} style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 13 }} />
                  <button onClick={() => void handleReject(payment.id)} disabled={isProcessing} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 8, border: '1px solid #E2E8F0', backgroundColor: '#FEF2F2', color: '#DC2626', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
                    <IconX size={14} /> ປະຕິເສດ
                  </button>
                  <button onClick={() => void handleApprove(payment.id)} disabled={isProcessing} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 8, border: 'none', backgroundColor: COLORS.primary, color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
                    <IconCheck size={14} /> ອະນຸມັດ
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {!loading && displayed.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#94A3B8' }}>✓ ບໍ່ມີລາຍການລໍຖ້າ</div>
        )}
      </div>
    </div>
  );
}
