import { useCallback, useEffect, useState } from 'react';
import { IconCheck, IconX } from '@tabler/icons-react';
import { useAuth } from '../auth';
import { listSlips, approveSlip, rejectSlip, type Slip } from '../api';
import { formatKip, timeAgo } from '../utils';
import { COLORS } from '../theme';

export function SlipReview() {
  const { token } = useAuth();
  const [slips, setSlips] = useState<Slip[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});
  const [processingId, setProcessingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setSlips(await listSlips(token));
    setLoading(false);
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  async function handleApprove(slipId: string) {
    setProcessingId(slipId);
    await approveSlip(token, slipId);
    setSlips((prev) => prev.filter((s) => s.id !== slipId));
    setProcessingId(null);
  }

  async function handleReject(slipId: string) {
    const reason = rejectReason[slipId] ?? 'Manual rejection';
    setProcessingId(slipId);
    await rejectSlip(token, slipId, reason);
    setSlips((prev) => prev.filter((s) => s.id !== slipId));
    setProcessingId(null);
  }

  return (
    <div style={{ padding: 24 }}>
      {loading && <div style={{ color: '#94A3B8', textAlign: 'center', padding: 40 }}>ກຳລັງໂຫຼດ...</div>}

      {!loading && slips.length === 0 && (
        <div
          style={{
            textAlign: 'center', padding: '60px 0', color: '#94A3B8',
            fontSize: 15,
          }}
        >
          ✓ ບໍ່ມີສະລິບລໍຖ້າ
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {slips.map((slip) => {
          const conf = slip.ocrConfidence;
          const confColor = conf >= 90 ? '#16A34A' : conf >= 75 ? '#D97706' : '#DC2626';
          const isProcessing = processingId === slip.id;

          return (
            <div
              key={slip.id}
              style={{
                background: '#FFFFFF', borderRadius: 14,
                border: '1px solid #E2E8F0', padding: 20,
                display: 'flex', flexDirection: 'column', gap: 14,
                opacity: isProcessing ? 0.5 : 1,
              }}
            >
              <div style={{ display: 'flex', gap: 16 }}>
                {/* Slip image placeholder */}
                <div
                  style={{
                    width: 80, height: 100, borderRadius: 8,
                    backgroundColor: '#F1F5F9', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, color: '#94A3B8', border: '1px solid #E2E8F0',
                  }}
                >
                  {slip.slipUrl ? (
                    <img src={slip.slipUrl} alt="slip" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }} />
                  ) : 'ໂນ Image'}
                </div>

                {/* Details */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 16, color: '#0F172A' }}>
                        {formatKip(slip.amount)}
                      </div>
                      <div style={{ fontSize: 13, color: '#64748B' }}>
                        {slip.customerName} · {slip.bank}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: confColor }}>
                        OCR {conf}%
                      </div>
                      <div style={{ fontSize: 11, color: '#94A3B8' }}>
                        {timeAgo(slip.submittedAt)}
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      backgroundColor: conf < 75 ? '#FFF7ED' : '#F8FAFC',
                      borderRadius: 8, padding: '8px 10px',
                      fontSize: 12, color: '#475569',
                    }}
                  >
                    {slip.ocrReason}
                  </div>

                  <div style={{ fontSize: 12, color: '#94A3B8' }}>Ref: {slip.qrRef}</div>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input
                  placeholder="ເຫດຜົນປະຕິເສດ..."
                  value={rejectReason[slip.id] ?? ''}
                  onChange={(e) =>
                    setRejectReason((prev) => ({ ...prev, [slip.id]: e.target.value }))
                  }
                  style={{
                    flex: 1, padding: '8px 12px', borderRadius: 8,
                    border: '1px solid #E2E8F0', fontSize: 13, color: '#0F172A',
                  }}
                />
                <button
                  onClick={() => void handleReject(slip.id)}
                  disabled={isProcessing}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '9px 14px', borderRadius: 8,
                    border: '1px solid #E2E8F0', backgroundColor: '#FEF2F2',
                    color: '#DC2626', fontWeight: 600, cursor: 'pointer', fontSize: 13,
                  }}
                >
                  <IconX size={14} /> ປະຕິເສດ
                </button>
                <button
                  onClick={() => void handleApprove(slip.id)}
                  disabled={isProcessing}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '9px 16px', borderRadius: 8,
                    border: 'none', backgroundColor: COLORS.primary,
                    color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 13,
                  }}
                >
                  <IconCheck size={14} /> ອະນຸມັດ
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
