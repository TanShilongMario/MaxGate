import type { FrameSnapshot, IRenderer } from "./types";

/**
 * Three.js 渲染后端占位。
 * 接入步骤见 docs/ARCHITECTURE.md §8：
 * 1. npm i three
 * 2. 用同一 IRenderer 画透视场景
 * 3. 在 main.ts 把 CanvasRenderer 换成本类
 * 不要在 Three 的 rAF 里推进 Game.update。
 */
export class ThreeRenderer implements IRenderer {
  mount(_canvas: HTMLCanvasElement): void {
    throw new Error("ThreeRenderer 尚未实现。v0.1 请使用 CanvasRenderer。");
  }

  resize(_cssWidth: number, _cssHeight: number, _dpr: number): void {}

  render(_snapshot: FrameSnapshot): void {}

  dispose(): void {}
}
