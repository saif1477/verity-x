# SECURITY

- Demo auth: HMAC-signed tokens (service role key as secret), password checked server-side
- Roles: ADMIN, INVESTIGATOR, REVIEWER, VIEWER
- Audit log on login, analysis, evidence request, simulation, case export
- Synthetic watermarking on data and UI
- No operational PII; all demo synthetic
- Environment secrets via `.env` / Vercel env — never commit real production keys to public forks
- Validation on API inputs (project_code, injection type, evidence_type)
