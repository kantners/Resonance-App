# Resonance

Resonance compares a person's HRV and resting heart rate with their own recent nights, and sets that alongside their phone use and the stillness they choose. It also has a practitioner mode for a controlled, single-practice Reiki session study.

It is a self-monitoring and research tool, not a medical device. Findings are described as *observed* or *associated*, never as causes or treatments.

Blue Ember Wellness · Layer 0 (the version described at IRRC, October 2026)

## Resonance and KEWT

Resonance was built from a copy of KEWT's code, and it is permanently a separate app. It has its own repository, Postgres database, Railway service, user accounts, secrets, app ID and branding. Nothing is shared with KEWT at runtime. If a person uses both apps, they have two logins, and their data never moves between them automatically.

## What's in this repository

```
Resonance/
├── client/          React + Vite front end (wouter, TanStack Query, Tailwind)
├── server/          Express API (express-session + bcrypt auth, Drizzle on Postgres)
├── shared/          Drizzle schema and zod validators shared by client and server
├── script/          build and utility scripts
├── design/          the 14 design screens (index.html, screens/, source/): the look and copy of every screen
├── docs/            roadmap.md (layers and gates), session-study-protocol.md
└── handoff/         HANDOFF.md (rules, data model, routes, tests), BUILD_PLAN.md
```

## The app

| Row | Screens |
|---|---|
| **Read** | Daily Brief · How the Brief reads you · Trends · The missing quiet |
| **Log** | Digital Exposure (screenshot / manual) · Reading · Sleep · Fasting · Stillness · Morning reading |
| **Session Study** | Client consent · Session record · Study dashboard |

Principles:
- **Weeks set the label; single nights are noted.** Steady / Drifting down / Recovering, from 7-night averages against the person's own 14-night baseline.
- **Transparent rules only.** Every computed value records the rule version that produced it (`handoff/HANDOFF.md` §3).
- **Associations, never diagnoses.** Patterns come with their counts and a plain caveat.
- **No streaks, badges, feeds or engagement notifications.**

## Development

Requires Node 24 and a Postgres database of its own.

```
npm install
npm run dev        # API + Vite dev server on http://localhost:5000
npm run check      # TypeScript
npm run build      # production build into dist/
npm start          # run the production build
```

Environment variables go in `.env` (never committed): `DATABASE_URL`, `SESSION_SECRET`, `OPENAI_API_KEY`, `HRV_LOG_SCALE`.

The build is in progress on branch `build/layer-0`; see `handoff/BUILD_PLAN.md` for the steps. This README is updated as scripts (migrations, tests, demo data) land.

## Privacy note

Screenshots imported for parsing are sent to OpenAI. Screen Time screenshots show app names and usage, and the in-app privacy text says so.
