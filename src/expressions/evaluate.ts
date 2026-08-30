import { isFiniteNumber } from "../core/math";
import type { Expr } from "./ast";

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function evaluate(expr: Expr): number {
  switch (expr.kind) {
    case "num":
      return expr.n;
    case "neg":
      return -evaluate(expr.x);
    case "add":
      return evaluate(expr.l) + evaluate(expr.r);
    case "sub":
      return evaluate(expr.l) - evaluate(expr.r);
    case "mul":
      return evaluate(expr.l) * evaluate(expr.r);
    case "div":
      return evaluate(expr.l) / evaluate(expr.r);
    case "pow":
      return evaluate(expr.b) ** evaluate(expr.e);
    case "sqrt":
      return Math.sqrt(evaluate(expr.x));
    case "sin":
      return Math.sin(degToRad(evaluate(expr.x)));
    case "cos":
      return Math.cos(degToRad(evaluate(expr.x)));
    case "i2":
      return -1;
  }
}

export function safeEvaluate(expr: Expr): number | null {
  try {
    const v = evaluate(expr);
    return isFiniteNumber(v) ? v : null;
  } catch {
    return null;
  }
}
