# Security Policy

This repository is the companion codebase for an undergraduate Web Programming course at Istinye University. It is **not a production product**, but it is publicly deployed (Vercel + Railway) and the security posture is part of the curriculum's final-project rubric. We take vulnerability reports seriously.

## Scope

- `bytebooks-frontend/` — Vite + React app deployed to Vercel
- `bytebooks-api/` — FastAPI service deployed to Railway, backed by Postgres
- The two GitHub Actions / Dependabot configs that ship with the repo

The deployed instances are:

- Frontend: <https://bytebooks-frontend-week12.vercel.app>
- Backend: <https://week12-web-programming-production.up.railway.app>

## Supported Versions

This is a single-branch, rolling-main project. Only the latest commit on `main` is supported. Older commits (including the `Week 11 checkpoint`) are kept for historical/teaching reasons and will not receive fixes.

| Branch | Supported |
| --- | --- |
| `main` (latest) | ✅ |
| Older history / tags | ❌ |

## Reporting a Vulnerability

**Preferred channel: GitHub Private Vulnerability Reporting.**

1. Go to the [Security tab of this repo](https://github.com/yigit353/week12-web-programming/security)
2. Click **Report a vulnerability**
3. Fill in the form — the report is private and only visible to repo maintainers

If you cannot use the GitHub flow, open a minimal public issue stating only *"I have a security report — please contact me"* (no details), and we will reach out to you to set up a private channel.

### What to include

- Affected component (`bytebooks-frontend`, `bytebooks-api`, deployment config, etc.)
- A description of the vulnerability and its impact
- Steps to reproduce — proof-of-concept code or curl invocations are very welcome
- The deployed URL or commit SHA you tested against
- (Optional) Suggested mitigation

### What to expect

- **Acknowledgement** within 5 business days
- **Initial triage** within 10 business days (severity assessment, scope)
- **Fix or mitigation timeline** depending on severity:
  - Critical → patch within 7 days
  - High → patch within 30 days
  - Moderate / low → next regularly scheduled release
- **Coordinated disclosure**: we will agree on a disclosure date with you before publishing details. Please do not publish until then.

### Out of scope

- Findings that require physical access to a maintainer's machine
- Denial-of-service via raw request volume against the Vercel/Railway free-tier deployments (the platforms' rate limiters will already 429 you)
- Self-XSS or attacks that depend on the victim running attacker-supplied JS in their own DevTools console
- Reports based purely on missing security headers without an exploitable consequence (we already enforce CSP, HSTS, X-Frame-Options, etc. — see *Security Posture* below)
- Issues in third-party dependencies that already have a public CVE and an open Dependabot PR — please file those upstream

## Security Posture (what's already configured)

The full operational posture is documented in [`bytebooks-frontend/SECURITY.md`](bytebooks-frontend/SECURITY.md). Briefly:

- 6 security headers in `vercel.json` with **enforced CSP**
- Vercel Authentication on previews; Vercel WAF rate limit; Bot Protection + AI Bots managed rulesets
- Edge Middleware injecting `x-request-id` and gating `/admin/*`
- Postgres reachable only via the Railway private network (`postgres.railway.internal`); public TCP proxy disabled
- `SECRET_KEY` sealed in Railway with a documented quarterly rotation procedure
- slowapi JWT-keyed rate limits on `/auth/login` (5/min) and `/books/search-external` (30/min)
- `pip-audit` and `npm audit --omit=dev` pass with 0 findings; Dependabot security + version updates enabled

A 14-item production-readiness checklist (the rubric for the course's final project) lives at the bottom of that file.

## Acknowledgements

If your report leads to a fix, we will credit you in the commit message and (optionally) in the change log of `bytebooks-frontend/SECURITY.md`. Tell us if you'd like to be acknowledged by name, by handle, or anonymously.
