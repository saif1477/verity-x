import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Watermark from './Watermark';
import {
  LayoutDashboard,
  GitBranch,
  Scale,
  ClipboardList,
  ShieldAlert,
  FlaskConical,
  FileText,
  LogOut,
  Binary,
} from 'lucide-react';

const nav = [
  { to: '/', label: 'Control Room', icon: LayoutDashboard },
  { to: '/project/142', label: 'Evidence Twin', icon: Binary },
  { to: '/project/142/replay', label: 'Timeline / Replay', icon: GitBranch },
  { to: '/project/142/contradictions', label: 'Contradictions', icon: Scale },
  { to: '/project/142/planner', label: 'Verification Planner', icon: ClipboardList },
  { to: '/project/142/disproof', label: 'Disproof Mode', icon: ShieldAlert },
  { to: '/project/142/simulator', label: 'Simulator', icon: FlaskConical },
  { to: '/project/142/case', label: 'Case File', icon: FileText },
];

export default function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-[#0e0f11] text-stone-200 flex">
      <aside className="w-56 shrink-0 border-r border-stone-800 bg-[#121316] flex flex-col">
        <div className="px-4 py-4 border-b border-stone-800">
          <Link to="/" className="block">
            <div className="text-[10px] uppercase tracking-[0.2em] text-stone-500">VERITY-X</div>
            <div className="text-sm font-semibold text-stone-100 leading-tight mt-0.5">Temporal Evidence Verification</div>
          </Link>
        </div>
        <nav className="flex-1 py-2 overflow-y-auto">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-2 px-4 py-2 text-[13px] border-l-2 ${isActive ? 'border-amber-600 bg-stone-800/50 text-stone-100' : 'border-transparent text-stone-400 hover:text-stone-200 hover:bg-stone-800/30'}`
              }
            >
              <n.icon size={14} strokeWidth={1.5} />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-stone-800 space-y-2">
          {user && (
            <div className="text-[11px] text-stone-500">
              <div className="text-stone-300">{user.name}</div>
              <div>{user.role}</div>
            </div>
          )}
          <button
            type="button"
            onClick={logout}
            className="flex items-center gap-1.5 text-[12px] text-stone-400 hover:text-stone-200"
          >
            <LogOut size={12} /> Sign out
          </button>
        </div>
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <header className="border-b border-stone-800 px-5 py-2 flex items-center justify-between gap-4 bg-[#121316]/" >
          <div className="text-[12px] text-stone-500">Investigation intelligence · No automatic accusation</div>
          <Watermark className="max-w-xl hidden md:block" />
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-5">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
