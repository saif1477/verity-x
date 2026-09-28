import supabase from './db-client.js';
import { setCors, handleOptions } from './lib/cors.js';
import { buildFlagship142, buildScenarioProjects } from './lib/seed-data.js';
import { SYNTHETIC_WATERMARK } from './lib/constants.js';

async function clearSynthetic() {
  // Order matters for FKs — children first
  const tables = [
    'vx_audit_logs',
    'vx_simulation_runs',
    'vx_cases',
    'vx_evidence_requests',
    'vx_hypotheses',
    'vx_contradictions',
    'vx_analysis_runs',
    'vx_ground_truth',
    'vx_evidence',
    'vx_events',
    'vx_projects',
  ];
  for (const t of tables) {
    await supabase.from(t).delete().neq('id', 0);
  }
}

export default async function handler(req, res) {
  setCors(res);
  if (handleOptions(req, res)) return;

  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const force = req.method === 'POST' ? req.body?.force !== false : req.query?.force === '1';
    const extra = req.method === 'POST' ? Number(req.body?.extra_projects ?? 80) : Number(req.query?.extra ?? 80);

    const { count } = await supabase.from('vx_projects').select('*', { count: 'exact', head: true });
    if (count && count > 0 && !force) {
      const { data: flag } = await supabase.from('vx_projects').select('id, project_code').eq('project_code', '142').maybeSingle();
      return res.status(200).json({
        status: 'already_seeded',
        project_count: count,
        flagship: flag,
        message: 'Pass force=true to reseed',
        watermark: SYNTHETIC_WATERMARK,
      });
    }

    if (force && count > 0) await clearSynthetic();

    const flag = buildFlagship142();
    const { data: p142, error: e1 } = await supabase.from('vx_projects').insert(flag.project).select().single();
    if (e1) throw e1;

    const events142 = flag.events.map((e) => {
      const { project_code, ...rest } = e;
      return { ...rest, project_id: p142.id };
    });
    const { error: e2 } = await supabase.from('vx_events').insert(events142);
    if (e2) throw e2;

    const evidence142 = flag.evidence.map((e) => {
      const { project_code, ...rest } = e;
      return { ...rest, project_id: p142.id };
    });
    await supabase.from('vx_evidence').insert(evidence142);

    await supabase.from('vx_ground_truth').insert({
      ...flag.ground_truth,
      project_id: p142.id,
      project_code: undefined,
    });

    const { projects, events, groundTruths } = buildScenarioProjects(extra);
    // insert in batches
    const batchSize = 40;
    const codeToId = { 142: p142.id };
    for (let i = 0; i < projects.length; i += batchSize) {
      const chunk = projects.slice(i, i + batchSize);
      const { data, error } = await supabase.from('vx_projects').insert(chunk).select('id, project_code');
      if (error) throw error;
      for (const row of data) codeToId[row.project_code] = row.id;
    }

    const mappedEvents = events
      .map((e) => {
        const { project_code, ...rest } = e;
        const project_id = codeToId[project_code];
        if (!project_id) return null;
        return { ...rest, project_id };
      })
      .filter(Boolean);

    for (let i = 0; i < mappedEvents.length; i += 100) {
      const { error } = await supabase.from('vx_events').insert(mappedEvents.slice(i, i + 100));
      if (error) throw error;
    }

    const gtRows = groundTruths
      .map((g) => {
        const project_id = codeToId[g.project_code];
        if (!project_id) return null;
        return {
          project_id,
          scenario_type: g.scenario_type,
          is_anomaly: g.is_anomaly,
          ground_truth_json: g.ground_truth_json,
          synthetic_watermark: true,
        };
      })
      .filter(Boolean);

    for (let i = 0; i < gtRows.length; i += 50) {
      await supabase.from('vx_ground_truth').insert(gtRows.slice(i, i + 50));
    }

    // flagship gt fix - already inserted

    return res.status(201).json({
      status: 'seeded',
      flagship_project_code: '142',
      flagship_id: p142.id,
      extra_projects: projects.length,
      events_flagship: events142.length,
      events_extra: mappedEvents.length,
      watermark: SYNTHETIC_WATERMARK,
      seed: 142001,
      deterministic: true,
      idempotent_note: 'Re-run with force=true to replace',
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
