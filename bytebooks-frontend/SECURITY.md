# ByteBooks Frontend — Security Posture

> Status: Session 1 complete. CSP is enforcing. Dashboard work documented.

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

## Gotchas

These bit us during Session 1 — capture for the next person:

- **`FRONTEND_URL` on Railway must have NO trailing slash.** FastAPI's `CORSMiddleware` with `allow_credentials=True` compares the browser's `Origin` header byte-for-byte against the allowlist. Browsers send `https://host` (no slash). A trailing slash in `FRONTEND_URL` makes every preflight return 400 with no `Access-Control-Allow-Origin` header, which surfaces in the React app as a generic "Failed to load dashboard data" error. Same rule for `connect-src` in `vercel.json` and for `VITE_API_URL` on Vercel.
- **Vercel project Root Directory + CLI deploys**: when the project's Root Directory is set to `bytebooks-frontend`, `vercel deploy` must run from the **monorepo root** (where `.vercel/` lives), not from inside `bytebooks-frontend/`. Running from the subdir produces a "doubled path" error: `~/.../bytebooks-frontend/bytebooks-frontend does not exist`.
- **Bot Protection vs rate-limit ordering during load tests**: a 70-request curl loop returned ~60 of 200, then a mix of 403 and 429 rather than a clean 60-then-10 split. Vercel's pipeline runs Bot Protection / AI Bot rulesets *before* custom WAF rules, so non-browser traffic (curl) can be intercepted with 403 before reaching the per-IP rate counter. To test the rate-limit rule cleanly, either set Bot Protection to Off temporarily or pass a browser-like `User-Agent` header in the loop.
- **`@vercel/edge` over `next/server` for plain Vite**: documented above; mentioned here because it's the most common copy-paste-from-the-internet mistake. The Vercel docs' middleware examples assume Next.js. For Vite you import from `@vercel/edge` and the Request object is the Web standard one.

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
