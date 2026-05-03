# ByteBooks — Security Posture (Frontend + Backend)

> Status: Session 1 complete (frontend). Session 2 complete (backend code + audits + checklist). Three Railway/GitHub dashboard items remain — see **Pending operator work** at the bottom.

## Production URLs

- **Frontend (Vercel)**: https://bytebooks-frontend-week12.vercel.app (project: `bytebooks-frontend-week12`, scope `yigit353s-projects`)
- **Backend (Railway)**: https://week12-web-programming-production.up.railway.app
- **Repo**: https://github.com/yigit353/week12-web-programming (Vercel Root Directory: `bytebooks-frontend`)

## Headers (`vercel.json`)

Configured at `bytebooks-frontend/vercel.json` and applied to `/(.*)`:

| Header | Value | Why |
| --- | --- | --- |
| `Content-Security-Policy` | `default-src 'self'; script-src 'self'; connect-src 'self' https://week12-web-programming-production.up.railway.app; img-src 'self' data:; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'` | XSS allowlist, now enforcing. |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | Force HTTPS for 2 years; prepare for HSTS preload-list submission. |
| `X-Frame-Options` | `DENY` | Clickjack defense. |
| `X-Content-Type-Options` | `nosniff` | Disable MIME-sniffing. |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Don't leak full URLs across origins. |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), interest-cohort=()` | Deny unused device APIs and FLoC. |

The `connect-src` directive lists the Railway API origin verbatim (no path, no trailing slash). Adding any new external API origin requires updating this list.

## Deployment Protection

- **Vercel Authentication**: Standard Protection ON (Hobby preview-only scope).
- Production deployments remain public on Hobby; only previews require Vercel login.
- **Protection Bypass for Automation** token stored in password manager under `bytebooks/vercel-protection-bypass`. Token value never committed. Used by Playwright runs and AI agents via the `x-vercel-protection-bypass` header.

## Firewall (Hobby — single rule cap)

- **`auth-and-api rate limit`** (active):
  - Match condition: Request Path `matches expression` `^/(api|auth)/.*$`
  - Algorithm: Fixed Window
  - Window: 60 s
  - Limit: 60 requests
  - Counting key: IP Address
  - Action on exceed: 429 (default)

Hobby plan caps us at one WAF rule. Surprise: **JA4 Digest is available as a rate-limit counting key on Hobby** (the older docs suggesting Pro-only were wrong). The gap on Hobby is the rule count, not the available keys. With one rule we spend it on the broad IP-keyed case. On Pro we would add:

- `/auth/login` stricter limit (e.g., 5/min/IP) for credential-stuffing defense
- IP block ranges for known-bad CIDRs
- A JA4-keyed rule targeting specific adversarial TLS fingerprints
- A User-Agent-keyed rule blocking known scraper agents

## Bot Management

Vercel retired the older "BotID Basic" product. Current offering is two managed rulesets:

- **Bot Protection managed ruleset**: **Log** mode. Identifies clients that violate browser-like behavior (e.g. curl claiming to be Chrome) and *would* serve a JS challenge — but in Log mode it only records the matches in Firewall observability. Verified bots (Googlebot, Bingbot, etc.) automatically pass through. Promote to **On** (challenge mode) once observability shows zero false positives.
- **AI Bots managed ruleset**: **On** (Deny mode). Blocks known AI crawlers — GPTBot, ClaudeBot, ChatGPT-User, Perplexity, etc. Vercel maintains and updates the list automatically.
- **Attack Challenge Mode**: separate panel in the Firewall sidebar (not under Bot Management). **Off** by default. Flip ON only during a live targeted attack — verify webhooks and any non-browser traffic still pass before leaving on.

**Reverse-proxy gotcha**: Bot Protection doesn't work behind external CDNs (Cloudflare etc.) — the proxy obscures detection signals and rotates exit IPs, causing frequent re-challenges. If you ever stick a CDN in front of this Vercel project, disable Bot Protection.

## Edge Middleware

- File: `bytebooks-frontend/middleware.js` (Vercel auto-detects).
- Runtime: Vercel Edge.
- Package: **`@vercel/edge`**, NOT `next/server` — `next/server` is Next.js-only. The runtime exposes a standard Web `Request` (no `.cookies` accessor, no `.geo` accessor); we parse the `Cookie` header manually.
- Matcher: `'/((?!assets/|favicon\\.ico|vite\\.svg).*)'` — excludes Vite's bundled assets and the static favicon/logo so they don't burn Edge invocations.
- Behaviors:
  1. Injects `x-request-id: <UUIDv4>` on every response. Useful for cross-tier log correlation between CDN logs, browser DevTools, and the Railway backend.
  2. Returns 401 for any `/admin/*` request without a `bb_session` cookie. The React app does not yet have an `/admin` route; the gate exists so any future admin shell is protected by default at the edge.

## ByteBooks Backend — Security Posture

### Database

- Postgres public TCP proxy: **must be disabled** in Railway dashboard (Postgres service → Settings → Networking). See *Pending operator work* below.
- FastAPI reads `DATABASE_URL` from env (`bytebooks-api/database.py:31`). Production value should be the Railway-variable reference `${{ Postgres.DATABASE_PRIVATE_URL }}`, which resolves to `postgres.railway.internal` over the project's Wireguard private network.
- Code is hostname-based (no hardcoded IPs), so dual-stack and the legacy IPv6-only path both work without changes.

### Secrets

- `SECRET_KEY` (JWT signing key) lives in Railway env. **Must be sealed** via dashboard → Variables → 3-dot → Seal. Once sealed it can't be read back; rotation = delete + re-create sealed.
- Rotation procedure (run quarterly or on suspected compromise):
  1. `openssl rand -hex 32` → new value
  2. Railway → Variables → `SECRET_KEY` → 3-dot → **Delete**
  3. **+ New Variable** → name `SECRET_KEY`, paste new value, check **Seal**, save
  4. Wait for Railway auto-redeploy (Logs tab → "uvicorn running")
  5. From a browser tab still holding an old JWT, hit any auth-required endpoint — must return 401. If 200, rotation didn't take (CDN cache or redeploy didn't fire).
- Last rotated: **TBD** — fill in after first operator rotation.
- `SENTRY_DSN`: not wired this session. If added later, seal it (anyone with the DSN can spam the Sentry quota).

### Rate Limiting (slowapi, JWT-keyed)

Wired in `bytebooks-api/main.py:149` (Limiter setup) and on the two protected routes:

| Route | Limit | Why |
| --- | --- | --- |
| `POST /auth/login` | 5/minute | Credential-stuffing defense (per-user, not per-edge IP) |
| `GET /books/search-external` | 30/minute | Open Library is a third-party API and cost vector |

- **Key function**: `jwt_or_ip_key` extracts the JWT `sub` claim (without verifying — the auth dep handles verification elsewhere) and returns `user:<sub>`. Falls back to `ip:<client-ip>` for unauthenticated requests.
- **Why JWT-keyed**: behind Vercel's edge, `request.client.host` is a Vercel POP IP, not the user. Per-IP rate limits would pool every user behind the same edge into a single bucket.
- **JWT decode library**: uses `python-jose` (`jose.jwt.get_unverified_claims`) since it's already a dep (`auth_utils.py:50`). The session prompt's example uses `pyjwt`; we kept python-jose to avoid a duplicate JWT library.
- **Decorator order**: `@app.post(...)` *outside*, `@limiter.limit(...)` *inside*. Python decorators apply bottom-up: with this order `@app.post` registers the limiter-wrapped function. Reversing the order registers the un-limited function and the limit silently does nothing. The session prompt has these reversed; the order in code is the working one.
- **429 response**: JSON body `{"detail":"rate limited"}` with `Retry-After: 60` header so the frontend can back off intelligently.

### Dependency Hygiene

- **`pip-audit -r requirements.txt`** — 0 known vulnerabilities (run 2026-05-03).
- **`npm audit --omit=dev`** — 0 vulnerabilities at every severity (run 2026-05-03; `--production` is deprecated, replaced by `--omit=dev`).
- **Dependabot**: must be enabled in *both* GitHub repos via Settings → Code security and analysis. Alerts + Security updates + (optional) Version updates. See *Pending operator work*.

### CORS

- `bytebooks-api/main.py:140` — `allow_origins` is the explicit list `[localhost:5173, localhost:5174, $FRONTEND_URL]`. **No `*` wildcards.** `allow_credentials=True` requires this.
- Trailing-slash rule: `FRONTEND_URL` must be the bare origin, no trailing `/`. See Gotchas below.

### Observability

- **Railway Logs** (api service → Logs tab): tail during a brute-force test (`for i in $(seq 1 8); do curl -s -o /dev/null -X POST .../auth/login ...; done`) — should show 5× normal log entries plus 3× 429 events.
- **Vercel Runtime Logs** (frontend project → Logs / Runtime Logs): every entry includes the `x-request-id` injected by Edge Middleware (`middleware.js`). That UUID is the cross-tier correlation key — the same value also appears in browser DevTools → Network tab → response headers, and (with a small middleware in FastAPI, not yet wired) could be propagated into Railway logs too.
- **Sentry**: not wired. To add: `pip install "sentry-sdk[fastapi]"`, `sentry_sdk.init(dsn=os.getenv("SENTRY_DSN"), traces_sample_rate=0.1, send_default_pii=False)` near the top of `main.py`, set sealed `SENTRY_DSN` in Railway.

### Backend Verification (run any time)

```bash
# /auth/login rate limit fires on the 6th request
API=https://week12-web-programming-production.up.railway.app
for i in $(seq 1 6); do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -X POST "$API/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"nope@example.com","password":"nope"}'
done
# Expected: 401, 401, 401, 401, 401, 429

# 429 includes Retry-After header
curl -is -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"nope@example.com","password":"nope"}' | head -10
# Expected (after threshold): HTTP/1.1 429 + retry-after: 60

# Public DB port is gone (after Part 1 dashboard work)
nc -zv <old-public-pg-host> 5432
# Expected: Name or service not known / connection refused
```

## Production-Readiness Checklist (Final-Project Rubric)

The 14 items below are the rubric for the final-project security score. Tick what's done; leave anything unticked with an owner + target date in *Pending operator work*.

- [x] All security headers present in `vercel.json` (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy)
- [x] CSP enforced (not Report-Only) and not blocking the API
- [x] Vercel Authentication enabled on previews (Standard Protection)
- [x] One Vercel WAF rate-limit rule active
- [x] Bot Protection managed ruleset enabled (Vercel retired "BotID Basic" — current product is Bot Protection in Log mode + AI Bots in Deny mode)
- [x] Edge Middleware injecting `x-request-id` on every response
- [ ] Postgres public TCP proxy disabled; FastAPI uses `${{ Postgres.DATABASE_PRIVATE_URL }}`
- [ ] `SECRET_KEY` sealed in Railway and rotated within the last 30 days
- [x] slowapi rate limits on `/auth/login` (5/min) and one expensive route (`/books/search-external`, 30/min), keyed on JWT
- [x] No `pip-audit` high/critical findings (0 of any severity, 2026-05-03)
- [x] No `npm audit --omit=dev` high/critical findings (0 of any severity, 2026-05-03)
- [ ] Dependabot security updates enabled in both repos
- [x] CORS allows the production frontend URL only — no `*` wildcards
- [x] `SECURITY.md` documents rotation order and known platform caveats

**Score: 11 / 14.** The three open items are operator dashboard tasks (no code change needed). See below.

## Pending operator work (Railway + GitHub dashboards)

These cannot be done in code — they live in dashboards. Do them in order; each takes < 5 minutes.

### 1. Postgres private networking

- Railway dashboard → **Postgres** service → Settings → Networking → **disable public TCP proxy**
- Railway dashboard → **api** service → Variables → set `DATABASE_URL = ${{ Postgres.DATABASE_PRIVATE_URL }}` (exact double-curly syntax; service name is case-sensitive)
- Save → wait for redeploy → Logs tab should show "uvicorn running" with no DNS / connection errors
- From your laptop: `nc -zv <old-public-pg-host> 5432` should fail with *Name or service not known*

### 2. Seal + rotate `SECRET_KEY`

- Railway → api service → Variables → `SECRET_KEY` → 3-dot → **Seal** (no un-seal exists)
- Verify: `railway login && railway link && railway variables` — output should NOT show the value
- Rotation drill: `openssl rand -hex 32` → Delete sealed var → **+ New Variable** with same name + new value + Seal checked → save → wait for redeploy
- Verify rotation invalidated old JWTs: from a browser tab with an old token, hit any authenticated endpoint → must return 401
- After rotation, update `Last rotated:` in this doc

### 3. Enable Dependabot in both GitHub repos

- `github.com/yigit353/week12-web-programming` → Settings → Code security and analysis
- Turn on **Dependabot alerts** and **Dependabot security updates**
- (Optional) **Dependabot version updates** — adds a `.github/dependabot.yml` PR
- Visit the **Security** tab → confirm "Dependabot is monitoring" with a green check
- (No second repo: this monorepo holds both `bytebooks-frontend/` and `bytebooks-api/`. If they're ever split, repeat there.)

### 4. (Optional) Wire Sentry

- Backend: `pip install "sentry-sdk[fastapi]"` → add to `requirements.txt` → init in `main.py` (gate on `SENTRY_DSN` env var)
- Sentry.io → create project (Python → FastAPI) → copy DSN
- Railway → api service → Variables → `SENTRY_DSN` → paste → check **Seal** → save
- Trigger a deliberate exception → confirm it appears in Sentry within seconds

### 5. Tail logs during a brute-force test (one-off observation)

```bash
API=https://week12-web-programming-production.up.railway.app
for i in $(seq 1 8); do
  curl -s -o /dev/null -X POST "$API/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"nope@example.com","password":"nope"}'
done
```

Watch Railway → api → Logs: should show 5× normal entries plus 3× 429s. If the 429s don't log, add a logger call to `rate_limit_exceeded_handler` in `main.py`.

## Gotchas

These bit us during Session 1 — capture for the next person:

- **`FRONTEND_URL` on Railway must have NO trailing slash.** FastAPI's `CORSMiddleware` with `allow_credentials=True` compares the browser's `Origin` header byte-for-byte against the allowlist. Browsers send `https://host` (no slash). A trailing slash in `FRONTEND_URL` makes every preflight return 400 with no `Access-Control-Allow-Origin` header, which surfaces in the React app as a generic "Failed to load dashboard data" error. Same rule for `connect-src` in `vercel.json` and for `VITE_API_URL` on Vercel.
- **Vercel project Root Directory + CLI deploys**: when the project's Root Directory is set to `bytebooks-frontend`, `vercel deploy` must run from the **monorepo root** (where `.vercel/` lives), not from inside `bytebooks-frontend/`. Running from the subdir produces a "doubled path" error: `~/.../bytebooks-frontend/bytebooks-frontend does not exist`.
- **Bot Protection vs rate-limit ordering during load tests**: a 70-request curl loop returned ~60 of 200, then a mix of 403 and 429 rather than a clean 60-then-10 split. Vercel's pipeline runs Bot Protection / AI Bot rulesets *before* custom WAF rules, so non-browser traffic (curl) can be intercepted with 403 before reaching the per-IP rate counter. To test the rate-limit rule cleanly, either set Bot Protection to Off temporarily or pass a browser-like `User-Agent` header in the loop.
- **`@vercel/edge` over `next/server` for plain Vite**: documented above; mentioned here because it's the most common copy-paste-from-the-internet mistake. The Vercel docs' middleware examples assume Next.js. For Vite you import from `@vercel/edge` and the Request object is the Web standard one.
- **slowapi decorator order matters for rate limiting**: `@app.post(...)` must be the **outer** decorator, `@limiter.limit(...)` the **inner** one. Python decorators apply bottom-up, so with `@app.post` outside, `@limiter.limit` wraps the function first and `@app.post` then registers the wrapped version. Reverse them and FastAPI registers the un-limited function — the route still works, but the limit silently never fires. (The Session 2 prompt has the order inverted; the working order is what's in `main.py`.)

## Verification (run any time)

```bash
# All six headers present + CSP enforcing
curl -I https://bytebooks-frontend-week12.vercel.app | grep -iE 'content-security|strict-transport|x-frame|x-content-type|referrer-policy|permissions-policy'

# Edge Middleware injects x-request-id (different UUID each call)
curl -I https://bytebooks-frontend-week12.vercel.app | grep -i x-request-id

# Admin gate returns 401 (no cookie)
curl -i https://bytebooks-frontend-week12.vercel.app/admin/anything | head -1

# Admin gate passes through with cookie present
curl -sI -H "Cookie: bb_session=anything" https://bytebooks-frontend-week12.vercel.app/admin/anything | head -1

# WAF rate-limit fires after threshold (expect ~60 of 200, mix of 403 and 429 after)
for i in $(seq 1 70); do
  curl -s -o /dev/null -w "%{http_code}\n" https://bytebooks-frontend-week12.vercel.app/api/probe
done | sort | uniq -c
```

## Open items

- `style-src 'unsafe-inline'` is a Vite-mode concession. Remove after refactoring inline component styles into `.css` modules.
- HSTS preload-list submission is deferred until the apex domain is finalised.
- Promote **Bot Protection** from Log mode to On (challenge mode) after a week of observability shows no false positives.
- Write an ACM operator runbook: one-page checklist of webhooks / automations to verify before and after enabling Attack Challenge Mode.
- Delete the retired Week 11 Vercel project (`bytebooks-frontend` at `bytebooks-frontend-mu.vercel.app`) and old Railway project once the Week 12 deployments have been observed stable.
- Reconnect Vercel project to the GitHub repo so future `git push` triggers an auto-deploy (currently CLI-deployed only).

## Change log

- **Phase A**: shipped 6 headers with CSP in Report-Only mode, added Edge Middleware (`x-request-id` + `/admin/*` gate), drafted this document. Created new Vercel project `bytebooks-frontend-week12` and new Railway project for `bytebooks-api` linked to `github.com/yigit353/week12-web-programming`. Dashboard work completed during the deploy wait: Vercel Authentication ON, Bypass token saved, WAF rate-limit rule published, Bot Protection set to Log, AI Bots set to On (Deny), Attack Challenge Mode confirmed off, Vercel Root Directory set to `bytebooks-frontend`, Railway `FRONTEND_URL` env var set without trailing slash.
- **Phase B**: promoted CSP from Report-Only to enforcing after Console showed zero violations under a full app exercise (`/`, `/books`, `/authors`, `/login`, `/books/new` post-login). Rewrote Bot Management section with current Vercel terminology. Added Gotchas section capturing the four lessons from this session.
- **Phase C (Session 2, 2026-05-03)**: hardened the Railway origin. Wired slowapi with a JWT-or-IP key function (`bytebooks-api/main.py:149`) — `/auth/login` 5/min, `/books/search-external` 30/min, 429 returns `Retry-After: 60`. Smoke-tested locally: 5×401 then 429. Added `slowapi>=0.1.9` to `requirements.txt`. Used `python-jose` (already a dep) instead of pulling in `pyjwt` for the unverified-claims read. Audits: `pip-audit` 0 vulns, `npm audit --omit=dev` 0 vulns. Added the 14-item production-readiness checklist (rubric for the final-project security score) — 11/14 ticked; the three open items are operator dashboard tasks captured under *Pending operator work*.
