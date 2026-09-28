import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, WATERMARK } from '../lib/api';
import type { Project } from '../lib/types';
import Loading from '../components/Loading';
import ErrorBanner from '../components/ErrorBanner';
import Watermark from '../components/Watermark';

export default function ControlRoom() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [filter, setFilter] = useState('');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api<{ projects: Project[] }>('/api/projects?limit=200');
      setProjects(r.projects || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const seed = async () => {
    setSeeding(true);
    try {
      await api('/api/seed', { method: 'POST', body: JSON.stringify({ force: true, extra_projects: 80 }) });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Seed failed');
    } finally {
      setSeeding(false);
    }
  };

  const filtered = projects.filter(
    (p) =>
      !filter ||
      p.project_code.includes(filter) ||
      p.name.toLowerCase().includes(filter.toLowerCase()) ||
      (p.scenario_type || '').toLowerCase().includes(filter.toLowerCase())
  );

  const flagship = projects.find((p) => p.project_code === '142');

  return (
    <div className="space-y-4 max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-stone-100">Verification Control Room</h1>
          <p className="text-[13px] text-stone-500 mt-1 max-w-2xl">
            Portfolio view of synthetic public-works projects. Open Project #142 for the flagship temporal evidence workflow.
            Terms used: Investigation risk · Evidence conflict · Possible explanation · Human review required.
          </p>
        </div>
        <button
          type="button"
          onClick={seed}
          disabled={seeding}
          className="text-[12px] border border-stone-700 px-3 py-1.5 rounded-sm hover:bg-stone-800 disabled:opacity-50"
        >
          {seeding ? 'Seeding…' : 'Reseed synthetic data'}
        </button>
      </div>

      <Watermark />
      {error && <ErrorBanner message={error} />}

      {flagship && (
        <Link
          to="/project/142"
          className="block border border-amber-900/50 bg-amber-950/20 px-4 py-3 rounded-sm hover:bg-amber-950/30"
        >
          <div className="text-[10px] uppercase tracking-wider text-amber-700/90">Flagship case</div>
          <div className="text-base font-medium text-stone-100 mt-0.5">
            Project #{flagship.project_code}: {flagship.name}
          </div>
          <div className="text-[13px] text-stone-400 mt-1">
            ₹{(Number(flagship.sanctioned_amount) / 100000).toFixed(0)} lakh · {flagship.scenario_type} · Day-47 replay ready
          </div>
          <div className="text-[11px] text-stone-500 mt-2">{WATERMARK}</div>
        </Link>
      )}

      <div className="flex gap-2 items-center">
        <input
          placeholder="Filter by code, name, scenario…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="bg-stone-950 border border-stone-700 px-3 py-1.5 text-sm rounded-sm w-full max-w-sm focus:outline-none focus:border-stone-500"
        />
        <span className="text-[12px] text-stone-500">{filtered.length} projects</span>
      </div>

      {loading ? (
        <Loading label="Loading projects…" />
      ) : (
        <div className="border border-stone-800 rounded-sm overflow-hidden">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-stone-900/80 text-[10px] uppercase tracking-wider text-stone-500">
              <tr>
                <th className="px-3 py-2 font-medium">Code</th>
                <th className="px-3 py-2 font-medium">Project</th>
                <th className="px-3 py-2 font-medium">Scenario</th>
                <th className="px-3 py-2 font-medium">Sanction</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 100).map((p) => (
                <tr key={p.id} className="border-t border-stone-800/80 hover:bg-stone-900/40">
                  <td className="px-3 py-2">
                    <Link to={`/project/${p.project_code}`} className="text-amber-600/90 hover:underline tabular-nums">
                      #{p.project_code}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-stone-300">{p.name}</td>
                  <td className="px-3 py-2 text-stone-500 text-[12px]">{p.scenario_type}</td>
                  <td className="px-3 py-2 tabular-nums text-stone-400">
                    ₹{Number(p.sanctioned_amount).toLocaleString('en-IN')}
                  </td>
                  <td className="px-3 py-2 text-stone-500">{p.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
