# Resonance

A mobile app that pairs personal recovery (sleep, HRV, resting heart rate, fasting) with digital exposure and chosen stillness, so a person can see how their phone habits relate to their nervous system over the long run. It also includes a practitioner mode for a controlled, single-practice Reiki session study.

Blue Ember Wellness · design package, September 27, 2026

## What's in this folder

```
Resonance/
├── README.md                          ← this file
├── claude_design_starting_prompt.md   ← the original brief
├── design/
│   ├── index.html                     ← open this first: every screen, in three rows
│   ├── screens/*.html                 ← 14 standalone screen exports (default state)
│   └── source/                        ← editable canvas sources (.dc.html + canvas.json)
├── handoff/
│   ├── HANDOFF.md                     ← rules, data model, routes, tests: give this to Claude Code
│   └── schema-additions.ts            ← new Drizzle enums and tables
└── docs/
    └── session-study-protocol.md      ← protocol draft to finish before locking the study
```

## The screens

| Row | Screens |
|---|---|
| **Read** | Daily Brief · How the Brief reads you · Trends · The missing quiet |
| **Log** | Digital Exposure (screenshot / manual) · Reading · Sleep · Fasting · Stillness · Morning reading |
| **Session Study** | Client consent · Session record · Study dashboard |

All sample numbers match across the screens: the same Thursday and the same week, everywhere.

## Principles the design holds to
- **Weeks set the label; single nights are noted.** Steady / Drifting down / Recovering, from 7-night averages against your own 14-night baseline.
- **Transparent rules only.** Every label can be traced to numbers shown on screen, and every computed value records the rule version that produced it.
- **Associations, never diagnoses.** Patterns come with their counts and a plain caveat.
- **No streaks, badges or social feed.** Consistency is "22 of 30 nights", not a streak that resets.
- **The app follows its own advice.** It asks for as little attention as possible.

## Next step
Give `handoff/HANDOFF.md` and `handoff/schema-additions.ts` to Claude Code.

> The base code is KEWT (`..\kewt-app\shared\schema.ts`, `..\kewt-app\server\routes.ts`). Resonance is permanently a separate app built from a copy of KEWT: its own repository, database, accounts and branding. KEWT is only read, never edited. `HANDOFF.md` §0 lists what to reuse, what to leave behind, and three KEWT security issues not to copy.

## Still open
See the end of `handoff/HANDOFF.md` §8 and `docs/session-study-protocol.md` §10:
- the log-scale HRV decision
- the withholding procedure wording for condition A
- the price for study sessions
- the ethics review decision.
