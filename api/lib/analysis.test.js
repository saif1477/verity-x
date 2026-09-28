import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeDrift,
  computeEFI,
  generateHypotheses,
  runAnalysisPipeline,
  filterKnowableEvents,
  computeMVS,
} from './analysis.js';

const project = {
  id: 1,
  project_code: '142',
  name: 'Anganwadi Centre',
  sanctioned_amount: 4800000,
  start_date: '2024-01-01',
  planned_duration_days: 120,
};

function ev(partial) {
  return {
    id: partial.id || Math.random().toString(36).slice(2),
    reliability: 0.8,
    ...partial,
  };
}

describe('Integrity Drift', () => {
  it('computes normalized weighted drift', () => {
    const d = computeDrift(
      { financial: 40, physical: 40, payment: 40, timeline: 40, execution: 40, procurement: 100, inspection: 1, completion: 0 },
      { financial: 84, physical: 35, payment: 84, timeline: 40, execution: 30, procurement: 100, inspection: 0, completion: 0 }
    );
    assert.ok(d.score > 20 && d.score <= 100);
    assert.ok(d.dimensions.payment.drift > 0);
  });
});

describe('Temporal filter', () => {
  it('excludes future-ingested events', () => {
    const events = [
      ev({ event_type: 'payment', event_time: '2024-02-10', recorded_at: '2024-02-10', published_at: '2024-02-10', ingested_at: '2024-02-11', amount: 100 }),
      ev({ event_type: 'inspection', event_time: '2024-03-01', recorded_at: '2024-03-01', published_at: '2024-03-01', ingested_at: '2024-04-01', progress_pct: 50 }),
    ];
    const k = filterKnowableEvents(events, '2024-01-01', 47);
    assert.equal(k.length, 1);
  });
});

describe('Pipeline Project 142 pattern', () => {
  it('detects payment-progress contradiction and hypotheses', () => {
    const events = [
      ev({ id: 'e1', event_type: 'sanction', event_time: '2024-01-01', recorded_at: '2024-01-01', published_at: '2024-01-01', ingested_at: '2024-01-01', description: 'Sanction' }),
      ev({ id: 'e2', event_type: 'work_order', event_time: '2024-01-06', recorded_at: '2024-01-06', published_at: '2024-01-06', ingested_at: '2024-01-06', description: 'WO' }),
      ev({ id: 'e3', event_type: 'payment', event_time: '2024-01-16', recorded_at: '2024-01-16', published_at: '2024-01-16', ingested_at: '2024-01-17', amount: 960000, description: 'P1' }),
      ev({ id: 'e4', event_type: 'progress', event_time: '2024-01-16', recorded_at: '2024-01-18', published_at: '2024-01-18', ingested_at: '2024-01-18', progress_pct: 10, description: 'Prog' }),
      ev({ id: 'e5', event_type: 'payment', event_time: '2024-01-26', recorded_at: '2024-01-26', published_at: '2024-01-26', ingested_at: '2024-01-27', amount: 1200000, description: 'P2' }),
      ev({ id: 'e6', event_type: 'payment', event_time: '2024-02-05', recorded_at: '2024-02-05', published_at: '2024-02-05', ingested_at: '2024-02-06', amount: 1200000, description: 'P3' }),
      ev({ id: 'e7', event_type: 'payment', event_time: '2024-02-12', recorded_at: '2024-02-12', published_at: '2024-02-12', ingested_at: '2024-02-13', amount: 672000, description: 'P4' }),
      ev({ id: 'e8', event_type: 'progress', event_time: '2024-02-15', recorded_at: '2024-02-16', published_at: '2024-02-16', ingested_at: '2024-02-16', progress_pct: 35, description: 'Prog 35' }),
      // future inspection — must not leak into day 47
      ev({ id: 'e9', event_type: 'inspection', event_time: '2024-03-10', recorded_at: '2024-03-10', published_at: '2024-03-10', ingested_at: '2024-03-11', progress_pct: 38, description: 'Late insp' }),
    ];
    const result = runAnalysisPipeline(project, events, { as_of_day: 47 });
    assert.ok(result.decision_aware_replay.snapshot.payment_pct >= 80);
    assert.ok(result.decision_aware_replay.snapshot.physical_progress_pct <= 40);
    assert.equal(result.decision_aware_replay.snapshot.inspection_available, false);
    assert.ok(result.contradictions.length >= 1);
    assert.ok(result.hypotheses.length >= 3);
    assert.ok(result.minimum_verification_set.items.length >= 3);
    assert.ok(result.integrity_drift.score > 0);
    assert.ok(result.evidence_friction.score >= 0);
    assert.equal(result.future_events_excluded, 1);
  });
});

describe('EFI and MVS', () => {
  it('EFI in 0-100', () => {
    const efi = computeEFI({
      qualityIssues: [{ issue_type: 'late_record' }],
      contradictions: [{}, {}],
      events: [{ reliability: 0.5, _is_delayed: true }],
      hypotheses: [{ missing_evidence: ['a', 'b'] }],
    });
    assert.ok(efi.score >= 0 && efi.score <= 100);
  });

  it('MVS includes core trio for payment mismatch', () => {
    const hyps = generateHypotheses(
      [{ contradiction_type: 'payment_progress', title: 'ppm' }],
      [
        { claim_type: 'payment_cumulative', value: 84 },
        { claim_type: 'physical_progress', value: 35 },
      ]
    );
    const mvs = computeMVS(hyps, [{ contradiction_type: 'payment_progress' }]);
    const ids = mvs.items.map((i) => i.id);
    assert.ok(ids.includes('field_inspection'));
    assert.ok(ids.includes('measurement_book'));
    assert.ok(ids.includes('payment_voucher'));
  });
});
