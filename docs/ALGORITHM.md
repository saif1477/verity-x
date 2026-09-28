# ALGORITHM

## Integrity Drift

For each dimension d ∈ {financial, physical, payment, timeline, execution, procurement, inspection, completion}:

```
Drift_d = |Expected_d − Observed_d| / (ExpectedRange_d + ε)
Score = Σ(w_d × Drift_d)   # normalized 0–100
```

Weights live in `api/lib/constants.js` (`DRIFT_WEIGHTS`).

## Earliest Actionable Divergence

Scan day 0…as_of; first day where drift ≥ threshold and evidence confidence ≥ threshold.

## Claims & Contradictions

Records → claims (payment cumulative, physical progress, inspection, completion, timeline). Contradiction types: payment/progress, completion/inspection, status/timeline, expenditure/milestone, administrative/execution.

## Hypotheses

```
HScore = Support − Contradiction − MissingEvidencePenalty
```

**Not** a probability of guilt. At least 3–4 competing explanations per major contradiction.

## Evidence Friction Index

```
EFI = wm·Missing + wc·ContradictionDensity + ws·SourceFragility
    + wt·TemporalUncertainty + we·EntityAmbiguity
```

Normalized 0–100.

## Minimum Verification Set

Lowest-cost evidence subset covering hypothesis missing-evidence tags, ranked by verification value (hypothesis separation, reliability, impact, cost, time).

## Counterfactuals

Sensitivity analysis only — not causation.

## Replay

Filter events by `ingested_at` ≤ knowledge cutoff.
