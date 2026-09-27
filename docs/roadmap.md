# Resonance roadmap: beyond the IRRC 2026 deck

**Anchor:** *Recalibrating Autonomic Balance in the Digital Age* (IRRC, October 4, 2026, accepted version `IRRC_2026_Autonomic_Balance_FINAL.pptx`).
**Rule for every expansion:** Resonance grows in *depth*, as a measurement and research instrument. It does not grow in *breadth* as a wellness app. Every new feature must pass three tests:

1. **Does it measure or test a mechanism named in the deck?** False sympathetic triggering, the missing off-signal, or one of the four routes: Meter, Breathe, Align, Receive.
2. **Does it add no new pull on the user's attention?** No streaks, badges, feeds or engagement notifications.
3. **Can its output be traced to a stated rule and a rule version?**

If a feature fails any of the three, it doesn't ship.

---

## Layer 0: Cover the deck (v1, the version described at IRRC)

Everything in `handoff/HANDOFF.md`, plus the three deck-alignment additions in §9 of that file:
- **Configurable study conditions.** Runs the deck's study 3 factorial (breath only, Reiki only, combined) as well as the intention-versus-touch design.
- **Breathing rate on breathwork sessions** (the deck: "report respiratory rate").
- **Align:** Gassho or posture practice logged as a stillness type.

**Claim on stage:** "a field tool in development." No data.

## Layer 1: A better instrument
- **Chest-strap heart data.** Pair a Bluetooth chest strap that sends beat-to-beat (RR) intervals, for example a Polar H10. This gives laboratory-grade RMSSD with artifact and ectopic-beat correction, and breathing rate derived from the heart signal. The deck's study 1 calls for a chest belt, so this makes the app the recorder for it.
- **Passive nightly HRV import** from Apple Health or Android Health Connect. The source device is recorded each time, and the baseline restarts when the device changes.
- **A quality flag on every reading:** signal quality, the percentage of artifacts corrected, posture, and breathing rate. The deck's slide 5 asks for these to be reported.

## Layer 2: Establish the phenomenon (study 2, at scale)
The direct test of **false sympathetic triggering**:
- **Event-triggered readings.** After a burst of notifications (for example, N or more within 10 minutes) or a long social-media session ends, the app offers an optional 60-second reading.
- **Random-time control readings.** The same prompt at random quiet moments. Without these, the event readings can't be compared with anything, and the design is biased.
- **Analysis:** RMSSD after burst events against RMSSD at control moments, within each person, pre-registered.
- **The irony, dealt with openly.** A prompt is itself a signal. So prompts are rare (at most 2 a day), silent, counted as pickups in the user's own data, and switchable off.
- **Platforms:** Android can detect events automatically. On iOS the user starts a reading after a burst they notice (weaker; label it as such).

## Layer 3: The four routes as personal experiments
Each route becomes an **A-B-A-B experiment for one person**: alternating two-week blocks, a pre-registered outcome (the 7-night average of RMSSD), and a result reported with its uncertainty, "no detectable effect" included.
- **Meter:** notification batching, phone out of the bedroom, grayscale screen after 8 p.m., app time limits.
- **Breathe:** a **resonance-frequency finder** (the Lehrer protocol: short trials at around 4.5–6.5 breaths per minute, choosing the rate with the largest heart-rate swing), then paced practice with live heart-rate feedback. This is where the app's name comes from.
- **Align:** Gassho-posture blocks, logged with minutes.
- **Receive:** Reiki sessions received, linked to the Session Study where applicable.

## Layer 4: Characterize Joshin Kokyu Ho (the deck's study 1, run by practitioners)
- **A guided recording protocol:** 5 minutes of baseline, 5 minutes of Joshin Kokyu Ho, 5 minutes of recovery. Chest strap required. Posture and time of day are fixed.
- **Output per practitioner:** breaths per minute and RMSSD for each phase, and whether the practice lands near 6 breaths per minute.
- **With consent,** de-identified results go to a pooled dataset. This is the "nobody appears to have measured it" study, run by the community the deck is addressed to.

## Layer 5: The practitioner and research network
- **Study templates:**
  - the deck's factorial study 3;
  - intention against touch against rest;
  - Joshin Kokyu Ho characterization.
- **Pre-registration export** in a format ready for the Open Science Framework, plus a methods and data export in a form an ethics review board can use.
- **Consent management:** versioned, revocable, with one-tap deletion.
- **Multiple practitioners:** results by practitioner stay hidden until enough sessions exist (the rule already in the handoff).
- **Partnership path:** Center for Reiki Research collaborators as co-investigators, so pooled analyses carry independent authorship.

## Layer 6: The clinician bridge (the Medical Reiki trajectory)
- **A summary a patient chooses to share:** baseline trends, session records and methods notes, in language a clinician reads ("RMSSD", not "energy").
- **Hospital-setting mode:** session logging with no personal phone data. Practitioner and patient on-table readings only.
- **Boundary:** Resonance never diagnoses. The moment it interprets a reading as a medical condition, it becomes regulated as a medical device. That line is kept deliberately.

---

## Order and gates
| Layer | Starts when |
|---|---|
| 0 | Now (Claude Code build) |
| 1 | Layer 0 is live on Railway and in use by you for 21 or more nights |
| 2 | Layer 1's chest-strap data is validated against a reference recording |
| 3 | Layer 1 is done; can run alongside Layer 2 |
| 4 | Layer 1 is done, plus at least 3 willing practitioners |
| 5 | Ethics review decision made (see the study protocol, §9) |
| 6 | Layer 5 has produced at least one completed, pre-registered study |

## Risks of going "way beyond"
- **Capacity.** Each layer is real engineering. The gates exist so that nothing starts before the layer below it works.
- **Regulation.** Stress-management and biofeedback wellness tools are generally lightly regulated, while diagnosis and treatment claims are not. Every screen's wording is reviewed against that line.
- **Human-subjects research.** Pooled data (Layers 4 and 5) is research on people and needs ethics review before any recruitment.
- **App store health-data rules.** Apple Health and Health Connect data comes with strict rules on use and sharing. Layer 1 must follow them from its first release.
