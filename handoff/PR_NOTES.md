# PR notes (collected during the build; folded into the PR body at step 12)

## Process notes
- **Verification piping (steps 3–4).** The check/build commands in steps 2–4 were piped through `tail` without `set -o pipefail`, so the shell's exit status was `tail`'s, not `tsc`'s. The step 3 commit message says check and build passed. Its output showed no diagnostics, so that claim holds, but the exit code wasn't what confirmed it. In step 4, the same piping briefly hid a real failure in the new `server/middleware/rateLimit.ts`: iterating a `Map` was rejected because `tsconfig.json` set no `target` (the ES3 default). Fixed in step 4 by setting `"target": "ES2022"`, which matches Node 24, and clearing the stale `tsbuildinfo`. From step 4 on, verification runs with `pipefail`.

## Changes beyond the plan (so far)
- **Step 3:** `/api/commit-screenshot` requires a client-supplied wake date instead of defaulting to the server clock (early part of B6).
- **Step 4:**
  - Removed `reusePort: true` from `httpServer.listen`. It fails with `ENOTSUP` on Windows, and a single process doesn't need it.
  - Request logging no longer writes response bodies, which contained personal health data.
  - The error handler no longer echoes 5xx error messages (for example database errors) to clients.
  - The Dockerfile runs `npm ci`, the build and the app as the unprivileged `node` user (requested). `/app` and every copied file are owned by `node` via `COPY --chown`, which avoids a `chown -R` layer that would duplicate `node_modules`.
- **Standing rule (Mark, September 28):** all colors and fonts go through semantic design tokens (CSS variables in `index.css`, mapped in Tailwind), with no hex codes in components, so the palette is a single-file swap. Login.tsx and the placeholder Home get converted in step 9.

## Environment limits
- There's no local Postgres or Docker on the build machine, so `db:migrate`, `seed:demo` and `docker build` can't be run end-to-end locally. CI and Railway cover the build; the DB steps need a Postgres instance.
