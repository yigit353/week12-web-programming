# ByteBooks — Week 12 (Web Programming, Istinye University)

The Week 12 reference codebase for the Web Programming course. A small bookstore app split into two services that get hardened, deployed, and audited as the curriculum progresses.

| | |
| --- | --- |
| **Frontend** | Vite + React 19, deployed to Vercel — <https://bytebooks-frontend-week12.vercel.app> |
| **Backend** | FastAPI + SQLModel + Postgres, deployed to Railway — <https://week12-web-programming-production.up.railway.app> |
| **Repo** | Monorepo, single `main` branch, auto-deploys on push |

## Layout

```
.
├── bytebooks-frontend/   Vite + React app, vercel.json, Edge Middleware
├── bytebooks-api/        FastAPI service, SQLModel models, JWT auth, slowapi rate limits
├── prompts/              Session prompts students work through
│   ├── session1-prompt.md
│   └── session2-prompt.md
├── GUIDE.md              Session 1 companion guide (gotchas, terminology updates)
├── SECURITY.md           Public security policy (how to report)
└── bytebooks-frontend/SECURITY.md   Detailed posture + 14-item readiness checklist
```

## What's in the curriculum

The course walks through hardening a real PaaS-deployed stack in two sessions:

- **[Session 1](prompts/session1-prompt.md)** — frontend-side / edge security: security headers, CSP (Report-Only → enforced), Vercel Authentication on previews, one WAF rate-limit rule, Bot Protection, Edge Middleware (`x-request-id` + `/admin/*` gate). See **[GUIDE.md](GUIDE.md)** for a companion that captures gotchas and terminology updates that aren't in the prompt.
- **[Session 2](prompts/session2-prompt.md)** — backend / origin security: Postgres private networking, sealed `SECRET_KEY` with rotation drill, JWT-keyed slowapi rate limits, `pip-audit` + `npm audit`, Dependabot, observability, and a 14-item production-readiness checklist that doubles as the final-project rubric.

The full security posture (what's configured, why, and the working gotchas) lives in **[`bytebooks-frontend/SECURITY.md`](bytebooks-frontend/SECURITY.md)**. Open it before reading either prompt — it's the source of truth for what the deployed stack actually looks like today.

## Local development

### Backend (FastAPI)

```bash
cd bytebooks-api
python -m venv venv
source venv/bin/activate           # macOS / Linux — Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload          # → http://127.0.0.1:8000  (Swagger UI at /docs)
```

By default the backend uses a local SQLite file (`bytebooks.db`). To point at Postgres locally, set `DATABASE_URL=postgresql://...` in your shell before starting uvicorn. To allow CORS from a non-default frontend origin, set `FRONTEND_URL=https://...` (no trailing slash — see [Gotchas](bytebooks-frontend/SECURITY.md#gotchas)).

### Frontend (Vite + React)

```bash
cd bytebooks-frontend
npm install
npm run dev                        # → http://localhost:5173
```

The Vite dev server reads `VITE_API_URL` from `.env.development` / `.env.local` to decide which backend to talk to.

### Smoke-test the rate limit (against prod)

```bash
API=https://week12-web-programming-production.up.railway.app
for i in $(seq 1 6); do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -X POST "$API/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"nope@example.com","password":"nope"}'
done
# Expected: 401, 401, 401, 401, 401, 429
```

## Deployment

Both projects auto-deploy on push to `main`:

- **Vercel** picks up commits to `bytebooks-frontend/` (Root Directory is set to that subdir in the Vercel project settings)
- **Railway** rebuilds the api service from the monorepo root (`bytebooks-api/Procfile`)

Manual operator work that lives in dashboards (not in code) is tracked under **Pending operator work** in [`bytebooks-frontend/SECURITY.md`](bytebooks-frontend/SECURITY.md#pending-operator-work-railway--github-dashboards).

## Reporting a security issue

See [`SECURITY.md`](SECURITY.md). Preferred channel is **GitHub Private Vulnerability Reporting** via the repo's Security tab.

## License

Educational use. No license file is published; if you want to reuse parts of this code in your own course or project, open an issue and we'll add an explicit MIT/Apache-2.0 license.
