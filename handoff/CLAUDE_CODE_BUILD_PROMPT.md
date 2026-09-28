# Claude Code build prompt: Resonance Layer 0

Paste everything below the line into Claude Code, opened in
`D:\__BlueEmberWellness\05_Digital\Applications\Resonance`.

---

You are building **Resonance**, a standalone app in this folder. It started as a copy of KEWT's code.

## Hard rules
- **KEWT is off limits.** Never read from, write to, or run commands in `..\kewt-app`. Everything you need is in this folder.
- **Resonance never shares anything with KEWT at runtime:** no shared database, accounts, secrets, remotes or app IDs.
- **Branch.** Work on a branch named `build/layer-0`. Commit in logical steps, each with a clear message. Never commit `.env`, `*.zip` or any real secret.
- **Don't delete or rewrite** anything in `design/`, `docs/` or `handoff/`. You may add new files there.
- **Wording.** No health claims in any UI text. Findings are "observed" or "associated", never "causes" or "treats". Follow HANDOFF §6 and §9.

## Read first, in this order
1. `handoff/HANDOFF.md`, all of it. Start with §0, which reconciles this copy with KEWT.
2. `handoff/schema-additions.ts`
3. `docs/roadmap.md` (Layer 0 only is in scope)
4. `docs/session-study-protocol.md`
5. `design/index.html` and `design/screens/*.html`. These define the look and the copy of every screen.

Then write a plan in `handoff/BUILD_PLAN.md` and stop for my approval before step 2 below.

## Build steps (each step ends with a commit)
1. **Plan.** Write `handoff/BUILD_PLAN.md` (see above) and wait for approval.
2. **Identity and cleanup:**
   - package name `resonance`, version `0.1.0`, `"private": true`, remove the MIT license field;
   - Capacitor `appId: com.blueemberwellness.resonance`, `appName: Resonance`; remove `server.url` (it points at KEWT's production server);
   - Resonance name in `index.html`, `manifest.json` and `sw.js` (change the cache name);
   - replace every `kewt_*`, `bew_*` and `hero_*` asset with plain placeholder icons. Delete what's unused, including `client/src/index.css.new_top`;
   - rewrite `README.md` for Resonance.
3. **Remove the modules HANDOFF §0 lists as not carried over:** the IG post generator, the science ticker, Strava and Garmin (including `/api/garmin/credentials`), meals and food, posture, work logs, goals and body composition. Remove their pages, routes, storage methods, tables and dependencies. `npm run check` must pass afterwards.
4. **Build and deploy hygiene:**
   - Generate and commit `package-lock.json`. The Dockerfile runs `npm ci` and will fail without it.
   - Align the Capacitor versions: `@capacitor/cli` is 7 and core is 8.
   - Make the `dev` and `start` scripts work on Windows PowerShell (use `cross-env`).
   - Add `.gitattributes` with `* text=auto eol=lf`.
   - Add `.env.example` with `DATABASE_URL`, `SESSION_SECRET`, `OPENAI_API_KEY` and `HRV_LOG_SCALE=true`. Placeholders only.
5. **Schema:**
   - Merge `schema-additions.ts` into `shared/schema.ts`, including the commented `sleep_logs` additions.
   - Switch from `db:push` to versioned migrations: `drizzle-kit generate`, with the SQL files committed under `migrations/`, and a `db:migrate` script.
   - The first migration creates the full schema from scratch.
6. **Rule engine.** Put it in `server/rules/` as pure functions with no database access. Use `RULE_VERSION = "2026.09-r2"` and implement HANDOFF §3 exactly. Log-scale HRV sits behind the `HRV_LOG_SCALE` flag, default on. Store the rule version with every computed value.
7. **Tests.** Add Vitest. Every fixture in HANDOFF §7 must pass before any UI work. Also test the study allocation (all six orders in each shuffled block of 6) and the concealment rules.
8. **Server routes:**
   - Add every route in HANDOFF §5.
   - **Every route uses `requireAuth`**; study routes also check the role.
   - Add `GET /api/health`, which returns `{ ok: true, ruleVersion }` and pings the database.
   - A client-role response never contains `condition`.
   - The screenshot parser gets the Screen Time / Digital Wellbeing type, with per-field confidence.
9. **Screens.** Build the 14 screens from `design/screens/*.html`, keeping the tokens: IBM Plex Sans and Mono, Newsreader, ground `#F3F4F1`, ink `#15191C`, physiology blue `#1F5FA8`, exposure orange `#B4500B`. Mobile first at 390 px, with no streaks, badges or engagement notifications.
10. **Demo data.** Add `npm run seed:demo`, a clearly labelled demo user whose data matches the canvas numbers. Every screen showing demo data carries a visible "Illustrative data" tag.
11. **CI.** Add `.github/workflows/ci.yml` running `npm ci`, `npm run check`, `npm test` and `npm run build` on push and pull request.
12. **Wrap-up:**
    - Push the branch and open a pull request against `main`.
    - The PR description lists every HANDOFF §8 open decision with the default you used, anything you couldn't finish, and anything in the HANDOFF you disagreed with and why.

## Stop and ask me if
- a HANDOFF rule is ambiguous or contradicts the design screens;
- a removal would break something the HANDOFF says to keep;
- you want to add a dependency beyond Vitest, cross-env, or what's already in `package.json`.
