export interface Project {
  id: number;
  project_code: string;
  name: string;
  location?: string;
  sanctioned_amount: number;
  start_date: string;
  planned_duration_days: number;
  status: string;
  contractor_name?: string;
  scenario_type?: string;
  is_flagship?: boolean;
  description?: string;
  events?: EventRecord[];
  evidence?: EvidenceRecord[];
}

export interface EventRecord {
  id: number;
  event_type: string;
  description?: string;
  event_time?: string;
  recorded_at?: string;
  published_at?: string;
  ingested_at?: string;
  amount?: number;
  progress_pct?: number;
  reliability?: number;
  source?: string;
  is_simulated?: boolean;
}

export interface EvidenceRecord {
  id: number;
  evidence_type: string;
  title: string;
  content?: string;
  status?: string;
  reliability?: number;
  source?: string;
}

export interface DriftDimension {
  dimension: string;
  expected: number;
  observed: number;
  drift: number;
  weight: number;
  weighted_drift: number;
  formula: string;
}

export interface AnalysisResult {
  run_id?: number;
  project: {
    id: number;
    project_code: string;
    name: string;
    sanctioned_amount: number;
    start_date: string;
    planned_duration_days: number;
  };
  as_of_day: number;
  as_of_date: string;
  investigation_risk: string;
  labels: Record<string, unknown>;
  data_quality: Array<{ issue_type: string; severity: string; description: string }>;
  evidence_twin: {
    states: Record<string, unknown>;
    claims: Claim[];
  };
  trajectories: {
    expected: Array<Record<string, number>>;
    observed: Array<Record<string, number>>;
  };
  integrity_drift: {
    score: number;
    dimensions: Record<string, DriftDimension>;
    formula: string;
  };
  earliest_actionable_divergence: {
    day: number;
    drift_score: number;
    evidence_confidence: number;
    rationale: string;
  } | null;
  claims: Claim[];
  contradictions: Contradiction[];
  hypotheses: Hypothesis[];
  evidence_friction: {
    score: number;
    components: Record<string, number>;
    weights: Record<string, number>;
    formula: string;
  };
  minimum_verification_set: {
    items: MVSItem[];
    ranked_all: MVSItem[];
    total_cost: number;
    coverage_score: number;
    explanation: string;
  };
  disproof_mode: DisproofItem[];
  counterfactual_audit: Counterfactual[];
  decision_aware_replay: Replay;
  recommendation: string;
  knowable_event_count: number;
  future_events_excluded: number;
  watermark?: string;
}

export interface Claim {
  claim_type: string;
  statement: string;
  value: number;
  unit: string;
  source: string;
  confidence: number;
  evidence_refs?: (string | number)[];
}

export interface Contradiction {
  contradiction_type: string;
  title: string;
  description: string;
  severity: string;
  confidence: number;
  claim_a?: Claim;
  claim_b?: Claim;
}

export interface Hypothesis {
  label: string;
  description: string;
  supporting_evidence: string[];
  contradicting_evidence: string[];
  missing_evidence: string[];
  support_score: number;
  contradiction_score: number;
  missing_penalty: number;
  h_score: number;
  confidence: number;
  note?: string;
  contradiction_title?: string;
}

export interface MVSItem {
  id: string;
  label: string;
  cost: number;
  reliability: number;
  covers: string[];
  time_days: number;
  verification_value: number;
  hypothesis_separation?: number;
  recommendation?: string;
}

export interface DisproofItem {
  hypothesis: string;
  h_score: number;
  supporting: string[];
  weakening: string[];
  disconfirming: string[];
  alternative_hypotheses: string[];
  next_evidence: string[];
  guidance: string;
}

export interface Counterfactual {
  name: string;
  label: string;
  baseline_drift: number;
  counterfactual_drift: number;
  delta_drift: number;
  disclaimer: string;
}

export interface Replay {
  as_of_day: number;
  as_of_date: string;
  what_was_known: Array<{ id: number; type: string; day: number; summary?: string }>;
  what_was_unknown: string[];
  visible_risk: {
    investigation_risk: string;
    integrity_drift: number;
    evidence_friction: number;
    evidence_conflicts: number;
  };
  missing_evidence: string[];
  recommended_action: string;
  snapshot: {
    payment_pct: number;
    physical_progress_pct: number;
    inspection_available: boolean;
  };
  future_leakage_protected: boolean;
  disclaimer: string;
}
