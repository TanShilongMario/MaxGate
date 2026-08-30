import type { ExprTier } from "../expressions/ast";

export interface StageConfig {
  stage: number;
  lanes: 2 | 3 | 4;
  windowMs: number;
  resolveMs: number;
  minGap: number;
  hideChance: number;
  hideAfterRatio: number;
  hideCount: number;
  tiers: { tier: ExprTier; weight: number }[];
}

export type DifficultyMode = "cozy" | "classic" | "rush";

export const DIFFICULTY_MODES: Record<
  DifficultyMode,
  { label: string; description: string; speed: number; gap: number; stageBoost: number }
> = {
  cozy: { label: "轻松", description: "多一点思考时间", speed: 1.12, gap: 1.2, stageBoost: 0 },
  classic: { label: "经典", description: "节奏与计算平衡", speed: 1, gap: 1, stageBoost: 1 },
  rush: { label: "冲刺", description: "难题，但留出计算时间", speed: 1.08, gap: 0.82, stageBoost: 2 },
};

const RESOLVE_MS = 150;
const HIDE_AFTER = 0.38;
const WINDOW_FLOOR = 1400;

interface StageRow {
  lanes: 2 | 3 | 4;
  windowMs: number;
  minGap: number;
  hideChance: number;
  hideCount: number;
  tiers: { tier: ExprTier; weight: number }[];
}

/**
 * 一次只拧一颗螺丝：
 * - 前 140 门只在 2 道上把四则做深：加减 → 乘除 → 两步链 → 括号高原
 * - 加第 3 / 第 4 道时回退题型、拉大间隙、把窗口还回去，再把括号重走一遍
 * - 三角、根号、遮挡都排在四则 + 多道已经站稳之后
 */
const TABLE: StageRow[] = [
  // 1 扫视：50 vs 3
  {
    lanes: 2,
    windowMs: 3000,
    minGap: 28,
    hideChance: 0,
    hideCount: 0,
    tiers: [{ tier: "literal", weight: 100 }],
  },
  // 2 仍是大数，偶尔加减
  {
    lanes: 2,
    windowMs: 2820,
    minGap: 12,
    hideChance: 0,
    hideCount: 0,
    tiers: [
      { tier: "literal", weight: 20 },
      { tier: "add_sub", weight: 80 },
    ],
  },
  // 3 加减进场，间隙仍宽
  {
    lanes: 2,
    windowMs: 2700,
    minGap: 8,
    hideChance: 0,
    hideCount: 0,
    tiers: [
      { tier: "add_sub", weight: 55 },
      { tier: "mul_div", weight: 45 },
    ],
  },
  // 4 纯加减高原
  {
    lanes: 2,
    windowMs: 2600,
    minGap: 6,
    hideChance: 0,
    hideCount: 0,
    tiers: [
      { tier: "mul_div", weight: 50 },
      { tier: "chain", weight: 50 },
    ],
  },
  // 5 乘除进场
  {
    lanes: 2,
    windowMs: 2520,
    minGap: 5,
    hideChance: 0,
    hideCount: 0,
    tiers: [
      { tier: "chain", weight: 70 },
      { tier: "add_sub", weight: 30 },
    ],
  },
  // 6 坐在乘除上
  {
    lanes: 2,
    windowMs: 3400,
    minGap: 6,
    hideChance: 0,
    hideCount: 0,
    tiers: [
      { tier: "mul_div", weight: 75 },
      { tier: "add_sub", weight: 25 },
    ],
  },
  // 7 两步四则：3×2-4
  {
    lanes: 2,
    windowMs: 3300,
    minGap: 5,
    hideChance: 0,
    hideCount: 0,
    tiers: [
      { tier: "chain", weight: 65 },
      { tier: "mul_div", weight: 35 },
    ],
  },
  // 8 两步链高原，先不给括号
  {
    lanes: 2,
    windowMs: 3200,
    minGap: 4,
    hideChance: 0,
    hideCount: 0,
    tiers: [
      { tier: "chain", weight: 90 },
      { tier: "mul_div", weight: 10 },
    ],
  },
  // 9 继续两步链
  {
    lanes: 2,
    windowMs: 3150,
    minGap: 4,
    hideChance: 0,
    hideCount: 0,
    tiers: [{ tier: "chain", weight: 100 }],
  },
  // 10 括号进场
  {
    lanes: 2,
    windowMs: 3100,
    minGap: 4,
    hideChance: 0,
    hideCount: 0,
    tiers: [
      { tier: "paren", weight: 65 },
      { tier: "chain", weight: 35 },
    ],
  },
  // 11 括号为主
  {
    lanes: 2,
    windowMs: 3050,
    minGap: 3.5,
    hideChance: 0,
    hideCount: 0,
    tiers: [
      { tier: "paren", weight: 85 },
      { tier: "chain", weight: 15 },
    ],
  },
  // 12 括号高原
  {
    lanes: 2,
    windowMs: 3000,
    minGap: 3.5,
    hideChance: 0,
    hideCount: 0,
    tiers: [{ tier: "paren", weight: 100 }],
  },
  // 13 括号 + 两步混打
  {
    lanes: 2,
    windowMs: 2950,
    minGap: 3.5,
    hideChance: 0,
    hideCount: 0,
    tiers: [
      { tier: "paren", weight: 70 },
      { tier: "chain", weight: 30 },
    ],
  },
  // 14 2 道四则收束
  {
    lanes: 2,
    windowMs: 2900,
    minGap: 3,
    hideChance: 0,
    hideCount: 0,
    tiers: [
      { tier: "paren", weight: 55 },
      { tier: "chain", weight: 45 },
    ],
  },
  // 15 新通道：旧题 + 还时间 + 大间隙
  {
    lanes: 3,
    windowMs: 3600,
    minGap: 12,
    hideChance: 0,
    hideCount: 0,
    tiers: [
      { tier: "literal", weight: 55 },
      { tier: "add_sub", weight: 45 },
    ],
  },
  // 16 3 道上重走加减乘除
  {
    lanes: 3,
    windowMs: 3400,
    minGap: 7,
    hideChance: 0,
    hideCount: 0,
    tiers: [
      { tier: "add_sub", weight: 40 },
      { tier: "mul_div", weight: 40 },
      { tier: "chain", weight: 20 },
    ],
  },
  // 17 3 道两步链
  {
    lanes: 3,
    windowMs: 3250,
    minGap: 5,
    hideChance: 0,
    hideCount: 0,
    tiers: [
      { tier: "chain", weight: 80 },
      { tier: "mul_div", weight: 20 },
    ],
  },
  // 18 3 道括号进场
  {
    lanes: 3,
    windowMs: 3150,
    minGap: 4,
    hideChance: 0,
    hideCount: 0,
    tiers: [
      { tier: "paren", weight: 70 },
      { tier: "chain", weight: 30 },
    ],
  },
  // 19 3 道括号高原
  {
    lanes: 3,
    windowMs: 3050,
    minGap: 3.5,
    hideChance: 0,
    hideCount: 0,
    tiers: [
      { tier: "paren", weight: 80 },
      { tier: "chain", weight: 20 },
    ],
  },
  // 20 3 道负数
  {
    lanes: 3,
    windowMs: 3000,
    minGap: 3.5,
    hideChance: 0,
    hideCount: 0,
    tiers: [
      { tier: "negative", weight: 40 },
      { tier: "paren", weight: 35 },
      { tier: "chain", weight: 25 },
    ],
  },
  // 21 第 4 道：再回退、再还时间
  {
    lanes: 4,
    windowMs: 3500,
    minGap: 8,
    hideChance: 0,
    hideCount: 0,
    tiers: [
      { tier: "chain", weight: 45 },
      { tier: "add_sub", weight: 30 },
      { tier: "literal", weight: 25 },
    ],
  },
  // 22 四道两步链
  {
    lanes: 4,
    windowMs: 3250,
    minGap: 5,
    hideChance: 0,
    hideCount: 0,
    tiers: [
      { tier: "chain", weight: 75 },
      { tier: "add_sub", weight: 25 },
    ],
  },
  // 23 四道括号
  {
    lanes: 4,
    windowMs: 3150,
    minGap: 4,
    hideChance: 0,
    hideCount: 0,
    tiers: [
      { tier: "paren", weight: 75 },
      { tier: "chain", weight: 25 },
    ],
  },
  // 24 四道四则混打
  {
    lanes: 4,
    windowMs: 3000,
    minGap: 3.5,
    hideChance: 0,
    hideCount: 0,
    tiers: [
      { tier: "paren", weight: 45 },
      { tier: "chain", weight: 35 },
      { tier: "negative", weight: 20 },
    ],
  },
  // 25 三角第一次
  {
    lanes: 4,
    windowMs: 2900,
    minGap: 3,
    hideChance: 0,
    hideCount: 0,
    tiers: [
      { tier: "paren", weight: 30 },
      { tier: "chain", weight: 25 },
      { tier: "trig", weight: 25 },
      { tier: "negative", weight: 20 },
    ],
  },
  // 26 乘方根号
  {
    lanes: 4,
    windowMs: 2700,
    minGap: 2.5,
    hideChance: 0,
    hideCount: 0,
    tiers: [
      { tier: "trig", weight: 25 },
      { tier: "power_root", weight: 25 },
      { tier: "paren", weight: 30 },
      { tier: "chain", weight: 20 },
    ],
  },
  // 27 记忆遮挡
  {
    lanes: 4,
    windowMs: 2550,
    minGap: 2.2,
    hideChance: 0.1,
    hideCount: 1,
    tiers: [
      { tier: "mixed", weight: 35 },
      { tier: "paren", weight: 25 },
      { tier: "chain", weight: 15 },
      { tier: "power_root", weight: 15 },
      { tier: "trig", weight: 10 },
    ],
  },
  // 28 无限段前
  {
    lanes: 4,
    windowMs: 2400,
    minGap: 2,
    hideChance: 0.16,
    hideCount: 1,
    tiers: [
      { tier: "mixed", weight: 40 },
      { tier: "paren", weight: 25 },
      { tier: "chain", weight: 15 },
      { tier: "power_root", weight: 10 },
      { tier: "complex", weight: 10 },
    ],
  },
];

export function stageFromDoors(doorsPassed: number): number {
  const doors = Math.max(0, doorsPassed);
  if (doors < 5) return 1;
  return Math.floor((doors - 5) / 10) + 2;
}

export function getStageConfig(
  doorsPassed: number,
  mode: DifficultyMode = "classic",
): StageConfig {
  const baseStage = stageFromDoors(doorsPassed);
  const tuning = DIFFICULTY_MODES[mode];
  const stage = doorsPassed < 5 ? 1 : baseStage + tuning.stageBoost;
  let config: StageConfig;
  if (stage <= TABLE.length) {
    config = toConfig(stage, TABLE[stage - 1]!);
  } else {
    const extra = stage - TABLE.length;
    const last = TABLE[TABLE.length - 1]!;
    config = toConfig(stage, {
      ...last,
      windowMs: Math.max(WINDOW_FLOOR, last.windowMs - extra * 50),
      minGap: Math.max(0.8, 2 - extra * 0.08),
      hideChance: Math.min(0.32, last.hideChance + extra * 0.015),
      hideCount: extra >= 3 ? 2 : 1,
      tiers: [
        { tier: "mixed", weight: 40 },
        { tier: "paren", weight: 25 },
        { tier: "chain", weight: 15 },
        { tier: "power_root", weight: 10 },
        { tier: "complex", weight: 10 },
      ],
    });
  }
  const lanes: 2 | 3 | 4 = mode === "rush" && config.lanes === 2 ? 3 : config.lanes;
  return {
    ...config,
    lanes,
    windowMs: Math.max(WINDOW_FLOOR, Math.round(config.windowMs * tuning.speed)),
    minGap: Math.max(0.8, config.minGap * tuning.gap),
  };
}

function toConfig(stage: number, row: StageRow): StageConfig {
  return {
    stage,
    lanes: row.lanes,
    windowMs: row.windowMs,
    resolveMs: RESOLVE_MS,
    minGap: row.minGap,
    hideChance: row.hideChance,
    hideAfterRatio: HIDE_AFTER,
    hideCount: row.hideCount,
    tiers: row.tiers,
  };
}
