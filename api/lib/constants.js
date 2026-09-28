export const SYNTHETIC_WATERMARK =
  'Synthetic demonstration data. This application does not use or represent official government records.';

export const ROLES = ['ADMIN', 'INVESTIGATOR', 'REVIEWER', 'VIEWER'];

export const DRIFT_WEIGHTS = {
  financial: 0.18,
  physical: 0.18,
  payment: 0.16,
  timeline: 0.12,
  execution: 0.12,
  procurement: 0.08,
  inspection: 0.1,
  completion: 0.06,
};

export const EFI_WEIGHTS = {
  missing: 0.28,
  contradiction: 0.24,
  source_fragility: 0.18,
  temporal_uncertainty: 0.18,
  entity_ambiguity: 0.12,
};

export const EPSILON = 1e-6;

export const DEFAULT_THRESHOLDS = {
  drift: 25,
  evidence_confidence: 0.45,
  actionable_drift: 30,
};

export const SCENARIO_TYPES = [
  'NORMAL',
  'DELAYED',
  'COST_INFLATION',
  'PAYMENT_PROGRESS_MISMATCH',
  'DUPLICATE_LIKE',
  'ABANDONED',
  'CONTRACTOR_CONCENTRATION',
  'DATA_INCONSISTENCY',
  'COMBINED_ANOMALY',
];

export const EVIDENCE_CATALOG = [
  {
    id: 'field_inspection',
    label: 'Latest field inspection report',
    cost: 12,
    reliability: 0.9,
    covers: ['progress', 'execution', 'inspection'],
    time_days: 3,
  },
  {
    id: 'measurement_book',
    label: 'Measurement book / MB extract',
    cost: 10,
    reliability: 0.88,
    covers: ['progress', 'physical', 'execution'],
    time_days: 2,
  },
  {
    id: 'payment_voucher',
    label: 'Payment voucher with sanction linkage',
    cost: 6,
    reliability: 0.85,
    covers: ['payment', 'financial'],
    time_days: 1,
  },
  {
    id: 'geo_photo',
    label: 'Geo-tagged site photographs',
    cost: 8,
    reliability: 0.75,
    covers: ['progress', 'physical'],
    time_days: 2,
  },
  {
    id: 'contractor_ledger',
    label: 'Contractor work ledger',
    cost: 9,
    reliability: 0.7,
    covers: ['execution', 'payment'],
    time_days: 4,
  },
  {
    id: 'completion_certificate',
    label: 'Independent completion certificate',
    cost: 14,
    reliability: 0.92,
    covers: ['completion', 'inspection'],
    time_days: 5,
  },
  {
    id: 'procurement_file',
    label: 'Procurement / tender file',
    cost: 7,
    reliability: 0.8,
    covers: ['procurement'],
    time_days: 2,
  },
];

export function clamp(n, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, n));
}

export function round2(n) {
  return Math.round(n * 100) / 100;
}
