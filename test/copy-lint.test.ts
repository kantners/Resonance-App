// Wording rule (HANDOFF §6, §9; build prompt): no health claims, findings are
// "observed" or "associated", never causes or treatments; no streaks or badges.
// Scans string literals and JSX text in user-facing code (not identifiers or comments).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "..");

const BANNED: { word: RegExp; allowIn?: string[] }[] = [
  { word: /\bcaus(e|es|ed|ing)\b/i },
  { word: /\btreat(s|ed|ing|ment|ments)?\b/i },
  { word: /\bcur(e|es|ed|ing)\b/i },
  { word: /\bprov(e|es|ed|en|ing)\b/i },
  { word: /\bheal(s|ed|ing)?\b/i },
  // The Recovery-Rule screen explains why Resonance has no streaks.
  { word: /\bstreaks?\b/i, allowIn: ["client/src/screens/RecoveryRule.tsx"] },
  { word: /\bbadges?\b/i },
];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return name === "ui" ? [] : walk(p);   // skip shadcn primitives
    return /\.(tsx?|html)$/.test(name) && !/\.test\.ts$/.test(name) ? [p] : [];
  });
}

function userFacingText(src: string): string[] {
  const noComments = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  const out: string[] = [];
  for (const m of noComments.matchAll(/(["'`])((?:\\.|(?!\1)[^\\])*)\1/g)) out.push(m[2]);
  for (const m of noComments.matchAll(/>([^<>{}]+)</g)) out.push(m[1]);
  // Drop template interpolations: `${cause}` is an identifier, not copy.
  return out.map(s => s.replace(/\$\{[^}]*\}/g, " ").trim()).filter(s => /[a-z]{3}/i.test(s) && !s.startsWith("@/") && !s.startsWith("./"));
}

const files = [
  ...walk(join(ROOT, "client", "src")),
  join(ROOT, "client", "index.html"),
  join(ROOT, "server", "rules", "messages.ts"),
  join(ROOT, "server", "rules", "study.ts"),
];

describe("copy lint", () => {
  it("finds files to scan", () => {
    expect(files.length).toBeGreaterThan(3);
  });

  it("catches banned wording in strings and JSX, not in identifiers or comments", () => {
    const flagged = (src: string) => userFacingText(src).filter(t => BANNED.some(b => b.word.test(t)));
    expect(flagged(`const m = "Breathwork treats stress";`)).toHaveLength(1);
    expect(flagged(`<p>This proves it works</p>`)).toHaveLength(1);
    expect(flagged("const s = `Keep your streak going, ${name}`;")).toHaveLength(1);
    expect(flagged(`const cause = x; // causes nothing\nconst t = \`\${cause}\`;`)).toHaveLength(0);
    expect(flagged(`<p>An association, not a diagnosis.</p>`)).toHaveLength(0);
  });

  for (const file of files) {
    const rel = relative(ROOT, file).replace(/\\/g, "/");
    it(`${rel} has no banned wording`, () => {
      const texts = userFacingText(readFileSync(file, "utf8"));
      const hits = texts.flatMap(t =>
        BANNED.filter(b => b.word.test(t) && !b.allowIn?.includes(rel)).map(b => `${b.word}: "${t}"`));
      expect(hits).toEqual([]);
    });
  }
});
