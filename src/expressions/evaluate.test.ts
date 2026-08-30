import { describe, expect, it } from "vitest";
import type { Expr } from "./ast";
import { evaluate } from "./evaluate";
import { format } from "./format";

function add(l: Expr, r: Expr): Expr {
  return { kind: "add", l, r };
}
function sub(l: Expr, r: Expr): Expr {
  return { kind: "sub", l, r };
}
function mul(l: Expr, r: Expr): Expr {
  return { kind: "mul", l, r };
}
function n(v: number): Expr {
  return { kind: "num", n: v };
}

describe("evaluate + format", () => {
  it("一眼能比：50 vs 3", () => {
    expect(evaluate(n(50))).toBeGreaterThan(evaluate(n(3)));
  });

  it("加减：3+2 vs 27-18", () => {
    const a = add(n(3), n(2));
    const b = sub(n(27), n(18));
    expect(evaluate(a)).toBe(5);
    expect(evaluate(b)).toBe(9);
    expect(evaluate(b)).toBeGreaterThan(evaluate(a));
    expect(format(a)).toBe("3+2");
    expect(format(b)).toBe("27-18");
  });

  it("开方也走四则：√16+3 = 7，3²-5 = 4", () => {
    const a = add({ kind: "sqrt", x: n(16) }, n(3));
    const b = sub({ kind: "pow", b: n(3), e: n(2) }, n(5));
    expect(evaluate(a)).toBe(7);
    expect(evaluate(b)).toBe(4);
    expect(format(a)).toBe("√16+3");
    expect(format(b)).toBe("3²-5");
  });

  it("2√2 < 3", () => {
    const twoRoot2: Expr = mul(n(2), { kind: "sqrt", x: n(2) });
    expect(evaluate(twoRoot2)).toBeCloseTo(2.828427, 5);
    expect(evaluate(n(3))).toBeGreaterThan(evaluate(twoRoot2));
    expect(format(twoRoot2)).toBe("2√2");
  });

  it("i² = -1，且 2×i²+4 = 2", () => {
    expect(evaluate({ kind: "i2" })).toBe(-1);
    const wrapped = add(mul(n(2), { kind: "i2" }), n(4));
    expect(evaluate(wrapped)).toBe(2);
    expect(format(wrapped)).toBe("2×i²+4");
  });

  it("sin(90°) = 1，且四则包裹：2×sin(90°)+3 = 5", () => {
    expect(evaluate({ kind: "sin", x: n(90) })).toBeCloseTo(1, 9);
    expect(evaluate({ kind: "cos", x: n(0) })).toBeCloseTo(1, 9);
    const wrapped = add(mul(n(2), { kind: "sin", x: n(90) }), n(3));
    expect(evaluate(wrapped)).toBeCloseTo(5, 9);
    expect(format(wrapped)).toBe("2×sin(90°)+3");
  });

  it("负数乘法写成 5×(-2)", () => {
    const e = mul(n(5), { kind: "neg", x: n(2) });
    expect(evaluate(e)).toBe(-10);
    expect(format(e)).toBe("5×(-2)");
  });

  it("两步四则：3×2-4 = 2，8+5×2 = 18", () => {
    const a = sub(mul(n(3), n(2)), n(4));
    const b = add(n(8), mul(n(5), n(2)));
    expect(evaluate(a)).toBe(2);
    expect(evaluate(b)).toBe(18);
    expect(format(a)).toBe("3×2-4");
    expect(format(b)).toBe("8+5×2");
  });

  it("括号：(3+2)×4 = 20，27-(8+5) = 14，4×(3+2) = 20", () => {
    const a = mul(add(n(3), n(2)), n(4));
    const b = sub(n(27), add(n(8), n(5)));
    const c = mul(n(4), add(n(3), n(2)));
    const d = sub(mul(add(n(3), n(2)), n(4)), n(1));
    expect(evaluate(a)).toBe(20);
    expect(evaluate(b)).toBe(14);
    expect(evaluate(c)).toBe(20);
    expect(evaluate(d)).toBe(19);
    expect(format(a)).toBe("(3+2)×4");
    expect(format(b)).toBe("27-(8+5)");
    expect(format(c)).toBe("4×(3+2)");
    expect(format(d)).toBe("(3+2)×4-1");
  });
});
