export type ExprTier =
  | "literal"
  | "add_sub"
  | "mul_div"
  | "chain"
  | "paren"
  | "negative"
  | "trig"
  | "power_root"
  | "mixed"
  | "complex";

export type Expr =
  | { kind: "num"; n: number }
  | { kind: "neg"; x: Expr }
  | { kind: "add"; l: Expr; r: Expr }
  | { kind: "sub"; l: Expr; r: Expr }
  | { kind: "mul"; l: Expr; r: Expr }
  | { kind: "div"; l: Expr; r: Expr }
  | { kind: "pow"; b: Expr; e: Expr }
  | { kind: "sqrt"; x: Expr }
  | { kind: "sin"; x: Expr }
  | { kind: "cos"; x: Expr }
  | { kind: "i2" };

export const TRIG_DEGREES = [0, 30, 45, 60, 90, 180] as const;
