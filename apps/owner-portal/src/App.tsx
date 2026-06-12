import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { LoginPage } from './pages/LoginPage';
import { Dashboard } from './pages/Dashboard';
import { Machines } from './pages/Machines';
import { Orders } from './pages/Orders';
import { SlipReview } from './pages/SlipReview';
import { Settlements } from './pages/Settlements';

const PAGE_TITLES: Record<string, string> = {
  '/': 'ໜ້າຫຼັກ',
  '/machines': 'ເຄື່ອງ',
  '/orders': 'ການສັ່ງ',
  '/slips': 'ສະລິບ',
  '/settlements': 'ການຊຳລະ',
};

function Shell() {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#F8FAFC' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Routes>
          <Route
            path="/*"
            element={
              <TitledShell>
                <Routes>
                  <Route index element={<Dashboard />} />
                  <Route path="machines" element={<Machines />} />
                  <Route path="orders" element={<Orders />} />
                  <Route path="slips" element={<SlipReview />} />
                  <Route path="settlements" element={<Settlements />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </TitledShell>
            }
          />
        </Routes>
      </div>
    </div>
  );
}

function TitledShell({ children }: { children: React.ReactNode }) {
  const path = window.location.pathname;
  const title = PAGE_TITLES[path] ?? 'SmartWash';
  return (
    <>
      <TopBar title={title} />
      <main style={{ flex: 1, overflowY: 'auto' }}>{children}</main>
    </>
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
