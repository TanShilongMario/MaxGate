export type GamePhase = "menu" | "playing" | "resolving" | "gameover";

export interface DoorSnapshot {
  approach: number;
  labels: string[];
  hidden: boolean[];
  correctLane: number | null;
}

export interface ResolveSnapshot {
  correct: boolean;
  chosen: number;
  answer: number;
}

export interface HudSnapshot {
  lives: number;
  score: number;
  doorsPassed: number;
  stage: number;
  difficulty: "cozy" | "classic" | "rush";
}

export interface FrameSnapshot {
  phase: GamePhase;
  lanes: number;
  playerLane: number;
  playerDisplayX: number;
  door: DoorSnapshot | null;
  resolve: ResolveSnapshot | null;
  hud: HudSnapshot;
}

export interface IRenderer {
  mount(canvas: HTMLCanvasElement): void;
  resize(cssWidth: number, cssHeight: number, dpr: number): void;
  render(snapshot: FrameSnapshot): void;
  dispose(): void;
}
