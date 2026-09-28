import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import ControlRoom from './pages/ControlRoom';
import EvidenceTwin from './pages/EvidenceTwin';
import Replay from './pages/Replay';
import Contradictions from './pages/Contradictions';
import Planner from './pages/Planner';
import Disproof from './pages/Disproof';
import Simulator from './pages/Simulator';
import CaseFile from './pages/CaseFile';
import type { ReactNode } from 'react';

function Protected({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0e0f11] text-stone-400 flex items-center justify-center text-sm">
        Loading session…
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <Protected>
                <Layout />
              </Protected>
            }
          >
            <Route index element={<ControlRoom />} />
            <Route path="project/:code" element={<EvidenceTwin />} />
            <Route path="project/:code/replay" element={<Replay />} />
            <Route path="project/:code/contradictions" element={<Contradictions />} />
            <Route path="project/:code/planner" element={<Planner />} />
            <Route path="project/:code/disproof" element={<Disproof />} />
            <Route path="project/:code/simulator" element={<Simulator />} />
            <Route path="project/:code/case" element={<CaseFile />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
