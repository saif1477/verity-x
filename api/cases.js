import supabase from './db-client.js';
import { setCors, handleOptions } from './lib/cors.js';
import { runAnalysisPipeline } from './lib/analysis.js';
import { auditLog, verifyToken } from './lib/auth.js';
import { SYNTHETIC_WATERMARK } from './lib/constants.js';

export default async function handler(req, res) {
  setCors(res);
  if (handleOptions(req, res)) return;

  try {
    if (req.method === 'GET') {
      const { id, project_code } = req.query || {};
      if (id) {
        const { data, error } = await supabase.from('vx_cases').select('*').eq('id', id).maybeSingle();
        if (error) throw error;
        return res.status(200).json(data);
      }
      let q = supabase.from('vx_cases').select('*').order('id', { ascending: false }).limit(50);
      if (project_code) {
        const { data: p } = await supabase.from('vx_projects').select('id').eq('project_code', project_code).maybeSingle();
        if (p) q = q.eq('project_id', p.id);
      }
      const { data, error } = await q;
      if (error) throw error;
      return res.status(200).json({ cases: data || [], watermark: SYNTHETIC_WATERMARK });
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const project_code = body.project_code || '142';
      const as_of_day = body.as_of_day != null ? Number(body.as_of_day) : 47;
      const format = body.format || 'json';

      const { data: project } = await supabase
        .from('vx_projects')
        .select('*')
        .eq('project_code', String(project_code))
        .maybeSingle();
      if (!project) return res.status(404).json({ error: 'Project not found' });

      const { data: events } = await supabase.from('vx_events').select('*').eq('project_id', project.id);
      const { data: requests } = await supabase
        .from('vx_evidence_requests')
        .select('*')
        .eq('project_id', project.id);

      const analysis = runAnalysisPipeline(project, events || [], { as_of_day });

      const caseFile = {
        title: `VERITY-X Auditable Case File — Project #${project_code}`,
        generated_at: new Date().toISOString(),
        watermark: SYNTHETIC_WATERMARK,
        limitations: [
          'Synthetic demonstration only — not official government records.',
          'Does not accuse persons or prove wrongdoing.',
          'Metrics indicate investigation risk and evidence conflict, not guilt.',
          'Counterfactuals are sensitivity analyses, not causal claims.',
          'LLM summaries (if any) must not invent evidence.',
        ],
        project: {
          code: project.project_code,
          name: project.name,
          sanctioned_amount: project.sanctioned_amount,
          location: project.location,
          contractor_name: project.contractor_name,
          scenario_type: project.scenario_type,
        },
        as_of_day,
        as_of_date: analysis.as_of_date,
        investigation_risk: analysis.investigation_risk,
        integrity_drift: analysis.integrity_drift,
        evidence_friction: analysis.evidence_friction,
        earliest_actionable_divergence: analysis.earliest_actionable_divergence,
        claims: analysis.claims,
        contradictions: analysis.contradictions,
        hypotheses: analysis.hypotheses,
        minimum_verification_set: analysis.minimum_verification_set,
        disproof_mode: analysis.disproof_mode,
        counterfactual_audit: analysis.counterfactual_audit,
        decision_aware_replay: analysis.decision_aware_replay,
        evidence_requests: requests || [],
        traceability_note:
          'Every finding traces Finding → Risk Signal → Claim → Evidence → Source → timestamps → reliability → data-quality status.',
        recommendation: analysis.recommendation,
      };

      const user = verifyToken(req.headers.authorization?.replace(/^Bearer\s+/i, '')) || {
        email: 'investigator@verity-x.demo',
        role: 'INVESTIGATOR',
      };

      const { data: saved, error } = await supabase
        .from('vx_cases')
        .insert({
          project_id: project.id,
          title: caseFile.title,
          as_of_day,
          case_json: caseFile,
          status: 'draft',
          created_by: user.email,
          synthetic_watermark: true,
        })
        .select()
        .single();
      if (error) throw error;

      await auditLog('export_case', 'case', saved.id, { project_code, format }, user);

      if (format === 'csv') {
        const rows = [
          ['field', 'value'],
          ['project_code', project_code],
          ['as_of_day', as_of_day],
          ['investigation_risk', analysis.investigation_risk],
          ['drift_score', analysis.integrity_drift.score],
          ['efi_score', analysis.evidence_friction.score],
          ['contradictions', analysis.contradictions.length],
          ['hypotheses', analysis.hypotheses.length],
          ['watermark', SYNTHETIC_WATERMARK],
        ];
        const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
        res.setHeader('Content-Type', 'text/csv');
        return res.status(200).send(csv);
      }

      return res.status(201).json({
        case_id: saved.id,
        case_file: caseFile,
        export_formats: ['json', 'csv'],
        pdf_note: 'PDF export: print case JSON view from frontend or use browser print-to-PDF.',
        watermark: SYNTHETIC_WATERMARK,
      });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
