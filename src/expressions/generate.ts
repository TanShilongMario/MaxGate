import { uniqueMaxIndex } from "../core/math";
import { chance, pick, pickInt } from "../core/rng";
import type { Expr, ExprTier } from "./ast";
import { TRIG_DEGREES } from "./ast";
import { safeEvaluate } from "./evaluate";
import { format } from "./format";

export interface GateSpec {
  lanes: number;
  minGap: number;
  tiers: { tier: ExprTier; weight: number }[];
}

export interface GeneratedGate {
  exprs: Expr[];
  labels: string[];
  values: number[];
  correctLane: number;
}

const MAX_ATTEMPTS = 80;

export function generateGate(rng: () => number, spec: GateSpec): GeneratedGate {
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const exprs = Array.from({ length: spec.lanes }, () =>
      generateExpr(rng, weightedTier(rng, spec.tiers)),
    );
    const built = finalize(exprs, spec.minGap);
    if (built) return built;
  }
  return fallbackLiterals(rng, spec.lanes, spec.minGap);
}

function weightedTier(rng: () => number, tiers: GateSpec["tiers"]): ExprTier {
  const total = tiers.reduce((s, t) => s + t.weight, 0);
  let x = rng() * total;
  for (const t of tiers) {
    x -= t.weight;
    if (x <= 0) return t.tier;
  }
  return tiers[tiers.length - 1]!.tier;
}

function finalize(exprs: Expr[], minGap: number): GeneratedGate | null {
  const values: number[] = [];
  for (const e of exprs) {
    const v = safeEvaluate(e);
    if (v === null) return null;
    values.push(v);
  }
  const correctLane = uniqueMaxIndex(values, minGap);
  if (correctLane === null) return null;
  return {
    exprs,
    labels: exprs.map(format),
    values,
    correctLane,
  };
}

function fallbackLiterals(rng: () => number, lanes: number, minGap: number): GeneratedGate {
  const gap = Math.max(minGap, 3);
  const base = pickInt(rng, 1, 20);
  const values = Array.from({ length: lanes }, (_, i) => base + i * gap);
  // shuffle
  for (let i = values.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = values[i]!;
    values[i] = values[j]!;
    values[j] = tmp;
  }
  const exprs: Expr[] = values.map((n) => ({ kind: "num", n }));
  return finalize(exprs, minGap)!;
}

function generateExpr(rng: () => number, tier: ExprTier): Expr {
  switch (tier) {
    case "literal":
      return num(pickInt(rng, 0, 99));
    case "add_sub":
      return genAddSub(rng, false);
    case "mul_div":
      return genMulDiv(rng, false);
    case "chain":
      return genChain(rng);
    case "paren":
      return genParen(rng);
    case "negative":
      return genNegative(rng);
    case "trig":
      return genTrig(rng);
    case "power_root":
      return genPowerRoot(rng);
    case "mixed":
      return genMixed(rng);
    case "complex":
      return genComplex(rng);
  }
}

function num(n: number): Expr {
  return { kind: "num", n };
}

function genAddSub(rng: () => number, allowNeg: boolean): Expr {
  const a = pickInt(rng, allowNeg ? -20 : 1, 40);
  const b = pickInt(rng, allowNeg ? -20 : 1, 40);
  return chance(rng, 0.55)
    ? { kind: "add", l: num(a), r: num(b) }
    : { kind: "sub", l: num(a), r: num(b) };
}

function genMulDiv(rng: () => number, allowNeg: boolean): Expr {
  if (chance(rng, 0.55)) {
    const a = pickInt(rng, allowNeg ? -12 : 2, 12);
    const b = pickInt(rng, allowNeg ? -12 : 2, 12);
    return { kind: "mul", l: num(a), r: num(b) };
  }
  const b = pickInt(rng, 2, 12);
  const q = pickInt(rng, 2, 12);
  const a = b * q * (allowNeg && chance(rng, 0.25) ? -1 : 1);
  return { kind: "div", l: num(a), r: num(b) };
}

/** 两步四则，如 3×2-4、8+5×2。不用括号，但要按先乘除后加减组 AST。 */
function genChain(rng: () => number): Expr {
  const mode = pickInt(rng, 0, 5);
  switch (mode) {
    case 0: {
      const a = pickInt(rng, 2, 9);
      const b = pickInt(rng, 2, 9);
      const c = pickInt(rng, 1, 12);
      return { kind: "sub", l: { kind: "mul", l: num(a), r: num(b) }, r: num(c) };
    }
    case 1: {
      const a = pickInt(rng, 1, 12);
      const b = pickInt(rng, 2, 8);
      const c = pickInt(rng, 2, 8);
      return { kind: "add", l: num(a), r: { kind: "mul", l: num(b), r: num(c) } };
    }
    case 2: {
      const a = pickInt(rng, 2, 9);
      const b = pickInt(rng, 2, 8);
      const c = pickInt(rng, 1, 15);
      return { kind: "add", l: { kind: "mul", l: num(a), r: num(b) }, r: num(c) };
    }
    case 3: {
      const b = pickInt(rng, 2, 9);
      const q = pickInt(rng, 2, 9);
      const c = pickInt(rng, 1, 12);
      return { kind: "add", l: { kind: "div", l: num(b * q), r: num(b) }, r: num(c) };
    }
    case 4: {
      const a = pickInt(rng, 5, 20);
      const b = pickInt(rng, 1, 15);
      const c = pickInt(rng, 1, 12);
      return { kind: "sub", l: { kind: "add", l: num(a), r: num(b) }, r: num(c) };
    }
    default: {
      const a = pickInt(rng, 2, 8);
      const b = pickInt(rng, 2, 8);
      const prod = a * b;
      const divisors = [2, 3, 4, 5, 6, 8].filter((d) => prod % d === 0);
      const c = pick(rng, divisors.length > 0 ? divisors : [2]);
      return { kind: "div", l: { kind: "mul", l: num(a), r: num(b) }, r: num(c) };
    }
  }
}

function genParen(rng: () => number): Expr {
  const mode = pickInt(rng, 0, 7);
  switch (mode) {
    case 0: {
      const a = pickInt(rng, 1, 12);
      const b = pickInt(rng, 1, 12);
      return { kind: "mul", l: { kind: "add", l: num(a), r: num(b) }, r: num(pickInt(rng, 2, 6)) };
    }
    case 1: {
      const b = pickInt(rng, 1, 9);
      const a = b + pickInt(rng, 1, 12);
      return { kind: "mul", l: { kind: "sub", l: num(a), r: num(b) }, r: num(pickInt(rng, 2, 6)) };
    }
    case 2: {
      const b = pickInt(rng, 1, 10);
      const c = pickInt(rng, 1, 10);
      const a = b + c + pickInt(rng, 2, 16);
      return { kind: "sub", l: num(a), r: { kind: "add", l: num(b), r: num(c) } };
    }
    case 3: {
      const a = pickInt(rng, 2, 8);
      const b = pickInt(rng, 1, 8);
      const c = pickInt(rng, 1, 8);
      return { kind: "mul", l: num(a), r: { kind: "add", l: num(b), r: num(c) } };
    }
    case 4: {
      const c = pickInt(rng, 2, 8);
      const sum = c * pickInt(rng, 2, 9);
      const a = pickInt(rng, 1, sum - 1);
      return { kind: "div", l: { kind: "add", l: num(a), r: num(sum - a) }, r: num(c) };
    }
    case 5: {
      const c = pickInt(rng, 1, 8);
      const b = c + pickInt(rng, 1, 10);
      return { kind: "sub", l: num(pickInt(rng, 5, 20)), r: { kind: "sub", l: num(b), r: num(c) } };
    }
    case 6: {
      const a = pickInt(rng, 1, 8);
      const b = pickInt(rng, 1, 8);
      const c = pickInt(rng, 2, 5);
      const d = pickInt(rng, 1, 10);
      return {
        kind: "sub",
        l: { kind: "mul", l: { kind: "add", l: num(a), r: num(b) }, r: num(c) },
        r: num(d),
      };
    }
    default: {
      const c = pickInt(rng, 1, 8);
      const b = c + pickInt(rng, 1, 12);
      return { kind: "add", l: num(pickInt(rng, 2, 15)), r: { kind: "sub", l: num(b), r: num(c) } };
    }
  }
}

function genNegative(rng: () => number): Expr {
  if (chance(rng, 0.4)) {
    return { kind: "add", l: { kind: "neg", x: num(pickInt(rng, 1, 12)) }, r: num(pickInt(rng, 1, 16)) };
  }
  if (chance(rng, 0.5)) {
    return { kind: "mul", l: num(pickInt(rng, 2, 8)), r: { kind: "neg", x: num(pickInt(rng, 1, 6)) } };
  }
  return { kind: "sub", l: { kind: "neg", x: num(pickInt(rng, 1, 9)) }, r: num(pickInt(rng, 1, 9)) };
}

function leafTrig(rng: () => number): Expr {
  const deg = pick(rng, TRIG_DEGREES);
  return chance(rng, 0.5) ? { kind: "sin", x: num(deg) } : { kind: "cos", x: num(deg) };
}

function leafRoot(rng: () => number): Expr {
  const roll = rng();
  if (roll < 0.35) {
    return { kind: "pow", b: num(pickInt(rng, 2, 12)), e: num(2) };
  }
  if (roll < 0.65) {
    const r = pickInt(rng, 2, 10);
    return { kind: "sqrt", x: num(r * r) };
  }
  const n = pick(rng, [2, 3, 5] as const);
  const k = pickInt(rng, 1, 4);
  return k === 1 ? { kind: "sqrt", x: num(n) } : { kind: "mul", l: num(k), r: { kind: "sqrt", x: num(n) } };
}

/** 特殊值进场后仍嵌在四则里：2×sin(90°)+3、√16-4、(2+3)×√4 */
function wrapWithArith(rng: () => number, core: Expr): Expr {
  const mode = pickInt(rng, 0, 4);
  const k = pickInt(rng, 2, 6);
  const n = pickInt(rng, 1, 9);
  switch (mode) {
    case 0:
      return { kind: "add", l: { kind: "mul", l: num(k), r: core }, r: num(n) };
    case 1:
      return { kind: "sub", l: { kind: "mul", l: num(k), r: core }, r: num(n) };
    case 2:
      return { kind: "add", l: core, r: { kind: "mul", l: num(k), r: num(pickInt(rng, 2, 6)) } };
    case 3:
      return {
        kind: "mul",
        l: { kind: "add", l: num(pickInt(rng, 1, 6)), r: num(pickInt(rng, 1, 6)) },
        r: core,
      };
    default:
      return {
        kind: "sub",
        l: { kind: "add", l: num(pickInt(rng, 4, 12)), r: num(pickInt(rng, 1, 8)) },
        r: { kind: "mul", l: num(k), r: core },
      };
  }
}

function genTrig(rng: () => number): Expr {
  return wrapWithArith(rng, leafTrig(rng));
}

function genPowerRoot(rng: () => number): Expr {
  return wrapWithArith(rng, leafRoot(rng));
}

function genComplex(rng: () => number): Expr {
  return wrapWithArith(rng, { kind: "i2" });
}

function genMixed(rng: () => number): Expr {
  const roll = rng();
  if (roll < 0.28) return genChain(rng);
  if (roll < 0.52) return genParen(rng);
  if (roll < 0.72) return genTrig(rng);
  if (roll < 0.9) return genPowerRoot(rng);
  return genComplex(rng);
}
