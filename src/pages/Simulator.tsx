import { useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import Loading from '../components/Loading';
import ErrorBanner from '../components/ErrorBanner';
import Watermark from '../components/Watermark';
import ScoreCard from '../components/ScoreCard';

interface SimResult {
  injection: string;
  baseline: {
    investigation_risk: string;
    drift_score: number;
    efi_score: number;
    snapshot: { payment_pct: number; physical_progress_pct: number; inspection_available: boolean };
    contradictions: Array<{ title: string }>;
    recommendation: string;
  };
  updated: {
    investigation_risk: string;
    drift_score: number;
    efi_score: number;
    snapshot: { payment_pct: number; physical_progress_pct: number; inspection_available: boolean };
    contradictions: Array<{ title: string }>;
    hypotheses: Array<{ label: string; h_score: number }>;
    recommendation: string;
  };
  injected_event: { description: string; event_type: string };
}

const LABELS: Record<string, string> = {
  approved_mobilization_advance: 'Approved mobilization advance',
  fresh_inspection_low_progress: 'Fresh inspection (confirms low progress)',
  measurement_book: 'Measurement book extract',
  corrected_progress: 'Corrected progress (higher)',
  cost_inflation_payment: 'Additional payment (cost pressure)',
  completion_conflict: 'Completion without inspection',
  delay_marker: 'Delay notice',
};

export default function Simulator() {
  const { code = '142' } = useParams();
  const [injections, setInjections] = useState<string[]>([]);
  const [result, setResult] = useState<SimResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [day] = useState(47);

  useEffect(() => {
    api<{ injections: string[] }>('/api/simulator')
      .then((r) => setInjections(r.injections))
      .catch((e) => setError(e.message));
  }, []);

  const run = async (injection: string) => {
    setBusy(true);
    setError(null);
    try {
      const r = await api<SimResult>('/api/simulator', {
        method: 'POST',
        body: JSON.stringify({ project_code: code, injection, as_of_day: day, persist: true }),
      });
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Simulation failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 max-w-5xl">
      <div>
        <div className="text-[10px] uppercase tracking-wider text-stone-500">Adversarial Simulator</div>
        <h1 className="text-lg font-semibold">Inject evidence → recalculate</h1>
        <p className="text-[13px] text-stone-500 mt-1">
          Baseline → injected synthetic evidence → updated contradictions, hypotheses, risk, confidence, recommendation.
          Demo path: mobilization advance, then fresh inspection.
        </p>
      </div>
      <Watermark />
      {error && <ErrorBanner message={error} />}
      {busy && <Loading label="Injecting & recalculating…" />}

      <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2">
        {injections.map((id) => (
          <button
            key={id}
            type="button"
            disabled={busy}
            onClick={() => run(id)}
            className="text-left border border-stone-700 hover:border-stone-500 px-3 py-2 rounded-sm text-[13px] disabled:opacity-50"
          >
            <div className="text-stone-200">{LABELS[id] || id}</div>
            <div className="text-[11px] text-stone-600 font-mono">{id}</div>
          </button>
        ))}
      </div>

      {result && (
        <div className="space-y-3 border border-stone-800 p-3 rounded-sm">
          <div className="text-[13px] text-stone-300">
            Injected: <span className="text-amber-200/80">{result.injected_event.description}</span>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <div className="text-[11px] uppercase text-stone-500 mb-2">Baseline</div>
              <div className="grid grid-cols-2 gap-2">
                <ScoreCard label="Risk" value={result.baseline.investigation_risk} />
                <ScoreCard label="Drift" value={result.baseline.drift_score} />
                <ScoreCard label="EFI" value={result.baseline.efi_score} />
                <ScoreCard
                  label="Snapshot"
                  value={`${result.baseline.snapshot.payment_pct}% / ${result.baseline.snapshot.physical_progress_pct}%`}
                  sub={`insp: ${result.baseline.snapshot.inspection_available}`}
                />
              </div>
              <ul className="mt-2 text-[12px] text-stone-500">
                {result.baseline.contradictions.map((c) => (
                  <li key={c.title}>· {c.title}</li>
                ))}
              </ul>
            </div>
            <div>
              <div className="text-[11px] uppercase text-stone-500 mb-2">Updated after injection</div>
              <div className="grid grid-cols-2 gap-2">
                <ScoreCard label="Risk" value={result.updated.investigation_risk} tone="warn" />
                <ScoreCard label="Drift" value={result.updated.drift_score} tone="warn" />
                <ScoreCard label="EFI" value={result.updated.efi_score} />
                <ScoreCard
                  label="Snapshot"
                  value={`${result.updated.snapshot.payment_pct}% / ${result.updated.snapshot.physical_progress_pct}%`}
                  sub={`insp: ${result.updated.snapshot.inspection_available}`}
                  tone="warn"
                />
              </div>
              <ul className="mt-2 text-[12px] text-stone-400">
                {result.updated.contradictions.map((c) => (
                  <li key={c.title}>· {c.title}</li>
                ))}
              </ul>
              <div className="mt-2 text-[12px] text-stone-500">Top hypotheses:</div>
              <ul className="text-[12px] text-stone-400">
                {result.updated.hypotheses.slice(0, 4).map((h) => (
                  <li key={h.label}>
                    {h.label} (H={h.h_score})
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <p className="text-[12px] text-stone-500 border-t border-stone-800 pt-2">{result.updated.recommendation}</p>
        </div>
      )}
    </div>
  );
}
