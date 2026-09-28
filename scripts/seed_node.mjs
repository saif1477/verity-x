#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { buildFlagship142, buildScenarioProjects } from '../api/lib/seed-data.js';

function loadEnv() {
  const env = { ...process.env };
  try {
    for (const line of readFileSync('.env', 'utf8').split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#') || !t.includes('=')) continue;
      const i = t.indexOf('=');
      const k = t.slice(0, i).trim();
      let v = t.slice(i + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (!env[k]) env[k] = v;
    }
  } catch {}
  return env;
}

const env = loadEnv();
const force = process.argv.includes('--force');
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

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

async function main() {
  const { count } = await supabase.from('vx_projects').select('*', { count: 'exact', head: true });
  if (count > 0 && !force) {
    console.log(JSON.stringify({ status: 'already_seeded', project_count: count, hint: 'pass --force' }));
    return;
  }
  if (force && count > 0) {
    for (const t of tables) {
      await supabase.from(t).delete().gte('id', 0);
    }
  }

  const flag = buildFlagship142();
  const { data: p142, error: e1 } = await supabase.from('vx_projects').insert(flag.project).select().single();
  if (e1) throw e1;

  const events142 = flag.events.map(({ project_code, ...rest }) => ({ ...rest, project_id: p142.id }));
  const { error: e2 } = await supabase.from('vx_events').insert(events142);
  if (e2) throw e2;

  const evidence142 = flag.evidence.map(({ project_code, ...rest }) => ({ ...rest, project_id: p142.id }));
  await supabase.from('vx_evidence').insert(evidence142);

  const { project_code, ...gt } = flag.ground_truth;
  await supabase.from('vx_ground_truth').insert({ ...gt, project_id: p142.id });

  const { projects, events, groundTruths } = buildScenarioProjects(80);
  const codeToId = { 142: p142.id };
  for (let i = 0; i < projects.length; i += 40) {
    const chunk = projects.slice(i, i + 40);
    const { data, error } = await supabase.from('vx_projects').insert(chunk).select('id, project_code');
    if (error) throw error;
    for (const row of data) codeToId[row.project_code] = row.id;
  }

  const mapped = events
    .map(({ project_code, ...rest }) => ({ ...rest, project_id: codeToId[project_code] }))
    .filter((e) => e.project_id);
  for (let i = 0; i < mapped.length; i += 100) {
    const { error } = await supabase.from('vx_events').insert(mapped.slice(i, i + 100));
    if (error) throw error;
  }

  const gtRows = groundTruths
    .map((g) => ({
      project_id: codeToId[g.project_code],
      scenario_type: g.scenario_type,
      is_anomaly: g.is_anomaly,
      ground_truth_json: g.ground_truth_json,
      synthetic_watermark: true,
    }))
    .filter((g) => g.project_id);
  for (let i = 0; i < gtRows.length; i += 50) {
    await supabase.from('vx_ground_truth').insert(gtRows.slice(i, i + 50));
  }

  console.log(
    JSON.stringify(
      {
        status: 'seeded',
        flagship: '142',
        flagship_id: p142.id,
        extra: projects.length,
        seed: 142001,
        watermark:
          'Synthetic demonstration data. This application does not use or represent official government records.',
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
