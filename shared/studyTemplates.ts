// The two protocol templates (HANDOFF §9.1). Conditions are data: 2–4 arms,
// each {code, label, touch, intention, breathPacing}.
import type { StudyArm } from "./schema";

export interface StudyTemplate {
  key: "intention_vs_touch" | "deck_factorial";
  name: string;
  question: string;
  primaryOutcome: string;
  primaryContrast: string;
  secondaryContrast: string | null;
  conditions: StudyArm[];
  optionalArm?: StudyArm;     // e.g. rest, added by the practitioner if wanted
}

const OUTCOME = "Change in HRV (rMSSD), before → after, 60-second on-table reading, face-up, after 2 minutes of settling";

export const STUDY_TEMPLATES: StudyTemplate[] = [
  {
    key: "intention_vs_touch",
    name: "Intention against touch",
    question: "Does Reiki intention change heart rate variability beyond the same touch given without it?",
    primaryOutcome: OUTCOME,
    primaryContrast: "A-B",
    secondaryContrast: "B-C",
    conditions: [
      { code: "A", label: "Reiki", touch: true, intention: true, breathPacing: false },
      { code: "B", label: "Touch only", touch: true, intention: false, breathPacing: false },
      { code: "C", label: "Rest", touch: false, intention: false, breathPacing: false },
    ],
  },
  {
    key: "deck_factorial",
    name: "Deck study 3 (factorial)",
    question: "Does adding Reiki to paced breathing change heart rate variability beyond breathing alone?",
    primaryOutcome: OUTCOME,
    primaryContrast: "C-A",
    secondaryContrast: "C-B",
    conditions: [
      { code: "A", label: "Breath only", touch: false, intention: false, breathPacing: true },
      { code: "B", label: "Reiki only", touch: true, intention: true, breathPacing: false },
      { code: "C", label: "Breath + Reiki", touch: true, intention: true, breathPacing: true },
    ],
    optionalArm: { code: "D", label: "Rest", touch: false, intention: false, breathPacing: false, optional: true },
  },
];
