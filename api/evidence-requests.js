import supabase from './db-client.js';
import { setCors, handleOptions } from './lib/cors.js';
import { auditLog, verifyToken } from './lib/auth.js';
import { SYNTHETIC_WATERMARK } from './lib/constants.js';

export default async function handler(req, res) {
  setCors(res);
  if (handleOptions(req, res)) return;

  try {
    if (req.method === 'GET') {
      const { project_code } = req.query || {};
      let q = supabase.from('vx_evidence_requests').select('*, vx_projects(project_code, name)').order('id', { ascending: false }).limit(100);
      if (project_code) {
        const { data: p } = await supabase.from('vx_projects').select('id').eq('project_code', project_code).maybeSingle();
        if (p) q = q.eq('project_id', p.id);
      }
      const { data, error } = await q;
      if (error) throw error;
      return res.status(200).json({ requests: data || [], watermark: SYNTHETIC_WATERMARK });
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const { project_code, evidence_type, title, rationale, priority, analysis_run_id } = body;
      if (!project_code || !evidence_type) {
        return res.status(400).json({ error: 'project_code and evidence_type required' });
      }
      const { data: project } = await supabase
        .from('vx_projects')
        .select('id')
        .eq('project_code', String(project_code))
        .maybeSingle();
      if (!project) return res.status(404).json({ error: 'Project not found' });

      const user = verifyToken(req.headers.authorization?.replace(/^Bearer\s+/i, '')) || {
        email: 'investigator@verity-x.demo',
        role: 'INVESTIGATOR',
      };

      const { data, error } = await supabase
        .from('vx_evidence_requests')
        .insert({
          project_id: project.id,
          analysis_run_id: analysis_run_id || null,
          evidence_type,
          title: title || evidence_type,
          rationale: rationale || 'Verification recommendation from MVS',
          priority: priority || 'high',
          status: 'requested',
          requested_by: user.email,
          synthetic_watermark: true,
        })
        .select()
        .single();
      if (error) throw error;

      await auditLog('request_evidence', 'evidence_request', data.id, { evidence_type, project_code }, user);
      return res.status(201).json({ request: data, watermark: SYNTHETIC_WATERMARK, message: 'Evidence request recorded' });
    }

    if (req.method === 'PUT') {
      const { id, status } = req.body || {};
      const { data, error } = await supabase
        .from('vx_evidence_requests')
        .update({ status })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return res.status(200).json(data);
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
