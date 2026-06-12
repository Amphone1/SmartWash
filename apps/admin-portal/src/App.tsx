import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { LoginPage } from './pages/LoginPage';
import { Dashboard } from './pages/Dashboard';
import { Orders } from './pages/Orders';
import { Payments } from './pages/Payments';
import { Drivers } from './pages/Drivers';
import { Branches } from './pages/Branches';
import { Analytics } from './pages/Analytics';

const PAGE_TITLES: Record<string, string> = {
  '/': 'ໜ້າຫຼັກ',
  '/orders': 'ການສັ່ງ',
  '/payments': 'ການຊຳລະ',
  '/drivers': 'ໄດຣເວີ',
  '/branches': 'ສາຂາ',
  '/analytics': 'ສະຖິຕິ',
};

function Shell() {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  const title = PAGE_TITLES[window.location.pathname] ?? 'SmartWash Admin';
  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#F8FAFC' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <TopBar title={title} />
        <main style={{ flex: 1, overflowY: 'auto' }}>
          <Routes>
            <Route index element={<Dashboard />} />
            <Route path="orders" element={<Orders />} />
            <Route path="payments" element={<Payments />} />
            <Route path="drivers" element={<Drivers />} />
            <Route path="branches" element={<Branches />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/*" element={<Shell />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
