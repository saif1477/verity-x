# API

| Method | Path | Description |
|--------|------|-------------|
| GET/POST | /api/auth | Demo accounts; login; me |
| GET | /api/projects | List or `?code=142` detail |
| GET/POST | /api/analysis | Run temporal pipeline (`project_code`, `as_of_day`) |
| GET/POST | /api/evidence-requests | List / create REQUEST EVIDENCE |
| GET/POST | /api/simulator | List injections / inject & recalculate |
| GET/POST | /api/cases | List / generate case file (json\|csv) |
| GET/POST | /api/seed | Deterministic seed |
| GET/POST | /api/evaluation | Sample metrics vs ground truth |

All analysis metrics are computed server-side — frontend never hard-codes drift/EFI/HScore.
