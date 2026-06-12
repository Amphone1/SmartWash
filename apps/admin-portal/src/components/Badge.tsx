import { STATUS_COLORS } from '../theme';

const LABEL: Record<string, string> = {
  PENDING: 'ລໍຖ້າ', REVIEW: 'ກວດສອບ', APPROVED: 'ອະນຸມັດ', REJECTED: 'ປະຕິເສດ',
  MATCHED: 'ຖືກຕ້ອງ', SUSPICIOUS: 'ສົງໄສ', ORPHAN: 'ຫາຍ',
  ONLINE: 'ໃນລະບົບ', OFFLINE: 'ອອຟລາຍ',
  DONE: 'ສຳເລັດ', COMPLETED: 'ສຳເລັດ', CANCELLED: 'ຍົກເລີກ',
  WASHING: 'ກຳລັງຊັກ', RUNNING: 'ກຳລັງ', IN_TRANSIT: 'ກຳລັງສົ່ງ',
};

export function Badge({ status, label }: { status: string; label?: string }) {
  const colors = STATUS_COLORS[status] ?? { bg: '#F1F5F9', text: '#475569' };
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center',
        padding: '2px 10px', borderRadius: 20,
        fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
        backgroundColor: colors.bg, color: colors.text,
      }}
    >
      {label ?? LABEL[status] ?? status}
    </span>
  );
}
