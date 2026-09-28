import { useParams, Link } from 'react-router-dom';
import { useState } from 'react';
import { useAnalysis } from '../hooks/useAnalysis';
import Loading from '../components/Loading';
import ErrorBanner from '../components/ErrorBanner';
import ScoreCard from '../components/ScoreCard';
import Watermark from '../components/Watermark';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
} from 'recharts';

export default function EvidenceTwin() {
  const { code = '142' } = useParams();
  const [day, setDay] = useState(47);
  const { data, loading, error, rerun } = useAnalysis(code, day);

  if (loading) return <Loading />;
  if (error) return <ErrorBanner message={error} />;
  if (!data) return null;

  const snap = data.decision_aware_replay.snapshot;
  const dims = Object.values(data.integrity_drift.dimensions || {});
  const chartData = data.trajectories.expected.map((e, i) => ({
    day: e.day,
    expected_physical: e.physical,
    observed_physical: data.trajectories.observed[i]?.physical,
    expected_payment: e.payment,
    observed_payment: data.trajectories.observed[i]?.payment,
  }));

  const riskTone = data.investigation_risk === 'high' ? 'risk' : data.investigation_risk === 'moderate' ? 'warn' : 'ok';

  return (
    <div className="space-y-4 max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-stone-500">Project Evidence Twin</div>
          <h1 className="text-lg font-semibold">
            #{data.project.project_code} · {data.project.name}
          </h1>
          <p className="text-[13px] text-stone-500 mt-1">
            Sanctioned ₹{Number(data.project.sanctioned_amount).toLocaleString('en-IN')} · As-of day {data.as_of_day} ({data.as_of_date})
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[12px] text-stone-500">Replay day</label>
          <input
            type="number"
            min={1}
            max={120}
            value={day}
            onChange={(e) => setDay(Number(e.target.value))}
            className="w-20 bg-stone-950 border border-stone-700 px-2 py-1 text-sm rounded-sm"
          />
          <button type="button" onClick={rerun} className="text-[12px] border border-stone-600 px-2 py-1 rounded-sm hover:bg-stone-800">
            Run analysis
          </button>
        </div>
      </div>

      <Watermark />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <ScoreCard label="Payment %" value={`${snap.payment_pct}%`} tone="warn" sub="Observed cumulative" />
        <ScoreCard label="Physical progress" value={`${snap.physical_progress_pct}%`} tone="warn" sub="Reported" />
        <ScoreCard
          label="Inspection"
          value={snap.inspection_available ? 'Available' : 'Unavailable'}
          tone={snap.inspection_available ? 'ok' : 'risk'}
        />
        <ScoreCard
          label="Investigation risk"
          value={data.investigation_risk}
          tone={riskTone}
          sub="Human review required"
        />
        <ScoreCard
          label="Integrity Drift"
          value={data.integrity_drift.score}
          tone="warn"
          detail={
            <div>
              <div>{data.integrity_drift.formula}</div>
              {dims.map((d) => (
                <div key={d.dimension}>
                  {d.formula} × w={d.weight}
                </div>
              ))}
            </div>
          }
        />
        <ScoreCard
          label="Evidence Friction"
          value={data.evidence_friction.score}
          detail={
            <div>
              <div>{data.evidence_friction.formula}</div>
              {Object.entries(data.evidence_friction.components).map(([k, v]) => (
                <div key={k}>
                  {k}: {v}
                </div>
              ))}
            </div>
          }
        />
        <ScoreCard
          label="Earliest divergence"
          value={data.earliest_actionable_divergence ? `Day ${data.earliest_actionable_divergence.day}` : '—'}
          sub={data.earliest_actionable_divergence ? `drift ${data.earliest_actionable_divergence.drift_score}` : ''}
          detail={data.earliest_actionable_divergence?.rationale}
        />
        <ScoreCard
          label="Future excluded"
          value={data.future_events_excluded}
          sub="Temporal leakage protected"
          tone="ok"
        />
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        <div className="md:col-span-2 border border-stone-800 bg-stone-900/40 p-3 rounded-sm">
          <div className="text-[11px] uppercase tracking-wider text-stone-500 mb-2">Expected vs Observed Trajectories</div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid stroke="#292524" strokeDasharray="3 3" />
                <XAxis dataKey="day" stroke="#78716c" tick={{ fontSize: 11 }} />
                <YAxis stroke="#78716c" tick={{ fontSize: 11 }} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ background: '#1c1917', border: '1px solid #44403c', fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="expected_physical" stroke="#a8a29e" dot={false} strokeWidth={1.5} name="Expected physical" />
                <Line type="monotone" dataKey="observed_physical" stroke="#d97706" dot={false} strokeWidth={1.5} name="Observed physical" />
                <Line type="monotone" dataKey="expected_payment" stroke="#57534e" dot={false} strokeDasharray="4 4" name="Expected payment" />
                <Line type="monotone" dataKey="observed_payment" stroke="#e11d48" dot={false} strokeWidth={1.5} name="Observed payment" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="border border-stone-800 bg-stone-900/40 p-3 rounded-sm space-y-2">
          <div className="text-[11px] uppercase tracking-wider text-stone-500">Twin state summary</div>
          {Object.entries(data.evidence_twin.states).map(([k, v]) => {
            if (typeof v !== 'object' || v === null) return null;
            if (k === 'provenance') return null;
            return (
              <div key={k} className="text-[12px] border-b border-stone-800/60 pb-1">
                <span className="text-stone-500">{k}</span>
                <div className="text-stone-300 font-mono text-[11px] mt-0.5">{JSON.stringify(v)}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <div className="border border-stone-800 p-3 rounded-sm">
          <div className="text-[11px] uppercase tracking-wider text-stone-500 mb-2">Claims</div>
          <ul className="space-y-2">
            {data.claims.map((c) => (
              <li key={c.claim_type} className="text-[13px]">
                <div className="text-stone-200">{c.statement}</div>
                <div className="text-[11px] text-stone-500">
                  {c.source} · confidence {c.confidence} · {c.claim_type}
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="border border-stone-800 p-3 rounded-sm">
          <div className="text-[11px] uppercase tracking-wider text-stone-500 mb-2">Data quality</div>
          {data.data_quality.length === 0 ? (
            <p className="text-[13px] text-stone-500">No quality flags at this cutoff.</p>
          ) : (
            <ul className="space-y-1.5">
              {data.data_quality.map((q, i) => (
                <li key={i} className="text-[12px] text-stone-300">
                  <span className="text-amber-700/90">{q.issue_type}</span> · {q.description}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-[12px]">
        <Link className="border border-stone-700 px-3 py-1.5 rounded-sm hover:bg-stone-800" to={`/project/${code}/replay`}>
          Decision-Aware Replay
        </Link>
        <Link className="border border-stone-700 px-3 py-1.5 rounded-sm hover:bg-stone-800" to={`/project/${code}/contradictions`}>
          Contradictions & Hypotheses
        </Link>
        <Link className="border border-stone-700 px-3 py-1.5 rounded-sm hover:bg-stone-800" to={`/project/${code}/planner`}>
          Verification Planner (MVS)
        </Link>
        <Link className="border border-stone-700 px-3 py-1.5 rounded-sm hover:bg-stone-800" to={`/project/${code}/disproof`}>
          Disproof Mode
        </Link>
        <Link className="border border-stone-700 px-3 py-1.5 rounded-sm hover:bg-stone-800" to={`/project/${code}/simulator`}>
          Adversarial Simulator
        </Link>
        <Link className="border border-amber-900/60 px-3 py-1.5 rounded-sm hover:bg-amber-950/30 text-amber-200/80" to={`/project/${code}/case`}>
          Generate Case File
        </Link>
      </div>

      <p className="text-[12px] text-stone-500 border-t border-stone-800 pt-3">{data.recommendation}</p>
    </div>
  );
}
