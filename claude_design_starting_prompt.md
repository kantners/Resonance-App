# Claude Design — Starting Prompt

> Paste this into Claude Design as your opening prompt. Fill in the two
> bracketed decisions first — Design will ask for them anyway if you don't.

---

Design a mobile-first app for tracking personal recovery (sleep, HRV, fasting) alongside digital device exposure, so a person can see the connection between their scrolling habits and their nervous system's recovery, day to day.

**App name:** Resonance (placeholder — chosen for now because it maps to an actual HRV biofeedback term, "resonance breathing," rather than being decorative; revisit once the prototype earns real naming/trademark time)

**Visual tone:** Clinical and credible, not cutesy. This needs to hold up in front of health and medical professionals, and it's being built alongside a Medical Reiki / IRRC-facing presentation, so the design should read as serious and evidence-grounded rather than soft or wellness-app-generic.

**Core screens to prototype, in this order:**

1. **Daily Brief (home screen)** — the composite view. Shows: last night's sleep score and HRV, a single recovery label (Low / Moderate / High, not a fake precise number dressed as clinical), and a one-line plain-English callout connecting it to yesterday's screen time if there's a notable pattern ("Screen time was high yesterday — HRV is down 6 points from your average"). This is the screen that has to sell the whole idea in one glance.

2. **Digital Exposure log** — two entry paths: (a) upload a screenshot of Apple Screen Time or Android Digital Wellbeing and show a parsed result the person can confirm/edit (total screen time, pickups, social/entertainment/productivity minutes, top apps), or (b) manual quick-entry if they don't want to screenshot. Show clearly which path they're using.

3. **Reading log** — a simple three-way choice when logging a session: Physical Book, E-Reader (offline), or Phone/Tablet App. Make the distinction visually obvious, this is a deliberate design decision, not an afterthought toggle. Duration and optional title.

4. **Sleep + Fasting entry** — straightforward manual entry screens for nights and fasting windows, secondary to the Daily Brief, these feed it rather than compete with it.

5. **Trends view** — a simple week-over-week chart pairing digital exposure against sleep score/HRV, this is the "prove the correlation" screen.

**Data shape to design around** (so fields match what's real, not invented):

- Sleep: hours, sleep score, HRV (ms), resting HR, notes
- Digital exposure: date, source (screenshot or manual), total screen minutes, pickups, social/entertainment/productivity minutes, top apps list
- Reading: date, medium (physical book / offline e-reader / app screen), duration, optional title
- Fasting: start time, end time, goal hours

**What this is not:** not a general nutrition or calorie tracker, not a six-pillar wellness app, no social feed, no gamification badges. Keep it narrow and serious.

**After Design produces something:** the next step is handing the output to Claude Code along with the existing `schema.ts` and `routes.ts` (already built, Postgres/Drizzle/Express) to wire the screens to real data, not asking Design to persist anything itself.
