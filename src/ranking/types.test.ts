import { describe, expect, it } from "vitest";
import { sortRecords, type RunRecord } from "./types";

function rec(partial: Partial<RunRecord> & Pick<RunRecord, "score" | "doorsPassed" | "endedAt">): RunRecord {
  return {
    id: partial.id ?? "x",
    playerId: "p",
    maxStage: 1,
    difficulty: "classic",
    seed: "s",
    clientVersion: "0.1.0",
    ...partial,
  };
}

describe("sortRecords", () => {
  it("分数优先，其次过门数，再其次时间", () => {
    const sorted = sortRecords([
      rec({ score: 10, doorsPassed: 1, endedAt: 3 }),
      rec({ score: 30, doorsPassed: 3, endedAt: 1 }),
      rec({ score: 30, doorsPassed: 5, endedAt: 2 }),
    ]);
    expect(sorted.map((r) => r.doorsPassed)).toEqual([5, 3, 1]);
  });
});
