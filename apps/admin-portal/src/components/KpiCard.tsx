interface KpiCardProps {
  label: string;
  value: string | number;
  delta?: string;
  accentColor?: string;
  icon?: React.ReactNode;
}

export function KpiCard({ label, value, delta, accentColor = '#2563EB', icon }: KpiCardProps) {
  return (
    <div
      style={{
        background: '#FFFFFF', borderRadius: 14,
        border: '1px solid #E2E8F0', padding: '20px 22px',
        display: 'flex', flexDirection: 'column', gap: 8,
        borderLeftWidth: 4, borderLeftStyle: 'solid', borderLeftColor: accentColor,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 13, color: '#64748B', fontWeight: 500 }}>{label}</span>
        {icon && <span style={{ color: accentColor, opacity: 0.7 }}>{icon}</span>}
      </div>
      <span style={{ fontSize: 26, fontWeight: 700, color: '#0F172A', lineHeight: 1 }}>{value}</span>
      {delta && (
        <span style={{ fontSize: 12, color: delta.startsWith('+') ? '#16A34A' : '#DC2626', fontWeight: 600 }}>
          {delta}
        </span>
      )}
    </div>
  );
}
