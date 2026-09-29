# Deploying Resonance to Railway (private staging)

This guide covers a **private staging** deploy: one user (Mark), no clients, and registration closed. Before anyone else uses it, see [Before real clients](#before-real-clients).

## Services
One Railway project with two services:

| Service | What it is |
|---|---|
| **Postgres** | Railway's Postgres template. It holds everything: accounts, logs, the study tables and the login sessions (`session` table). |
| **resonance** | This repo, branch `build/layer-0`, built from the root `Dockerfile` (Node 24, `node:24-slim`, runs as the unprivileged `node` user). Railway detects the Dockerfile automatically. |

- Keep one replica. The login/register rate limiter is in memory, per instance.
- Nothing else is needed: no Redis and no object storage. Screenshots are sent to OpenAI to be read and are never stored.

## Environment variables (resonance service)

| Variable | Staging value | Notes |
|---|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` | A Railway reference variable. Use the private URL (`*.railway.internal`); it needs no SSL settings. |
| `SESSION_SECRET` | 64 random hex characters | **Required in production:** the app refuses to start without it. Generate with `openssl rand -hex 32`, or `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Never reuse KEWT's secret. Changing it signs everyone out. |
| `REGISTRATION_OPEN` | `false` | Closed is already the production default; set it explicitly anyway. While closed, `POST /api/auth/register` returns 403 unless the email is on the allowlist. |
| `REGISTRATION_ALLOWLIST` | `your@email` | Comma-separated. Needed only to create the first account (see [First login](#first-login)), then clear it. |
| `HRV_LOG_SCALE` | `true` | Daily Brief HRV ranges on the ln scale (the default). Study analysis ignores it. |
| `OPENAI_API_KEY` | *(optional)* | Only for screenshot import. Without it, screenshot parsing is off and everything else works. |
| `OPENAI_VISION_MODEL` | `gpt-4o-mini` | Evaluate on real Screen Time screenshots before relying on it (PR_NOTES). |
| `ALLOW_DEMO_SEED` | `false` | Keep false on any deployed server. |
| `DEMO_PASSWORD` | *(unset)* | Only used by `seed:demo`, which doesn't run here. |

Set automatically, so don't set these yourself:
- `NODE_ENV=production`, from the Dockerfile. It turns on secure cookies, `trust proxy`, the `SESSION_SECRET` requirement and closed registration.
- `PORT`, injected by Railway.

## Deploy settings (resonance service → Settings)
- **Source:** GitHub `kantners/Resonance-App`, branch `build/layer-0`.
- **Builder:** Dockerfile.
- **Pre-deploy command:** `npx drizzle-kit migrate`
  - It runs inside the built image with the service's variables, before the new version takes traffic. `drizzle-kit` and `migrations/` are in the image on purpose (no dev-dependency pruning).
  - A failed migration stops the deploy, and the previous version keeps running.
- **Start command:** leave empty (the Dockerfile's `node dist/index.cjs`).
- **Health check path:** `/api/health`
  - It's public and returns `{"ok":true,"ruleVersion":"2026.09-r3"}`.
  - If the database is unreachable it returns `503 {"ok":false,…}`, with no error text.
- **Networking:** generate a Railway domain (HTTPS). Session cookies are `Secure`, so the app only works over HTTPS.

CI builds the same Docker image on every push (the `docker` job, build only, never pushed), so Dockerfile problems show up in GitHub before Railway.

## First login
1. Set the variables above, with `REGISTRATION_ALLOWLIST=<your email>`, and deploy.
2. Check the deploy log for `registration closed (1 allowlisted)`, and check that the health check is green.
3. Open `https://<your-domain>`, choose **Create account** and register with the allowlisted email. Any other email gets "Registration is closed."
4. **Clear `REGISTRATION_ALLOWLIST`** and redeploy. The log should now show `registration closed (0 allowlisted)`. Signing in doesn't depend on the allowlist.
5. In the app, confirm the time zone on the first-run Brief, and set your HRV source (device + app) and your morning posture. Settings has the same controls.
6. Optional: turn on practitioner mode under Settings to see the Study tab. Don't lock a protocol on staging unless you mean it: locking fixes the allocation.

## Verifying security in production
Replace `$APP` with `https://<your-domain>`.

**Health is public and minimal:**
```sh
curl -s $APP/api/health
# {"ok":true,"ruleVersion":"2026.09-r3"}
```

**Every other API route needs a session (401):**
```sh
curl -s -o /dev/null -w "%{http_code}\n" $APP/api/me                      # 401
curl -s -o /dev/null -w "%{http_code}\n" $APP/api/brief/2026-10-01        # 401
curl -s -o /dev/null -w "%{http_code}\n" $APP/api/study/protocols         # 401
```

**Registration is closed (403):**
```sh
curl -s -X POST $APP/api/auth/register -H 'content-type: application/json' \
  -d '{"email":"someone@example.com","password":"not-a-real-one"}'
# {"error":"Registration is closed."}
```
This call counts toward the rate limit below, so run it before the 429 test or wait 15 minutes.

**The rate limit gives a 429 on the 11th attempt in 15 minutes from one IP** (login and register share the budget):
```sh
for i in $(seq 1 11); do
  curl -s -o /dev/null -w "%{http_code} " -X POST $APP/api/auth/login \
    -H 'content-type: application/json' -d '{"email":"nobody@example.com","password":"wrong"}'
done; echo
# 401 401 401 401 401 401 401 401 401 401 429
```
- The 429 response has a `Retry-After` header.
- Your own IP is then blocked from signing in for up to 15 minutes, so run this from a network you aren't about to sign in from, or wait it out.
- If every attempt returns 429, or none does, `trust proxy` isn't seeing the client IP. Check that the service is behind Railway's own proxy and not a second one.

**The cookie is secure:** sign in with your browser's dev tools open. The `connect.sid` cookie must be `Secure`, `HttpOnly` and `SameSite=Lax`.

## Before real clients
Staging is for Mark alone. All of these must be done before any other person, and especially any study client, gets an account:

- **Code review.** PR #1 is a draft. Get an independent review of at least the auth, concealment, outcome-blind and export paths, then take the PR out of draft. The 9b screens (Session, Consent, Quiet, Trends, Exposure-Screenshot, Reading, Stillness, Fasting) aren't built yet. Clients can't enroll without the Consent screen.
- **Final Privacy and Terms.** The current pages are working text (PR_NOTES, step 9a). They need a final version reviewed by someone qualified. That includes disclosing that screenshots are sent to OpenAI, where the data is hosted (Railway's region), how long it's kept, and the pseudonymised withdrawal record.
- **Password reset.** There is none. A user who forgets their password is locked out, and only a database edit can help. This needs an email provider and a reset-token flow, or at least a documented manual procedure.
- **Ethics decision.** Decide and write down whether the study needs IRB approval or exemption. The Study screen says so if results will go beyond a practice talk. Get it before the first enrollment, not after.
- **Then open registration deliberately:** either `REGISTRATION_OPEN=true`, or keep it closed and add each client to `REGISTRATION_ALLOWLIST` (safer for a small study).

Also worth settling before clients (not blockers for staging):
- Postgres backups. Turn on Railway's backups for the Postgres service, and try a restore once.
- Evaluate the screenshot model on real screenshots (PR_NOTES).
- A second replica would split the in-memory rate limiter. Stay on one, or move the limiter into Postgres first.
