// Wording rule (HANDOFF §6, §9; build prompt): no health claims, findings are
// "observed" or "associated", never causes or treatments; no streaks or badges.
// Scans string literals and JSX text in user-facing code (not identifiers or comments).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "..");

const BANNED: { word: RegExp; allowIn?: string[] }[] = [
  { word: /\bcaus(e|es|ed|ing)\b/i },
  // "treated as meaningful" (canvas copy) is ordinary English; "treats", "treatment", "treated for" are not allowed.
  { word: /\btreat(s|ing|ment|ments)?\b|\btreated\b(?!\s+as\b)/i },
  { word: /\bcur(e|es|ed|ing)\b/i },
  { word: /\bprov(e|es|ed|en|ing)\b/i },
  { word: /\bheal(s|ed|ing)?\b/i },
  // The Recovery-Rule screen explains why Resonance has no streaks.
  { word: /\bstreaks?\b/i, allowIn: ["client/src/screens/RecoveryRule.tsx"] },
  { word: /\bbadges?\b/i },
  // Study records are pseudonymised (a study code), not anonymous (Mark, Sep 29).
  { word: /\banonym(i[sz](e|es|ed|ing|ation)|ous|ously|ity)\b/i },
];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return name === "ui" ? [] : walk(p);   // skip shadcn primitives
    return /\.(tsx?|html)$/.test(name) && !/\.test\.ts$/.test(name) ? [p] : [];
  });
}

function userFacingText(src: string, hasJsx = true): string[] {
  const noComments = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  // Class lists are styling, never copy (e.g. the "tracking-badge" token).
  const noClasses = noComments
    .replace(/className=\{`[^`]*`\}/g, "")
    .replace(/className=(["'])[^"']*\1/g, "");
  const out: string[] = [];
  // JSX text first, then remove it, so an apostrophe in prose ("signal's")
  // can't be mistaken for the start of a string literal.
  const jsxText = /(?<=>)([^<>{}]+)(?=<|\{)/g;
  if (hasJsx) for (const m of noClasses.matchAll(jsxText)) out.push(m[1]);
  const code = hasJsx ? noClasses.replace(jsxText, " ") : noClasses;
  for (const m of code.matchAll(/(["'`])((?:\\.|(?!\1)[^\\])*)\1/g)) out.push(m[2]);
  // Drop template interpolations: `${cause}` is an identifier, not copy.
  return out.map(s => s.replace(/\$\{[^}]*\}/g, " ").trim()).filter(s => /[a-z]{3}/i.test(s) && !s.startsWith("@/") && !s.startsWith("./"));
}

const files = [
  ...walk(join(ROOT, "client", "src")),
  join(ROOT, "client", "index.html"),
  join(ROOT, "server", "rules", "messages.ts"),
  join(ROOT, "server", "rules", "study.ts"),
  join(ROOT, "shared", "consentCopy.ts"),
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
    expect(flagged(`<p>the smallest change commonly treated as meaningful</p>`)).toHaveLength(0);
    expect(flagged(`<p>Breathwork treated my anxiety</p>`)).toHaveLength(1);
    expect(flagged(`<p>A gentle treatment</p>`)).toHaveLength(1);
    expect(flagged(`const n = "keeps one anonymised record";`)).toHaveLength(1);
    // Class names aren't copy; an apostrophe in prose doesn't swallow the markup after it.
    expect(flagged(`<span className="font-mono tracking-badge">x</span>`)).toHaveLength(0);
    expect(flagged(`<p>Each signal's range</p><span className="tracking-badge">ok</span><p>no badges here</p>`)).toHaveLength(1);
  });

  for (const file of files) {
    const rel = relative(ROOT, file).replace(/\\/g, "/");
    it(`${rel} has no banned wording`, () => {
      const texts = userFacingText(readFileSync(file, "utf8"), /\.(tsx|html)$/.test(file));
      const hits = texts.flatMap(t =>
        BANNED.filter(b => b.word.test(t) && !b.allowIn?.includes(rel)).map(b => `${b.word}: "${t}"`));
      expect(hits).toEqual([]);
    });
  }
});
