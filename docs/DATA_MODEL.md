# DATA_MODEL

| Table | Purpose |
|-------|---------|
| vx_projects | Synthetic projects (flagship #142 + scenarios) |
| vx_events | Temporal events with event_time, recorded_at, published_at, ingested_at |
| vx_evidence | Evidence inventory (available/missing) |
| vx_analysis_runs | Persisted pipeline results |
| vx_contradictions | Derived contradictions per run |
| vx_hypotheses | Competing hypotheses per run |
| vx_evidence_requests | REQUEST EVIDENCE records |
| vx_cases | Auditable case files |
| vx_simulation_runs | Simulator baseline/updated snapshots |
| vx_ground_truth | Hidden evaluation labels |
| vx_audit_logs | Auth/analysis/export/request logging |

All rows carry synthetic watermarking fields where applicable.
