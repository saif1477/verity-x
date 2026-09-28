import { useParams } from 'react-router-dom';
import { useAnalysis } from '../hooks/useAnalysis';
import Loading from '../components/Loading';
import ErrorBanner from '../components/ErrorBanner';
import Watermark from '../components/Watermark';

export default function Contradictions() {
  const { code = '142' } = useParams();
  const { data, loading, error } = useAnalysis(code, 47);

  if (loading) return <Loading />;
  if (error) return <ErrorBanner message={error} />;
  if (!data) return null;

  return (
    <div className="space-y-4 max-w-5xl">
      <div>
        <div className="text-[10px] uppercase tracking-wider text-stone-500">Evidence conflicts</div>
        <h1 className="text-lg font-semibold">Contradictions & Competing Hypotheses</h1>
        <p className="text-[13px] text-stone-500 mt-1">
          HScore = Support − Contradiction − MissingEvidencePenalty. Never interpreted as probability of guilt.
        </p>
      </div>
      <Watermark />

      <section className="space-y-3">
        <h2 className="text-[11px] uppercase tracking-wider text-stone-500">Contradictions ({data.contradictions.length})</h2>
        {data.contradictions.map((c) => (
          <div key={c.contradiction_type + c.title} className="border border-stone-800 p-3 rounded-sm">
            <div className="flex flex-wrap justify-between gap-2">
              <div className="font-medium text-stone-100">{c.title}</div>
              <div className="text-[11px] text-stone-500">
                {c.contradiction_type} · severity {c.severity} · confidence {c.confidence}
              </div>
            </div>
            <p className="text-[13px] text-stone-400 mt-1">{c.description}</p>
            <div className="grid md:grid-cols-2 gap-2 mt-2 text-[12px]">
              {c.claim_a && (
                <div className="bg-stone-950/60 p-2 border border-stone-800">
                  <div className="text-stone-500 text-[10px] uppercase">Claim A</div>
                  {c.claim_a.statement}
                </div>
              )}
              {c.claim_b && (
                <div className="bg-stone-950/60 p-2 border border-stone-800">
                  <div className="text-stone-500 text-[10px] uppercase">Claim B</div>
                  {c.claim_b.statement}
                </div>
              )}
            </div>
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-[11px] uppercase tracking-wider text-stone-500">
          Competing hypotheses ({data.hypotheses.length}) — possible explanations
        </h2>
        <div className="grid md:grid-cols-2 gap-2">
          {data.hypotheses.slice(0, 8).map((h) => (
            <div key={h.label + h.contradiction_title} className="border border-stone-800 p-3 rounded-sm">
              <div className="font-medium text-[13px] text-stone-100">{h.label}</div>
              <div className="text-[11px] text-stone-500 mt-0.5">
                HScore {h.h_score} · support {h.support_score} · contr. {h.contradiction_score} · miss. pen. {h.missing_penalty} · conf. {h.confidence}
              </div>
              <p className="text-[12px] text-stone-400 mt-2">{h.description}</p>
              <div className="mt-2 grid grid-cols-3 gap-1 text-[11px]">
                <div>
                  <div className="text-emerald-800/90">Supporting</div>
                  <ul className="text-stone-500">{h.supporting_evidence.map((x) => <li key={x}>{x}</li>)}</ul>
                </div>
                <div>
                  <div className="text-amber-800/90">Contradicting</div>
                  <ul className="text-stone-500">{h.contradicting_evidence.map((x) => <li key={x}>{x}</li>)}</ul>
                </div>
                <div>
                  <div className="text-rose-800/90">Missing</div>
                  <ul className="text-stone-500">{h.missing_evidence.map((x) => <li key={x}>{x}</li>)}</ul>
                </div>
              </div>
              {h.note && <p className="text-[10px] text-stone-600 mt-2">{h.note}</p>}
            </div>
          ))}
        </div>
      </section>

      <section className="border border-stone-800 p-3 rounded-sm">
        <h2 className="text-[11px] uppercase tracking-wider text-stone-500 mb-2">Counterfactual audit (sensitivity analysis)</h2>
        <div className="space-y-2">
          {data.counterfactual_audit.map((cf) => (
            <div key={cf.name} className="text-[13px] flex flex-wrap justify-between gap-2 border-b border-stone-800/50 pb-2">
              <div>
                <div className="text-stone-200">{cf.name}</div>
                <div className="text-[11px] text-stone-500">{cf.disclaimer}</div>
              </div>
              <div className="tabular-nums text-stone-400 text-[12px]">
                baseline {cf.baseline_drift} → {cf.counterfactual_drift} (Δ {cf.delta_drift})
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
