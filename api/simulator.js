import supabase from './db-client.js';
import { setCors, handleOptions } from './lib/cors.js';
import { runAnalysisPipeline, addDays } from './lib/analysis.js';
import { auditLog, verifyToken } from './lib/auth.js';
import { SYNTHETIC_WATERMARK } from './lib/constants.js';

const INJECTIONS = {
  approved_mobilization_advance: (project, day) => ({
    event_type: 'mobilization_advance',
    description: 'SIMULATED: Approved mobilization advance ₹4,80,000 (10%)',
    event_time: `${addDays(project.start_date, Math.min(day, 12))}T10:00:00.000Z`,
    recorded_at: `${addDays(project.start_date, Math.min(day, 12))}T12:00:00.000Z`,
    published_at: `${addDays(project.start_date, Math.min(day, 12))}T14:00:00.000Z`,
    ingested_at: `${addDays(project.start_date, Math.min(day, 14))}T10:00:00.000Z`,
    amount: Math.round(Number(project.sanctioned_amount) * 0.1),
    reliability: 0.92,
    source: 'simulator',
    is_simulated: true,
  }),
  fresh_inspection_low_progress: (project, day) => ({
    event_type: 'inspection',
    description: 'SIMULATED: Fresh field inspection confirming low physical progress (~36%)',
    event_time: `${addDays(project.start_date, day)}T11:00:00.000Z`,
    recorded_at: `${addDays(project.start_date, day)}T15:00:00.000Z`,
    published_at: `${addDays(project.start_date, day)}T16:00:00.000Z`,
    ingested_at: `${addDays(project.start_date, day)}T17:00:00.000Z`,
    progress_pct: 36,
    reliability: 0.93,
    source: 'simulator',
    is_simulated: true,
  }),
  measurement_book: (project, day) => ({
    event_type: 'measurement',
    description: 'SIMULATED: Measurement book extract — quantities support ~34% progress',
    event_time: `${addDays(project.start_date, day)}T10:00:00.000Z`,
    recorded_at: `${addDays(project.start_date, day)}T12:00:00.000Z`,
    published_at: `${addDays(project.start_date, day)}T13:00:00.000Z`,
    ingested_at: `${addDays(project.start_date, day)}T14:00:00.000Z`,
    progress_pct: 34,
    reliability: 0.9,
    source: 'simulator',
    is_simulated: true,
  }),
  corrected_progress: (project, day) => ({
    event_type: 'progress',
    description: 'SIMULATED: Corrected progress report raising physical to 72%',
    event_time: `${addDays(project.start_date, day)}T10:00:00.000Z`,
    recorded_at: `${addDays(project.start_date, day)}T11:00:00.000Z`,
    published_at: `${addDays(project.start_date, day)}T12:00:00.000Z`,
    ingested_at: `${addDays(project.start_date, day)}T12:30:00.000Z`,
    progress_pct: 72,
    reliability: 0.8,
    source: 'simulator',
    is_simulated: true,
  }),
  cost_inflation_payment: (project, day) => ({
    event_type: 'payment',
    description: 'SIMULATED: Additional payment (cost pressure scenario)',
    event_time: `${addDays(project.start_date, day)}T10:00:00.000Z`,
    recorded_at: `${addDays(project.start_date, day)}T11:00:00.000Z`,
    published_at: `${addDays(project.start_date, day)}T12:00:00.000Z`,
    ingested_at: `${addDays(project.start_date, day)}T13:00:00.000Z`,
    amount: Math.round(Number(project.sanctioned_amount) * 0.12),
    reliability: 0.7,
    source: 'simulator',
    is_simulated: true,
  }),
  completion_conflict: (project, day) => ({
    event_type: 'completion',
    description: 'SIMULATED: Completion certificate without matching inspection',
    event_time: `${addDays(project.start_date, day)}T10:00:00.000Z`,
    recorded_at: `${addDays(project.start_date, day)}T10:00:00.000Z`,
    published_at: `${addDays(project.start_date, day)}T11:00:00.000Z`,
    ingested_at: `${addDays(project.start_date, day)}T12:00:00.000Z`,
    status_value: 'completed',
    progress_pct: 100,
    reliability: 0.45,
    source: 'simulator',
    is_simulated: true,
  }),
  delay_marker: (project, day) => ({
    event_type: 'status',
    description: 'SIMULATED: Delay notice — extended timeline',
    event_time: `${addDays(project.start_date, day)}T10:00:00.000Z`,
    recorded_at: `${addDays(project.start_date, day + 5)}T10:00:00.000Z`,
    published_at: `${addDays(project.start_date, day + 5)}T12:00:00.000Z`,
    ingested_at: `${addDays(project.start_date, day + 6)}T10:00:00.000Z`,
    status_value: 'delayed',
    reliability: 0.75,
    source: 'simulator',
    is_simulated: true,
  }),
};

export default async function handler(req, res) {
  setCors(res);
  if (handleOptions(req, res)) return;

  try {
    if (req.method === 'GET') {
      return res.status(200).json({
        injections: Object.keys(INJECTIONS),
        description: 'Adversarial / evidence simulator — synthetic only',
        watermark: SYNTHETIC_WATERMARK,
      });
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const project_code = body.project_code || '142';
      const injection = body.injection;
      const as_of_day = body.as_of_day != null ? Number(body.as_of_day) : 47;
      const persist = body.persist !== false;

      if (!injection || !INJECTIONS[injection]) {
        return res.status(400).json({ error: 'Unknown injection', available: Object.keys(INJECTIONS) });
      }

      const { data: project } = await supabase
        .from('vx_projects')
        .select('*')
        .eq('project_code', String(project_code))
        .maybeSingle();
      if (!project) return res.status(404).json({ error: 'Project not found' });

      const { data: events } = await supabase
        .from('vx_events')
        .select('*')
        .eq('project_id', project.id)
        .order('event_time');

      const baseline = runAnalysisPipeline(project, events || [], { as_of_day });

      const injected = {
        ...INJECTIONS[injection](project, as_of_day),
        project_id: project.id,
        synthetic_watermark: true,
      };

      let saved = injected;
      if (persist) {
        const { data, error } = await supabase.from('vx_events').insert(injected).select().single();
        if (error) throw error;
        saved = data;
      }

      const merged = [...(events || []), saved];
      const updated = runAnalysisPipeline(project, merged, { as_of_day });

      const user = verifyToken(req.headers.authorization?.replace(/^Bearer\s+/i, '')) || {
        email: 'investigator@verity-x.demo',
        role: 'INVESTIGATOR',
      };

      await supabase.from('vx_simulation_runs').insert({
        project_id: project.id,
        injection_type: injection,
        as_of_day,
        baseline_json: {
          drift: baseline.integrity_drift.score,
          efi: baseline.evidence_friction.score,
          contradictions: baseline.contradictions.length,
          risk: baseline.investigation_risk,
        },
        updated_json: {
          drift: updated.integrity_drift.score,
          efi: updated.evidence_friction.score,
          contradictions: updated.contradictions.length,
          risk: updated.investigation_risk,
        },
        event_id: saved.id || null,
        synthetic_watermark: true,
      });

      await auditLog('simulate_evidence', 'simulation', injection, { project_code, as_of_day }, user);

      return res.status(200).json({
        injection,
        persisted: persist,
        injected_event: saved,
        baseline: {
          investigation_risk: baseline.investigation_risk,
          drift_score: baseline.integrity_drift.score,
          efi_score: baseline.evidence_friction.score,
          contradictions: baseline.contradictions,
          hypotheses: baseline.hypotheses.slice(0, 4),
          snapshot: baseline.decision_aware_replay.snapshot,
          recommendation: baseline.recommendation,
        },
        updated: {
          investigation_risk: updated.investigation_risk,
          drift_score: updated.integrity_drift.score,
          efi_score: updated.evidence_friction.score,
          contradictions: updated.contradictions,
          hypotheses: updated.hypotheses.slice(0, 6),
          snapshot: updated.decision_aware_replay.snapshot,
          integrity_drift: updated.integrity_drift,
          evidence_friction: updated.evidence_friction,
          minimum_verification_set: updated.minimum_verification_set,
          disproof_mode: updated.disproof_mode,
          recommendation: updated.recommendation,
          full: updated,
        },
        watermark: SYNTHETIC_WATERMARK,
      });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
