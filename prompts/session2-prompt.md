You are hardening the ByteBooks FastAPI backend that's already deployed to Railway from Week 11. The project has a FastAPI service named `api` (or similar) and a Postgres service named `Postgres`, both in the same Railway environment. The frontend (Vercel) was hardened in Session 1. Goal: lock down the origin and complete the production-readiness checklist.

This session has six parts. Work through them in order. Each part ends with a verification step — do not skip it. The final part is signing off the 14-item checklist that doubles as the rubric for the final-project security score.

## Part 1: Private Networking + `DATABASE_PRIVATE_URL`

1. Open the Railway dashboard for your project. Click on the **Postgres** service → **Settings** → **Networking** (or **Public Networking** depending on the dashboard version).

2. **Disable the public TCP proxy** if it's enabled. Visually: there should be a "Public Networking" toggle or a "Generate Domain" / "Disable" button. After disabling, the public connection string is gone — Postgres is only reachable from inside the Railway project.

3. Note the internal hostname Railway shows you: `postgres.railway.internal` (or whatever your service is named). This is your DB's address from inside the project.

4. Open the **api** service (your FastAPI service) → **Variables**. Find `DATABASE_URL`. Replace its value with a Railway-variable reference to Postgres's private URL:
   ```
   DATABASE_URL = ${{ Postgres.DATABASE_PRIVATE_URL }}
   ```
   The `${{ ... }}` syntax tells Railway to interpolate the value at deploy time. The actual injected value uses `postgres.railway.internal`.

5. Save. Railway will redeploy the api service. Watch the Logs tab during deploy:
   - You should see "uvicorn running" or your start command's output
   - You should see successful Postgres connection (no DNS errors, no timeout)
   - If you see `Name or service not known` or `connection refused`: see the **IPv6 gotcha** below

6. **IPv6 gotcha (if your environment is legacy, pre-2025-10-16):** `*.railway.internal` may resolve to **IPv6 only**. psycopg2 handles this fine when given the hostname (it does the DNS lookup and uses the right address family). It only breaks if you've hardcoded an IP without brackets. Check your `database.py`:
   - Good: `DATABASE_URL = os.getenv("DATABASE_URL")` and the URL uses the hostname
   - Bad: hardcoded `127.0.0.1` or `::1` without brackets
   If you're on a legacy environment and seeing IPv6-related errors, either (a) recreate the environment to get dual-stack, or (b) ensure you're using the hostname end-to-end.

7. Verify the public DB port is gone. From your laptop:
   ```bash
   nc -zv <old-public-pg-host> 5432
   ```
   You no longer have a public host (you disabled it), so this should fail with `Name or service not known` or `connection refused`. **That's the win.**

8. Verify the FastAPI service is still healthy:
   ```bash
   curl -s https://<your-api>.railway.app/docs | head -5
   ```
   Should return Swagger HTML. If you get an error, check the api service Logs tab for the connection error.

## Part 2: Sealed Variables + Rotation Drill

9. In the Railway dashboard → api service → **Variables** tab, find `SECRET_KEY` (the one you use to sign JWTs).

10. Click the **3-dot menu** on the right of the variable → **Seal**. Confirm. Once sealed, the value is no longer visible in the dashboard, in the API, or via the Railway CLI. **There is no un-seal.** To change a sealed value you must delete it and re-create.

11. Verify sealing worked. From your laptop:
    ```bash
    railway login
    railway link  # link to your project if you haven't
    railway variables
    ```
    The output should NOT include the value of `SECRET_KEY`. The variable name will appear with `[sealed]` or be omitted entirely.

12. **Rotation drill.** Generate a new key:
    ```bash
    openssl rand -hex 32
    # → e.g., a3f2b1c0...
    ```

13. In the Railway dashboard → Variables → `SECRET_KEY` → 3-dot → **Delete** (sealed = can't update in place; must delete and re-create).

14. Click **+ New Variable** → name `SECRET_KEY`, paste the new value, check the **Seal** option (creates it sealed in one step). Save.

15. Railway will auto-redeploy the api service. Wait for the Logs tab to show successful startup.

16. **Verify the rotation invalidated old JWTs.** From a browser already logged into ByteBooks (i.e., you have a JWT cookie or localStorage token issued under the OLD `SECRET_KEY`):
    - Hit any authenticated endpoint
    - You should see 401 Unauthorized
    - Logging in again issues a new token signed with the new key — that one works

17. **Do not skip this verification.** A rotation that doesn't invalidate old tokens didn't actually rotate.

## Part 3: slowapi Rate Limiting (JWT-keyed)

18. In the backend repo, add `slowapi` to `requirements.txt`:
    ```
    slowapi>=0.1.9
    ```

19. Edit `main.py` (or wherever your FastAPI app is initialized). Add a JWT-keyed limiter:

    ```python
    from slowapi import Limiter, _rate_limit_exceeded_handler
    from slowapi.errors import RateLimitExceeded
    from slowapi.util import get_remote_address
    from fastapi import Request
    from fastapi.responses import JSONResponse
    import jwt as pyjwt

    def jwt_or_ip_key(request: Request) -> str:
        """Rate-limit key: JWT subject if authenticated, else client IP.

        Why: behind Vercel's edge, request.client.host is a Vercel POP IP, not the user.
        Keying on the JWT 'sub' claim limits per-user instead of per-edge.
        """
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
            try:
                # We don't verify here — just extract the sub for keying
                # (the actual auth dep already verified the token elsewhere)
                payload = pyjwt.decode(token, options={"verify_signature": False})
                sub = payload.get("sub")
                if sub:
                    return f"user:{sub}"
            except Exception:
                pass
        return f"ip:{get_remote_address(request)}"

    limiter = Limiter(key_func=jwt_or_ip_key)
    app.state.limiter = limiter

    @app.exception_handler(RateLimitExceeded)
    async def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded):
        return JSONResponse(
            status_code=429,
            content={"detail": "rate limited"},
            headers={"Retry-After": "60"},
        )
    ```

    `Limiter` and `RateLimitExceeded` are slowapi imports; the handler shape returns the **`Retry-After`** header so the frontend can show a useful message.

20. Decorate the endpoints you want to protect. Order matters: `@limiter.limit(...)` must precede `@app.post(...)`.

    ```python
    @limiter.limit("5/minute")
    @app.post("/auth/login")
    async def login(request: Request, ...):
        ...

    @limiter.limit("30/minute")
    @app.post("/api/search")  # or whichever expensive route you have
    async def search(request: Request, ...):
        ...
    ```

    The `request: Request` parameter is required by slowapi to extract the key.

21. Commit and push:
    ```bash
    git add main.py requirements.txt
    git commit -m "Add slowapi rate limiting (JWT-keyed) on /auth/login and /api/search"
    git push
    ```
    Wait for Railway to redeploy.

22. Test it. From your laptop:
    ```bash
    for i in $(seq 1 6); do
      curl -s -o /dev/null -w "%{http_code}\n" \
        -X POST https://<your-api>.railway.app/auth/login \
        -H "Content-Type: application/json" \
        -d '{"username":"nope","password":"nope"}'
    done
    ```
    First 5 should be 401 (bad credentials); the 6th should be **429** with a `Retry-After: 60` header.

23. Verify the response shape. Run a single curl with `-i` to see headers:
    ```bash
    curl -i -X POST https://<your-api>.railway.app/auth/login \
      -H "Content-Type: application/json" -d '{"username":"nope","password":"nope"}'
    # ... after triggering the limit ...
    # HTTP/1.1 429 Too Many Requests
    # Retry-After: 60
    # Content-Type: application/json
    # ...
    # {"detail":"rate limited"}
    ```

## Part 4: Dependency Hygiene

24. **Backend audit.** From the backend repo:
    ```bash
    pip install pip-audit
    pip-audit
    ```
    - For each `high` or `critical` finding: bump the affected dep in `requirements.txt`, retest, commit
    - For `moderate` findings: document in `SECURITY.md` with rationale (e.g., "moderate, no upgrade available, mitigated by [X]")
    - For `low` findings: optional to fix; document if you skip

25. **Frontend audit.** From the frontend repo:
    ```bash
    npm audit --production
    ```
    `--production` skips dev-only dependencies that aren't part of the deployed bundle. Same triage policy as Python.

    To auto-fix non-breaking changes: `npm audit fix`. To attempt fixes including breaking changes: `npm audit fix --force` (review the diff carefully — this can change major versions).

26. **Enable Dependabot** in both GitHub repos:
    - Repo → **Settings** → **Code security and analysis**
    - Enable **Dependabot alerts** (notifications for new CVEs in your deps)
    - Enable **Dependabot security updates** (automatic PRs to fix vulnerable deps)
    - Optional: enable **Dependabot version updates** (PRs for non-security upgrades)
    - Visit the **Security** tab — you should see "Dependabot is monitoring" with a green check

## Part 5: Logs and Observability

27. **Tail Railway logs during a brute-force attempt.** Open the Railway dashboard → api service → **Logs**. Then in another terminal:
    ```bash
    for i in $(seq 1 8); do
      curl -s -o /dev/null https://<your-api>.railway.app/auth/login \
        -X POST -H "Content-Type: application/json" \
        -d '{"username":"nope","password":"nope"}'
    done
    ```
    The Logs tab should show 5× login attempts plus 3× 429 responses. The slowapi 429 may or may not log by default — if you don't see it, add a logger call in your `rate_limit_exceeded_handler`.

28. **Tail Vercel Runtime Logs during a real browser request.** Vercel dashboard → frontend project → **Logs** (or **Runtime Logs**). Open your deployed app, click around. You should see middleware invocations and any function calls. Look for the `x-request-id` you set in Session 1's Edge Middleware appearing in the log entries.

29. **(Optional, time permitting) wire Sentry.** From the backend repo:
    ```bash
    pip install "sentry-sdk[fastapi]"
    ```
    Add to `requirements.txt`. In `main.py`, near the top:
    ```python
    import sentry_sdk
    import os
    if dsn := os.getenv("SENTRY_DSN"):
        sentry_sdk.init(dsn=dsn, traces_sample_rate=0.1, send_default_pii=False)
    ```

30. (If wiring Sentry) Sign up at [sentry.io](https://sentry.io) for a free account. Create a project (Python → FastAPI). Copy the DSN.

31. (If wiring Sentry) In Railway → api service → Variables → **+ New Variable**:
    - Name: `SENTRY_DSN`
    - Value: paste the DSN
    - Check **Seal** (the DSN is sensitive — anyone with it can spam your Sentry quota)

32. (If wiring Sentry) Commit, push, redeploy. Trigger a deliberate exception (e.g., visit a route you know throws). The error should appear in Sentry within seconds with the full traceback and code context.

## Part 6: Production-Readiness Sign-off

33. Open `SECURITY.md` (created in Session 1) and add the backend section:

    ```markdown
    ## ByteBooks Backend — Security Posture

    ### Database
    - Public TCP proxy disabled on Postgres
    - FastAPI uses DATABASE_URL = ${{ Postgres.DATABASE_PRIVATE_URL }}
    - Connection over Wireguard private network only

    ### Secrets
    - SECRET_KEY sealed in Railway. Last rotated: <YYYY-MM-DD>.
    - Rotation procedure: regenerate (openssl rand -hex 32) → delete sealed var → recreate sealed → redeploy → verify old JWTs invalidate.
    - SENTRY_DSN sealed in Railway (if Sentry wired).

    ### Rate Limiting
    - slowapi keyed on JWT 'sub' claim, falls back to IP for unauthenticated requests
    - /auth/login: 5/minute
    - /api/search: 30/minute
    - 429 response includes Retry-After header

    ### Dependency Hygiene
    - pip-audit: 0 high/critical findings as of <YYYY-MM-DD>
    - npm audit --production: 0 high/critical findings as of <YYYY-MM-DD>
    - Dependabot security updates enabled in both repos

    ### Observability
    - Railway Logs tailed for 429 events
    - Vercel Runtime Logs show x-request-id from Edge Middleware
    - Sentry: [wired/not wired]
    ```

34. **Sign off the 14-item checklist.** Add this section to `SECURITY.md` and tick every box. Anything unticked = a known gap and must be documented with an owner and a target date.

    ```markdown
    ### Production-Readiness Checklist

    - [ ] All security headers present in vercel.json (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy)
    - [ ] CSP enforced (not Report-Only) and not blocking the API
    - [ ] Vercel Authentication enabled on previews (Standard Protection)
    - [ ] One Vercel WAF rate-limit rule active
    - [ ] BotID Basic confirmed enabled
    - [ ] Edge Middleware injecting x-request-id on every response
    - [ ] Postgres public TCP proxy disabled; FastAPI uses DATABASE_PRIVATE_URL
    - [ ] SECRET_KEY sealed in Railway and rotated within the last 30 days
    - [ ] slowapi rate limits on /auth/login (5/min) and one expensive route (30/min), keyed on JWT
    - [ ] No pip-audit high/critical findings
    - [ ] No npm audit --production high/critical findings
    - [ ] Dependabot security updates enabled in both repos
    - [ ] CORS allows the production frontend URL only — no `*` wildcards
    - [ ] SECURITY.md documents rotation order and known platform caveats
    ```

35. Commit and push:
    ```bash
    git add SECURITY.md
    git commit -m "Document backend security posture + sign off readiness checklist"
    git push
    ```

## Verification Checklist

- [ ] Railway dashboard → Postgres → Networking shows public TCP proxy disabled
- [ ] api service Variables shows `DATABASE_URL = ${{ Postgres.DATABASE_PRIVATE_URL }}`
- [ ] api service Logs show successful startup with the new DATABASE_URL
- [ ] `railway variables` does not return the value of `SECRET_KEY`
- [ ] After rotation, an old JWT returns 401 from an authenticated endpoint
- [ ] `requirements.txt` lists `slowapi`
- [ ] `main.py` defines `jwt_or_ip_key`, `limiter`, and the 429 handler
- [ ] Curling `/auth/login` 6× returns 429 with `Retry-After: 60` on the 6th
- [ ] `pip-audit` reports 0 high/critical findings
- [ ] `npm audit --production` reports 0 high/critical findings
- [ ] Both GitHub repos show Dependabot active in the Security tab
- [ ] Railway Logs show the 429 events during the brute-force test
- [ ] Vercel Runtime Logs show entries with `x-request-id` from Edge Middleware
- [ ] `SECURITY.md` has both the frontend (Session 1) and backend (Session 2) sections, plus the 14-item checklist with all boxes ticked

## Expected Output

When complete, students should have:
- A backend whose database is unreachable from the public internet
- A `SECRET_KEY` that's sealed and has been rotated end-to-end with verification
- Per-user rate limits on `/auth/login` and an expensive route (not per-edge-IP)
- Zero high/critical CVEs in either dependency tree
- Dependabot watching both repos
- A `SECURITY.md` that any future developer can read and understand the posture from
- A signed-off 14-item production-readiness checklist that's the rubric for the final-project security score

## Common Issues and Solutions

**Issue: api service can't connect to Postgres after switching to DATABASE_PRIVATE_URL**
- Most common cause: the Railway-variable reference syntax is wrong. It must be `${{ Postgres.DATABASE_PRIVATE_URL }}` (double curly braces, exact service name)
- Check the api service Variables tab — Railway should show the resolved value next to the reference
- If "Postgres" isn't your service's name, use the actual name (case-sensitive)

**Issue: legacy environment, IPv6-only, psycopg2 errors with "Name or service not known"**
- Confirm your `database.py` uses the hostname from `DATABASE_URL`, not a hardcoded IP
- If you must hardcode IPv6, bracket it: `[::1]:5432`, not `::1:5432`
- Easiest path: recreate the environment (post-2025-10-16 environments are dual-stack)

**Issue: SECRET_KEY rotation didn't invalidate old JWTs**
- Did you actually redeploy after replacing the sealed variable? Railway should auto-redeploy on var change, but verify in the Deployments tab
- Did you flush any frontend cache that holds the old token? A browser tab with a cached request might still show 200 from a CDN cache

**Issue: slowapi 429 fires on every request, not just over the limit**
- Decorator order is wrong. `@limiter.limit("5/minute")` must come BEFORE `@app.post("/auth/login")` (the limiter has to wrap the endpoint, not be wrapped by it)

**Issue: slowapi treats every request as the same user**
- Your `key_func` isn't returning distinct keys
- Add a `print(f"[ratelimit] key = {key}")` line at the end of `jwt_or_ip_key` and check the Logs — every authenticated user should produce a different `user:<sub>` key

**Issue: pip-audit reports findings on packages you didn't install directly**
- Those are transitive dependencies. The fix is to bump the direct dep that pulls them in (or pin them in your requirements with a version constraint that forces a higher transitive)

**Issue: npm audit reports findings only fixable with `--force`**
- `--force` can introduce breaking changes. Read the changelog for the affected package, run tests, only then apply
- Alternative: add an `overrides` block in package.json to pin the transitive dep version

**Issue: private networking unavailable during build phase**
- Symptom: build fails with DNS resolution errors when running migrations
- Fix: move migrations from build phase to start command (e.g., `Procfile`: `alembic upgrade head && uvicorn ...`)

## Explanation to Students

This session demonstrates **origin-side security on a PaaS stack**:

- **`DATABASE_PRIVATE_URL`** is the simplest possible production-grade improvement — disabling the public TCP proxy eliminates an entire class of attack (random scanners on the internet), and it costs nothing.
- **Sealed variables** are designed for the way real teams leak secrets: in screen-shares, support sessions, and CLI dumps. Encryption at rest doesn't help if the dashboard shows the value to anyone with project access.
- **JWT-keyed rate limiting** is the layer the edge can't do. The edge sees IPs (rotated, NAT'd, useless for per-user policy); the origin sees JWTs (the actual user identity). Both layers in combination make rate limits useful.
- **Dependency CVEs** are not optional — a single vulnerable transitive dep can become a backdoor. Dependabot is free and removes the friction.
- **The checklist** is the same 14 items you'll be graded on for the final project. Internalize it.

You've now hardened a real production stack end-to-end. This is the same posture used by professional teams shipping on Vercel + Railway.
