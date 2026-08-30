import type { Game } from "../game/Game";
import type { RankingAdapter, RunRecord } from "../ranking";
import type { FrameSnapshot } from "../render/types";
import {
  DIFFICULTY_MODES,
  type DifficultyMode,
} from "../difficulty/curve";

export function bindScreens(game: Game, ranking: RankingAdapter): {
  sync: (snap: FrameSnapshot) => void;
} {
  const overlay = el("overlay");
  const hud = el("hud");
  const menu = el("screen-menu");
  const rankingScreen = el("screen-ranking");
  const over = el("screen-over");
  let selectedDifficulty: DifficultyMode = "classic";
  let previousScore = 0;

  for (const option of document.querySelectorAll<HTMLButtonElement>(".difficulty-option")) {
    option.addEventListener("click", () => {
      selectedDifficulty = option.dataset.difficulty as DifficultyMode;
      for (const peer of document.querySelectorAll(".difficulty-option")) {
        peer.classList.toggle("selected", peer === option);
      }
    });
  }

  el("btn-start").addEventListener("click", () => {
    game.start(selectedDifficulty);
    show(overlay, false);
  });
  el("btn-ranking").addEventListener("click", () => void openRanking());
  el("btn-retry").addEventListener("click", () => {
    game.start(game.difficulty);
    show(overlay, false);
  });
  el("btn-home").addEventListener("click", () => {
    hideAll();
    overlay.classList.remove("hidden");
    menu.classList.remove("hidden");
  });
  el("btn-over-ranking").addEventListener("click", () => void openRanking(true));

  async function openRanking(fromOver = false): Promise<void> {
    hideAll();
    overlay.classList.remove("hidden");
    rankingScreen.classList.remove("hidden");
    const records = await ranking.list();
    renderRanking(records);
    rankingScreen.dataset.from = fromOver ? "over" : "menu";
  }

  el("btn-ranking-back").addEventListener("click", () => {
    hideAll();
    overlay.classList.remove("hidden");
    if (rankingScreen.dataset.from === "over") {
      over.classList.remove("hidden");
    } else {
      menu.classList.remove("hidden");
    }
  });

  function sync(snap: FrameSnapshot): void {
    const inPlay = snap.phase === "playing" || snap.phase === "resolving";
    hud.classList.toggle("hidden", !inPlay);
    if (inPlay) {
      const scoreNode = el("score");
      scoreNode.textContent = String(snap.hud.score);
      if (snap.hud.score > previousScore) {
        scoreNode.animate(
          [
            { transform: "scale(1)", color: "#6f4d31" },
            { transform: "scale(1.18)", color: "#159b89", offset: 0.45 },
            { transform: "scale(1)", color: "#6f4d31" },
          ],
          { duration: 180, easing: "cubic-bezier(0.23, 1, 0.32, 1)" },
        );
      }
      previousScore = snap.hud.score;
      el("doors").textContent = `${snap.hud.doorsPassed} 扇门`;
      el("stage").textContent = `第 ${snap.hud.stage} 段`;
      el("difficulty-badge").textContent = DIFFICULTY_MODES[snap.hud.difficulty].label;
      el("lives").textContent = "❤".repeat(snap.hud.lives) + "♡".repeat(Math.max(0, 3 - snap.hud.lives));
    }

    if (snap.phase === "gameover") {
      const browsingRank = !rankingScreen.classList.contains("hidden");
      if (!browsingRank) {
        overlay.classList.remove("hidden");
        menu.classList.add("hidden");
        rankingScreen.classList.add("hidden");
        over.classList.remove("hidden");
      }
      if (!over.classList.contains("hidden")) {
        const rec = game.lastRecord;
        el("over-summary").textContent = rec
          ? `得分 ${rec.score} · 通过 ${rec.doorsPassed} 扇 · 最高第 ${rec.maxStage} 段`
          : `得分 ${snap.hud.score} · 通过 ${snap.hud.doorsPassed} 扇`;
        el("over-rank-hint").textContent = rec
          ? `已写入本机纪录 · 种子 ${rec.seed}`
          : "正在写入本机纪录…";
      }
    }
  }

  return { sync };
}

function renderRanking(records: RunRecord[]): void {
  const list = el("ranking-list");
  const empty = el("ranking-empty");
  list.innerHTML = "";
  empty.classList.toggle("hidden", records.length > 0);
  for (const [i, r] of records.slice(0, 20).entries()) {
    const li = document.createElement("li");
    const time = new Date(r.endedAt).toLocaleString("zh-CN", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    li.innerHTML = `<span class="rank-n">${i + 1}</span><span class="rank-score">${r.score}</span><span class="rank-meta">${r.doorsPassed} 门 · 段${r.maxStage} · ${time}</span>`;
    list.appendChild(li);
  }
}

function hideAll(): void {
  for (const id of ["screen-menu", "screen-ranking", "screen-over"]) {
    el(id).classList.add("hidden");
  }
}

function show(node: HTMLElement, visible: boolean): void {
  node.classList.toggle("hidden", !visible);
}

function el(id: string): HTMLElement {
  const node = document.getElementById(id);
  if (!node) throw new Error(`#${id} missing`);
  return node;
}
