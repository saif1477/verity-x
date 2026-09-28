import { useParams } from 'react-router-dom';
import { useState } from 'react';
import { useAnalysis } from '../hooks/useAnalysis';
import { api } from '../lib/api';
import Loading from '../components/Loading';
import ErrorBanner from '../components/ErrorBanner';
import Watermark from '../components/Watermark';
import ScoreCard from '../components/ScoreCard';

export default function Planner() {
  const { code = '142' } = useParams();
  const { data, loading, error } = useAnalysis(code, 47);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [requests, setRequests] = useState<unknown[]>([]);

  const loadRequests = async () => {
    const r = await api<{ requests: unknown[] }>(`/api/evidence-requests?project_code=${code}`);
    setRequests(r.requests || []);
  };

  const requestEvidence = async (item: { id: string; label: string }) => {
    setBusy(item.id);
    setMsg('');
    try {
      await api('/api/evidence-requests', {
        method: 'POST',
        body: JSON.stringify({
          project_code: code,
          evidence_type: item.id,
          title: item.label,
          rationale: 'Minimum Verification Set — verification recommendation',
          priority: 'high',
          analysis_run_id: data?.run_id,
        }),
      });
      setMsg(`Evidence request recorded: ${item.label}`);
      await loadRequests();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <Loading />;
  if (error) return <ErrorBanner message={error} />;
  if (!data) return null;

  const mvs = data.minimum_verification_set;

  return (
    <div className="space-y-4 max-w-4xl">
      <div>
        <div className="text-[10px] uppercase tracking-wider text-stone-500">Verification Planner</div>
        <h1 className="text-lg font-semibold">Minimum Verification Set</h1>
        <p className="text-[13px] text-stone-500 mt-1">{mvs.explanation}</p>
      </div>
      <Watermark />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        <ScoreCard label="MVS items" value={mvs.items.length} />
        <ScoreCard label="Total cost units" value={mvs.total_cost} />
        <ScoreCard label="Coverage score" value={mvs.coverage_score} />
        <ScoreCard
          label="Evidence Friction"
          value={data.evidence_friction.score}
          detail={
            <div>
              {Object.entries(data.evidence_friction.components).map(([k, v]) => (
                <div key={k}>
                  {k}: {v}
                </div>
              ))}
            </div>
          }
        />
      </div>

      {msg && <div className="text-sm text-emerald-700/90 border border-emerald-900/40 px-3 py-2">{msg}</div>}

      <div className="border border-stone-800 rounded-sm overflow-hidden">
        <table className="w-full text-[13px]">
          <thead className="bg-stone-900 text-[10px] uppercase text-stone-500">
            <tr>
              <th className="px-3 py-2 text-left">Evidence</th>
              <th className="px-3 py-2 text-left">Value</th>
              <th className="px-3 py-2 text-left">Cost</th>
              <th className="px-3 py-2 text-left">Days</th>
              <th className="px-3 py-2 text-left">Action</th>
            </tr>
          </thead>
          <tbody>
            {mvs.items.map((item) => (
              <tr key={item.id} className="border-t border-stone-800">
                <td className="px-3 py-2">
                  <div className="text-stone-200">{item.label}</div>
                  <div className="text-[11px] text-stone-500">{item.covers.join(', ')}</div>
                </td>
                <td className="px-3 py-2 tabular-nums">{item.verification_value}</td>
                <td className="px-3 py-2 tabular-nums">{item.cost}</td>
                <td className="px-3 py-2 tabular-nums">{item.time_days}</td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    disabled={busy === item.id}
                    onClick={() => requestEvidence(item)}
                    className="text-[12px] border border-amber-900/50 text-amber-200/80 px-2 py-1 rounded-sm hover:bg-amber-950/30 disabled:opacity-50"
                  >
                    {busy === item.id ? '…' : 'REQUEST EVIDENCE'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button type="button" onClick={loadRequests} className="text-[12px] text-stone-400 underline">
        Refresh evidence requests
      </button>

      {requests.length > 0 && (
        <div className="border border-stone-800 p-3 rounded-sm">
          <h2 className="text-[11px] uppercase text-stone-500 mb-2">Recorded requests</h2>
          <ul className="space-y-1 text-[12px]">
            {(requests as Array<{ id: number; title: string; status: string; evidence_type: string }>).map((r) => (
              <li key={r.id}>
                #{r.id} · {r.evidence_type} · {r.title} · <span className="text-amber-700">{r.status}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
