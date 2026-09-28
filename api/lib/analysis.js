/**
 * VERITY-X Temporal Evidence Verification Engine
 * Deterministic analysis — no LLM required for core pipeline.
 */
import {
  DRIFT_WEIGHTS,
  EFI_WEIGHTS,
  EPSILON,
  DEFAULT_THRESHOLDS,
  EVIDENCE_CATALOG,
  SYNTHETIC_WATERMARK,
  clamp,
  round2,
} from './constants.js';

function dayDiff(startISO, atISO) {
  const a = new Date(startISO);
  const b = new Date(atISO);
  return Math.floor((b - a) / (86400000));
}

function addDays(startISO, days) {
  const d = new Date(startISO);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Filter events knowable at as_of without future leakage */
export function filterKnowableEvents(events, projectStart, asOfDay) {
  const cutoffDate = addDays(projectStart, asOfDay);
  return events.filter((e) => {
    const ingestedDay = dayDiff(projectStart, e.ingested_at?.slice(0, 10) || e.event_time);
    const publishedDay = dayDiff(projectStart, e.published_at?.slice(0, 10) || e.event_time);
    // Knowledge cutoff: only what was ingested by as_of day
    return ingestedDay <= asOfDay && publishedDay <= asOfDay + 2;
  }).map((e) => {
    const eventDay = dayDiff(projectStart, e.event_time?.slice(0, 10));
    const recordedDay = dayDiff(projectStart, e.recorded_at?.slice(0, 10) || e.event_time);
    const ingestedDay = dayDiff(projectStart, e.ingested_at?.slice(0, 10) || e.event_time);
    return {
      ...e,
      _event_day: eventDay,
      _recorded_day: recordedDay,
      _ingested_day: ingestedDay,
      _is_retroactive: recordedDay > eventDay + 3,
      _is_delayed: ingestedDay > eventDay + 7,
      _sync_delay: Math.max(0, ingestedDay - eventDay),
    };
  });
}

export function detectDataQuality(events, project) {
  const issues = [];
  const seen = new Map();
  for (const e of events) {
    if (!e.event_time || !e.recorded_at || !e.ingested_at) {
      issues.push({ issue_type: 'missing_timestamp', severity: 'high', description: `Event ${e.id || e.event_type} missing required timestamps`, event_ref: e.id });
    }
    if (e.amount != null && Number(e.amount) < 0) {
      issues.push({ issue_type: 'negative_expenditure', severity: 'high', description: 'Negative expenditure recorded', event_ref: e.id });
    }
    if (e.progress_pct != null && (e.progress_pct < 0 || e.progress_pct > 100)) {
      issues.push({ issue_type: 'invalid_progress', severity: 'high', description: `Invalid progress ${e.progress_pct}%`, event_ref: e.id });
    }
    if (e._is_retroactive) {
      issues.push({ issue_type: 'retroactive_record', severity: 'medium', description: `Retroactive recording delay ${e._recorded_day - e._event_day}d`, event_ref: e.id });
    }
    if (e._is_delayed) {
      issues.push({ issue_type: 'late_record', severity: 'medium', description: `Late ingestion delay ${e._sync_delay}d`, event_ref: e.id });
    }
    const key = `${e.event_type}|${e.event_time}|${e.amount}|${e.progress_pct}`;
    if (seen.has(key)) {
      issues.push({ issue_type: 'duplicate_like', severity: 'medium', description: 'Duplicate-like record pattern', event_ref: e.id });
    }
    seen.set(key, true);
    if (e.event_type === 'completion' && e._event_day < 0) {
      issues.push({ issue_type: 'completion_before_sanction', severity: 'critical', description: 'Completion before sanction', event_ref: e.id });
    }
  }
  const payments = events.filter((e) => e.event_type === 'payment' || e.amount > 0);
  const totalPaid = payments.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  if (project?.sanctioned_amount && totalPaid > Number(project.sanctioned_amount) * 1.05) {
    issues.push({ issue_type: 'excess_payment', severity: 'high', description: `Cumulative payment ${totalPaid} exceeds sanction`, event_ref: null });
  }
  const inspections = events.filter((e) => e.event_type === 'inspection');
  if (inspections.length === 0 && events.some((e) => e.progress_pct >= 50)) {
    issues.push({ issue_type: 'missing_inspections', severity: 'high', description: 'No inspection records while progress claimed ≥50%', event_ref: null });
  }
  return issues;
}

function expectedPhysical(day, durationDays = 120) {
  // S-curve-ish planned physical progress
  const t = Math.min(1, Math.max(0, day / durationDays));
  const curve = t < 0.2 ? t * 0.5 : t < 0.8 ? 0.1 + (t - 0.2) * 1.2 : 0.82 + (t - 0.8) * 0.9;
  return clamp(curve * 100, 0, 100);
}

function expectedPayment(day, durationDays = 120) {
  // Payments lag physical slightly in plan
  const phys = expectedPhysical(day, durationDays);
  return clamp(phys * 0.85, 0, 95);
}

function expectedInspection(day) {
  if (day < 30) return 0;
  if (day < 60) return 1;
  if (day < 90) return 2;
  return 3;
}

function latestValue(events, predicate, field, fallback = 0) {
  const matched = events.filter(predicate).sort((a, b) => b._event_day - a._event_day);
  if (!matched.length) return fallback;
  const v = matched[0][field];
  return v == null ? fallback : Number(v);
}

function cumulativePayment(events, sanctioned) {
  const pays = events.filter((e) => e.event_type === 'payment' || (e.amount != null && ['payment', 'advance', 'mobilization_advance'].includes(e.event_type)));
  const total = pays.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  if (!sanctioned) return { amount: total, pct: 0 };
  return { amount: total, pct: round2((total / Number(sanctioned)) * 100) };
}

export function buildTrajectories(events, project, asOfDay) {
  const duration = project.planned_duration_days || 120;
  const sanctioned = Number(project.sanctioned_amount) || 4800000;
  const expected = [];
  const observed = [];
  for (let d = 0; d <= asOfDay; d += 1) {
    const evUpTo = events.filter((e) => e._event_day <= d && e._ingested_day <= asOfDay);
    const pay = cumulativePayment(evUpTo, sanctioned);
    const phys = latestValue(evUpTo, (e) => e.progress_pct != null && ['progress', 'inspection', 'measurement', 'status'].includes(e.event_type), 'progress_pct', latestValue(evUpTo, (e) => e.progress_pct != null, 'progress_pct', 0));
    const inspCount = evUpTo.filter((e) => e.event_type === 'inspection').length;
    const expPhys = expectedPhysical(d, duration);
    const expPay = expectedPayment(d, duration);
    expected.push({
      day: d,
      physical: round2(expPhys),
      payment: round2(expPay),
      financial: round2(expPay),
      inspection: expectedInspection(d),
      timeline: round2((d / duration) * 100),
      execution: round2(expPhys * 0.95),
      procurement: d >= 5 ? 100 : round2((d / 5) * 100),
      completion: d >= duration ? 100 : 0,
    });
    observed.push({
      day: d,
      physical: round2(phys),
      payment: round2(pay.pct),
      financial: round2(pay.pct),
      inspection: inspCount,
      timeline: round2((d / duration) * 100),
      execution: round2(phys * 0.9),
      procurement: evUpTo.some((e) => e.event_type === 'procurement' || e.event_type === 'work_order') ? 100 : 0,
      completion: evUpTo.some((e) => e.event_type === 'completion') ? 100 : 0,
      payment_amount: pay.amount,
    });
  }
  return { expected, observed, duration, sanctioned };
}

export function computeDrift(expectedPoint, observedPoint) {
  const dimensions = {};
  let weighted = 0;
  for (const [dim, w] of Object.entries(DRIFT_WEIGHTS)) {
    const exp = expectedPoint[dim] ?? 0;
    const obs = observedPoint[dim] ?? 0;
    const range = Math.max(Math.abs(exp), 10) + EPSILON;
    const drift = Math.abs(exp - obs) / (range + EPSILON);
    const scaled = clamp(drift * 100, 0, 100);
    dimensions[dim] = {
      dimension: dim,
      expected: round2(exp),
      observed: round2(obs),
      drift: round2(scaled),
      weight: w,
      weighted_drift: round2(scaled * w),
      formula: `Drift_${dim}=|${round2(exp)}-${round2(obs)}|/(${round2(range)}+ε)=${round2(scaled)}`,
    };
    weighted += scaled * w;
  }
  return {
    score: round2(clamp(weighted, 0, 100)),
    dimensions,
    formula: `Σ(w_d×Drift_d)=${round2(weighted)} (normalized 0–100)`,
  };
}

export function extractClaims(events, project, asOfDay) {
  const sanctioned = Number(project.sanctioned_amount) || 4800000;
  const pay = cumulativePayment(events, sanctioned);
  const phys = latestValue(events, (e) => e.progress_pct != null, 'progress_pct', 0);
  const inspections = events.filter((e) => e.event_type === 'inspection');
  const completions = events.filter((e) => e.event_type === 'completion');
  const claims = [];

  claims.push({
    claim_type: 'payment_cumulative',
    statement: `Cumulative payment stands at ${pay.pct}% of sanctioned amount (₹${pay.amount.toLocaleString('en-IN')})`,
    value: pay.pct,
    unit: 'percent',
    source: 'payment_ledger',
    event_time: events.find((e) => e.event_type === 'payment')?.event_time || null,
    confidence: 0.85,
    evidence_refs: events.filter((e) => e.event_type === 'payment').map((e) => e.id),
  });

  claims.push({
    claim_type: 'physical_progress',
    statement: `Reported physical progress is ${phys}%`,
    value: phys,
    unit: 'percent',
    source: 'progress_reports',
    event_time: events.filter((e) => e.progress_pct != null).slice(-1)[0]?.event_time || null,
    confidence: phys > 0 ? 0.7 : 0.3,
    evidence_refs: events.filter((e) => e.progress_pct != null).map((e) => e.id),
  });

  claims.push({
    claim_type: 'inspection_status',
    statement: inspections.length
      ? `${inspections.length} inspection(s) on record; latest progress note ${inspections.slice(-1)[0].progress_pct ?? 'n/a'}%`
      : 'No field inspection available as of knowledge cutoff',
    value: inspections.length,
    unit: 'count',
    source: 'inspection_register',
    event_time: inspections.slice(-1)[0]?.event_time || null,
    confidence: inspections.length ? 0.8 : 0.55,
    evidence_refs: inspections.map((e) => e.id),
  });

  claims.push({
    claim_type: 'completion_status',
    statement: completions.length
      ? `Completion claimed on ${completions[0].event_time}`
      : 'Project not marked complete',
    value: completions.length ? 1 : 0,
    unit: 'boolean',
    source: 'status_register',
    event_time: completions[0]?.event_time || null,
    confidence: 0.75,
    evidence_refs: completions.map((e) => e.id),
  });

  claims.push({
    claim_type: 'timeline_position',
    statement: `As-of project day ${asOfDay} of planned ${project.planned_duration_days || 120}`,
    value: asOfDay,
    unit: 'day',
    source: 'project_schedule',
    event_time: addDays(project.start_date, asOfDay),
    confidence: 0.95,
    evidence_refs: [],
  });

  const advances = events.filter((e) => e.event_type === 'mobilization_advance' || e.event_type === 'advance');
  if (advances.length) {
    const advAmt = advances.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    claims.push({
      claim_type: 'approved_advance',
      statement: `Approved advance/mobilization totaling ₹${advAmt.toLocaleString('en-IN')}`,
      value: advAmt,
      unit: 'INR',
      source: 'payment_ledger',
      event_time: advances[0].event_time,
      confidence: 0.9,
      evidence_refs: advances.map((e) => e.id),
    });
  }

  return claims;
}

export function detectContradictions(claims, events, drift) {
  const byType = Object.fromEntries(claims.map((c) => [c.claim_type, c]));
  const contradictions = [];

  const pay = byType.payment_cumulative;
  const phys = byType.physical_progress;
  if (pay && phys && pay.value - phys.value >= 25) {
    contradictions.push({
      contradiction_type: 'payment_progress',
      title: 'Payment vs physical progress mismatch',
      description: `Payment claim ${pay.value}% diverges from physical progress ${phys.value}% (gap ${round2(pay.value - phys.value)} pp). Investigation risk elevated; human review required.`,
      severity: pay.value - phys.value >= 40 ? 'high' : 'medium',
      confidence: round2(Math.min(0.95, 0.5 + (pay.value - phys.value) / 100)),
      claim_a: pay,
      claim_b: phys,
      evidence_conflict: true,
    });
  }

  const insp = byType.inspection_status;
  const comp = byType.completion_status;
  if (comp?.value === 1 && (!insp || insp.value === 0)) {
    contradictions.push({
      contradiction_type: 'completion_inspection',
      title: 'Completion claimed without inspection',
      description: 'Completion status conflicts with absent inspection record. Possible explanation set remains open.',
      severity: 'high',
      confidence: 0.8,
      claim_a: comp,
      claim_b: insp,
      evidence_conflict: true,
    });
  }

  if (phys && insp && insp.value === 0 && phys.value >= 30) {
    contradictions.push({
      contradiction_type: 'status_timeline',
      title: 'Progress reported without available inspection',
      description: `Physical progress ${phys.value}% with inspection unavailable at knowledge cutoff. Evidence friction elevated.`,
      severity: 'medium',
      confidence: 0.72,
      claim_a: phys,
      claim_b: insp,
      evidence_conflict: true,
    });
  }

  if (drift.dimensions?.timeline && drift.dimensions.timeline.drift > 40) {
    contradictions.push({
      contradiction_type: 'timeline_execution',
      title: 'Timeline vs execution deviation',
      description: `Timeline/execution drift ${drift.dimensions.timeline.drift} indicates schedule-state divergence.`,
      severity: 'medium',
      confidence: 0.65,
      claim_a: byType.timeline_position,
      claim_b: phys,
      evidence_conflict: true,
    });
  }

  const late = events.filter((e) => e._is_delayed || e._is_retroactive);
  if (late.length >= 2) {
    contradictions.push({
      contradiction_type: 'administrative_execution',
      title: 'Administrative recording lag vs execution claims',
      description: `${late.length} records show delayed/retroactive administrative capture relative to event time.`,
      severity: 'low',
      confidence: 0.6,
      claim_a: byType.timeline_position,
      claim_b: pay,
      evidence_conflict: true,
    });
  }

  // expenditure vs milestone
  if (pay && phys && pay.value > 60 && phys.value < 40) {
    contradictions.push({
      contradiction_type: 'expenditure_milestone',
      title: 'Expenditure ahead of milestone attainment',
      description: 'High expenditure share relative to milestone progress. Competing hypotheses required.',
      severity: 'high',
      confidence: 0.78,
      claim_a: pay,
      claim_b: phys,
      evidence_conflict: true,
    });
  }

  return contradictions;
}

function hypothesisTemplates(c, claims) {
  const pay = claims.find((x) => x.claim_type === 'payment_cumulative');
  const phys = claims.find((x) => x.claim_type === 'physical_progress');
  const gap = pay && phys ? round2(pay.value - phys.value) : 0;

  const base = [
    {
      label: 'H1: Legitimate mobilization / advance payment',
      description:
        'Payments include approved mobilization advance or front-loaded legitimate disbursements not yet reflected in measured physical work. Possible explanation — not an accusation.',
      support: ['payment_records', 'sanction_terms'],
      contradict: phys?.value > 0 ? ['low_physical_progress'] : [],
      missing: ['approved_advance_order', 'mobilization_certificate'],
      support_score: 0.55,
      contradiction_score: gap > 40 ? 0.35 : 0.2,
      missing_penalty: 0.25,
    },
    {
      label: 'H2: Measurement lag / delayed progress reporting',
      description:
        'Physical work may have progressed further than last recorded measurement; reporting lag creates apparent mismatch. Evidence confidence limited by stale progress data.',
      support: ['late_records', 'reporting_delays'],
      contradict: ['no_recent_inspection'],
      missing: ['measurement_book', 'fresh_field_inspection'],
      support_score: 0.5,
      contradiction_score: 0.25,
      missing_penalty: 0.3,
    },
    {
      label: 'H3: Execution shortfall relative to disbursement schedule',
      description:
        'Observed physical state may lag planned execution while payments followed schedule. Investigation risk — requires verification, not determination of wrongdoing.',
      support: ['payment_progress_gap', 'integrity_drift'],
      contradict: ['approved_advance_if_present'],
      missing: ['site_inspection', 'work_quantity_bill'],
      support_score: 0.6,
      contradiction_score: 0.15,
      missing_penalty: 0.28,
    },
    {
      label: 'H4: Data inconsistency / source disagreement',
      description:
        'Ledger, progress, and administrative sources may disagree due to entity ambiguity, duplicate-like entries, or synchronization delays. Prefer evidence repair before adverse inference.',
      support: ['data_quality_flags', 'temporal_uncertainty'],
      contradict: [],
      missing: ['reconciled_ledger', 'source_crosswalk'],
      support_score: 0.45,
      contradiction_score: 0.1,
      missing_penalty: 0.22,
    },
  ];

  if (c.contradiction_type === 'completion_inspection') {
    return [
      {
        label: 'H1: Premature administrative completion entry',
        description: 'Status updated administratively before independent inspection. Human review required.',
        support: ['completion_without_inspection'],
        contradict: [],
        missing: ['independent_inspection'],
        support_score: 0.65,
        contradiction_score: 0.1,
        missing_penalty: 0.3,
      },
      {
        label: 'H2: Inspection performed but not ingested',
        description: 'Inspection may exist offline; temporal evidence gap.',
        support: ['ingestion_delays'],
        contradict: [],
        missing: ['inspection_upload'],
        support_score: 0.4,
        contradiction_score: 0.2,
        missing_penalty: 0.35,
      },
      {
        label: 'H3: Partial completion mislabeled',
        description: 'Partial works recorded as complete due to coding error.',
        support: ['status_coding'],
        contradict: ['progress_below_100'],
        missing: ['completion_certificate'],
        support_score: 0.5,
        contradiction_score: 0.25,
        missing_penalty: 0.25,
      },
      {
        label: 'H4: Source disagreement across systems',
        description: 'Multiple systems disagree on completion state.',
        support: ['multi_source'],
        contradict: [],
        missing: ['master_status_reconcile'],
        support_score: 0.42,
        contradiction_score: 0.12,
        missing_penalty: 0.2,
      },
    ];
  }

  return base;
}

export function generateHypotheses(contradictions, claims) {
  const all = [];
  for (const c of contradictions) {
    const templates = hypothesisTemplates(c, claims);
    for (const t of templates) {
      const hScore = round2(t.support_score - t.contradiction_score - t.missing_penalty);
      all.push({
        contradiction_type: c.contradiction_type,
        contradiction_title: c.title,
        label: t.label,
        description: t.description,
        supporting_evidence: t.support,
        contradicting_evidence: t.contradict,
        missing_evidence: t.missing,
        support_score: t.support_score,
        contradiction_score: t.contradiction_score,
        missing_penalty: t.missing_penalty,
        h_score: hScore,
        confidence: clamp(50 + hScore * 40, 15, 90),
        note: 'HScore=Support−Contradiction−MissingEvidencePenalty. Not a probability of guilt.',
      });
    }
  }
  // Ensure at least 3-4 for major case even if few contradictions
  if (all.length < 4 && contradictions.length) {
    // already 4 per major
  } else if (!contradictions.length) {
    all.push({
      contradiction_type: 'none',
      contradiction_title: 'No major contradiction',
      label: 'H1: Records broadly consistent',
      description: 'No major evidence conflict detected at this cutoff. Residual uncertainty remains.',
      supporting_evidence: ['aligned_trajectories'],
      contradicting_evidence: [],
      missing_evidence: ['periodic_inspection'],
      support_score: 0.7,
      contradiction_score: 0.05,
      missing_penalty: 0.1,
      h_score: 0.55,
      confidence: 70,
      note: 'HScore is not guilt probability.',
    });
  }
  return all.sort((a, b) => b.h_score - a.h_score);
}

export function computeEFI({ qualityIssues, contradictions, events, hypotheses }) {
  const missingEvidence = hypotheses.reduce((s, h) => s + (h.missing_evidence?.length || 0), 0);
  const missingNorm = clamp((missingEvidence / Math.max(hypotheses.length * 3, 1)) * 100, 0, 100);
  const contradictionDensity = clamp(contradictions.length * 18, 0, 100);
  const fragile = events.filter((e) => (e.reliability ?? 0.7) < 0.65).length;
  const sourceFragility = clamp((fragile / Math.max(events.length, 1)) * 100 + qualityIssues.filter((q) => q.issue_type === 'duplicate_like').length * 10, 0, 100);
  const temporalUncertainty = clamp(
    events.filter((e) => e._is_delayed || e._is_retroactive).length * 12 +
      qualityIssues.filter((q) => ['late_record', 'retroactive_record'].includes(q.issue_type)).length * 8,
    0,
    100
  );
  const entityAmbiguity = clamp(qualityIssues.filter((q) => q.issue_type === 'entity_ambiguity').length * 25, 0, 40);

  const score = round2(
    clamp(
      EFI_WEIGHTS.missing * missingNorm +
        EFI_WEIGHTS.contradiction * contradictionDensity +
        EFI_WEIGHTS.source_fragility * sourceFragility +
        EFI_WEIGHTS.temporal_uncertainty * temporalUncertainty +
        EFI_WEIGHTS.entity_ambiguity * entityAmbiguity,
      0,
      100
    )
  );

  return {
    score,
    components: {
      missing_evidence: round2(missingNorm),
      contradiction_density: round2(contradictionDensity),
      source_fragility: round2(sourceFragility),
      temporal_uncertainty: round2(temporalUncertainty),
      entity_ambiguity: round2(entityAmbiguity),
    },
    weights: EFI_WEIGHTS,
    formula:
      'EFI=wm×Missing+wc×ContradictionDensity+ws×SourceFragility+wt×TemporalUncertainty+we×EntityAmbiguity',
  };
}

export function computeMVS(hypotheses, contradictions) {
  const needed = new Set();
  for (const h of hypotheses.slice(0, 8)) {
    for (const m of h.missing_evidence || []) needed.add(m);
  }
  // Map missing tags to catalog items
  const tagMap = {
    approved_advance_order: 'payment_voucher',
    mobilization_certificate: 'payment_voucher',
    measurement_book: 'measurement_book',
    fresh_field_inspection: 'field_inspection',
    site_inspection: 'field_inspection',
    work_quantity_bill: 'measurement_book',
    independent_inspection: 'field_inspection',
    inspection_upload: 'field_inspection',
    completion_certificate: 'completion_certificate',
    reconciled_ledger: 'contractor_ledger',
    source_crosswalk: 'procurement_file',
    payment_voucher: 'payment_voucher',
    geo_photo: 'geo_photo',
  };

  const selectedIds = new Set();
  for (const tag of needed) {
    const id = tagMap[tag] || (EVIDENCE_CATALOG.find((c) => c.covers.some((x) => tag.includes(x)))?.id);
    if (id) selectedIds.add(id);
  }
  // Always prioritize core MVS for payment-progress cases
  if (contradictions.some((c) => ['payment_progress', 'expenditure_milestone'].includes(c.contradiction_type))) {
    selectedIds.add('field_inspection');
    selectedIds.add('measurement_book');
    selectedIds.add('payment_voucher');
  }

  const items = EVIDENCE_CATALOG.filter((c) => selectedIds.has(c.id)).map((c) => {
    const hypSep = hypotheses.filter((h) =>
      (h.missing_evidence || []).some((m) => tagMap[m] === c.id || m.includes(c.id.split('_')[0]))
    ).length;
    const verification_value = round2(
      hypSep * 18 + c.reliability * 40 + 20 - c.cost * 0.8 - c.time_days * 1.5
    );
    return {
      ...c,
      hypothesis_separation: hypSep,
      verification_value,
      recommendation: 'Verification recommendation — collect to separate competing hypotheses',
    };
  });

  items.sort((a, b) => b.verification_value - a.verification_value);

  // Greedy lowest-cost covering set
  const coverTags = new Set(needed);
  const chosen = [];
  const remaining = [...items].sort((a, b) => a.cost - b.cost || b.verification_value - a.verification_value);
  const covered = new Set();
  for (const item of remaining) {
    const itemTags = [...coverTags].filter((t) => tagMap[t] === item.id);
    if (itemTags.length || chosen.length < 3) {
      chosen.push(item);
      itemTags.forEach((t) => covered.add(t));
    }
    if (chosen.length >= 5) break;
  }
  if (!chosen.length) chosen.push(...items.slice(0, 3));

  const totalCost = chosen.reduce((s, i) => s + i.cost, 0);
  const coverage = coverTags.size ? round2((covered.size / coverTags.size) * 100) : chosen.length ? 80 : 0;

  return {
    items: chosen,
    ranked_all: items,
    total_cost: totalCost,
    coverage_score: Math.max(coverage, chosen.length >= 3 ? 75 : coverage),
    explanation:
      'Minimum Verification Set = lowest-cost evidence subset maximizing hypothesis coverage and verification value.',
  };
}

export function buildDisproof(hypotheses, claims, contradictions) {
  return hypotheses.slice(0, 6).map((h) => ({
    hypothesis: h.label,
    h_score: h.h_score,
    supporting: h.supporting_evidence,
    weakening: h.contradicting_evidence,
    disconfirming: h.missing_evidence.map((m) => `Absence or adverse finding on: ${m}`),
    alternative_hypotheses: hypotheses.filter((x) => x.label !== h.label).slice(0, 3).map((x) => x.label),
    next_evidence: h.missing_evidence.slice(0, 2),
    guidance:
      'Disproof Mode prioritizes evidence that could weaken or eliminate explanations. Does not establish wrongdoing.',
  }));
}

export function buildCounterfactuals(drift, observed, expected) {
  // Sensitivity analysis — not causation
  const obs = observed[observed.length - 1];
  const exp = expected[expected.length - 1];
  const scenarios = [
    {
      name: 'If physical progress matched payment pace',
      change: { physical: obs.payment },
      label: 'sensitivity_analysis',
    },
    {
      name: 'If payment matched physical progress',
      change: { payment: obs.physical },
      label: 'sensitivity_analysis',
    },
    {
      name: 'If inspection confirmed expected progress',
      change: { physical: exp.physical, inspection: exp.inspection },
      label: 'sensitivity_analysis',
    },
  ];

  return scenarios.map((s) => {
    const hypoObs = { ...obs, ...s.change };
    const d = computeDrift(exp, hypoObs);
    return {
      ...s,
      baseline_drift: drift.score,
      counterfactual_drift: d.score,
      delta_drift: round2(d.score - drift.score),
      disclaimer: 'Counterfactual Audit is sensitivity analysis, not causal attribution or proof of wrongdoing.',
      dimension_detail: d.dimensions,
    };
  });
}

export function buildReplay(project, asOfDay, knowable, drift, efi, contradictions, claims, qualityIssues) {
  const known = knowable.map((e) => ({
    id: e.id,
    type: e.event_type,
    day: e._event_day,
    summary: e.description,
    ingested_day: e._ingested_day,
  }));
  const pay = cumulativePayment(knowable, project.sanctioned_amount);
  const phys = latestValue(knowable, (e) => e.progress_pct != null, 'progress_pct', 0);
  const hasInsp = knowable.some((e) => e.event_type === 'inspection');

  return {
    as_of_day: asOfDay,
    as_of_date: addDays(project.start_date, asOfDay),
    what_was_known: known,
    what_was_unknown: [
      !hasInsp ? 'Field inspection outcome' : null,
      'Future payment adjustments',
      'Post-cutoff progress revisions',
      'Any records ingested after knowledge cutoff',
    ].filter(Boolean),
    visible_risk: {
      investigation_risk: drift.score >= 40 ? 'elevated' : drift.score >= 25 ? 'moderate' : 'low',
      integrity_drift: drift.score,
      evidence_friction: efi.score,
      evidence_conflicts: contradictions.length,
    },
    missing_evidence: ['latest field inspection', 'measurement book', 'linked payment voucher'],
    recommended_action:
      'Verification recommendation: request minimum verification set; do not treat drift as proof of wrongdoing. Human review required.',
    snapshot: {
      payment_pct: pay.pct,
      physical_progress_pct: phys,
      inspection_available: hasInsp,
    },
    future_leakage_protected: true,
    quality_issues_visible: qualityIssues.length,
    claims_count: claims.length,
    disclaimer: SYNTHETIC_WATERMARK,
  };
}

export function findEarliestDivergence(expected, observed, events, thresholds = DEFAULT_THRESHOLDS) {
  let earliest = null;
  for (let i = 0; i < expected.length; i++) {
    const d = computeDrift(expected[i], observed[i]);
    const conf =
      events.filter((e) => e._event_day <= expected[i].day).length >= 2
        ? Math.min(0.95, 0.4 + events.filter((e) => e._event_day <= expected[i].day).length * 0.05)
        : 0.3;
    if (d.score >= thresholds.actionable_drift && conf >= thresholds.evidence_confidence) {
      earliest = {
        day: expected[i].day,
        drift_score: d.score,
        evidence_confidence: round2(conf),
        dimensions: d.dimensions,
        rationale:
          'Earliest actionable divergence where integrity drift and evidence confidence exceed thresholds. Flags investigation risk only.',
      };
      break;
    }
  }
  return earliest;
}

export function buildEvidenceTwin(project, events, claims, qualityIssues, asOfDay) {
  const sanctioned = Number(project.sanctioned_amount);
  const pay = cumulativePayment(events, sanctioned);
  const phys = latestValue(events, (e) => e.progress_pct != null, 'progress_pct', 0);
  return {
    project_id: project.id,
    project_code: project.project_code,
    as_of_day: asOfDay,
    states: {
      planned: {
        sanctioned_amount: sanctioned,
        duration_days: project.planned_duration_days || 120,
        start_date: project.start_date,
      },
      financial: { cumulative_payment: pay.amount, payment_pct: pay.pct },
      physical: { progress_pct: phys },
      payment: { events: events.filter((e) => e.event_type === 'payment').length, pct: pay.pct },
      inspection: {
        count: events.filter((e) => e.event_type === 'inspection').length,
        available: events.some((e) => e.event_type === 'inspection'),
      },
      procurement: {
        work_order: events.some((e) => e.event_type === 'work_order'),
      },
      completion: {
        claimed: events.some((e) => e.event_type === 'completion'),
      },
      provenance: events.map((e) => ({
        id: e.id,
        event_time: e.event_time,
        recorded_at: e.recorded_at,
        published_at: e.published_at,
        ingested_at: e.ingested_at,
        delayed: e._is_delayed,
        retroactive: e._is_retroactive,
      })),
      contradiction: { open: true },
      hypothesis: { open: true },
      missing_evidence: ['field_inspection', 'measurement_book', 'payment_voucher'],
      confidence: {
        overall: round2(
          events.reduce((s, e) => s + (e.reliability || 0.7), 0) / Math.max(events.length, 1)
        ),
      },
      evidence_availability: {
        records: events.length,
        quality_flags: qualityIssues.length,
      },
    },
    claims,
    watermark: SYNTHETIC_WATERMARK,
  };
}

/** Full pipeline entry */
export function runAnalysisPipeline(project, allEvents, options = {}) {
  const asOfDay = options.as_of_day ?? 47;
  const thresholds = { ...DEFAULT_THRESHOLDS, ...(options.thresholds || {}) };
  const knowable = filterKnowableEvents(allEvents, project.start_date, asOfDay);
  const qualityIssues = detectDataQuality(knowable, project);
  const { expected, observed, duration, sanctioned } = buildTrajectories(knowable, project, asOfDay);
  const expNow = expected[expected.length - 1];
  const obsNow = observed[observed.length - 1];
  const drift = computeDrift(expNow, obsNow);
  const claims = extractClaims(knowable, project, asOfDay);
  const contradictions = detectContradictions(claims, knowable, drift);
  const hypotheses = generateHypotheses(contradictions, claims);
  const efi = computeEFI({ qualityIssues, contradictions, events: knowable, hypotheses });
  const mvs = computeMVS(hypotheses, contradictions);
  const earliest = findEarliestDivergence(expected, observed, knowable, thresholds);
  const disproof = buildDisproof(hypotheses, claims, contradictions);
  const counterfactuals = buildCounterfactuals(drift, observed, expected);
  const replay = buildReplay(project, asOfDay, knowable, drift, efi, contradictions, claims, qualityIssues);
  const twin = buildEvidenceTwin(project, knowable, claims, qualityIssues, asOfDay);

  const investigation_risk =
    drift.score >= 55 || efi.score >= 60 ? 'high' : drift.score >= 35 || efi.score >= 40 ? 'moderate' : 'low';

  return {
    watermark: SYNTHETIC_WATERMARK,
    project: {
      id: project.id,
      project_code: project.project_code,
      name: project.name,
      sanctioned_amount: sanctioned,
      start_date: project.start_date,
      planned_duration_days: duration,
    },
    as_of_day: asOfDay,
    as_of_date: addDays(project.start_date, asOfDay),
    investigation_risk,
    labels: {
      investigation_risk: investigation_risk,
      evidence_conflict: contradictions.length > 0,
      human_review_required: true,
      synthetic_demonstration: true,
    },
    data_quality: qualityIssues,
    evidence_twin: twin,
    trajectories: { expected, observed },
    integrity_drift: drift,
    earliest_actionable_divergence: earliest,
    claims,
    contradictions,
    hypotheses,
    evidence_friction: efi,
    minimum_verification_set: mvs,
    disproof_mode: disproof,
    counterfactual_audit: counterfactuals,
    decision_aware_replay: replay,
    knowable_event_count: knowable.length,
    total_event_count: allEvents.length,
    future_events_excluded: allEvents.length - knowable.length,
    recommendation:
      'Verification recommendation: obtain MVS evidence; keep competing hypotheses open; human review required. This is a synthetic demonstration — not an accusation.',
  };
}

export { dayDiff, addDays, cumulativePayment, latestValue, expectedPhysical, expectedPayment };
