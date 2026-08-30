import { describe, expect, it } from "vitest";
import { uniqueMaxIndex } from "../core/math";
import { mulberry32 } from "../core/rng";
import { generateGate } from "./generate";

describe("generateGate", () => {
  it("任意种子都给出唯一最大且满足间隙", () => {
    for (let s = 1; s <= 40; s++) {
      const gate = generateGate(mulberry32(s * 97), {
        lanes: 3,
        minGap: 1,
        tiers: [
          { tier: "add_sub", weight: 1 },
          { tier: "chain", weight: 1 },
          { tier: "paren", weight: 1 },
          { tier: "power_root", weight: 1 },
        ],
      });
      expect(gate.labels).toHaveLength(3);
      expect(uniqueMaxIndex(gate.values, 1)).toBe(gate.correctLane);
      expect(gate.values[gate.correctLane]).toBeDefined();
    }
  });

  it("两步四则门组能收敛且带运算符号", () => {
    const gate = generateGate(mulberry32(42), {
      lanes: 2,
      minGap: 2,
      tiers: [{ tier: "chain", weight: 1 }],
    });
    expect(gate.labels).toHaveLength(2);
    expect(gate.labels.some((l) => /[×÷+\-]/.test(l))).toBe(true);
  });

  it("括号门组带括号且能收敛", () => {
    const gate = generateGate(mulberry32(7), {
      lanes: 2,
      minGap: 2,
      tiers: [{ tier: "paren", weight: 1 }],
    });
    expect(gate.labels).toHaveLength(2);
    expect(gate.labels.some((l) => l.includes("("))).toBe(true);
  });

  it("三角、开方、i² 都嵌在四则里", () => {
    for (const tier of ["trig", "power_root", "complex"] as const) {
      const gate = generateGate(mulberry32(99), {
        lanes: 3,
        minGap: 0.5,
        tiers: [{ tier, weight: 1 }],
      });
      for (const label of gate.labels) {
        expect(label, `${tier}: ${label}`).toMatch(/[+\-×÷]/);
      }
    }
  });

  it("4 道混合题也能收敛", () => {
    const gate = generateGate(mulberry32(20260830), {
      lanes: 4,
      minGap: 0.6,
      tiers: [
        { tier: "mixed", weight: 2 },
        { tier: "complex", weight: 1 },
      ],
    });
    expect(gate.labels).toHaveLength(4);
    expect(uniqueMaxIndex(gate.values, 0.6)).toBe(gate.correctLane);
  });
});
