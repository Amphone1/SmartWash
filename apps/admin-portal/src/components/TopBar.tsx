import { IconBell } from '@tabler/icons-react';
import { useAuth } from '../auth';

export function TopBar({ title }: { title: string }) {
  const { user } = useAuth();
  return (
    <header style={{ height: 64, backgroundColor: '#FFFFFF', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', flexShrink: 0, position: 'sticky', top: 0, zIndex: 10 }}>
      <h1 style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', margin: 0 }}>{title}</h1>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', padding: 6, borderRadius: 8 }}>
          <IconBell size={20} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 20, backgroundColor: '#F1F5F9' }}>
          <div style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#1D4ED8' }}>
            {user?.name?.charAt(0)?.toUpperCase() ?? 'A'}
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>{user?.name ?? 'Admin'}</span>
        </div>
      </div>
    </header>
  );
}
