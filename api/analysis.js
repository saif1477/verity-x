import supabase from './db-client.js';
import { setCors, handleOptions } from './lib/cors.js';
import { runAnalysisPipeline } from './lib/analysis.js';
import { auditLog, verifyToken } from './lib/auth.js';
import { SYNTHETIC_WATERMARK } from './lib/constants.js';

async function loadProjectBundle(projectCode) {
  const { data: project, error } = await supabase
    .from('vx_projects')
    .select('*')
    .eq('project_code', String(projectCode))
    .maybeSingle();
  if (error) throw error;
  if (!project) return null;
  const { data: events } = await supabase
    .from('vx_events')
    .select('*')
    .eq('project_id', project.id)
    .order('event_time', { ascending: true });
  return { project, events: events || [] };
}

export default async function handler(req, res) {
  setCors(res);
  if (handleOptions(req, res)) return;

  try {
    if (req.method === 'GET') {
      const { project_code, as_of_day, run_id } = req.query || {};
      if (run_id) {
        const { data, error } = await supabase.from('vx_analysis_runs').select('*').eq('id', run_id).maybeSingle();
        if (error) throw error;
        return res.status(200).json(data);
      }
      if (!project_code) return res.status(400).json({ error: 'project_code required' });

      const bundle = await loadProjectBundle(project_code);
      if (!bundle) return res.status(404).json({ error: 'Project not found' });

      const day = as_of_day != null ? Number(as_of_day) : 47;
      const result = runAnalysisPipeline(bundle.project, bundle.events, { as_of_day: day });
      return res.status(200).json(result);
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const project_code = body.project_code || '142';
      const as_of_day = body.as_of_day != null ? Number(body.as_of_day) : 47;
      const bundle = await loadProjectBundle(project_code);
      if (!bundle) return res.status(404).json({ error: 'Project not found. Run seed first.' });

      const result = runAnalysisPipeline(bundle.project, bundle.events, {
        as_of_day,
        thresholds: body.thresholds,
      });

      const user = verifyToken(req.headers.authorization?.replace(/^Bearer\s+/i, '')) || {
        email: 'anonymous',
        role: 'VIEWER',
      };

      const { data: run, error } = await supabase
        .from('vx_analysis_runs')
        .insert({
          project_id: bundle.project.id,
          as_of_day,
          as_of_date: result.as_of_date,
          investigation_risk: result.investigation_risk,
          drift_score: result.integrity_drift.score,
          efi_score: result.evidence_friction.score,
          result_json: result,
          synthetic_watermark: true,
          created_by: user.email,
        })
        .select()
        .single();
      if (error) throw error;

      // Persist derived rows for traceability
      if (result.contradictions?.length) {
        await supabase.from('vx_contradictions').delete().eq('analysis_run_id', run.id);
        await supabase.from('vx_contradictions').insert(
          result.contradictions.map((c) => ({
            analysis_run_id: run.id,
            project_id: bundle.project.id,
            contradiction_type: c.contradiction_type,
            title: c.title,
            description: c.description,
            severity: c.severity,
            confidence: c.confidence,
            detail_json: c,
            synthetic_watermark: true,
          }))
        );
      }
      if (result.hypotheses?.length) {
        await supabase.from('vx_hypotheses').delete().eq('analysis_run_id', run.id);
        await supabase.from('vx_hypotheses').insert(
          result.hypotheses.map((h) => ({
            analysis_run_id: run.id,
            project_id: bundle.project.id,
            label: h.label,
            description: h.description,
            h_score: h.h_score,
            confidence: h.confidence,
            supporting_evidence: h.supporting_evidence,
            contradicting_evidence: h.contradicting_evidence,
            missing_evidence: h.missing_evidence,
            detail_json: h,
            synthetic_watermark: true,
          }))
        );
      }

      await auditLog('run_analysis', 'analysis_run', run.id, { project_code, as_of_day }, user);

      return res.status(201).json({ run_id: run.id, ...result, watermark: SYNTHETIC_WATERMARK });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
