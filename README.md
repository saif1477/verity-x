# VERITY-X

**Temporal Evidence Verification and Investigation Intelligence**

Synthetic MPLADS-like public-works verification platform. Reconstructs what happened, what was knowable at each point in time, where expected and observed states diverged, which explanations remain possible, and what minimum evidence should be collected next.

> **Synthetic demonstration data. This application does not use or represent official government records.**

This system **never accuses people or proves wrongdoing**. Language is limited to: Investigation risk, Evidence conflict, Possible explanation, Evidence confidence, Evidence friction, Verification recommendation, Human review required, Synthetic demonstration.

## Quick start

```bash
cp .env.example .env   # fill Supabase keys if needed
npm install
node scripts/seed_node.mjs --force   # or: python scripts/seed_demo.py
npm test                             # analysis unit tests
npm run typecheck
npm run build
```

Docker:

```bash
docker compose up --build
```

## Demo credentials (RBAC)

| Role | Email | Password |
|------|-------|----------|
| ADMIN | admin@verity-x.demo | verity-admin-2024 |
| INVESTIGATOR | investigator@verity-x.demo | verity-inv-2024 |
| REVIEWER | reviewer@verity-x.demo | verity-rev-2024 |
| VIEWER | viewer@verity-x.demo | verity-view-2024 |

## Three-minute demo

1. Sign in as Investigator → **Control Room**
2. Open **Project #142** (Anganwadi Centre, ₹48 lakh)
3. Set replay **Day 47** → payment ~84%, physical ~35%, inspection unavailable
4. Inspect Integrity Drift, earliest divergence, contradictions, four+ hypotheses
5. **Disproof Mode** → **Verification Planner** → REQUEST EVIDENCE (MVS: field inspection, measurement book, payment voucher)
6. **Simulator** → inject approved mobilization advance → recalculate → inject fresh inspection → recalculate
7. **Case File** → generate JSON/CSV/print-PDF

## Core pipeline

Records → Temporal Evidence Twin → Project Reconstruction → Expected/Observed Trajectories → Integrity Drift → Earliest Actionable Divergence → Contradictions → Competing Hypotheses → Evidence Friction → Minimum Verification Set → Verification-Value Ranking → Disproof Mode → Counterfactual Audit → Decision-Aware Replay → Auditable Case File

## Stack (this deployment)

- Frontend: Vite + React 19 + TypeScript + Tailwind + Recharts
- API: Vercel serverless (`api/`) + analysis engine (`api/lib/analysis.js`)
- DB: Supabase Postgres
- Tests: Node test runner on pure analysis functions
- Seed: deterministic seed `142001`

## Documentation

See `docs/` — ARCHITECTURE, ALGORITHM, DATA_MODEL, API, DEMO_GUIDE, EVALUATION, SECURITY, DEPLOYMENT, LIMITATIONS.

## License

Demonstration software. Not for operational enforcement use.
