# ARCHITECTURE

## Overview

VERITY-X separates **deterministic analysis** from **presentation** and **persistence**.

```
React UI  →  /api/* serverless  →  analysis engine  →  Supabase
                 │
                 ├─ auth (HMAC JWT-like tokens + RBAC roles)
                 ├─ seed / projects / analysis / simulator
                 ├─ evidence-requests / cases / evaluation
                 └─ audit_logs
```

## Temporal Evidence Twin

Maintains planned, financial, physical, payment, inspection, procurement, completion, provenance, contradiction, hypothesis, missing-evidence, confidence, and evidence-availability states.

Knowledge cutoff uses `ingested_at` relative to project start so **future information cannot leak** into Decision-Aware Replay.

## Vertical slice (priority path)

Project #142 → Twin → Day-47 Replay → Drift → Contradiction → Hypotheses → EFI → MVS → Disproof → Simulated Evidence → Updated Result → Case File

## Optional LLM

Not required. If added later, may only summarize structured outputs — never invent evidence, numbers, entities, anomalies, or accusations.
