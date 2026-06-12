import { STATUS_COLORS } from '../theme';

interface BadgeProps {
  status: string;
  label?: string;
}

const STATUS_LABEL: Record<string, string> = {
  IDLE: 'ວ່າງ', RUNNING: 'ກຳລັງຊັກ', RESERVED: 'ຈອງ', MAINTENANCE: 'ບຳລຸງ', ERROR: 'ຜິດພາດ',
  PENDING: 'ລໍຖ້າ', WASHING: 'ກຳລັງຊັກ', DONE: 'ສຳເລັດ', COMPLETED: 'ສຳເລັດ',
  CANCELLED: 'ຍົກເລີກ', IN_TRANSIT: 'ກຳລັງສົ່ງ', DELIVERED: 'ຈັດສົ່ງແລ້ວ',
  PAID: 'ຊຳລະແລ້ວ', APPROVED: 'ອະນຸມັດ', REJECTED: 'ປະຕິເສດ', ACTIVE: 'ໃຊ້ງານ',
  OFFLINE: 'ອອຟລາຍ',
};

export function Badge({ status, label }: BadgeProps) {
  const colors = STATUS_COLORS[status] ?? { bg: '#F1F5F9', text: '#475569' };
  const display = label ?? STATUS_LABEL[status] ?? status;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 10px',
        borderRadius: 20,
        fontSize: 12,
        fontWeight: 600,
        backgroundColor: colors.bg,
        color: colors.text,
        whiteSpace: 'nowrap',
      }}
    >
      {display}
    </span>
  );
}
