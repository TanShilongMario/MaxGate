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

const ranking = new LocalRankingAdapter();
const game = new Game(ranking);
const input = new InputManager();
const renderer: IRenderer = new ThreeRenderer();
const ui = bindScreens(game, ranking);

renderer.mount(canvas);
input.attach(document.getElementById("app") ?? document.body);

function layout(): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.resize(window.innerWidth, window.innerHeight, dpr);
}

window.addEventListener("resize", layout);
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
