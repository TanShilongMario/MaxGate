export const EPS = 1e-9;

export function nearlyEqual(a: number, b: number, eps = EPS): boolean {
  return Math.abs(a - b) < eps;
}

export function isFiniteNumber(n: number): boolean {
  return Number.isFinite(n);
}

export function uniqueMaxIndex(values: number[], minGap: number): number | null {
  if (values.length === 0) return null;
  let max = -Infinity;
  let maxIndex = -1;
  let second = -Infinity;
  for (let i = 0; i < values.length; i++) {
    const v = values[i]!;
    if (v > max) {
      second = max;
      max = v;
      maxIndex = i;
    } else if (v > second) {
      second = v;
    }
  }
  if (maxIndex < 0) return null;
  const distinct = values.filter((v) => nearlyEqual(v, max)).length;
  if (distinct !== 1) return null;
  if (max - second < minGap - EPS) return null;
  return maxIndex;
}
