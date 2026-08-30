import type { FrameSnapshot, IRenderer } from "./types";

export class CanvasRenderer implements IRenderer {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private w = 1;
  private h = 1;
  private shake = 0;

  mount(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
  }

  resize(cssWidth: number, cssHeight: number, dpr: number): void {
    if (!this.canvas) return;
    this.w = Math.max(1, Math.floor(cssWidth * dpr));
    this.h = Math.max(1, Math.floor(cssHeight * dpr));
    this.canvas.width = this.w;
    this.canvas.height = this.h;
    this.canvas.style.width = `${cssWidth}px`;
    this.canvas.style.height = `${cssHeight}px`;
  }

  render(snapshot: FrameSnapshot): void {
    const ctx = this.ctx;
    if (!ctx) return;
    if (snapshot.resolve && !snapshot.resolve.correct) {
      this.shake = Math.max(this.shake, 10);
    }
    this.shake *= 0.86;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (this.shake > 0.4) {
      ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
    }

    this.drawSky(ctx);
    this.drawRoad(ctx, snapshot.lanes);
    if (snapshot.door && snapshot.phase !== "menu") {
      this.drawDoors(ctx, snapshot);
    }
    if (snapshot.phase === "playing" || snapshot.phase === "resolving") {
      this.drawPlayer(ctx, snapshot);
      this.drawResolveBanner(ctx, snapshot);
    }
    ctx.restore();
  }

  dispose(): void {
    this.canvas = null;
    this.ctx = null;
  }

  private drawSky(ctx: CanvasRenderingContext2D): void {
    const g = ctx.createLinearGradient(0, 0, 0, this.h);
    g.addColorStop(0, "#2a140c");
    g.addColorStop(0.45, "#5a2a14");
    g.addColorStop(1, "#120a08");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.w, this.h);

    ctx.fillStyle = "rgba(255,186,92,0.16)";
    ctx.beginPath();
    ctx.arc(this.w * 0.72, this.h * 0.16, this.w * 0.18, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawRoad(ctx: CanvasRenderingContext2D, lanes: number): void {
    const topY = this.h * 0.28;
    const topW = this.w * 0.18;
    const botW = this.w * 0.92;
    const cx = this.w / 2;

    ctx.beginPath();
    ctx.moveTo(cx - topW / 2, topY);
    ctx.lineTo(cx + topW / 2, topY);
    ctx.lineTo(cx + botW / 2, this.h);
    ctx.lineTo(cx - botW / 2, this.h);
    ctx.closePath();
    const rg = ctx.createLinearGradient(0, topY, 0, this.h);
    rg.addColorStop(0, "#3a2618");
    rg.addColorStop(1, "#1a100c");
    ctx.fillStyle = rg;
    ctx.fill();

    ctx.strokeStyle = "rgba(232,196,128,0.28)";
    ctx.lineWidth = Math.max(1, this.w * 0.004);
    for (let i = 1; i < lanes; i++) {
      const t = i / lanes;
      const x0 = cx - topW / 2 + topW * t;
      const x1 = cx - botW / 2 + botW * t;
      ctx.beginPath();
      ctx.moveTo(x0, topY);
      ctx.lineTo(x1, this.h);
      ctx.stroke();
    }
  }

  private drawDoors(ctx: CanvasRenderingContext2D, snap: FrameSnapshot): void {
    const door = snap.door!;
    const a = easeIn(door.approach);
    const topY = this.h * 0.28;
    const y = topY + (this.h * 0.52 - topY) * a;
    const scale = 0.22 + 0.78 * a;
    const width = this.w * 0.78 * scale;
    const height = this.h * 0.22 * scale;
    const left = (this.w - width) / 2;
    const laneW = width / snap.lanes;

    for (let i = 0; i < snap.lanes; i++) {
      const x = left + laneW * i + laneW * 0.06;
      const w = laneW * 0.88;
      const highlight =
        snap.resolve && (i === snap.resolve.answer || (snap.resolve.correct && i === snap.resolve.chosen));
      const wrong = Boolean(snap.resolve && !snap.resolve.correct && i === snap.resolve.chosen);

      ctx.fillStyle = wrong ? "#5a2218" : highlight ? "#3d4a22" : "#2c2118";
      ctx.strokeStyle = wrong ? "#e07050" : highlight ? "#c6e06a" : "#d4b06a";
      ctx.lineWidth = Math.max(2, this.w * 0.008 * scale);
      roundRect(ctx, x, y, w, height, 10 * scale);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#1a120c";
      ctx.fillRect(x + w * 0.12, y + height * 0.12, w * 0.76, height * 0.28);

      const label = door.hidden[i] ? "？" : door.labels[i] ?? "";
      const fontSize = Math.max(14, Math.min(w * 0.22, height * 0.28));
      ctx.font = `700 ${fontSize}px "Iowan Old Style", "Songti SC", serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = door.hidden[i] ? "#8a7a68" : "#f4e2b0";
      fitText(ctx, label, x + w / 2, y + height * 0.68, w * 0.86, fontSize);
    }
  }

  private drawPlayer(ctx: CanvasRenderingContext2D, snap: FrameSnapshot): void {
    const botW = this.w * 0.92;
    const left = (this.w - botW) / 2;
    const laneW = botW / snap.lanes;
    const x = left + (snap.playerDisplayX * (snap.lanes - 1) + 0.5) * laneW;
    const y = this.h * 0.86;
    const s = this.w * 0.045;

    ctx.fillStyle = snap.resolve?.correct === false ? "#e07050" : "#f2c14e";
    ctx.beginPath();
    ctx.ellipse(x, y + s * 0.9, s * 0.55, s * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#1e1510";
    ctx.beginPath();
    ctx.moveTo(x, y - s * 1.6);
    ctx.quadraticCurveTo(x + s * 0.9, y - s * 0.2, x + s * 0.45, y + s * 0.7);
    ctx.lineTo(x - s * 0.45, y + s * 0.7);
    ctx.quadraticCurveTo(x - s * 0.9, y - s * 0.2, x, y - s * 1.6);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#f4e2b0";
    ctx.beginPath();
    ctx.arc(x, y - s * 1.15, s * 0.32, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawResolveBanner(ctx: CanvasRenderingContext2D, snap: FrameSnapshot): void {
    if (!snap.resolve) return;
    const text = snap.resolve.correct ? "正确 +10" : "选错了 −1 命";
    ctx.font = `700 ${Math.max(22, this.w * 0.055)}px "Iowan Old Style", "Songti SC", serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = snap.resolve.correct ? "#d5ec8a" : "#f0a090";
    ctx.shadowColor = "#140c08";
    ctx.shadowBlur = 12;
    ctx.fillText(text, this.w / 2, this.h * 0.2);
    ctx.shadowBlur = 0;
  }
}

function easeIn(t: number): number {
  // 略加速但仍接近线性，避免门在最后瞬间砸到脸上。
  return t * (0.35 + 0.65 * t);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxW: number,
  fontSize: number,
): void {
  let size = fontSize;
  ctx.font = `700 ${size}px "Iowan Old Style", "Songti SC", "Noto Serif SC", serif`;
  while (size > 10 && ctx.measureText(text).width > maxW) {
    size -= 1;
    ctx.font = `700 ${size}px "Iowan Old Style", "Songti SC", "Noto Serif SC", serif`;
  }
  ctx.fillText(text, x, y);
}
