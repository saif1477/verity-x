# DEPLOYMENT

```bash
cp .env.example .env
npm install
node scripts/seed_node.mjs --force
npm test && npm run typecheck && npm run build
docker compose up --build   # optional
```

Vercel: `api/*` serverless + static Vite build. Supabase tables must exist (created via platform tools / migrations equivalent).

## Required commands checklist

- `cp .env.example .env`
- `docker compose up --build`
- `python scripts/seed_demo.py`
- `npm test` (pytest-equivalent unit suite for engine)
- `npm run typecheck`
- `npm run build`
