You are hardening the ByteBooks React frontend that's already deployed to Vercel from Week 11. The project is a Vite-built React app, the production URL is `<your-app>.vercel.app`, and the FastAPI backend is at `<your-api>.railway.app`. Goal: lock down the front door before the hands-on Railway session.

This session has six parts. Work through them in order. Each part ends with a verification step — do not skip it.

## Part 1: Security Headers via `vercel.json`

1. Open `vercel.json` in the frontend repo. If it doesn't exist, create it. If it does, you'll be **adding** a `headers` array (preserve any existing `rewrites` block from Week 11).

2. Add a `headers` block applying to `/(.*)` with these entries. Important: ship CSP first as `Content-Security-Policy-Report-Only` so violations are observed, not enforced. Replace `<your-api>.railway.app` with your actual Railway backend host.

   ```json
   {
     "rewrites": [
       { "source": "/(.*)", "destination": "/index.html" }
     ],
     "headers": [
       {
         "source": "/(.*)",
         "headers": [
           {
             "key": "Content-Security-Policy-Report-Only",
             "value": "default-src 'self'; script-src 'self'; connect-src 'self' https://<your-api>.railway.app; img-src 'self' data:; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
           },
           {
             "key": "Strict-Transport-Security",
             "value": "max-age=63072000; includeSubDomains; preload"
           },
           { "key": "X-Frame-Options", "value": "DENY" },
           { "key": "X-Content-Type-Options", "value": "nosniff" },
           { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
           {
             "key": "Permissions-Policy",
             "value": "camera=(), microphone=(), geolocation=(), interest-cohort=()"
           }
         ]
       }
     ]
   }
   ```

   Why each header:
   - **Content-Security-Policy-Report-Only**: defense against XSS by allowlisting where scripts/styles/images can come from. `Report-Only` so we observe before blocking. `style-src 'unsafe-inline'` is a Vite-dev-mode concession we'll plan to remove.
   - **Strict-Transport-Security**: tells browsers to never use plain HTTP again for this domain. `preload` hints toward submission to the HSTS preload list.
   - **X-Frame-Options: DENY**: prevents clickjacking by refusing to be iframed.
   - **X-Content-Type-Options: nosniff**: stops browsers from MIME-sniffing scripts out of non-script responses.
   - **Referrer-Policy**: stops leaking the full URL (with query strings) to third-party domains.
   - **Permissions-Policy**: explicit deny-list — kills FLoC/topic-tracking and unnecessary device permissions.

3. Commit and push:
   ```bash
   git add vercel.json
   git commit -m "Add security headers via vercel.json (CSP in Report-Only)"
   git push
   ```
   Wait ~1-2 minutes for Vercel auto-deploy.

4. Verify the headers landed:
   ```bash
   curl -I https://<your-app>.vercel.app
   ```
   You should see all six security headers in the response. If `Content-Security-Policy-Report-Only` is missing, double-check the JSON syntax.

5. Open the deployed site in Chrome / Firefox DevTools → Console tab. Exercise the app:
   - Load the homepage
   - Navigate to a few routes
   - Try logging in
   - Browse books
   The Console will show CSP violation reports for anything blocked by the policy. Capture the directives that fired.

6. Tighten directives based on what you saw:
   - If `connect-src` violations appear → ensure your Railway URL is correct (full `https://...`, no trailing slash)
   - If `img-src` violations appear from a CDN → add the CDN host
   - If `style-src` violations appear from an analytics/font provider → add it explicitly (do NOT broaden to `*`)

7. Once the Console is clean for a full app exercise, **promote to enforcing**:
   - Change the header key from `Content-Security-Policy-Report-Only` to `Content-Security-Policy`
   - Commit, push, redeploy
   - Re-exercise the app — anything still firing now actually breaks. Roll back to Report-Only if you see a regression you can't fix in 5 minutes.

## Part 2: Deployment Protection on Previews

8. Open the Vercel dashboard for your project → **Settings** → **Deployment Protection**.

9. Under **Vercel Authentication**, toggle **ON** with the **Standard Protection** scope. On Hobby this protects all preview deployments; production stays public (Pro+ can extend to production).

10. Test it. From your terminal:
    ```bash
    git checkout -b throwaway/test-protection
    echo "<!-- test -->" >> index.html  # any tiny change
    git commit -am "Test protection"
    git push -u origin throwaway/test-protection
    ```
    Wait for the auto-deploy. The preview URL will be something like `bytebooks-git-throwaway-test-protection.vercel.app`.

11. Open that URL in an **incognito window**. You should see Vercel's login wall. Log in (or attempt to access without an account) — if logged in to your team, you pass through; if not, you get the access-request page.

12. Locate **Protection Bypass for Automation** (same Settings panel). Generate a token. **Don't paste it here in code or commits.** Save it to your password manager. Document its purpose in `SECURITY.md` (you'll create that file in Part 6) — note that this token is for Playwright/AI agents/CI and bypasses the auth wall via the `x-vercel-protection-bypass` header.

13. Clean up:
    ```bash
    git checkout main
    git push origin --delete throwaway/test-protection
    git branch -D throwaway/test-protection
    ```

## Part 3: One Vercel WAF Rule (the Hobby cap)

14. Vercel dashboard → your project → **Firewall** in the sidebar → **Configure** → **+ New Rule**.

15. Configure the rule:
    - **Name:** `auth-and-api rate limit`
    - **If** condition: `Path` `matches regex` `^/(api|auth)/.*$`
    - **Then** action: select **Rate Limit**
    - When the Rate Limit Pricing dialog appears, read it, then **Continue**
    - **Algorithm:** Fixed Window (the only option on Hobby)
    - **Time Window:** 60s
    - **Request Limit:** 60
    - **Counting key:** IP
    - **Action on exceed:** Default (429)

16. Save the rule, then click **Review Changes** → **Publish**. Wait ~30 seconds for propagation.

17. Test it. From your terminal:
    ```bash
    for i in $(seq 1 70); do
      curl -s -o /dev/null -w "%{http_code}\n" https://<your-app>.vercel.app/api/anything
    done | sort | uniq -c
    ```
    You should see ~60 of one status (404 or 200) followed by a cluster of 429s. If you see no 429s after 70 requests, your regex didn't match — go back and verify it's `^/(api|auth)/.*$` not `/api/.*` (which won't match `/api`).

18. **You've now used your one Hobby rate-limit rule.** Document this constraint in `SECURITY.md` (you'll create it in Part 6). On Pro you'd add separate rules for `/auth/login` (stricter, e.g. 5/min), IP blocking ranges, and JA4-keyed rules for adversarial fingerprints.

## Part 4: Bot Management Posture

19. Vercel dashboard → **Firewall** → **Bot Management**.

20. Confirm **BotID Basic** is on (it's free on Hobby; should be enabled by default). Note where the **Attack Challenge Mode** kill-switch lives — but **do not enable it now**. ACM challenges are browser-initiated; standalone-API patterns and webhooks may fail. ByteBooks' FastAPI origin lives on Railway, not behind Vercel's ACM, so it's fine for the frontend — but flipping ACM on without a live attack is unnecessary noise for users.

21. Document in `SECURITY.md` (Part 6):
    - "BotID Basic enabled (default, free)."
    - "Attack Challenge Mode disabled by default. Flip ON only during a live targeted attack via Firewall → Bot Management → Attack Challenge Mode → Enable. Verify webhooks and any non-browser traffic still passes."

## Part 5: Edge Middleware

22. Create a `middleware.ts` (or `middleware.js` if your project doesn't use TypeScript) at the **project root** (not inside `src/`). Vercel auto-detects this file.

    For a Vite + React project (no Next.js), use the Vercel Edge Middleware standalone format:

    ```ts
    // middleware.ts
    import type { NextRequest } from 'next/server';
    import { NextResponse } from 'next/server';

    export const config = {
      matcher: ['/((?!_next/static|_next/image|favicon.ico|assets/).*)'],
    };

    export function middleware(req: NextRequest) {
      const requestId = crypto.randomUUID();

      // Gate /admin/* on a session cookie
      if (req.nextUrl.pathname.startsWith('/admin')) {
        const session = req.cookies.get('bb_session');
        if (!session) {
          return new NextResponse('unauthorized', { status: 401 });
        }
      }

      // Always inject x-request-id on the response
      const res = NextResponse.next();
      res.headers.set('x-request-id', requestId);
      return res;
    }
    ```

    If your project is plain Vite (no Next.js), substitute the equivalent Vercel Edge Function pattern from `vercel.com/docs/edge-middleware`. The matcher and the two behaviors (gate `/admin/*`, inject `x-request-id`) are the lesson here, not the framework wrapper.

23. Commit and push:
    ```bash
    git add middleware.ts
    git commit -m "Add Edge Middleware: x-request-id + admin gating"
    git push
    ```

24. After deploy, verify in Chrome DevTools → Network tab. Reload your homepage. Click any request → **Headers** tab → look for **`x-request-id`** in the response headers. Each request should have a different UUID.

25. Test the admin gate:
    ```bash
    # Should return 401 (no cookie)
    curl -i https://<your-app>.vercel.app/admin/anything
    ```
    Expect `HTTP/1.1 401 Unauthorized`. If you get a 200 or 404, the matcher is too permissive or the gate isn't running.

## Part 6: Document Everything in `SECURITY.md`

26. Create `SECURITY.md` in the frontend repo root. It's the "what we did and why" record for the next person who touches this project (which might be you in 6 months).

    ```markdown
    # ByteBooks Frontend — Security Posture

    ## Headers (vercel.json)
    - CSP enforced (default-src 'self', connect-src includes Railway API)
    - HSTS, X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy, Permissions-Policy

    ## Deployment Protection
    - Vercel Authentication ON (Standard Protection — Hobby preview-only scope)
    - Production deployments remain public (Hobby cap)
    - Protection Bypass for Automation token: stored in [password manager]

    ## Firewall
    - 1 WAF rate-limit rule active: 60 req/min per IP on /(api|auth)/.*
    - Hobby cap = 1 rule. On Pro we'd add: stricter /auth/login limit, IP blocks, JA4-keyed rules.

    ## Bot Management
    - BotID Basic enabled (default)
    - Attack Challenge Mode disabled by default. Flip on during live attacks only.

    ## Edge Middleware
    - middleware.ts injects x-request-id on every response
    - /admin/* requires bb_session cookie (else 401)

    ## Open items
    - style-src 'unsafe-inline' is a Vite-mode concession; remove after refactoring inline styles to CSS files
    ```

27. Commit and push:
    ```bash
    git add SECURITY.md
    git commit -m "Document security posture (Session 1)"
    git push
    ```

## Verification Checklist

- [ ] `curl -I https://<your-app>.vercel.app` shows all 6 security headers (CSP enforcing, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy)
- [ ] Exercising the deployed app in DevTools shows zero CSP violations
- [ ] A throwaway preview URL shows the Vercel login wall in incognito
- [ ] Vercel dashboard → Firewall lists the 1 rate-limit rule
- [ ] `for i in $(seq 1 70); do curl ...; done` produces 429s after the threshold
- [ ] Vercel dashboard → Bot Management shows BotID Basic enabled, ACM disabled
- [ ] DevTools Network tab shows `x-request-id` header on every response
- [ ] `curl -i https://<your-app>.vercel.app/admin/anything` returns 401
- [ ] `SECURITY.md` exists in the repo with all the items documented above

## Expected Output

When complete, students should have:
- A frontend that responds with hardened security headers, including an enforced CSP
- Preview deployments that aren't publicly indexable / accessible
- One active firewall rate-limit rule visible in the dashboard
- Edge Middleware injecting trace IDs and gating admin routes
- A `SECURITY.md` documenting the full posture for the next person

## Common Issues and Solutions

**Issue: CSP blocks the API call after promoting to enforcing**
- Most common cause: `connect-src` doesn't include the Railway API origin
- Fix: add the full `https://<your-api>.railway.app` (no path, no trailing slash) to `connect-src`
- If your app also uses websockets: add `wss://<host>` too

**Issue: Vercel Authentication blocks a webhook (e.g., GitHub, Stripe)**
- Webhooks can't log in to Vercel
- Fix: use the **Protection Bypass for Automation** token via `x-vercel-protection-bypass` header
- The webhook provider must support setting custom headers

**Issue: Edge Middleware fires on `_next/static/...` or static assets**
- Symptom: every PNG and font triggers middleware → wasted invocations
- Fix: refine the `matcher` regex to exclude static-asset paths

**Issue: WAF rate-limit rule never triggers**
- Common causes:
  - Regex doesn't match (e.g., used `/api/.*` which doesn't match `/api`)
  - Window too long (give it 60s)
  - Per-region counter — if your test traffic is split across regions, no single region hits the limit
- Fix: tighten the regex, run the curl loop in a single region (your laptop is one region)

**Issue: Edge Middleware admin gate returns 200 instead of 401**
- Likely the matcher is excluding `/admin` (e.g., used `_next/static` exclusion that accidentally matches `/admin`)
- Fix: test the regex explicitly; ensure `/admin/*` is INCLUDED in the matcher

**Issue: After enforcing CSP, the React app fails to load JS bundles**
- `script-src 'self'` should cover Vite-built bundles, but some Vite plugins inject inline scripts
- Quick fix: revert to `Report-Only`, capture the violation, decide whether to whitelist via a hash or refactor
- Long-term: avoid Vite plugins that inject inline scripts in production builds

## Explanation to Students

This session demonstrates **edge-side security on a PaaS stack**:

- **Security headers** are enforced by the browser, not the server. Setting them in `vercel.json` is a one-time config that hardens every response.
- **CSP Report-Only first** is the only sane way to roll out CSP without breaking production. The browser shows you what it would have blocked.
- **Vercel Authentication** is the cheapest possible defense against the most common PaaS-era leak (preview URLs indexed by Google).
- **The Hobby firewall** is one rate-limit rule. That's a real ceiling. The lesson is that Pro starts paying for itself the moment you have two endpoints with different rate-limit needs.
- **Edge Middleware** is where you put auth checks that don't need to know your full business logic — coarse, fast, before the function spins up.

Next session (Session 2): the Railway side. Private networking, sealed variables, JWT-keyed rate limiting, dependency hygiene.
