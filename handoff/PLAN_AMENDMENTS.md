# Plan amendments (Mark, September 28)

Revise the build plan to include every item below, then show me the revised plan. Don't start building.

## A. Study integrity: these change what the study can claim
1. **Generate the allocation list at protocol lock, not at enrollment.**
   - When a protocol is locked, generate the full allocation list for the target number of clients (the shuffled blocks) and store it.
   - Store the list's SHA-256 hash on the protocol, and show it on the Study screen and in the export.
   - Enrollment takes the next unused row. It must never generate a new one.
   - Why: the hash lets anyone confirm afterwards that the order was fixed before the first client, which is the credibility point for pre-registration.
2. **The analysis scale belongs to the locked protocol, not to an environment flag.**
   - Add `analysisScale: 'linear' | 'ln'` to the protocol, frozen at lock and printed in the methods export.
   - Study analysis reads it from the protocol and ignores `HRV_LOG_SCALE`.
   - Why: changing the analysis after data is in is the error that pre-registration exists to prevent.
3. **The reading device also belongs to the locked protocol.**
   - Add `readingDevice` (device + app) to the protocol, frozen at lock.
   - Every study session records the device it actually used.
   - The results screen flags any session where the two don't match.
4. **Concealment holds for the practitioner too, not only the client.**
   - Before `/start` succeeds, a practitioner-role `GET` on that session, on the protocol, or on its session list must not show that session's condition or any future condition.
   - Conditions of sessions already started may be shown to the practitioner.
   - Add route tests for all three `GET`s.

## B. Correctness
5. **Record the flag with the rule version.** `daily_status` stores `ruleVersion` and also the `HRV_LOG_SCALE` value used, so every stored label can be traced to the exact rule that produced it.
6. **Dates come from the client, never from the server's clock.** Railway runs in UTC, and a 9 p.m. log in Richmond is the next day in UTC.
   - Every route that works on "today" takes the user's local date (`YYYY-MM-DD`) from the client.
   - Save the user's IANA time zone in Settings.
   - Add a test for an entry near midnight.
7. **Show how many nights a label is based on.** When the week has 5 or 6 nights, the label shows it, for example "Steady · 6 of 7 nights". A label is never shown without its night count.
8. **Add a first-run and building-baseline state.** None of the 14 screens covers a new user.
   - Minimal Brief state: "Resonance is learning your baseline. N of 14 nights logged." The HRV source question also goes here.
   - Use the design tokens and no new art.

## C. Deployment and security
9. **Use Node 24 everywhere.** Node 20 reached end of life in April 2026.
   - Dockerfile → `node:24-slim`, CI → Node 24, `package.json` `"engines": { "node": ">=24" }`.
   - The Dockerfile must keep `drizzle-kit` available for the Railway pre-deploy command `npx drizzle-kit migrate` (no dev-dependency pruning before that step), and must copy `migrations/`.
10. **Make cookies and the proxy work in production.**
    - `app.set('trust proxy', 1)` in production.
    - Session cookie: `secure` in production, `httpOnly`, `sameSite: 'lax'`.
    - Add a basic in-memory rate limit on login and register, for example 10 attempts per 15 minutes per IP. No new dependency.
11. **Keep the demo user safe on a public server.**
    - `seed:demo` refuses to run unless `ALLOW_DEMO_SEED=true`.
    - The demo password comes from `DEMO_PASSWORD`, never hard-coded.
    - Demo accounts can't enroll in a real protocol, and real clients can't be enrolled in a demo protocol.
12. **`/api/health` stays public** (approved), and returns only `{ ok, ruleVersion }` with no database details in errors.

## D. Order and stopping point
13. **Commit and push after every step**, so the work is saved on GitHub if a usage limit pauses the session.
14. **Priority for October 4:** steps 2 to 8 (with tests passing), then the screens in this order: Main, Recovery-Rule, Morning-Check, Sleep, Exposure-Manual, Study. The other screens follow after October 4. If usage limits make it tight, stop at a clean commit and tell me where things stand. Don't rush the tests to reach more screens.
15. **Install `gh`:** approved. I'll run `winget install GitHub.cli` and `gh auth login` myself before step 12.
