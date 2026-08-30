import { Game } from "./game/Game";
import { InputManager } from "./input/InputManager";
import { LocalRankingAdapter } from "./ranking";
import { ThreeRenderer } from "./render/ThreeRenderer";
import type { IRenderer } from "./render/types";
import { bindScreens } from "./ui/screens";

const canvas = document.getElementById("game-canvas");
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error("canvas missing");
}
const appNode = document.getElementById("app");
if (!(appNode instanceof HTMLElement)) {
  throw new Error("app missing");
}
const app: HTMLElement = appNode;

const ranking = new LocalRankingAdapter();
const game = new Game(ranking);
const input = new InputManager();
const renderer: IRenderer = new ThreeRenderer();
const ui = bindScreens(game, ranking);

renderer.mount(canvas);
input.attach(app);

function layout(): void {
  const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
  document.documentElement.style.setProperty("--app-height", `${Math.ceil(viewportHeight)}px`);
  const bounds = app.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.resize(Math.max(1, bounds.width), Math.max(1, bounds.height), dpr);
}

window.addEventListener("resize", layout);
window.addEventListener("orientationchange", layout);
window.visualViewport?.addEventListener("resize", layout);
const appResizeObserver = new ResizeObserver(layout);
appResizeObserver.observe(app);
layout();

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(now - last, 50);
  last = now;
  game.applyIntents(input.drain());
  game.update(dt);
  const snap = game.snapshot();
  renderer.render(snap);
  ui.sync(snap);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
