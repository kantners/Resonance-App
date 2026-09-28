// Brief wording for the escalation ladder (HANDOFF §3.4). Tags change the
// words only, never the level or the averages. No diagnosis, no health claims:
// findings are "observed" or "associated", never causes.
import type { ContextTag } from "@shared/schema";
import type { NightInput } from "./baseline";
import type { NightState, Status } from "./status";

export interface Message {
  title: string;
  body: string;
}

export interface BriefMessages {
  lastNight: Message | null;   // levels 1–2: about last night
  week: Message | null;        // levels 3–4: about the 7-night pattern
}

const TAG_WORDS: Record<ContextTag, string> = {
  alcohol: "alcohol",
  late_meal: "a late meal",
  hard_workout: "a hard workout",
  illness: "illness",
  travel: "travel",
};

function outText(state: NightState, night: NightInput, hrvOut: boolean): string {
  const hrv = `HRV ${Math.round(night.hrv!)} ms`;
  const rhr = night.rhr != null ? `resting HR ${Math.round(night.rhr)} bpm` : null;
  if (state === "both_out") return `Both signals outside your range: ${hrv}, ${rhr}.`;
  if (hrvOut) return `HRV outside your range: ${Math.round(night.hrv!)} ms.`;
  return `Resting HR outside your range: ${Math.round(night.rhr!)} bpm.`;
}

function taggedText(tags: readonly ContextTag[]): string {
  if (!tags.length) return "";
  const words = tags.map(t => TAG_WORDS[t]);
  const list = words.length === 1 ? words[0] : `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
  return ` You tagged ${list}; the night still counts in every average.`;
}

export function briefMessages(
  status: Status,
  tags: readonly ContextTag[],
  opts: { hrvOut: boolean; followedHighExposure: boolean },
): BriefMessages {
  const { escalationLevel: level, nightState, lastNight, consecutiveNightsOut: run } = status;
  let lastNightMsg: Message | null = null;

  if (lastNight && (nightState === "one_out" || nightState === "both_out")) {
    const out = outText(nightState, lastNight, opts.hrvOut);
    if (run >= 2) {
      const cause = opts.followedHighExposure
        ? ` ${run === 2 ? "Both" : `All ${run}`} followed high screen-time days.`
        : " An easier evening and an earlier night are worth a try.";
      lastNightMsg = { title: `${run} nights in a row`, body: `${out}${cause}${taggedText(tags)}` };
    } else if (tags.includes("hard_workout")) {
      lastNightMsg = {
        title: "Expected after a hard session",
        body: `${out} A dip after hard training is expected. The night still counts in every average.`,
      };
    } else {
      lastNightMsg = {
        title: "Noted",
        body: `${out} One night is noise. Worth an easy evening, not a worry.${taggedText(tags)}`,
      };
    }
  }

  let weekMsg: Message | null = null;
  if (level === 4) {
    weekMsg = {
      title: "Worth raising with a clinician",
      body: "Your 7-night average has been outside your normal range for 14 or more mornings in a row, "
        + "and your resting heart rate is above its range. A pattern this persistent is worth raising with a clinician.",
    };
  } else if (level === 3) {
    weekMsg = {
      title: "Drifting down",
      body: "Your 7-night average is outside your normal range. The pattern behind it is shown below.",
    };
  }

  return { lastNight: lastNightMsg, week: weekMsg };
}
