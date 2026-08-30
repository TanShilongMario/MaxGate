import { describe, expect, it } from "vitest";
import { getStageConfig, stageFromDoors, type DifficultyMode } from "./curve";

function tiersOf(doors: number, mode: DifficultyMode = "classic") {
  return getStageConfig(doors, mode).tiers.map((t) => t.tier);
}

describe("difficulty curve", () => {
  it("只用前 5 题做整数教学", () => {
    expect(stageFromDoors(0)).toBe(1);
    expect(stageFromDoors(4)).toBe(1);
    expect(stageFromDoors(5)).toBe(2);
    expect(stageFromDoors(14)).toBe(2);
    expect(stageFromDoors(15)).toBe(3);
    for (const mode of ["cozy", "classic", "rush"] as const) {
      expect(tiersOf(0, mode)).toEqual(["literal"]);
      expect(tiersOf(4, mode)).toEqual(["literal"]);
      expect(tiersOf(5, mode)).not.toEqual(["literal"]);
    }
  });

  it("初始速度比旧版更紧凑", () => {
    const c = getStageConfig(0, "classic");
    expect(c.lanes).toBe(2);
    expect(c.windowMs).toBe(3000);
    expect(c.minGap).toBeGreaterThanOrEqual(20);
    expect(c.resolveMs).toBeLessThanOrEqual(160);
  });

  it("三种难度有稳定的节奏差", () => {
    const cozy = getStageConfig(5, "cozy");
    const classic = getStageConfig(5, "classic");
    const rush = getStageConfig(5, "rush");
    expect(cozy.windowMs).toBeGreaterThan(rush.windowMs);
    expect(rush.windowMs).toBeGreaterThan(classic.windowMs);
    expect(cozy.minGap).toBeGreaterThan(classic.minGap);
    expect(classic.minGap).toBeGreaterThan(rush.minGap);
  });

  it("冲刺模式从第一题就使用 3 条甬道", () => {
    expect(getStageConfig(0, "cozy").lanes).toBe(2);
    expect(getStageConfig(0, "classic").lanes).toBe(2);
    expect(getStageConfig(0, "rush").lanes).toBe(3);
  });

  it("冲刺模式用题型和甬道增加难度，而不是压缩计算时间", () => {
    expect(getStageConfig(0, "rush").windowMs).toBe(3240);
    expect(getStageConfig(5, "rush").windowMs).toBeGreaterThan(getStageConfig(5, "classic").windowMs);
  });

  it("经典模式在第 6 题开始乘除", () => {
    expect(tiersOf(5, "classic")).toContain("mul_div");
    expect(tiersOf(5, "classic")).toContain("add_sub");
  });

  it("冲刺模式在第 6 题开始两步计算", () => {
    expect(tiersOf(5, "rush")).toContain("chain");
  });

  it("轻松模式在第 6 题从加减开始", () => {
    expect(tiersOf(5, "cozy")).toContain("add_sub");
    expect(tiersOf(5, "cozy")).not.toContain("chain");
  });

  it("新增泳道时仍会还时间与间隙", () => {
    const before = getStageConfig(124, "classic");
    const debut = getStageConfig(125, "classic");
    expect(before.lanes).toBe(2);
    expect(debut.lanes).toBe(3);
    expect(debut.windowMs).toBeGreaterThan(before.windowMs);
    expect(debut.minGap).toBeGreaterThan(before.minGap);
  });

  it("第四道同样独立进场", () => {
    const before = getStageConfig(184, "classic");
    const debut = getStageConfig(185, "classic");
    expect(before.lanes).toBe(3);
    expect(debut.lanes).toBe(4);
    expect(debut.windowMs).toBeGreaterThan(before.windowMs);
  });

  it("三角与记忆遮挡仍属后期机制", () => {
    expect(tiersOf(224, "classic")).not.toContain("trig");
    expect(tiersOf(225, "classic")).toContain("trig");
    expect(getStageConfig(244, "classic").hideChance).toBe(0);
    expect(getStageConfig(245, "classic").hideChance).toBeGreaterThan(0);
  });

  it("后期窗口触底不低于 1400ms", () => {
    expect(getStageConfig(900, "classic").windowMs).toBe(1400);
    expect(getStageConfig(900, "classic").lanes).toBe(4);
  });
});
