import { useParams } from 'react-router-dom';
import { useAnalysis } from '../hooks/useAnalysis';
import Loading from '../components/Loading';
import ErrorBanner from '../components/ErrorBanner';
import Watermark from '../components/Watermark';

export default function Disproof() {
  const { code = '142' } = useParams();
  const { data, loading, error } = useAnalysis(code, 47);

  if (loading) return <Loading />;
  if (error) return <ErrorBanner message={error} />;
  if (!data) return null;

  return (
    <div className="space-y-4 max-w-4xl">
      <div>
        <div className="text-[10px] uppercase tracking-wider text-stone-500">Disproof Mode</div>
        <h1 className="text-lg font-semibold">Weaken or eliminate explanations</h1>
        <p className="text-[13px] text-stone-500 mt-1">
          Prioritizes evidence that could disconfirm competing hypotheses. Does not establish wrongdoing.
        </p>
      </div>
      <Watermark />

      <div className="space-y-3">
        {data.disproof_mode.map((d) => (
          <div key={d.hypothesis} className="border border-stone-800 p-3 rounded-sm">
            <div className="flex justify-between gap-2 flex-wrap">
              <div className="font-medium text-stone-100">{d.hypothesis}</div>
              <div className="text-[11px] text-stone-500">HScore {d.h_score}</div>
            </div>
            <div className="grid md:grid-cols-3 gap-3 mt-3 text-[12px]">
              <div>
                <div className="text-[10px] uppercase text-emerald-800/80 mb-1">Supporting</div>
                <ul className="text-stone-400 space-y-0.5">{d.supporting.map((x) => <li key={x}>{x}</li>)}</ul>
              </div>
              <div>
                <div className="text-[10px] uppercase text-amber-800/80 mb-1">Weakening</div>
                <ul className="text-stone-400 space-y-0.5">{d.weakening.map((x) => <li key={x}>{x}</li>)}</ul>
              </div>
              <div>
                <div className="text-[10px] uppercase text-rose-800/80 mb-1">Disconfirming paths</div>
                <ul className="text-stone-400 space-y-0.5">{d.disconfirming.map((x) => <li key={x}>{x}</li>)}</ul>
              </div>
            </div>
            <div className="mt-3 text-[12px] text-stone-500">
              <span className="text-stone-400">Alternatives: </span>
              {d.alternative_hypotheses.join(' · ')}
            </div>
            <div className="mt-1 text-[12px]">
              <span className="text-stone-500">Next evidence: </span>
              <span className="text-amber-200/70">{d.next_evidence.join(', ') || '—'}</span>
            </div>
            <p className="text-[11px] text-stone-600 mt-2">{d.guidance}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
