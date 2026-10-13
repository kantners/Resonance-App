import { describe, expect, it } from "vitest";
import { createMemoryStorage } from "../../storage/memory";

// Edit and delete for stillness and reading entries stay scoped to their owner.
describe("stillness and reading edit/delete", () => {
  it("patches and deletes only the owner's rows", async () => {
    const st: any = createMemoryStorage();
    const s = await st.createStillness(1, { date: "2026-10-13", startedAt: "2026-10-13T12:00:00.000Z", minutes: 10, type: "walk", phoneLocation: "another_room" });
    expect((await st.patchStillness(1, s.id, { minutes: 25 }))?.minutes).toBe(25);
    expect(await st.patchStillness(2, s.id, { minutes: 5 })).toBeNull();
    expect(await st.deleteStillness(2, s.id)).toBe(false);
    expect(await st.deleteStillness(1, s.id)).toBe(true);
    const r = await st.createReading(1, { date: "2026-10-13", medium: "physical", durationMin: 30 });
    expect((await st.patchReading(1, r.id, { durationMin: 45, title: "Chernow" }))?.durationMin).toBe(45);
    expect(await st.deleteReading(1, r.id)).toBe(true);
    expect(await st.listReading(1)).toHaveLength(0);
  });
});
