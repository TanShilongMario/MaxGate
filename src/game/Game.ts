import { createDoorRng, chance, newSeed, pickInt } from "../core/rng";
import { getStageConfig, type StageConfig } from "../difficulty/curve";
import { generateGate, type GeneratedGate } from "../expressions/generate";
import type { LaneIntent } from "../input/InputManager";
import { CLIENT_VERSION, type RankingAdapter, type RunRecord } from "../ranking";
import type { FrameSnapshot, GamePhase } from "../render/types";

interface ActiveDoor {
  gate: GeneratedGate;
  hidden: boolean[];
  hideArmed: boolean;
  hideAfter: number;
  approach: number;
  windowMs: number;
  holdMs: number;
}

export class Game {
  phase: GamePhase = "menu";
  lives = 3;
  score = 0;
  doorsPassed = 0;
  maxStage = 1;
  seed = "";
  playerLane = 0;
  displayX = 0;
  lastRecord: RunRecord | null = null;

  private door: ActiveDoor | null = null;
  private resolve:
    | { correct: boolean; chosen: number; answer: number; remain: number }
    | null = null;
  private config: StageConfig = getStageConfig(0);
  private submitted = false;
  private pendingHideCount = 0;
  private pendingHideRng: () => number = () => 0;

  constructor(private ranking: RankingAdapter) {}

  start(): void {
    this.phase = "playing";
    this.lives = 3;
    this.score = 0;
    this.doorsPassed = 0;
    this.maxStage = 1;
    this.seed = newSeed();
    this.lastRecord = null;
    this.submitted = false;
    this.resolve = null;
    this.spawnDoor();
    this.playerLane = Math.floor((this.config.lanes - 1) / 2);
    this.displayX = this.laneToX(this.playerLane);
  }

  applyIntents(intents: LaneIntent[]): void {
    if (this.phase !== "playing") return;
    for (const intent of intents) {
      this.playerLane = clamp(this.playerLane + intent.delta, 0, this.config.lanes - 1);
    }
  }

  update(dt: number): void {
    const target = this.laneToX(this.playerLane);
    this.displayX += (target - this.displayX) * Math.min(1, dt / 70);

    if (this.phase === "resolving" && this.resolve) {
      this.resolve.remain -= dt;
      if (this.resolve.remain <= 0) {
        this.resolve = null;
        if (this.lives <= 0) {
          this.phase = "gameover";
          void this.persist();
        } else {
          this.phase = "playing";
          this.spawnDoor();
        }
      }
      return;
    }

    if (this.phase !== "playing" || !this.door) return;

    if (this.door.holdMs > 0) {
      this.door.holdMs -= dt;
      return;
    }

    this.door.approach = Math.min(1, this.door.approach + dt / this.door.windowMs);
    if (
      this.door.hideArmed &&
      this.door.approach >= this.door.hideAfter &&
      this.door.hidden.every((h) => !h)
    ) {
      this.applyHide();
    }
    if (this.door.approach >= 1) {
      this.judge();
    }
  }

  snapshot(): FrameSnapshot {
    return {
      phase: this.phase,
      lanes: this.config.lanes,
      playerLane: this.playerLane,
      playerDisplayX: this.displayX,
      door: this.door
        ? {
            approach: this.door.approach,
            labels: this.door.gate.labels,
            hidden: this.door.hidden,
            correctLane: this.phase === "resolving" ? this.door.gate.correctLane : null,
          }
        : null,
      resolve: this.resolve
        ? {
            correct: this.resolve.correct,
            chosen: this.resolve.chosen,
            answer: this.resolve.answer,
          }
        : null,
      hud: {
        lives: this.lives,
        score: this.score,
        doorsPassed: this.doorsPassed,
        stage: this.config.stage,
      },
    };
  }

  private spawnDoor(): void {
    this.config = getStageConfig(this.doorsPassed);
    this.maxStage = Math.max(this.maxStage, this.config.stage);
    this.playerLane = clamp(this.playerLane, 0, this.config.lanes - 1);
    const rng = createDoorRng(this.seed, this.doorsPassed);
    const gate = generateGate(rng, {
      lanes: this.config.lanes,
      minGap: this.config.minGap,
      tiers: this.config.tiers,
    });
    const hideArmed = this.config.hideChance > 0 && chance(rng, this.config.hideChance);
    this.door = {
      gate,
      hidden: gate.labels.map(() => false),
      hideArmed,
      hideAfter: this.config.hideAfterRatio,
      approach: 0,
      windowMs: this.config.windowMs,
      holdMs: this.doorsPassed === 0 ? 900 : 180,
    };
    if (hideArmed) {
      this.pendingHideCount = Math.min(this.config.hideCount, this.config.lanes);
      this.pendingHideRng = rng;
    } else {
      this.pendingHideCount = 0;
      this.pendingHideRng = rng;
    }
  }

  private applyHide(): void {
    if (!this.door) return;
    const count = this.pendingHideCount;
    const used = new Set<number>();
    while (used.size < count) {
      used.add(pickInt(this.pendingHideRng, 0, this.door.gate.labels.length - 1));
    }
    this.door.hidden = this.door.hidden.map((_, i) => used.has(i));
  }

  private judge(): void {
    if (!this.door) return;
    const chosen = this.playerLane;
    const correct = chosen === this.door.gate.correctLane;
    if (correct) {
      this.score += 10;
      this.doorsPassed += 1;
    } else {
      this.lives -= 1;
    }
    this.phase = "resolving";
    this.resolve = {
      correct,
      chosen,
      answer: this.door.gate.correctLane,
      remain: this.config.resolveMs,
    };
  }

  private async persist(): Promise<void> {
    if (this.submitted) return;
    this.submitted = true;
    this.lastRecord = await this.ranking.submit({
      score: this.score,
      doorsPassed: this.doorsPassed,
      maxStage: this.maxStage,
      seed: this.seed,
      endedAt: Date.now(),
      clientVersion: CLIENT_VERSION,
    });
  }

  private laneToX(lane: number): number {
    return lane / (this.config.lanes - 1);
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
