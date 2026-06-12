import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { errorMessage } from '../utils';
import { COLORS } from '../theme';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(username, password);
      navigate('/');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  function handleDemo() {
    setUsername('demo-owner');
    setPassword('demo');
  }

  return (
    <div
      style={{
        minHeight: '100vh', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: '#F8FAFC',
      }}
    >
      <div
        style={{
          width: '100%', maxWidth: 400,
          backgroundColor: '#FFFFFF',
          borderRadius: 20,
          border: '1px solid #E2E8F0',
          padding: 40,
          boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
        }}
      >
        {/* Logo */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
          <div
            style={{
              width: 60, height: 60, borderRadius: 16,
              backgroundColor: COLORS.primary,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: 22, color: '#fff',
            }}
          >
            SW
          </div>
        </div>

        <h2 style={{ textAlign: 'center', marginBottom: 6, fontSize: 22, fontWeight: 700, color: '#0F172A' }}>
          ລົງຊື່ເຂົ້າ
        </h2>
        <p style={{ textAlign: 'center', color: '#64748B', fontSize: 14, marginBottom: 28 }}>
          SmartWash Owner Portal
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>ຊື່ຜູ້ໃຊ້</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="ຊື່ຜູ້ໃຊ້"
              required
              style={inputStyle}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>ລະຫັດຜ່ານ</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="ລະຫັດຜ່ານ"
              required
              style={inputStyle}
            />
          </div>

          {error && (
            <div style={{ backgroundColor: '#FEE2E2', color: '#B91C1C', borderRadius: 10, padding: '10px 14px', fontSize: 13 }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              backgroundColor: loading ? '#94A3B8' : COLORS.primary,
              color: '#fff', border: 'none', borderRadius: 10,
              padding: '13px', fontSize: 15, fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'ກຳລັງດຳເນີນ...' : 'ເຂົ້າສູ່ລະບົບ'}
          </button>
        </form>

        <button
          onClick={handleDemo}
          style={{
            marginTop: 16, width: '100%', background: 'none',
            border: '1px dashed #CBD5E1', borderRadius: 10,
            padding: '10px', color: '#64748B', fontSize: 13,
            cursor: 'pointer',
          }}
        >
          ໃຊ້ Demo Account (demo-owner / demo)
        </button>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '11px 14px',
  borderRadius: 10, border: '1.5px solid #E2E8F0',
  fontSize: 14, color: '#0F172A',
  outline: 'none', boxSizing: 'border-box',
};
