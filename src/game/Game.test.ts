import { describe, expect, it } from "vitest";
import type { RankingAdapter, RunRecord } from "../ranking";
import { Game } from "./Game";

class MemoryRanking implements RankingAdapter {
  async getPlayer() {
    return { playerId: "test" };
  }
  async list() {
    return [];
  }
  async submit(record: Omit<RunRecord, "id" | "playerId"> & { id?: string }) {
    return {
      id: record.id ?? "1",
      playerId: "test",
      score: record.score,
      doorsPassed: record.doorsPassed,
      maxStage: record.maxStage,
      seed: record.seed,
      endedAt: record.endedAt,
      clientVersion: record.clientVersion,
    };
  }
}

describe("Game 换道不应立刻扣命", () => {
  it("开局换道与前两秒接近都不扣命", () => {
    const game = new Game(new MemoryRanking());
    game.start();
    expect(game.lives).toBe(3);
    game.applyIntents([{ type: "lane", delta: 1 }]);
    game.update(16);
    expect(game.lives).toBe(3);
    game.applyIntents([{ type: "lane", delta: -1 }, { type: "lane", delta: 1 }]);
    game.update(800);
    expect(game.lives).toBe(3);
    game.update(2000);
    expect(game.lives).toBe(3);
    expect(game.phase).toBe("playing");
  });

  it("答错后也会推进题目序列，不重复同一题", () => {
    const game = new Game(new MemoryRanking());
    game.start("classic");
    const internal = game as unknown as {
      gateIndex: number;
      door: { gate: { correctLane: number } };
    };
    game.playerLane = internal.door.gate.correctLane === 0 ? 1 : 0;
    game.update(360);
    game.update(3100);
    expect(game.lives).toBe(2);
    expect(internal.gateIndex).toBe(1);
    game.update(899);
    expect(game.phase).toBe("resolving");
    game.update(1);
    expect(game.phase).toBe("playing");
  });
});
