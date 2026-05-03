# ByteBooks Frontend — Security Posture (Session 1 — In Progress)

> Status: Phase A. Headers shipped, CSP is **Report-Only** while we observe
> violations. Vercel dashboard work tracked below; some items still TODO.

## Headers (`vercel.json`)

Configured at `bytebooks-frontend/vercel.json` and applied to `/(.*)`:

| Header | Value (current) | Why |
| --- | --- | --- |
| `Content-Security-Policy-Report-Only` | `default-src 'self'; script-src 'self'; connect-src 'self' https://week11-web-programming-production.up.railway.app; img-src 'self' data:; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'` | XSS allowlist. Report-Only first so violations are observed, not blocked. Promote to enforcing once DevTools shows zero violations. |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | Force HTTPS for 2 years; prepare for HSTS preload-list submission. |
| `X-Frame-Options` | `DENY` | Clickjack defense (legacy header, paired with CSP `frame-ancestors 'none'`). |
| `X-Content-Type-Options` | `nosniff` | Disable MIME-sniffing. |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Don't leak full URLs across origins. |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), interest-cohort=()` | Deny unused device APIs and FLoC. |

The `connect-src` directive lists the Railway API origin verbatim (no path, no trailing slash). Adding any new external API origin requires updating this list.

## Deployment Protection

- **Vercel Authentication**: Standard Protection — TODO (toggled ON in Phase A user-driven dashboard step).
- Production deployments remain public on Hobby; only previews are gated.
- **Protection Bypass for Automation token**: TODO — generate, store in password manager (suggested name: `bytebooks/vercel-protection-bypass`), reference here by name only. Used by Playwright runs and AI agents that hit preview URLs via the `x-vercel-protection-bypass` header.

## Firewall (Hobby — single rule cap)

- **`auth-and-api rate limit`**: TODO — create in Phase A.
  - Path matches regex `^/(api|auth)/.*$`
  - Fixed Window, 60 s, 60 requests, IP-keyed
  - Default action on exceed: 429
- Hobby plan caps us at one WAF rule. On Pro we would split this into:
  - `/auth/login` stricter limit (e.g., 5/min/IP) for credential-stuffing defense
  - IP block ranges for known-bad CIDRs
  - JA4-keyed rules for adversarial TLS fingerprints

## Bot Management

- **BotID Basic** enabled (Hobby default, free) — TODO confirm in dashboard.
- **Attack Challenge Mode** disabled by default. Flip ON only during a live targeted attack via Firewall → Bot Management → Attack Challenge Mode → Enable. Verify webhooks and any non-browser traffic still pass before leaving on.

## Edge Middleware

- File: `bytebooks-frontend/middleware.js` (Vercel auto-detects).
- Runtime: Vercel Edge (uses `@vercel/edge` — framework-agnostic; chosen over `next/server` because this is plain Vite, not Next.js).
- Matcher: `'/((?!assets/|favicon\\.ico|vite\\.svg).*)'` — excludes Vite's bundled assets so they don't burn Edge invocations.
- Behaviors:
  1. Injects `x-request-id: <UUIDv4>` on every response.
  2. Returns 401 for any `/admin/*` request without a `bb_session` cookie.

## Open items

- `style-src 'unsafe-inline'` is a Vite-mode concession because some component CSS leans on inline styles. Remove after refactoring inline styles into `.css` modules.
- Promote CSP to enforcing (drop the `-Report-Only` suffix) once DevTools shows zero violations under a full app exercise.
- Generate Protection Bypass for Automation token, store in password manager, document by name only.
- Confirm BotID Basic is on in the dashboard; document the ACM kill-switch path.

## Change log

- **Phase A (current)**: shipped headers in Report-Only mode, added Edge Middleware, drafted this document.
- **Phase B (next)**: promote CSP to enforcing, finalize dashboard items.
