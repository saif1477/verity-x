import { useParams } from 'react-router-dom';
import { useState } from 'react';
import { useAnalysis } from '../hooks/useAnalysis';
import Loading from '../components/Loading';
import ErrorBanner from '../components/ErrorBanner';
import ScoreCard from '../components/ScoreCard';
import Watermark from '../components/Watermark';

export default function Replay() {
  const { code = '142' } = useParams();
  const [day, setDay] = useState(47);
  const { data, loading, error, rerun } = useAnalysis(code, day);

  if (loading) return <Loading label="Building decision-aware replay…" />;
  if (error) return <ErrorBanner message={error} />;
  if (!data) return null;

  const r = data.decision_aware_replay;

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-stone-500">Decision-Aware Replay</div>
          <h1 className="text-lg font-semibold">Day {r.as_of_day} knowledge state</h1>
          <p className="text-[13px] text-stone-500 mt-1">
            Shows what was known / unknown without future-information leakage. Not a determination of wrongdoing.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={5}
            max={90}
            value={day}
            onChange={(e) => setDay(Number(e.target.value))}
            className="w-40"
          />
          <span className="tabular-nums text-sm w-16">Day {day}</span>
          <button type="button" onClick={rerun} className="text-[12px] border border-stone-600 px-2 py-1 rounded-sm">
            Replay
          </button>
        </div>
      </div>
      <Watermark />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <ScoreCard label="Payment %" value={`${r.snapshot.payment_pct}%`} tone="warn" />
        <ScoreCard label="Physical %" value={`${r.snapshot.physical_progress_pct}%`} tone="warn" />
        <ScoreCard
          label="Inspection"
          value={r.snapshot.inspection_available ? 'Available' : 'Unavailable'}
          tone={r.snapshot.inspection_available ? 'ok' : 'risk'}
        />
        <ScoreCard label="Visible risk" value={r.visible_risk.investigation_risk} />
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <section className="border border-stone-800 p-3 rounded-sm">
          <h2 className="text-[11px] uppercase tracking-wider text-stone-500 mb-2">What was known</h2>
          <ul className="space-y-1 max-h-72 overflow-y-auto">
            {r.what_was_known.map((e) => (
              <li key={e.id} className="text-[12px] border-b border-stone-800/50 py-1">
                <span className="text-stone-500">d{e.day}</span>{' '}
                <span className="text-amber-700/80">{e.type}</span> — {e.summary}
              </li>
            ))}
          </ul>
        </section>
        <section className="border border-stone-800 p-3 rounded-sm space-y-3">
          <div>
            <h2 className="text-[11px] uppercase tracking-wider text-stone-500 mb-2">What was unknown</h2>
            <ul className="list-disc list-inside text-[13px] text-stone-300 space-y-1">
              {r.what_was_unknown.map((u) => (
                <li key={u}>{u}</li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="text-[11px] uppercase tracking-wider text-stone-500 mb-2">Missing evidence</h2>
            <ul className="list-disc list-inside text-[13px] text-stone-300 space-y-1">
              {r.missing_evidence.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
          <div className="text-[13px] text-stone-400 border-t border-stone-800 pt-2">{r.recommended_action}</div>
          <div className="text-[11px] text-emerald-800">
            Future leakage protected: {String(r.future_leakage_protected)} · excluded events: {data.future_events_excluded}
          </div>
        </section>
      </div>

      {data.earliest_actionable_divergence && (
        <div className="border border-amber-900/40 bg-amber-950/10 p-3 rounded-sm text-[13px]">
          <div className="text-[11px] uppercase tracking-wider text-amber-700/80">Earliest actionable divergence</div>
          <div className="mt-1 text-stone-200">
            Day {data.earliest_actionable_divergence.day} · drift {data.earliest_actionable_divergence.drift_score} ·
            evidence confidence {data.earliest_actionable_divergence.evidence_confidence}
          </div>
          <p className="text-stone-500 mt-1">{data.earliest_actionable_divergence.rationale}</p>
        </div>
      )}
    </div>
  );
}
