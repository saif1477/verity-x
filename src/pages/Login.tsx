import { useState, FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Watermark from '../components/Watermark';

const DEMOS = [
  { email: 'investigator@verity-x.demo', password: 'verity-inv-2024', role: 'INVESTIGATOR' },
  { email: 'admin@verity-x.demo', password: 'verity-admin-2024', role: 'ADMIN' },
  { email: 'reviewer@verity-x.demo', password: 'verity-rev-2024', role: 'REVIEWER' },
  { email: 'viewer@verity-x.demo', password: 'verity-view-2024', role: 'VIEWER' },
];

export default function Login() {
  const { user, login, loading } = useAuth();
  const [email, setEmail] = useState(DEMOS[0].email);
  const [password, setPassword] = useState(DEMOS[0].password);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!loading && user) return <Navigate to="/" replace />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0e0f11] text-stone-200 flex items-center justify-center p-4">
      <div className="w-full max-w-md border border-stone-800 bg-[#121316] p-6 space-y-5">
        <div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-stone-500">VERITY-X</div>
          <h1 className="text-lg font-semibold mt-1">Temporal Evidence Verification</h1>
          <p className="text-[13px] text-stone-500 mt-2 leading-relaxed">
            Investigation intelligence platform. Reconstructs knowable state over time. Never accuses persons or proves wrongdoing.
          </p>
        </div>
        <Watermark />
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="text-[11px] text-stone-500 uppercase">Email</label>
            <input
              className="w-full mt-1 bg-stone-950 border border-stone-700 px-3 py-2 text-sm rounded-sm focus:outline-none focus:border-amber-800"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
            />
          </div>
          <div>
            <label className="text-[11px] text-stone-500 uppercase">Password</label>
            <input
              className="w-full mt-1 bg-stone-950 border border-stone-700 px-3 py-2 text-sm rounded-sm focus:outline-none focus:border-amber-800"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              required
            />
          </div>
          {error && <div className="text-sm text-rose-300">{error}</div>}
          <button
            type="submit"
            disabled={busy}
            className="w-full bg-stone-100 text-stone-900 text-sm font-medium py-2 rounded-sm hover:bg-white disabled:opacity-50"
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <div className="border-t border-stone-800 pt-3">
          <div className="text-[11px] text-stone-500 mb-2">Demo accounts (RBAC)</div>
          <div className="grid gap-1">
            {DEMOS.map((d) => (
              <button
                key={d.email}
                type="button"
                onClick={() => {
                  setEmail(d.email);
                  setPassword(d.password);
                }}
                className="text-left text-[12px] px-2 py-1.5 border border-stone-800 hover:border-stone-600 rounded-sm"
              >
                <span className="text-stone-300">{d.role}</span>
                <span className="text-stone-600 ml-2">{d.email}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
