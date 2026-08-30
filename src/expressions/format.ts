import type { Expr } from "./ast";

function parenIf(need: boolean, s: string): string {
  return need ? `(${s})` : s;
}

function prec(expr: Expr): number {
  switch (expr.kind) {
    case "num":
    case "i2":
    case "sqrt":
    case "sin":
    case "cos":
      return 4;
    case "neg":
      return 3;
    case "pow":
      return 3;
    case "mul":
    case "div":
      return 2;
    case "add":
    case "sub":
      return 1;
  }
}

function isNegativeNum(expr: Expr): boolean {
  return expr.kind === "num" && expr.n < 0;
}

export function format(expr: Expr): string {
  return formatInner(expr, 0);
}

function formatInner(expr: Expr, parentPrec: number): string {
  switch (expr.kind) {
    case "num": {
      if (Number.isInteger(expr.n)) return String(expr.n);
      return trimFloat(expr.n);
    }
    case "i2":
      return "i²";
    case "neg": {
      const inner = formatInner(expr.x, 3);
      const wrapped = expr.x.kind === "num" || expr.x.kind === "i2" ? inner : `(${inner})`;
      return parenIf(parentPrec >= 2, `-${wrapped}`);
    }
    case "add":
      return parenIf(
        parentPrec > 1,
        `${formatInner(expr.l, 1)}+${formatInner(expr.r, 1)}`,
      );
    case "sub":
      return parenIf(
        parentPrec > 1,
        `${formatInner(expr.l, 1)}-${formatInner(expr.r, 2)}`,
      );
    case "mul": {
      if (canJuxtapose(expr.l, expr.r)) {
        return parenIf(parentPrec > 2, `${formatInner(expr.l, 2)}${formatInner(expr.r, 2)}`);
      }
      return parenIf(
        parentPrec > 2,
        `${formatInner(expr.l, 2)}×${formatInner(expr.r, 2)}`,
      );
    }
    case "div":
      return parenIf(
        parentPrec > 2,
        `${formatInner(expr.l, 2)}÷${formatInner(expr.r, 3)}`,
      );
    case "pow": {
      const exp = expr.e.kind === "num" && expr.e.n === 2 ? "²" : `^${formatInner(expr.e, 3)}`;
      const base = prec(expr.b) < 4 || isNegativeNum(expr.b) ? `(${format(expr.b)})` : format(expr.b);
      return parenIf(parentPrec > 3, `${base}${exp}`);
    }
    case "sqrt":
      return `√${parenIf(prec(expr.x) < 4, format(expr.x))}`;
    case "sin":
      return `sin(${format(expr.x)}°)`;
    case "cos":
      return `cos(${format(expr.x)}°)`;
  }
}

function canJuxtapose(l: Expr, r: Expr): boolean {
  const leftOk = l.kind === "num" && l.n > 0 && Number.isInteger(l.n);
  const rightOk = r.kind === "sqrt";
  return leftOk && rightOk;
}

function trimFloat(n: number): string {
  const s = n.toFixed(4).replace(/\.?0+$/, "");
  return s;
}
