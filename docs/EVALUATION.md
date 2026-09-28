# EVALUATION

Endpoint: `GET /api/evaluation?limit=40`

Reports precision, recall, F1, false-positive rate on seeded ground truth (`is_anomaly` vs drift/contradiction prediction).

Also tracks contradiction accuracy and first-divergence accuracy when ground-truth ranges exist (flagship #142).

## Ablations (documented)

remove_temporal_provenance, remove_drift, remove_contradiction, remove_hypotheses, remove_friction, remove_mvs, remove_counterfactuals

Unit tests cover drift, temporal filter, pipeline #142 pattern, EFI, MVS (`npm test`).
