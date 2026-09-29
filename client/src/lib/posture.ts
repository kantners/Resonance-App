import type { Posture } from "@shared/api";

/** Morning-reading postures. The user sets one (first run or Settings); it's pre-selected each morning. */
export const MORNING_POSTURES: { value: Posture; label: string; step: string }[] = [
  { value: "seated", label: "Seated", step: "Sit up, same spot, soon after waking." },
  { value: "face_up", label: "Lying face-up", step: "Lie face-up, same spot, soon after waking." },
];

export const postureLabel = (p: Posture | null | undefined) =>
  MORNING_POSTURES.find(x => x.value === p)?.label ?? "Seated";

/** Shown whenever a reading's posture differs from the set posture (Mark, Sep 29). */
export const OFF_POSTURE_NOTE =
  "Different posture from your baseline; this reading is noted but not used in your averages.";
