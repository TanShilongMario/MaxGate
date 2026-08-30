import { describe, expect, it } from "vitest";
import { getStageConfig, stageFromDoors } from "./curve";

function tiersOf(doors: number) {
  return getStageConfig(doors).tiers.map((t) => t.tier);
}

describe("difficulty curve", () => {
  it("每 10 门升一段", () => {
    expect(stageFromDoors(0)).toBe(1);
    expect(stageFromDoors(9)).toBe(1);
    expect(stageFromDoors(10)).toBe(2);
    expect(stageFromDoors(90)).toBe(10);
  });

  it("第一段：2 道、大间隙、只有字面量", () => {
    const c = getStageConfig(0);
    expect(c.lanes).toBe(2);
    expect(c.windowMs).toBeGreaterThanOrEqual(4000);
    expect(c.minGap).toBeGreaterThanOrEqual(20);
    expect(c.hideChance).toBe(0);
    expect(tiersOf(0)).toEqual(["literal"]);
  });

  it("四则进场后每一段都还带着四则", () => {
    const arith = new Set(["add_sub", "mul_div", "chain", "paren"]);
    for (let d = 20; d <= 400; d += 5) {
      expect(tiersOf(d).some((t) => arith.has(t)), `door ${d}`).toBe(true);
    }
  });

  it("前 140 门始终 2 道，且没有三角/根号/复数", () => {
    for (let d = 0; d < 140; d++) {
      const c = getStageConfig(d);
      expect(c.lanes).toBe(2);
      expect(c.hideChance).toBe(0);
      expect(tiersOf(d)).not.toContain("trig");
      expect(tiersOf(d)).not.toContain("power_root");
      expect(tiersOf(d)).not.toContain("complex");
    }
  });

  it("两步四则先在 2 道出现（约 60 门），括号更晚", () => {
    expect(tiersOf(59)).not.toContain("chain");
    expect(tiersOf(60)).toContain("chain");
    expect(getStageConfig(60).lanes).toBe(2);
    for (let d = 60; d < 90; d++) {
      expect(tiersOf(d)).not.toContain("paren");
    }
    expect(tiersOf(90)).toContain("paren");
    expect(getStageConfig(90).lanes).toBe(2);
  });

  it("括号在 2 道上有独立高原（约 100–119 门）", () => {
    expect(tiersOf(110)).toEqual(["paren"]);
    expect(getStageConfig(110).lanes).toBe(2);
  });

  it("第 3 道在 140 门出现，且窗口和间隙都回让", () => {
    const before = getStageConfig(139);
    const debut = getStageConfig(140);
    expect(before.lanes).toBe(2);
    expect(debut.lanes).toBe(3);
    expect(debut.windowMs).toBeGreaterThan(before.windowMs);
    expect(debut.minGap).toBeGreaterThan(before.minGap);
    expect(tiersOf(140)).toContain("literal");
  });

  it("3 道上会再走一遍括号，再给负数", () => {
    expect(tiersOf(170)).toContain("paren");
    expect(getStageConfig(170).lanes).toBe(3);
    expect(tiersOf(190)).toContain("negative");
  });

  it("第 4 道在 200 门出现，随后再出现四道括号", () => {
    const before = getStageConfig(199);
    const debut = getStageConfig(200);
    expect(before.lanes).toBe(3);
    expect(debut.lanes).toBe(4);
    expect(debut.windowMs).toBeGreaterThan(before.windowMs);
    expect(debut.minGap).toBeGreaterThan(before.minGap);
    expect(tiersOf(220)).toContain("paren");
    expect(getStageConfig(220).lanes).toBe(4);
  });

  it("三角不在 240 门前出现", () => {
    for (let d = 0; d < 240; d++) {
      expect(tiersOf(d)).not.toContain("trig");
    }
    expect(tiersOf(240)).toContain("trig");
  });

  it("遮挡不在 260 门前出现", () => {
    for (let d = 0; d < 260; d++) {
      expect(getStageConfig(d).hideChance).toBe(0);
    }
    expect(getStageConfig(260).hideChance).toBeGreaterThan(0);
  });

  it("后期窗口触底不低于 1400ms", () => {
    expect(getStageConfig(900).windowMs).toBe(1400);
    expect(getStageConfig(900).lanes).toBe(4);
  });
});
