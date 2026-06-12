import { NavLink, useNavigate } from 'react-router-dom';
import {
  IconLayoutDashboard,
  IconWashMachine,
  IconReceipt,
  IconFileText,
  IconCash,
  IconLogout,
} from '@tabler/icons-react';
import { useAuth } from '../auth';
import { COLORS } from '../theme';

interface NavItem {
  to: string;
  icon: React.ReactNode;
  label: string;
}

const NAV: NavItem[] = [
  { to: '/', icon: <IconLayoutDashboard size={20} />, label: 'ໜ້າຫຼັກ' },
  { to: '/machines', icon: <IconWashMachine size={20} />, label: 'ເຄື່ອງ' },
  { to: '/orders', icon: <IconReceipt size={20} />, label: 'ການສັ່ງ' },
  { to: '/slips', icon: <IconFileText size={20} />, label: 'ສະລິບ' },
  { to: '/settlements', icon: <IconCash size={20} />, label: 'ການຊຳລະ' },
];

export function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <aside
      style={{
        width: 232,
        minHeight: '100vh',
        backgroundColor: '#0F172A',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}
    >
      {/* Logo */}
      <div style={{ padding: '24px 20px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 36, height: 36, borderRadius: 10,
              backgroundColor: COLORS.primary,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: 16, color: '#fff',
            }}
          >
            SW
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#F8FAFC' }}>SmartWash</div>
            <div style={{ fontSize: 11, color: '#94A3B8' }}>Owner Portal</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '0 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '9px 12px',
              borderRadius: 10,
              textDecoration: 'none',
              fontSize: 14,
              fontWeight: isActive ? 600 : 400,
              color: isActive ? '#fff' : '#94A3B8',
              backgroundColor: isActive ? COLORS.primary : 'transparent',
              transition: 'background 0.15s',
            })}
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* User block */}
      <div
        style={{
          padding: '16px 16px 24px',
          borderTop: '1px solid #1E293B',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <div
          style={{
            width: 32, height: 32, borderRadius: 16,
            backgroundColor: '#1E293B',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#94A3B8', fontSize: 14, fontWeight: 700, flexShrink: 0,
          }}
        >
          {user?.name?.charAt(0)?.toUpperCase() ?? 'O'}
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#F8FAFC', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {user?.name ?? 'Owner'}
          </div>
          <div style={{ fontSize: 11, color: '#64748B' }}>Branch Admin</div>
        </div>
        <button
          onClick={handleLogout}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', padding: 4 }}
          title="ອອກຈາກລະບົບ"
        >
          <IconLogout size={18} />
        </button>
      </div>
    </aside>
  );
}
