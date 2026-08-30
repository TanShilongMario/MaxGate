# 数字大冒险 MaxGate · 架构说明

本文描述模块边界、数据流和扩展点。产品规则以 [PRD.md](./PRD.md) 为准；曲线数值以 [DIFFICULTY.md](./DIFFICULTY.md) 为准。

---

## 1. 原则

1. **玩法与像素分离。** `Game` 只推进逻辑状态；画面实现 `IRenderer`。换 Three.js 不改生命、分数、求值。
2. **题目是纯函数。** 给定 `seed + doorIndex + stage`，生成与求值可单测、可复盘。
3. **排名可替换存储。** 内核依赖 `RankingAdapter`，默认本地缓存。
4. **禁止 `eval`。** 表达式是 AST，展示层只负责排版。
5. **逻辑与 3D 分离。** Three.js 是默认渲染后端，但不是规则引擎核心；Canvas 仍可作为降级后端。

---

## 2. 总览

```text
                    ┌─────────────┐
   键盘 / 滑动 ───► │ InputManager│
                    └──────┬──────┘
                           │ LaneIntent (-1 / +1)
                           ▼
┌──────────┐  tick   ┌────────────┐  snapshot  ┌─────────────┐
│  rAF 循环 ├────────►│    Game    ├───────────►│  IRenderer  │
└──────────┘         │  状态机    │            │ Canvas / 3D │
                     └─────┬──────┘            └─────────────┘
                           │
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
    ExpressionEngine  DifficultyTable  RankingAdapter
     生成 / 求值        段位配置        Local → (Future Remote)
```

`Game` 是唯一可变局内状态的地方。生成器、曲线、排名适配器都无 UI 依赖。

---

## 3. 分层

| 层 | 目录 | 可以依赖 | 不可以 |
| --- | --- | --- | --- |
| 核心工具 | `src/core` | 无 | DOM、渲染 |
| 表达式 | `src/expressions` | `core` | 游戏状态、DOM |
| 难度 | `src/difficulty` | `core`、表达式的 *tier 枚举* | 渲染 |
| 排名 | `src/ranking` | 无（或 `core` 的 id） | 游戏循环内部字段乱写 |
| 输入 | `src/input` | DOM | 游戏规则 |
| 渲染 | `src/render` | 快照类型 | 改分数/生命 |
| 局内 | `src/game` | 以上除具体 Canvas 细节 | 具体画线 API |
| UI 壳 | `src/ui` `main.ts` | 全部装配 | 把规则写进按钮回调 |

---

## 4. 状态机

```text
menu ──start──► playing ──life=0──► gameover ──home──► menu
                  │                    │
                  │                    └──retry──► playing
                  └──(每扇门) resolving（短反馈）──► playing
```

| 状态 | 输入 | 时间 |
| --- | --- | --- |
| `menu` | 只响应 UI 按钮 | 不推进门 |
| `playing` | 换道；推进门的 `t ∈ [0,1]` | `t` 到 1 进入判定 |
| `resolving` | 锁换道或仍允许（本版锁） | 短闪反馈，门匀速穿过镜头后生成下一组 |
| `gameover` | UI | 写排名一次，防重复提交 |

`FrameSnapshot` 是渲染唯一输入，字段应保持可序列化，便于以后录像或测试。

```ts
interface FrameSnapshot {
  phase: "menu" | "playing" | "resolving" | "gameover";
  lanes: number;
  playerLane: number;
  playerDisplayX: number; // 0..1 插值，仅视觉
  door: {
    approach: number;     // 0 远 → 1 近
    labels: string[];
    hidden: boolean[];
    correctLane: number;  // resolving 才需要高亮；playing 可不告诉渲染器
  } | null;
  resolve: null | { correct: boolean; chosen: number; answer: number };
  hud: { lives: number; score: number; doorsPassed: number; stage: number };
}
```

对局中**不要**把 `correctLane` 画出来，除非以后做「窥视」道具。

---

## 5. 表达式引擎

### 5.1 AST

```ts
type Expr =
  | { kind: "num"; n: number }
  | { kind: "neg"; x: Expr }
  | { kind: "add" | "sub" | "mul" | "div"; l: Expr; r: Expr }
  | { kind: "pow"; b: Expr; e: Expr }
  | { kind: "sqrt"; x: Expr }
  | { kind: "sin" | "cos"; x: Expr }      // x 为角度（度）
  | { kind: "i2" };                       // 值 = -1，后续题型
```

求值规则：

- 四则与乘方按 JS 数字，生成器避免除零与无意义根号。
- 三角：`sin/cos(θ°)` = `Math.sin/cos(θ * π/180)`，只生成 0/30/45/60/90/180。
- `i²` 映射为实数 `-1`，再与其他实数比。不引入复平面排序。

展示（`format`）与求值分离。`2 * √2` 显示为 `2√2`。

### 5.2 生成

```text
generateGate(rng, spec) → { exprs, values, correctLane }
```

`spec` 来自当前段位：泳道数、允许的 tier、最小间隙、最大尝试次数。题型含 `chain`（两步四则，如 `3×2-4`）。`trig` / `power_root` / `complex` 生成时会套上四则（`2×sin(90°)+3`），不单独出特殊值。曲线一次只推进一道压力轴，见难度文档。

算法：

1. 按权重抽 tier，递归或模板生成 `lanes` 个 AST；
2. 求值；过滤 NaN / Infinity；
3. 检查唯一最大，且 `max - secondMax >= minGap`；
4. 失败则重试；耗尽则回退到「字面量整数 + 强制间隙」（玩家仍看到合法题，只是该次更简单）。

不要先随机再祈祷能比。回退保证**永不死局**。

### 5.3 与种子的关系

```text
rng = mulberry32(hash(seed, doorIndex))
```

同一 `seed` 重跑，门序列一致。换种子换题。

---

## 6. 难度模块

`getStageConfig(doorsPassed) → StageConfig`

```ts
interface StageConfig {
  stage: number;          // 1-based
  lanes: 2 | 3 | 4;
  windowMs: number;
  resolveMs: number;
  minGap: number;
  hideChance: number;     // 0..1，是否对部分门施加记忆遮挡
  hideAfterRatio: number; // 窗口进度超过后遮挡
  tiers: { tier: ExprTier; weight: number }[];
}
```

`Game` 在生成下一门组时问一次配置，不在渲染里算难度。调参只改 `src/difficulty/curve.ts`。

---

## 7. 输入

`InputManager` 把事件收成意图队列：

```ts
type Intent = { type: "lane"; delta: -1 | 1 } | { type: "pause" };
```

- 键盘：keydown（忽略长按系统重复可按项目口味处理；本版接受 repeat，手感更快）。
- 触控：记录 `touchstart` 坐标，`touchend` 时若 `|dx| > 阈值` 且 `|dx| > |dy|`，发一次换道。
- 对局中 `preventDefault` 水平滑动，减少浏览器回退手势冲突（能防则防）。

`Game.applyIntent` 只改 `playerLane`，夹紧到 `[0, lanes)`。

---

## 8. 渲染：2D 与 Three.js

```ts
interface IRenderer {
  mount(canvas: HTMLCanvasElement): void;
  resize(cssWidth: number, cssHeight: number, dpr: number): void;
  render(snapshot: FrameSnapshot): void;
  dispose(): void;
}
```

| 实现 | 何时用 |
| --- | --- |
| `ThreeRenderer` | 默认。积木世界、连续道路、对象池车道线/树木、无顶梁透明门与进度天空 |
| `CanvasRenderer` | 备用。透视梯形跑道 + 门板 + 角色剪影 |

装配点只在 `main.ts`：

```ts
const renderer: IRenderer = new ThreeRenderer();
```

Three.js 实现约定：

1. 依赖 `three`，实现同一接口；
2. 世界坐标系：Z 向前，X 为泳道，门沿 Z 逼近；
3. 公式用 CanvasTexture，只绘制字形，不在门上叠加额外圆角底板；
4. 玩法 `approach` 仍由逻辑时间驱动，Three 只做插值显示。
5. 道路底板连续铺设，车道线和树木在镜头后方回收并重置到雾中；山与云只做低速视差，不向玩家高速逼近；
6. 天空时段绑定通过门数：全程保留太阳，黄昏仅在很靠后的关卡出现，不进入黑夜。

**不要**在 Three 的 `requestAnimationFrame` 里推进游戏时间。时间源只有一个：主循环。

---

## 9. 排名适配器

```ts
interface RunRecord {
  id: string;
  playerId: string;
  score: number;
  doorsPassed: number;
  maxStage: number;
  seed: string;
  endedAt: number;       // epoch ms
  clientVersion: string;
}

interface RankingAdapter {
  getPlayer(): Promise<{ playerId: string; nickname?: string }>;
  list(): Promise<RunRecord[]>;
  submit(record: Omit<RunRecord, "id" | "playerId"> & { id?: string }): Promise<RunRecord>;
}
```

### 9.1 Local

- key: `maxgate.ranking.v1`
- value: `{ version: 1, playerId, nickname?, records: RunRecord[] }`
- `submit` 生成 id，unshift/push 后按分数排序截断。

### 9.2 Remote（预留，不实现）

```text
POST /api/v1/runs    body: RunRecord
GET  /api/v1/runs/me
GET  /api/v1/leaderboard?period=weekly
```

`CompositeAdapter` 以后可以：先写本地，再尽力同步远端。游戏结束流程不变。

规则版本 `clientVersion` 必须写入纪录，避免以后改曲线后旧分与新榜混读而不自知。

---

## 10. 主循环

```text
last = performance.now()
function frame(now):
  dt = min(now - last, 50)      // 后台回来不一次跳好几门
  last = now
  game.update(dt, input.drain())
  renderer.render(game.snapshot())
  ui.sync(game.snapshot())      // HUD / overlay 显隐
  raf(frame)
```

`dt` 上限防止切后台后瞬间判定多组门。

---

## 11. 目录

```text
src/
  main.ts
  style.css
  core/rng.ts
  expressions/{ast,eval,format,generate}.ts
  difficulty/curve.ts
  ranking/{types,localAdapter,index}.ts
  input/InputManager.ts
  render/{types,CanvasRenderer}.ts
  game/{types,Game}.ts
  ui/screens.ts
  expressions/*.test.ts
  difficulty/*.test.ts
```

---

## 12. 测试策略

| 层级 | 测什么 |
| --- | --- |
| 单元 | 求值：`3+2`、`27-18`、`2√2` vs `3`、`i²` vs `-2` |
| 单元 | `generateGate` 不变量：有限次内给出唯一最大 |
| 单元 | `getStageConfig`：0 门为 2 道简单题；足够门数后 4 道 |
| 手工 | 键盘、滑动、竖屏刘海、刷新后纪录 |

v0.1 不做 E2E。核心正确性靠求值测试兜住。

---

## 13. 扩展点一览

| 需求 | 改哪里 |
| --- | --- |
| 新题型 | AST + eval + format + generate 模板 + 曲线权重 |
| 肉鸽 | `playing` 每 N 门插入 `roguelike` 状态；修饰器改 `StageConfig` |
| 加命 | 生成器产一种 `bonus` 门或修饰器 `lives += 1` |
| Three.js | 新 `IRenderer`，`main.ts` 切换 |
| 在线榜 | `RemoteRankingAdapter` + 装配 |
| 连击分 | `Game` 结算处，不改生成器 |

---

## 14. 部署

静态站点：`npm run build` 后的 `dist/`。无 API、无环境变量也能玩。以后上榜再加 `VITE_API_BASE`。
