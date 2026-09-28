import supabase from './db-client.js';
import { setCors, handleOptions } from './lib/cors.js';
import { SYNTHETIC_WATERMARK } from './lib/constants.js';

export default async function handler(req, res) {
  setCors(res);
  if (handleOptions(req, res)) return;

  try {
    if (req.method === 'GET') {
      const { code, flagship, scenario, limit } = req.query || {};
      let q = supabase.from('vx_projects').select('*').order('is_flagship', { ascending: false }).order('project_code');
      if (code) q = q.eq('project_code', String(code));
      if (flagship === '1' || flagship === 'true') q = q.eq('is_flagship', true);
      if (scenario) q = q.eq('scenario_type', scenario);
      if (limit) q = q.limit(Number(limit));
      else q = q.limit(200);

      const { data, error } = await q;
      if (error) throw error;

      if (code && data?.length === 1) {
        const project = data[0];
        const { data: events } = await supabase
          .from('vx_events')
          .select('*')
          .eq('project_id', project.id)
          .order('event_time', { ascending: true });
        const { data: evidence } = await supabase
          .from('vx_evidence')
          .select('*')
          .eq('project_id', project.id);
        return res.status(200).json({
          ...project,
          events: events || [],
          evidence: evidence || [],
          watermark: SYNTHETIC_WATERMARK,
        });
      }

      return res.status(200).json({ projects: data || [], watermark: SYNTHETIC_WATERMARK });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
