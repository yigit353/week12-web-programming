# Session 1 Companion Guide — What to Watch Out For

This guide complements [`prompts/session1-prompt.md`](prompts/session1-prompt.md). It captures gotchas, terminology updates, and corrections that came up the first time we walked through the assignment, so you can avoid the same dead-ends.

Read this once before you start, then refer back to specific sections as you hit them.

## Table of Contents

- [Before You Start: Repo + Project Setup](#before-you-start-repo--project-setup)
- [Vercel Project Setup in a Monorepo](#vercel-project-setup-in-a-monorepo)
- [Terminology Updates Since the Prompt Was Written](#terminology-updates-since-the-prompt-was-written)
- [Phase 1 Notes: CSP and Headers](#phase-1-notes-csp-and-headers)
- [Phase 5 Notes: Edge Middleware](#phase-5-notes-edge-middleware)
- [Cross-Cutting: Backend CORS](#cross-cutting-backend-cors)
- [Testing the WAF Rate-Limit Rule Cleanly](#testing-the-waf-rate-limit-rule-cleanly)
- [Common Errors and What They Mean](#common-errors-and-what-they-mean)
- [Quick Reference: Verification Commands](#quick-reference-verification-commands)

---

## Before You Start: Repo + Project Setup

The Session 1 prompt assumes you have:

1. A standalone frontend repo with its own GitHub remote.
2. A Vercel project already linked to that repo, deploying to `<your-app>.vercel.app`.
3. A Railway project deploying the FastAPI backend.

In this class the codebase is a **monorepo** with `bytebooks-frontend/` and `bytebooks-api/` as subdirectories. Some prompt steps need adjustment:

- **`vercel.json` and `middleware.js` go inside `bytebooks-frontend/`**, not at the monorepo root. The Vercel project setting "Root Directory" must point at this subdirectory so Vercel can find the `package.json` and middleware.
- **Git commands run from the monorepo root**, not the subdirectory. `git push origin main` pushes everything in one go.
- **If you're starting Week 12 fresh** (creating a new GitHub repo and new Vercel/Railway projects), do the following BEFORE starting Phase A of the prompt:
  1. Create the GitHub repo from the monorepo root: `gh repo create <your-handle>/week12-web-programming --public --source=. --remote=origin`
  2. Make a "Week 11 checkpoint" commit that imports your existing code, then push: keeps your Session 1 commit clean.
  3. Create the new Vercel project: `cd bytebooks-frontend && vercel deploy --prod --yes --name <new-project-name>` (run from inside `bytebooks-frontend/` for the *first* deploy so Vercel auto-detects the build setup).
  4. Vercel dashboard → Settings → **Git** → Connect to your GitHub repo (CLI can't do this; see [below](#connecting-github-via-cli-doesnt-work)).
  5. Vercel dashboard → Settings → **Build and Deployment** → Root Directory → set to `bytebooks-frontend`.
  6. Move `.vercel/` from `bytebooks-frontend/` up to the monorepo root after step 5 (see [`.vercel/` location](#vercel-directory-location-matters)).
  7. Vercel dashboard → Settings → **Environment Variables** → add `VITE_API_URL=https://<your-railway-host>.up.railway.app` (no trailing slash — see the [CORS section](#cross-cutting-backend-cors)).
  8. New Railway project: railway.app → New Project → Deploy from GitHub repo, select the same repo, set Root Directory to `bytebooks-api`, add the Postgres add-on, set env vars (`SECRET_KEY` from `openssl rand -hex 32`, `FRONTEND_URL=https://<your-vercel-host>.vercel.app` — again, no trailing slash).

After these steps, you can start Phase 1 of the prompt.

## Vercel Project Setup in a Monorepo

### `.vercel/` directory location matters

When the Vercel project's Root Directory is set to a subdirectory (e.g. `bytebooks-frontend`):

- **`.vercel/` should live at the GitHub repo root** (the monorepo root).
- CLI deploys must run **from the monorepo root**, not from inside the subdirectory.

If you run `vercel deploy` from inside `bytebooks-frontend/` after Root Directory is set, you'll see:

```
Error: The provided path "~/.../bytebooks-frontend/bytebooks-frontend" does not exist.
```

The CLI is appending the Root Directory setting to your cwd, doubling the path. Fix:

```bash
mv bytebooks-frontend/.vercel ./.vercel  # move it up one level
cd ..                                     # then cd to monorepo root
vercel deploy --prod --yes
```

### Connecting GitHub via CLI doesn't work

`vercel git connect <repo-url>` fails with:

```
Error: Failed to connect ... to project. Make sure there aren't any typos and that you have access to the repository if it's private.
```

Vercel's GitHub integration needs the **Vercel GitHub App** to be installed on your GitHub account (an OAuth flow only doable through the browser). Connect via the dashboard:

1. Vercel project → **Settings → Git** → "Connect Git Repository" → pick your repo.
2. Vercel will offer to install the GitHub App if it isn't already on your account; accept it.

### Until GitHub is connected, deploy via CLI

Run `vercel deploy --prod --yes` from the monorepo root after every commit. Once the GitHub integration is connected, `git push` triggers an auto-deploy and you can stop calling `vercel deploy` manually.

## Terminology Updates Since the Prompt Was Written

The Session 1 prompt mentions some Vercel features that have been renamed or split since it was written. Here's the current state.

### "BotID Basic" → "Bot Protection" + "AI Bots"

The prompt says to confirm "BotID Basic" is enabled. That product was retired. Vercel now has two managed rulesets under **Firewall → Bot Management**:

| Ruleset | What it does | Modes |
| --- | --- | --- |
| **Bot Protection** | Challenges non-browser traffic that violates browser-like behavior. Auto-allows verified bots (Googlebot, Bingbot, etc.). | Off / Log / On (challenge) |
| **AI Bots** | Blocks known AI crawlers — GPTBot, ClaudeBot, ChatGPT-User, Perplexity, etc. List auto-maintained by Vercel. | Off / Log / On (deny) |

**Recommended for the prompt:**

- Bot Protection → **Log** (observe before challenging real users; promote to On later once observability shows zero false positives).
- AI Bots → **On** (Deny — useful for a course site since you generally don't want training data scrapers indexing it).

**Reverse-proxy gotcha**: Bot Protection breaks behind external CDNs (Cloudflare etc.). The proxy obscures detection signals and rotates exit IPs. Disable Bot Protection if you ever stick a CDN in front.

### "Attack Challenge Mode" still exists, but in a different place

The prompt says the Attack Challenge Mode kill-switch lives "under Bot Management." It's actually a **separate item in the Firewall sidebar**, not nested under Bot Management. Look for it as its own panel.

Leave it OFF by default. Flip ON only during a live targeted attack — and verify webhooks and any non-browser traffic still pass before leaving on.

### JA4 IS available on Hobby (the prompt is wrong)

The prompt says: "On Pro we'd add ... JA4-keyed rules for adversarial fingerprints." This implies JA4 is Pro-only.

Actually **JA4 Digest IS available as a counting key on the rate-limit rule on Hobby**. The Hobby gap is the *rule count* (one rule total), not the available keys. With one rule we use it for the broad IP-keyed case; on Pro you'd add a *separate* JA4-keyed rule targeting specific known-bad fingerprints.

For your Hobby rule, leave **only IP Address checked**. The tooltip says "Limits are calculated by the combination of all selected keys" — meaning adding more keys makes the rule MORE permissive, because each unique combination of keys gets its own counter.

### "If" condition — pick "Request Path", not "Raw Path" or "Route"

When configuring the rate-limit rule, the dropdown shows three path types:

- **Request Path** — normalized URL path (recommended; trailing slash collapsed, case-folded).
- **Raw Path** — exact bytes from the client (slightly stricter; bypassable via case tricks like `/API/login`).
- **Route** — Next.js framework patterns (doesn't apply to Vite).

Pick **Request Path**. Value: `^/(api|auth)/.*$`.

## Phase 1 Notes: CSP and Headers

### Promote to enforcing only after observing zero violations

The prompt's two-commit pattern (Report-Only → enforcing) is worth following exactly. After committing CSP in Report-Only mode:

1. Open the deployed site in Chrome or Firefox with DevTools open (F12 / ⌥⌘I).
2. Console tab visible.
3. **Reload the page** (so initial-load violations show up).
4. Click through every route in the app:
   - `/` (Dashboard)
   - `/books`
   - `/authors`
   - `/login` (try a real login attempt — exercises `connect-src` against Railway).
   - `/books/new` (after logging in, since it's a `ProtectedRoute`).
5. Watch Console for `[Report Only]` lines. Each is a directive that would block in enforcing mode.

If any fire, identify the directive (e.g. `connect-src`, `style-src`) and the blocked URL. Tighten the directive in `vercel.json`, ship a forward-fix commit, redeploy, re-exercise. Loop until Console is clean.

Only THEN flip the header key from `Content-Security-Policy-Report-Only` to `Content-Security-Policy`.

### Don't confuse extension errors with CSP violations

Browser extensions (LastPass, Bitwarden, Honey, ad blockers, etc.) inject scripts into your page and may produce errors like:

```
Uncaught (in promise) Error: A listener indicated an asynchronous response by returning true,
but the message channel closed before a response was received
```

This is **not** a CSP violation. It's the extension's own code complaining. Ignore it. (Or disable extensions briefly if you want a cleaner Console for the walkthrough.)

A real CSP violation looks like:

```
[Report Only] Refused to connect to 'https://example.com/api' because it violates the
following Content Security Policy directive: "connect-src 'self' https://...railway.app"
```

It always names the offending directive AND the blocked URL.

### `connect-src` value — no trailing slash

CSP origin allowlists are compared byte-for-byte against the URL being requested. Always paste:

```
connect-src 'self' https://your-api.up.railway.app
```

NOT `https://your-api.up.railway.app/`. The same rule applies to your `VITE_API_URL` env var on Vercel and your `FRONTEND_URL` env var on Railway (more on the Railway side in the [CORS section](#cross-cutting-backend-cors)).

### `style-src 'unsafe-inline'` is a Vite-mode concession

Some component CSS in this codebase uses inline styles, which require `'unsafe-inline'` in the CSP. This is a known compromise — the prompt mentions it as an Open Item. To remove it later you'd refactor inline styles into `.css` modules. For Session 1, leave it in.

## Phase 5 Notes: Edge Middleware

### Use `@vercel/edge`, not `next/server`

The prompt's example middleware imports from `next/server`:

```ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
```

These imports only work in Next.js projects. For a plain Vite + React project (which is what ByteBooks is), use the framework-agnostic `@vercel/edge` package:

```bash
cd bytebooks-frontend
npm install --save @vercel/edge
```

```js
import { next } from '@vercel/edge';

export const config = {
  matcher: '/((?!assets/|favicon\\.ico|vite\\.svg).*)',
};

export default function middleware(request) {
  // request is a Web standard Request — no .cookies, no .geo, no helpers
  const requestId = crypto.randomUUID();
  return next({ headers: { 'x-request-id': requestId } });
}
```

### Web standard `Request` has no `.cookies` accessor

The prompt uses `req.cookies.get('bb_session')`, which is a Next.js `NextRequest` extension. The Web standard `Request` (what `@vercel/edge` exposes) has no such accessor — you parse the `Cookie` header manually:

```js
function readCookie(cookieHeader, name) {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

const session = readCookie(request.headers.get('cookie'), 'bb_session');
if (!session) {
  return new Response('unauthorized', { status: 401 });
}
```

### Matcher excludes Vite assets, not Next.js paths

The prompt's matcher excludes `_next/static|_next/image|favicon.ico|assets/`. Those `_next/*` paths only exist in Next.js. For Vite, use:

```js
matcher: '/((?!assets/|favicon\\.ico|vite\\.svg).*)'
```

`assets/` is where Vite emits bundled JS/CSS. `vite.svg` is the default favicon shipped in `public/`.

### `/admin/*` doesn't need a real React route to demonstrate the gate

The prompt says to gate `/admin/*` on a `bb_session` cookie. This codebase has no `/admin` React route, but the gate still works — middleware runs before the SPA, returns 401 for any `/admin/anything` regardless of whether a React handler exists. This *is* the lesson: edge-side gating fires before any application logic.

## Cross-Cutting: Backend CORS

### `FRONTEND_URL` on Railway must have NO trailing slash

The FastAPI backend reads `FRONTEND_URL` from env and adds it to the CORS allowlist:

```python
FRONTEND_URL = os.getenv("FRONTEND_URL")
allowed_origins = ["http://localhost:5173", "http://localhost:5174"]
if FRONTEND_URL:
    allowed_origins.append(FRONTEND_URL)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

With `allow_credentials=True`, FastAPI's `CORSMiddleware` compares the browser's `Origin` header **byte-for-byte** against the allowlist. Wildcards aren't allowed and a trailing slash never matches.

Browsers always send:
```
Origin: https://bytebooks-frontend-week12.vercel.app
```

NOT:
```
Origin: https://bytebooks-frontend-week12.vercel.app/
```

If your Railway env var has a trailing slash, no match → no `Access-Control-Allow-Origin` header in the preflight response → browser blocks the request.

**Symptom**: Frontend shows "Failed to load dashboard data. Make sure the backend is running." DevTools Network tab shows the OPTIONS preflight returning 400 with no `access-control-allow-origin` header.

**Fix**: Railway dashboard → service → **Variables** → edit `FRONTEND_URL` → remove the trailing slash → save (Railway auto-redeploys, ~30–60s). Retry the frontend.

The same rule applies to:

- `VITE_API_URL` on Vercel (no trailing slash)
- The Railway origin in CSP `connect-src` (no trailing slash)

### How to verify CORS yourself

```bash
curl -sI -X OPTIONS \
  -H "Origin: https://<your-frontend>.vercel.app" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: authorization" \
  https://<your-backend>.up.railway.app/books | grep -iE 'access-control|http'
```

Expected output (good):
```
HTTP/2 200          (or 204)
access-control-allow-origin: https://<your-frontend>.vercel.app
access-control-allow-credentials: true
access-control-allow-headers: authorization
access-control-allow-methods: DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT
```

Bad (CORS rejection — your `FRONTEND_URL` is wrong):
```
HTTP/2 400
access-control-allow-credentials: true
access-control-allow-headers: authorization
access-control-allow-methods: DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT
                                # ^^^ no access-control-allow-origin = browser will reject
```

## Testing the WAF Rate-Limit Rule Cleanly

### Expected output of the curl loop

The prompt says:

```bash
for i in $(seq 1 70); do
  curl -s -o /dev/null -w "%{http_code}\n" https://your-app.vercel.app/api/anything
done | sort | uniq -c
```

Expected: ~60 of 200, then ~10 of 429.

### What you'll actually see if Bot Protection is on

If Bot Protection is in **On** (challenge) mode, the breakdown will look more like:

```
  60 200
   8 403
   2 429
```

The 403s are from Bot Protection challenging curl as non-browser traffic. Vercel's pipeline runs Bot Protection → AI Bots → Custom WAF rules. Curl gets caught at Bot Protection *before* reaching the rate-limit counter for some of the post-threshold requests.

### How to test cleanly

Two options:

1. Set Bot Protection to **Off** during the test, run the loop, then re-enable Log/On.
2. Pass a browser-like User-Agent in the curl loop:

   ```bash
   for i in $(seq 1 70); do
     curl -s -o /dev/null -w "%{http_code}\n" \
       -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" \
       https://your-app.vercel.app/api/anything
   done | sort | uniq -c
   ```

Option 2 is preferred — keeps the rest of your security posture intact while you measure the rate limit.

### What "the rate-limit rule works" looks like

You should see at least one **429** in the output. As long as 429s appear, the rule is functional. If 60 + 8 (403) + 2 (429) = 70, the rate limit IS firing — just on a smaller subset because Bot Protection caught the rest first.

If you see ZERO 429s, something is wrong:

- Most common cause: regex is `/api/.*` instead of `^/(api|auth)/.*$` (the trailing `.*` requires at least one character after the slash, so `/api` alone won't match).
- Or the rule isn't published — go back to the dashboard, click Review Changes → Publish.
- Or your test ran across two 60-second windows. Run the loop with `time` to confirm it finished inside 60s.

## Common Errors and What They Mean

| Symptom | Cause | Fix |
| --- | --- | --- |
| `vercel deploy: ".../bytebooks-frontend/bytebooks-frontend" does not exist` | CLI deployed from inside the subdir; Root Directory setting doubles the path. | `cd` up to monorepo root before deploying. |
| `vercel git connect: Failed to connect ...` | CLI can't perform GitHub OAuth flow. | Use Vercel dashboard → Settings → Git → Connect Git Repository. |
| Frontend: "Failed to load dashboard data." Network tab: preflight 400, no `access-control-allow-origin`. | Backend CORS rejection — `FRONTEND_URL` on Railway has trailing slash, doesn't match the browser's Origin header. | Railway → Variables → edit `FRONTEND_URL`, remove trailing slash. |
| Login form submits, gets 422. | FastAPI Pydantic validation failed. Login expects `email` (`EmailStr`), not username; or fields were empty. | Use a valid email format in the login form. |
| Login form returns 401 with valid email. | Backend validated the request but the user doesn't exist (new Railway = empty DB). | Register first via `/register`, then log in. |
| Console: `[Report Only] Refused to connect to ...` | CSP `connect-src` doesn't allow that origin. | Add the origin to `connect-src` in `vercel.json` (verbatim, no trailing slash). |
| Console: `[Report Only] Refused to apply inline style ...` | CSP `style-src` doesn't allow `'unsafe-inline'`. | Either include `'unsafe-inline'` in `style-src` (Vite mode concession) or refactor the inline style into a `.css` file. |
| Console: `Uncaught Error: A listener indicated an asynchronous response ...` | Browser extension noise (not your app). | Ignore. Disable the extension if you want a clean Console. |
| Curl rate-limit loop returns all 200s, no 429s. | Regex wrong, rule not published, or per-region counter not filling. | Verify regex is `^/(api|auth)/.*$`; click Review Changes → Publish; run loop in tighter time. |
| Curl loop returns mostly 403s instead of 429s. | Bot Protection is catching curl before rate-limit. | Set Bot Protection to Off temporarily OR pass a browser User-Agent in the loop. |
| `git push` succeeds but Vercel doesn't auto-deploy. | New Vercel project's GitHub integration not connected yet. | Vercel dashboard → Settings → Git → Connect Git Repository. Until then, deploy with `vercel deploy --prod`. |

## Quick Reference: Verification Commands

Replace `<your-app>.vercel.app` and `<your-api>.up.railway.app` with your actual hostnames.

```bash
# 1. Six security headers + CSP enforcing
curl -sI https://<your-app>.vercel.app | \
  grep -iE 'content-security|strict-transport|x-frame|x-content-type|referrer-policy|permissions-policy'

# 2. x-request-id present and rotates per request
curl -sI https://<your-app>.vercel.app | grep -i x-request-id
curl -sI https://<your-app>.vercel.app | grep -i x-request-id  # different UUID

# 3. Admin gate returns 401 (no cookie)
curl -i https://<your-app>.vercel.app/admin/anything | head -1
# Expect: HTTP/2 401

# 4. Admin gate passes through with cookie
curl -sI -H "Cookie: bb_session=anything" https://<your-app>.vercel.app/admin/anything | head -1
# Expect: HTTP/2 200

# 5. WAF rate-limit fires (use browser UA to bypass Bot Protection during testing)
for i in $(seq 1 70); do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -H "User-Agent: Mozilla/5.0" \
    https://<your-app>.vercel.app/api/probe
done | sort | uniq -c
# Expect: ~60 of 200, plus 429s after threshold

# 6. CORS preflight from your frontend origin
curl -sI -X OPTIONS \
  -H "Origin: https://<your-app>.vercel.app" \
  -H "Access-Control-Request-Method: GET" \
  https://<your-api>.up.railway.app/books | \
  grep -iE 'access-control|http'
# Expect: HTTP/2 200 or 204, plus access-control-allow-origin matching your frontend origin
```

If every command returns the expected output, you've completed Session 1 successfully — and you should have an enforced CSP, Edge Middleware injecting `x-request-id`, an admin gate at the edge, a WAF rate-limit rule firing under load, and a backend that actually accepts your frontend's CORS preflights.
