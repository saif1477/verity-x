import supabase from './db-client.js';
import { setCors, handleOptions } from './lib/cors.js';
import { runAnalysisPipeline } from './lib/analysis.js';
import { SYNTHETIC_WATERMARK } from './lib/constants.js';

export default async function handler(req, res) {
  setCors(res);
  if (handleOptions(req, res)) return;

  try {
    if (req.method !== 'GET' && req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const limit = Number(req.query?.limit || req.body?.limit || 40);
    const { data: projects } = await supabase.from('vx_projects').select('*').limit(limit);
    const { data: truths } = await supabase.from('vx_ground_truth').select('*');
    const truthMap = Object.fromEntries((truths || []).map((t) => [t.project_id, t]));

    let tp = 0,
      fp = 0,
      tn = 0,
      fn = 0;
    let divergenceHits = 0,
      divergenceTotal = 0;
    let contradictionHits = 0,
      contradictionTotal = 0;
    const ablation = {
      full: { tp: 0, fp: 0, fn: 0, tn: 0 },
    };

    for (const p of projects || []) {
      const { data: events } = await supabase.from('vx_events').select('*').eq('project_id', p.id);
      const asOf = Math.min(47, Math.floor((p.planned_duration_days || 120) * 0.4));
      const result = runAnalysisPipeline(p, events || [], { as_of_day: asOf });
      const gt = truthMap[p.id];
      const predictedAnomaly = result.integrity_drift.score >= 30 || result.contradictions.length >= 1;
      const actualAnomaly = gt ? gt.is_anomaly : p.scenario_type !== 'NORMAL';

      if (predictedAnomaly && actualAnomaly) tp++;
      else if (predictedAnomaly && !actualAnomaly) fp++;
      else if (!predictedAnomaly && !actualAnomaly) tn++;
      else fn++;

      if (gt?.ground_truth_json?.expected_contradictions) {
        contradictionTotal++;
        const types = result.contradictions.map((c) => c.contradiction_type);
        if (gt.ground_truth_json.expected_contradictions.some((t) => types.includes(t))) contradictionHits++;
      }
      if (gt?.ground_truth_json?.expected_first_divergence_day_range && result.earliest_actionable_divergence) {
        divergenceTotal++;
        const [lo, hi] = gt.ground_truth_json.expected_first_divergence_day_range;
        const d = result.earliest_actionable_divergence.day;
        if (d >= lo && d <= hi) divergenceHits++;
      }
    }

    const precision = tp + fp ? tp / (tp + fp) : 0;
    const recall = tp + fn ? tp / (tp + fn) : 0;
    const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
    const fpr = fp + tn ? fp / (fp + tn) : 0;

    return res.status(200).json({
      sample_size: projects?.length || 0,
      metrics: {
        precision: round(precision),
        recall: round(recall),
        f1: round(f1),
        false_positive_rate: round(fpr),
        tp,
        fp,
        tn,
        fn,
        contradiction_accuracy: contradictionTotal ? round(contradictionHits / contradictionTotal) : null,
        first_divergence_accuracy: divergenceTotal ? round(divergenceHits / divergenceTotal) : null,
        detection_latency_note: 'Earliest divergence day used as latency proxy when ground truth range present',
        mvs_coverage_note: 'MVS coverage scored in analysis.minimum_verification_set.coverage_score',
        temporal_provenance_accuracy_note: 'Future-ingested events excluded in filterKnowableEvents unit tests',
      },
      ablations_documented: [
        'remove_temporal_provenance',
        'remove_drift',
        'remove_contradiction',
        'remove_hypotheses',
        'remove_friction',
        'remove_mvs',
        'remove_counterfactuals',
      ],
      ablation_note:
        'Full ablation sweep is available via offline pytest; online endpoint reports full-pipeline metrics on seed sample.',
      watermark: SYNTHETIC_WATERMARK,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}

function round(n) {
  return Math.round(n * 1000) / 1000;
}
