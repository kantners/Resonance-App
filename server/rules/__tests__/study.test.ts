import { randomInt } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  allocationHash, blockSequences, buildAllocationList, canonicalJson, nextAllocationRow, pairedContrast,
  practitionerResultsVisible, qualityPanel, sessionDelta, verifyAllocation, type Rng, type SessionRecord,
} from "..";

const cryptoRng: Rng = n => randomInt(n);

/** Deterministic RNG (mulberry32) for reproducible tests. */
function seeded(seed: number): Rng {
  let a = seed >>> 0;
  return n => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * n);
  };
}

const key = (s: string[]) => s.join("");

describe("allocation (§4.2, §9.1, A1)", () => {
  it("3 arms: every shuffled block of 6 contains all six orders", () => {
    for (const rng of [cryptoRng, seeded(1), seeded(2), seeded(3)]) {
      const list = buildAllocationList(["A", "B", "C"], 36, rng);
      expect(list).toHaveLength(36);
      for (let b = 0; b < 6; b++) {
        const block = list.filter(r => r.block === b).map(r => key(r.sequence)).sort();
        expect(block).toEqual(["ABC", "ACB", "BAC", "BCA", "CAB", "CBA"]);
      }
    }
  });

  it("blocks are actually shuffled (not always in the same order)", () => {
    const firstRows = new Set(Array.from({ length: 40 }, (_, i) => key(buildAllocationList(["A", "B", "C"], 6, seeded(i))[0].sequence)));
    expect(firstRows.size).toBeGreaterThan(3);
  });

  it("rounds the list up to whole blocks and indexes rows 0..n−1", () => {
    const list = buildAllocationList(["A", "B", "C"], 13, seeded(7));
    expect(list).toHaveLength(18);
    expect(list.map(r => r.index)).toEqual([...Array(18).keys()]);
  });

  it("2 arms: blocks of AB and BA", () => {
    const list = buildAllocationList(["A", "B"], 10, seeded(4));
    for (let b = 0; b < 5; b++) {
      expect(list.filter(r => r.block === b).map(r => key(r.sequence)).sort()).toEqual(["AB", "BA"]);
    }
  });

  it("4 arms: a balanced Latin square (each arm once per position, each ordered pair once)", () => {
    const rows = blockSequences(["A", "B", "C", "D"]);
    expect(rows).toHaveLength(4);
    for (let pos = 0; pos < 4; pos++) expect(rows.map(r => r[pos]).sort()).toEqual(["A", "B", "C", "D"]);
    const pairs = rows.flatMap(r => r.slice(1).map((x, i) => r[i] + x));
    expect(new Set(pairs).size).toBe(12);
    expect(pairs).toHaveLength(12);
    const list = buildAllocationList(["A", "B", "C", "D"], 8, seeded(5));
    for (let b = 0; b < 2; b++) {
      expect(list.filter(r => r.block === b).map(r => key(r.sequence)).sort()).toEqual(rows.map(key).sort());
    }
  });

  it("rejects fewer than 2 or more than 4 arms", () => {
    expect(() => blockSequences(["A"])).toThrow();
    expect(() => blockSequences(["A", "B", "C", "D", "E"])).toThrow();
  });

  it("enrollment takes the next unused row and never generates one", () => {
    const list = buildAllocationList(["A", "B", "C"], 6, seeded(9));
    const used = new Set<number>();
    for (let i = 0; i < 6; i++) {
      const row = nextAllocationRow(list, used)!;
      expect(row.index).toBe(i);
      used.add(row.index);
    }
    expect(nextAllocationRow(list, used)).toBeNull();
    expect(list).toHaveLength(6);
  });

  it("the SHA-256 hash is stable, verifiable, and changes with the nonce or the list", () => {
    const list = buildAllocationList(["A", "B", "C"], 12, seeded(11));
    const nonce = "0123456789abcdef0123456789abcdef";
    const h = allocationHash(nonce, list);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(allocationHash(nonce, JSON.parse(JSON.stringify(list)))).toBe(h);
    expect(verifyAllocation(nonce, list, h)).toBe(true);
    expect(allocationHash("f" + nonce.slice(1), list)).not.toBe(h);
    const swapped = list.map(r => (r.index === 0 ? { ...r, sequence: [...r.sequence].reverse() } : r));
    expect(verifyAllocation(nonce, swapped, h)).toBe(false);
  });

  it("canonical JSON sorts keys at every level", () => {
    expect(canonicalJson({ b: 1, a: [{ d: 2, c: 3 }] })).toBe('{"a":[{"c":3,"d":2}],"b":1}');
  });
});

function session(p: Partial<SessionRecord> & Pick<SessionRecord, "enrollmentId" | "condition">): SessionRecord {
  return {
    id: p.id ?? Math.floor(Math.random() * 1e6), clientCode: `C-${p.enrollmentId}`, practitionerId: 1,
    preRmssdMs: 40, postRmssdMs: 45, preReadingDevice: null, postReadingDevice: null, clientGuess: null,
    intentionHeldRating: null, driftCount: 0, deviations: null, withdrawn: false, ...p,
  };
}

describe("analysis (§4.5, A2, A3)", () => {
  it("the protocol's analysis scale decides the delta; there is no flag input", () => {
    expect(sessionDelta({ preRmssdMs: 40, postRmssdMs: 50 }, "linear")).toBe(10);
    expect(sessionDelta({ preRmssdMs: 40, postRmssdMs: 50 }, "ln")).toBeCloseTo(Math.log(1.25), 12);
    const sessions = [1, 2, 3].flatMap(c => [
      session({ enrollmentId: c, condition: "A", preRmssdMs: 40, postRmssdMs: 50 + c }),
      session({ enrollmentId: c, condition: "B", preRmssdMs: 30, postRmssdMs: 33 }),
    ]);
    const lin = pairedContrast(sessions, "A-B", "linear", 3);
    const ln = pairedContrast(sessions, "A-B", "ln", 3);
    expect(lin.ci!.mean).toBeCloseTo(10 + 2 - 3, 10);
    expect(ln.ci!.mean).not.toBeCloseTo(lin.ci!.mean, 1);
  });

  it("uses only clients with both conditions, and excludes withdrawn clients", () => {
    const sessions = [
      session({ enrollmentId: 1, condition: "A" }), session({ enrollmentId: 1, condition: "B" }),
      session({ enrollmentId: 2, condition: "A" }),                                     // no B
      session({ enrollmentId: 3, condition: "A", withdrawn: true }), session({ enrollmentId: 3, condition: "B", withdrawn: true }),
    ];
    expect(pairedContrast(sessions, "A-B", "linear", 1).pairs).toHaveLength(1);
  });

  it("the verdict never claims more than the data: too early while n < target or the CI includes 0", () => {
    const clear = [1, 2, 3, 4].flatMap(c => [
      session({ enrollmentId: c, condition: "A", postRmssdMs: 50 + c * 0.1 }),
      session({ enrollmentId: c, condition: "B", postRmssdMs: 40 }),
    ]);
    expect(pairedContrast(clear, "A-B", "linear", 12).verdict).toBe("too_early");   // n < target
    const done = pairedContrast(clear, "A-B", "linear", 4);
    expect(done.verdict).toBe("observed_positive");
    expect(done.verdictText).toMatch(/^Observed in our sessions/);
    expect(done.verdictText).not.toMatch(/prove/i);
  });

  it("quality panel: blinding among primary-contrast sessions, ratings, drift, deviations", () => {
    const sessions = [
      session({ id: 1, enrollmentId: 1, condition: "A", clientGuess: "A", intentionHeldRating: 9, driftCount: 1 }),
      session({ id: 2, enrollmentId: 1, condition: "B", clientGuess: "A", intentionHeldRating: 10, deviations: "late start" }),
      session({ id: 3, enrollmentId: 1, condition: "C", clientGuess: "C" }),
      session({ id: 4, enrollmentId: 2, condition: "B", clientGuess: "not_sure", driftCount: 2 }),
    ];
    const q = qualityPanel(sessions, "A-B", null);
    expect(q.blinding).toEqual({ correct: 1, guesses: 3, chance: 0.5 });
    expect(q.meanIntentionHeld).toBe(9.5);
    expect(q.totalDrift).toBe(3);
    expect(q.sessionsWithDeviations).toBe(1);
  });

  it("flags sessions whose reading device doesn't match the locked protocol (A3)", () => {
    const sessions = [
      session({ id: 1, enrollmentId: 1, condition: "A", preReadingDevice: "Polar H10 + Elite HRV", postReadingDevice: "polar h10 + elite hrv " }),
      session({ id: 2, enrollmentId: 1, condition: "B", preReadingDevice: "Polar H10 + Elite HRV", postReadingDevice: "HRV4Training camera" }),
    ];
    const q = qualityPanel(sessions, "A-B", "Polar H10 + Elite HRV");
    expect(q.deviceMismatches.map(m => m.sessionId)).toEqual([2]);
    // Mismatched sessions are still analysed.
    expect(pairedContrast(sessions, "A-B", "linear", 1).pairs).toHaveLength(1);
  });

  it("per-practitioner results stay hidden until each has 10+ sessions in each compared condition", () => {
    const make = (pid: number, nA: number, nB: number) => [
      ...Array.from({ length: nA }, (_, i) => session({ enrollmentId: pid * 100 + i, practitionerId: pid, condition: "A" })),
      ...Array.from({ length: nB }, (_, i) => session({ enrollmentId: pid * 100 + i, practitionerId: pid, condition: "B" })),
    ];
    expect(practitionerResultsVisible([...make(1, 10, 10), ...make(2, 10, 9)], "A-B")).toBe(false);
    expect(practitionerResultsVisible([...make(1, 10, 10), ...make(2, 12, 10)], "A-B")).toBe(true);
  });
});
