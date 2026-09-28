/** Deterministic synthetic seed data — fixed seed 142001 */
import { SCENARIO_TYPES, SYNTHETIC_WATERMARK } from './constants.js';

function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(142001);

function pick(arr) {
  return arr[Math.floor(rand() * arr.length)];
}

function addDays(start, days) {
  const d = new Date(start);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function ts(date, hour = 10) {
  return `${date}T${String(hour).padStart(2, '0')}:00:00.000Z`;
}

export function buildFlagship142() {
  const start = '2024-01-01';
  const project = {
    project_code: '142',
    name: 'Anganwadi Centre Construction — Ward 7',
    location: 'Synthetic District Alpha, Block Demo',
    constituency: 'Synthetic Constituency North',
    category: 'Social Infrastructure',
    sanctioned_amount: 4800000,
    start_date: start,
    planned_end_date: addDays(start, 120),
    planned_duration_days: 120,
    status: 'in_progress',
    contractor_name: 'Synthetic Build Co. (Demo)',
    implementing_agency: 'Demo District Programme Unit',
    scenario_type: 'PAYMENT_PROGRESS_MISMATCH',
    is_flagship: true,
    description:
      'Flagship synthetic demonstration: Anganwadi Centre, ₹48 lakh. Contains payment-progress mismatch, timeline drift, inspection gap, and multiple plausible hypotheses. Not official data.',
    synthetic_watermark: SYNTHETIC_WATERMARK,
  };

  const events = [];
  const push = (e) =>
    events.push({
      ...e,
      project_code: '142',
      source: e.source || 'synthetic_ledger',
      reliability: e.reliability ?? 0.82,
      synthetic_watermark: true,
    });

  push({
    event_type: 'sanction',
    description: 'Administrative sanction of ₹48,00,000 for Anganwadi Centre',
    event_time: ts(start, 9),
    recorded_at: ts(start, 11),
    published_at: ts(start, 12),
    ingested_at: ts(start, 14),
    amount: 4800000,
    status_value: 'sanctioned',
  });
  push({
    event_type: 'procurement',
    description: 'Tender floated (synthetic)',
    event_time: ts(addDays(start, 3), 10),
    recorded_at: ts(addDays(start, 3), 15),
    published_at: ts(addDays(start, 4), 10),
    ingested_at: ts(addDays(start, 4), 16),
  });
  push({
    event_type: 'work_order',
    description: 'Work order issued to Synthetic Build Co.',
    event_time: ts(addDays(start, 5), 11),
    recorded_at: ts(addDays(start, 5), 17),
    published_at: ts(addDays(start, 6), 9),
    ingested_at: ts(addDays(start, 6), 12),
  });
  push({
    event_type: 'mobilization',
    description: 'Site mobilization noted',
    event_time: ts(addDays(start, 10), 10),
    recorded_at: ts(addDays(start, 12), 10),
    published_at: ts(addDays(start, 12), 14),
    ingested_at: ts(addDays(start, 13), 9),
    progress_pct: 5,
  });

  // Payments ramp to ~84% by day 42; progress only to 35% by day 45
  const pays = [
    { day: 15, amount: 960000, prog: 10 }, // 20%
    { day: 25, amount: 1200000, prog: 18 }, // +25% → 45%
    { day: 35, amount: 1200000, prog: 28 }, // +25% → 70%
    { day: 42, amount: 672000, prog: 30 }, // +14% → 84%
  ];
  for (const p of pays) {
    push({
      event_type: 'payment',
      description: `Payment release ₹${p.amount.toLocaleString('en-IN')} (synthetic voucher)`,
      event_time: ts(addDays(start, p.day), 11),
      recorded_at: ts(addDays(start, p.day), 16),
      published_at: ts(addDays(start, p.day + 1), 10),
      ingested_at: ts(addDays(start, p.day + 1), 14),
      amount: p.amount,
      reliability: 0.88,
    });
    push({
      event_type: 'progress',
      description: `Progress report ${p.prog}% physical (self-reported)`,
      event_time: ts(addDays(start, p.day), 12),
      recorded_at: ts(addDays(start, p.day + 2), 10),
      published_at: ts(addDays(start, p.day + 2), 15),
      ingested_at: ts(addDays(start, p.day + 3), 9),
      progress_pct: p.prog,
      reliability: 0.62,
    });
  }

  push({
    event_type: 'progress',
    description: 'Consolidated physical progress assessment 35%',
    event_time: ts(addDays(start, 45), 10),
    recorded_at: ts(addDays(start, 46), 11),
    published_at: ts(addDays(start, 46), 16),
    ingested_at: ts(addDays(start, 46), 18),
    progress_pct: 35,
    reliability: 0.65,
  });

  push({
    event_type: 'status',
    description: 'Administrative status remains in_progress; inspection slot vacant',
    event_time: ts(addDays(start, 47), 9),
    recorded_at: ts(addDays(start, 47), 9),
    published_at: ts(addDays(start, 47), 10),
    ingested_at: ts(addDays(start, 47), 11),
    status_value: 'in_progress',
  });

  // Delayed/stale correction
  push({
    event_type: 'correction',
    description: 'Late correction to day-25 progress figure (synthetic stale record)',
    event_time: ts(addDays(start, 25), 10),
    recorded_at: ts(addDays(start, 44), 10),
    published_at: ts(addDays(start, 44), 12),
    ingested_at: ts(addDays(start, 45), 9),
    progress_pct: 17,
    reliability: 0.55,
  });

  // FUTURE events (after day 47 knowledge) — must not leak into day-47 replay
  push({
    event_type: 'inspection',
    description: 'Post-cutoff field inspection (not knowable at day 47)',
    event_time: ts(addDays(start, 55), 11),
    recorded_at: ts(addDays(start, 55), 17),
    published_at: ts(addDays(start, 56), 9),
    ingested_at: ts(addDays(start, 56), 12),
    progress_pct: 38,
    reliability: 0.9,
  });
  push({
    event_type: 'completion',
    description: 'Premature completion claim (future, conflicting)',
    event_time: ts(addDays(start, 70), 10),
    recorded_at: ts(addDays(start, 70), 10),
    published_at: ts(addDays(start, 71), 10),
    ingested_at: ts(addDays(start, 71), 14),
    status_value: 'completed',
    progress_pct: 100,
    reliability: 0.5,
  });
  push({
    event_type: 'payment',
    description: 'Further payment after day 47 (future)',
    event_time: ts(addDays(start, 60), 11),
    recorded_at: ts(addDays(start, 60), 15),
    published_at: ts(addDays(start, 61), 10),
    ingested_at: ts(addDays(start, 61), 12),
    amount: 200000,
  });

  const evidence = [
    {
      evidence_type: 'sanction_order',
      title: 'Sanction order (synthetic)',
      content: '₹48 lakh sanctioned for Anganwadi Centre',
      source: 'admin_file',
      reliability: 0.95,
      event_time: ts(start),
      recorded_at: ts(start, 12),
      published_at: ts(start, 12),
      ingested_at: ts(start, 14),
      status: 'available',
    },
    {
      evidence_type: 'payment_voucher',
      title: 'Payment vouchers cumulative ~84%',
      content: 'Four payment releases totaling ₹40,32,000',
      source: 'treasury_synthetic',
      reliability: 0.88,
      event_time: ts(addDays(start, 42)),
      recorded_at: ts(addDays(start, 42), 16),
      published_at: ts(addDays(start, 43)),
      ingested_at: ts(addDays(start, 43), 14),
      status: 'available',
    },
    {
      evidence_type: 'progress_report',
      title: 'Physical progress 35%',
      content: 'Self-reported consolidated progress',
      source: 'ia_report',
      reliability: 0.65,
      event_time: ts(addDays(start, 45)),
      recorded_at: ts(addDays(start, 46)),
      published_at: ts(addDays(start, 46), 16),
      ingested_at: ts(addDays(start, 46), 18),
      status: 'available',
    },
    {
      evidence_type: 'field_inspection',
      title: 'Latest field inspection',
      content: 'Not available at day-47 knowledge cutoff',
      source: 'inspection_wing',
      reliability: 0,
      event_time: null,
      recorded_at: null,
      published_at: null,
      ingested_at: null,
      status: 'missing',
    },
    {
      evidence_type: 'measurement_book',
      title: 'Measurement book',
      content: 'Not filed in synthetic corpus at day 47',
      source: 'engineering',
      reliability: 0,
      event_time: null,
      recorded_at: null,
      published_at: null,
      ingested_at: null,
      status: 'missing',
    },
  ].map((e) => ({ ...e, project_code: '142', synthetic_watermark: true }));

  const ground_truth = {
    project_code: '142',
    scenario_type: 'PAYMENT_PROGRESS_MISMATCH',
    is_anomaly: true,
    ground_truth_json: {
      true_pattern: 'PAYMENT_PROGRESS_MISMATCH',
      notes: 'Hidden ground truth for evaluation only — never shown as accusation',
      expected_first_divergence_day_range: [30, 45],
      expected_contradictions: ['payment_progress', 'expenditure_milestone', 'status_timeline'],
    },
    synthetic_watermark: true,
  };

  return { project, events, evidence, ground_truth };
}

export function buildScenarioProjects(count = 120) {
  const districts = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon'];
  const types = ['Road', 'Toilet Block', 'Classroom', 'Water Tank', 'Community Hall', 'Health Sub-Centre', 'Anganwadi Centre', 'Drainage'];
  const contractors = ['Synthetic Build Co. (Demo)', 'Demo Infra LLP', 'Placeholder Works Ltd', 'Sample Civil JV', 'Mock Construct Pvt'];
  const projects = [];
  const events = [];
  const groundTruths = [];

  for (let i = 0; i < count; i++) {
    const code = String(200 + i);
    const scenario = SCENARIO_TYPES[i % SCENARIO_TYPES.length];
    const start = addDays('2023-06-01', Math.floor(rand() * 400));
    const sanctioned = Math.round((20 + rand() * 80) * 100000);
    const duration = 90 + Math.floor(rand() * 90);
    const contractor =
      scenario === 'CONTRACTOR_CONCENTRATION' ? 'Synthetic Build Co. (Demo)' : pick(contractors);

    projects.push({
      project_code: code,
      name: `${pick(types)} — Synthetic Site ${code}`,
      location: `Synthetic District ${pick(districts)}`,
      constituency: `Synthetic Seat ${Math.floor(rand() * 20) + 1}`,
      category: 'Public Works (Synthetic)',
      sanctioned_amount: sanctioned,
      start_date: start,
      planned_end_date: addDays(start, duration),
      planned_duration_days: duration,
      status: scenario === 'ABANDONED' ? 'stalled' : scenario === 'NORMAL' ? 'in_progress' : 'in_progress',
      contractor_name: contractor,
      implementing_agency: 'Demo District Programme Unit',
      scenario_type: scenario,
      is_flagship: false,
      description: `Synthetic scenario ${scenario}. ${SYNTHETIC_WATERMARK}`,
      synthetic_watermark: SYNTHETIC_WATERMARK,
    });

    // Generate a few events per scenario
    let payPct = 0;
    let phys = 0;
    const nPays = 3 + Math.floor(rand() * 3);
    for (let p = 0; p < nPays; p++) {
      const day = 10 + p * Math.floor(duration / (nPays + 1));
      let amount = Math.round(sanctioned * (0.15 + rand() * 0.2));
      let progInc = 8 + rand() * 15;

      if (scenario === 'PAYMENT_PROGRESS_MISMATCH' || scenario === 'COMBINED_ANOMALY') {
        amount = Math.round(sanctioned * (0.22 + rand() * 0.15));
        progInc = 3 + rand() * 6;
      }
      if (scenario === 'COST_INFLATION') {
        amount = Math.round(sanctioned * (0.28 + rand() * 0.1));
      }
      if (scenario === 'DELAYED') {
        // events shifted late
      }
      if (scenario === 'ABANDONED' && p > 1) {
        progInc = 0;
        amount = 0;
      }
      if (scenario === 'NORMAL') {
        amount = Math.round(sanctioned * (0.12 + rand() * 0.1));
        progInc = 12 + rand() * 12;
      }

      payPct += amount;
      phys = Math.min(100, phys + progInc);
      const delay = scenario === 'DELAYED' || scenario === 'DATA_INCONSISTENCY' ? 10 + Math.floor(rand() * 15) : 1;

      if (amount > 0) {
        events.push({
          project_code: code,
          event_type: 'payment',
          description: `Synthetic payment ${p + 1}`,
          event_time: ts(addDays(start, day)),
          recorded_at: ts(addDays(start, day + (scenario === 'DATA_INCONSISTENCY' ? 8 : 0))),
          published_at: ts(addDays(start, day + 1)),
          ingested_at: ts(addDays(start, day + delay)),
          amount,
          reliability: 0.75 + rand() * 0.2,
          synthetic_watermark: true,
          source: 'synthetic_ledger',
        });
      }
      events.push({
        project_code: code,
        event_type: 'progress',
        description: `Synthetic progress ${Math.round(phys)}%`,
        event_time: ts(addDays(start, day + 1)),
        recorded_at: ts(addDays(start, day + 2)),
        published_at: ts(addDays(start, day + 2)),
        ingested_at: ts(addDays(start, day + 2 + (scenario === 'DELAYED' ? 12 : 1))),
        progress_pct: Math.round(phys),
        reliability: 0.6 + rand() * 0.25,
        synthetic_watermark: true,
        source: 'ia_report',
      });

      if (scenario === 'DUPLICATE_LIKE' && p === 1) {
        events.push({
          project_code: code,
          event_type: 'payment',
          description: `Synthetic payment ${p + 1} duplicate-like`,
          event_time: ts(addDays(start, day)),
          recorded_at: ts(addDays(start, day)),
          published_at: ts(addDays(start, day + 1)),
          ingested_at: ts(addDays(start, day + 2)),
          amount,
          reliability: 0.5,
          synthetic_watermark: true,
          source: 'synthetic_ledger',
        });
      }
    }

    if (scenario !== 'ABANDONED' && rand() > 0.4) {
      events.push({
        project_code: code,
        event_type: 'inspection',
        description: 'Synthetic inspection',
        event_time: ts(addDays(start, Math.floor(duration * 0.5))),
        recorded_at: ts(addDays(start, Math.floor(duration * 0.5))),
        published_at: ts(addDays(start, Math.floor(duration * 0.5) + 1)),
        ingested_at: ts(addDays(start, Math.floor(duration * 0.5) + 2)),
        progress_pct: Math.round(phys * (0.9 + rand() * 0.1)),
        reliability: 0.85,
        synthetic_watermark: true,
        source: 'inspection_wing',
      });
    }

    if (scenario === 'DATA_INCONSISTENCY') {
      events.push({
        project_code: code,
        event_type: 'completion',
        description: 'Inconsistent completion flag',
        event_time: ts(addDays(start, 20)),
        recorded_at: ts(addDays(start, 20)),
        published_at: ts(addDays(start, 21)),
        ingested_at: ts(addDays(start, 22)),
        status_value: 'completed',
        progress_pct: 100,
        reliability: 0.4,
        synthetic_watermark: true,
        source: 'status_register',
      });
    }

    groundTruths.push({
      project_code: code,
      scenario_type: scenario,
      is_anomaly: scenario !== 'NORMAL',
      ground_truth_json: { true_pattern: scenario, seed: 142001 },
      synthetic_watermark: true,
    });
  }

  return { projects, events, groundTruths };
}
