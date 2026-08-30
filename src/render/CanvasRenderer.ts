import type { FrameSnapshot, IRenderer } from "./types";

const COLORS = {
  skyTop: "#74d5cf",
  skyBottom: "#d7f1c6",
  cream: "#fff9df",
  creamShade: "#eadfb9",
  brown: "#6f4d31",
  brownSoft: "#9a7652",
  mint: "#35c8ad",
  mintDark: "#159b89",
  coral: "#ff7f74",
  yellow: "#ffd65a",
  grass: "#77bd69",
  grassDark: "#4e9d63",
  road: "#d9b98f",
  roadEdge: "#f4dfb7",
};

const HORIZON_RATIO = 0.32;

export class CanvasRenderer implements IRenderer {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private w = 1;
  private h = 1;
  private dpr = 1;
  private startedAt = performance.now();
  private shake = 0;
  private lastLives = 3;

  mount(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
  }

  resize(cssWidth: number, cssHeight: number, dpr: number): void {
    if (!this.canvas) return;
    this.dpr = dpr;
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
    const time = (performance.now() - this.startedAt) / 1000;
    if (snapshot.hud.lives < this.lastLives) this.shake = 5 * this.dpr;
    this.lastLives = snapshot.hud.lives;
    this.shake *= 0.78;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (this.shake > 0.25) {
      ctx.translate(Math.sin(time * 82) * this.shake, Math.cos(time * 67) * this.shake * 0.45);
    }
    this.drawWorld(ctx, snapshot, time);
    if (snapshot.door && snapshot.phase !== "menu") this.drawDoors(ctx, snapshot, time);
    if (snapshot.phase === "playing" || snapshot.phase === "resolving") {
      this.drawPlayer(ctx, snapshot, time);
      if (snapshot.resolve && !snapshot.resolve.correct) this.drawDamageVignette(ctx);
    }
    ctx.restore();
  }

  dispose(): void {
    this.canvas = null;
    this.ctx = null;
  }

  private drawWorld(ctx: CanvasRenderingContext2D, snap: FrameSnapshot, time: number): void {
    const phase = (time / 180 + 0.38) % 1;
    const daylight = Math.max(0.08, Math.sin(phase * Math.PI));
    const sky = ctx.createLinearGradient(0, 0, 0, this.h);
    sky.addColorStop(0, mixColor("#42527c", COLORS.skyTop, daylight));
    sky.addColorStop(0.58, mixColor("#d78978", COLORS.skyBottom, daylight));
    sky.addColorStop(1, mixColor("#657855", "#9ad078", daylight));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, this.w, this.h);

    const sunX = this.w * (0.08 + phase * 0.84);
    const sunY = this.h * (0.26 - Math.sin(phase * Math.PI) * 0.17);
    ctx.fillStyle = `rgba(255,232,128,${0.18 + daylight * 0.68})`;
    ctx.beginPath();
    ctx.arc(sunX, sunY, this.w * 0.066, 0, Math.PI * 2);
    ctx.fill();

    const cloudMargin = this.w * 0.2;
    const cloud1X = positiveMod(this.w * 0.08 + time * this.dpr * 3.2, this.w + cloudMargin * 2) - cloudMargin;
    const cloud2X = positiveMod(this.w * 0.7 + time * this.dpr * 1.9, this.w + cloudMargin * 2) - cloudMargin;
    this.drawCloud(ctx, cloud1X, this.h * 0.13, 0.75, daylight);
    this.drawCloud(ctx, cloud2X, this.h * 0.23, 0.55, daylight);

    this.drawHills(ctx, daylight);
    this.drawRoad(ctx, snap.lanes, time, snap.phase !== "menu");
    this.drawScenery(ctx, time, snap.phase !== "menu");
    this.drawSkySign(ctx, time, daylight);
  }

  private drawCloud(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    scale: number,
    daylight: number,
  ): void {
    const s = this.w * 0.075 * scale;
    ctx.fillStyle = `rgba(255,255,238,${0.42 + daylight * 0.4})`;
    ctx.beginPath();
    ctx.arc(x - s * 0.8, y, s * 0.6, 0, Math.PI * 2);
    ctx.arc(x, y - s * 0.18, s * 0.85, 0, Math.PI * 2);
    ctx.arc(x + s * 0.9, y, s * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawHills(ctx: CanvasRenderingContext2D, daylight: number): void {
    const horizonY = this.h * HORIZON_RATIO;
    ctx.fillStyle = mixColor("#596b63", "#91c984", daylight);
    ctx.beginPath();
    ctx.moveTo(0, horizonY);
    ctx.quadraticCurveTo(this.w * 0.17, this.h * 0.21, this.w * 0.39, horizonY);
    ctx.quadraticCurveTo(this.w * 0.62, this.h * 0.2, this.w, horizonY);
    ctx.lineTo(this.w, this.h * 0.5);
    ctx.lineTo(0, this.h * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = mixColor("#3f6557", COLORS.grass, daylight);
    ctx.fillRect(0, horizonY, this.w, this.h - horizonY);
  }

  private drawRoad(ctx: CanvasRenderingContext2D, lanes: number, time: number, moving: boolean): void {
    const horizonY = this.h * HORIZON_RATIO;
    const topW = this.w * 0.045;
    const botW = Math.min(this.w * 1.04, this.h * 0.69);
    const cx = this.w / 2;

    ctx.fillStyle = COLORS.roadEdge;
    pathTrapezoid(ctx, cx, horizonY, topW * 1.35, botW * 1.12, this.h);
    ctx.fill();
    const road = ctx.createLinearGradient(0, horizonY, 0, this.h);
    road.addColorStop(0, "#d9c5a5");
    road.addColorStop(1, COLORS.road);
    ctx.fillStyle = road;
    pathTrapezoid(ctx, cx, horizonY, topW, botW, this.h);
    ctx.fill();

    const scroll = moving ? (time * 0.58) % 1 : 0.24;
    for (let row = 0; row < 11; row++) {
      const p = (row / 10 + scroll) % 1;
      const q = p * p;
      const y = horizonY + (this.h - horizonY) * q;
      const half = lerp(topW / 2, botW / 2, q);
      ctx.strokeStyle = `rgba(255,249,223,${0.1 + q * 0.2})`;
      ctx.lineWidth = Math.max(1, this.w * 0.004 * q);
      ctx.beginPath();
      ctx.moveTo(cx - half, y);
      ctx.lineTo(cx + half, y);
      ctx.stroke();
    }

    ctx.setLineDash([10 * this.dpr, 12 * this.dpr]);
    ctx.lineDashOffset = moving ? time * 70 * this.dpr : 0;
    for (let i = 1; i < lanes; i++) {
      const ratio = i / lanes;
      ctx.strokeStyle = "rgba(255,249,223,0.56)";
      ctx.lineWidth = Math.max(1.5, this.w * 0.0035);
      ctx.beginPath();
      ctx.moveTo(cx - topW / 2 + topW * ratio, horizonY);
      ctx.lineTo(cx - botW / 2 + botW * ratio, this.h);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  private drawScenery(ctx: CanvasRenderingContext2D, time: number, moving: boolean): void {
    const speed = moving ? time * 0.38 : 0.2;
    for (let i = 0; i < 7; i++) {
      const p = (i / 7 + speed) % 1;
      const q = p * p;
      const y = this.h * HORIZON_RATIO + this.h * (1 - HORIZON_RATIO) * q;
      const sequence = Math.floor(speed * 7) + i;
      const side = hash01(sequence * 17.13) < 0.5 ? -1 : 1;
      const scaleJitter = lerp(0.82, 1.12, hash01(sequence * 31.77));
      const s = lerp(this.w * 0.012, this.w * 0.075, q) * scaleJitter;
      const roadTopW = this.w * 0.045 * 1.35;
      const roadBotW = Math.min(this.w * 1.04, this.h * 0.69) * 1.12;
      const outerRoadHalf = lerp(roadTopW / 2, roadBotW / 2, q);
      const extra = lerp(this.w * 0.018, this.w * 0.075, hash01(sequence * 7.91));
      const x = this.w / 2 + side * (outerRoadHalf + s * 1.25 + extra);
      this.drawTree(ctx, x, y, s, sequence);
    }
  }

  private drawSkySign(ctx: CanvasRenderingContext2D, time: number, daylight: number): void {
    const w = Math.min(this.w * 0.42, 220 * this.dpr);
    const h = Math.min(this.h * 0.052, 50 * this.dpr);
    const x = (this.w - w) / 2;
    const y = this.h * 0.145 + Math.sin(time * 0.65) * this.dpr * 1.5;
    const ropeInset = w * 0.18;

    ctx.strokeStyle = `rgba(111,77,49,${0.38 + daylight * 0.3})`;
    ctx.lineWidth = Math.max(1.5 * this.dpr, this.w * 0.002);
    ctx.beginPath();
    ctx.moveTo(x + ropeInset, this.h * 0.025);
    ctx.lineTo(x + ropeInset, y + h * 0.08);
    ctx.moveTo(x + w - ropeInset, this.h * 0.025);
    ctx.lineTo(x + w - ropeInset, y + h * 0.08);
    ctx.stroke();

    ctx.fillStyle = "rgba(111,77,49,0.16)";
    roundRect(ctx, x, y + h * 0.09, w, h, h * 0.42);
    ctx.fill();
    ctx.fillStyle = "#fff4cf";
    ctx.strokeStyle = COLORS.brown;
    ctx.lineWidth = Math.max(2 * this.dpr, this.w * 0.004);
    roundRect(ctx, x, y, w, h, h * 0.42);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = COLORS.brown;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `900 ${Math.max(12 * this.dpr, h * 0.34)}px Nunito, "Noto Sans SC", sans-serif`;
    ctx.fillText("选择更大的数", this.w / 2, y + h * 0.52);
  }

  private drawTree(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, index: number): void {
    ctx.fillStyle = "#8b6846";
    roundRect(ctx, x - s * 0.13, y - s * 0.15, s * 0.26, s * 0.82, s * 0.12);
    ctx.fill();
    ctx.fillStyle = index % 3 === 0 ? "#59a96c" : "#63b877";
    for (const [dx, dy, r] of [[0, -0.55, 0.62], [-0.38, -0.25, 0.48], [0.4, -0.2, 0.46]] as const) {
      ctx.beginPath();
      ctx.arc(x + s * dx, y + s * dy, s * r, 0, Math.PI * 2);
      ctx.fill();
    }
    if (s > 22 * this.dpr) {
      ctx.fillStyle = index % 2 ? COLORS.yellow : "#f6a6ae";
      ctx.beginPath();
      ctx.arc(x - s * 0.22, y - s * 0.45, s * 0.08, 0, Math.PI * 2);
      ctx.arc(x + s * 0.31, y - s * 0.18, s * 0.07, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawDoors(ctx: CanvasRenderingContext2D, snap: FrameSnapshot, time: number): void {
    const door = snap.door!;
    const a = easeApproach(door.approach);
    const horizonY = this.h * HORIZON_RATIO;
    const y = lerp(horizonY + this.h * 0.012, this.h * 0.63, a);
    const roadProgress = (y - horizonY) / (this.h - horizonY);
    const roadTopW = this.w * 0.045;
    const roadBotW = Math.min(this.w * 1.04, this.h * 0.69);
    const roadWidth = lerp(roadTopW, roadBotW, roadProgress);
    const totalW = Math.max(this.w * 0.23, roadWidth * 0.92);
    const laneW = totalW / snap.lanes;
    const height = Math.min(this.h * 0.19, laneW * 1.55);
    const left = (this.w - totalW) / 2;

    for (let i = 0; i < snap.lanes; i++) {
      const x = left + laneW * i + laneW * 0.05;
      const w = laneW * 0.9;
      const correctFlash = Boolean(snap.resolve?.correct && i === snap.resolve.answer);
      const wrongFlash = Boolean(snap.resolve && !snap.resolve.correct && i === snap.resolve.chosen);
      const pulse = correctFlash ? 0.55 + Math.sin(time * 55) * 0.3 : 0;

      ctx.save();
      if (correctFlash) {
        ctx.shadowColor = `rgba(255, 244, 125, ${pulse})`;
        ctx.shadowBlur = 24 * this.dpr * lerp(0.45, 1, a);
      }
      ctx.fillStyle = "rgba(111,77,49,0.18)";
      archPath(ctx, x, y + height * 0.045, w, height);
      ctx.fill();
      ctx.translate(0, -height * 0.035);
      ctx.fillStyle = wrongFlash ? "#ffe0d8" : correctFlash ? "#fff7aa" : COLORS.cream;
      ctx.strokeStyle = wrongFlash ? COLORS.coral : correctFlash ? COLORS.yellow : COLORS.brown;
      ctx.lineWidth = Math.max(2.5 * this.dpr, this.w * 0.006 * lerp(0.45, 1, a));
      archPath(ctx, x, y, w, height);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "rgba(111,77,49,0.13)";
      ctx.beginPath();
      ctx.arc(x + w * 0.8, y + height * 0.65, Math.max(2, w * 0.035), 0, Math.PI * 2);
      ctx.fill();

      const label = door.hidden[i] ? "?" : door.labels[i] ?? "";
      const fontSize = Math.max(15 * this.dpr, Math.min(w * 0.27, height * 0.25));
      ctx.fillStyle = door.hidden[i] ? COLORS.brownSoft : COLORS.brown;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      fitText(ctx, label, x + w / 2, y + height * 0.63, w * 0.84, fontSize);
      ctx.restore();
    }
  }

  private drawPlayer(ctx: CanvasRenderingContext2D, snap: FrameSnapshot, time: number): void {
    const botW = Math.min(this.w * 1.04, this.h * 0.69);
    const left = (this.w - botW) / 2;
    const laneW = botW / snap.lanes;
    const x = left + (snap.playerDisplayX * (snap.lanes - 1) + 0.5) * laneW;
    const baseY = this.h * 0.84;
    const s = Math.min(this.w * 0.072, this.h * 0.046);
    const bob = Math.sin(time * 15) * s * 0.055;

    ctx.save();
    ctx.translate(x, baseY + bob);
    ctx.fillStyle = "rgba(78,92,55,0.2)";
    ctx.beginPath();
    ctx.ellipse(0, s * 1.62, s * 0.9, s * 0.26, 0, 0, Math.PI * 2);
    ctx.fill();

    const leg = Math.sin(time * 15) * s * 0.22;
    ctx.strokeStyle = COLORS.brown;
    ctx.lineWidth = s * 0.22;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-s * 0.22, s * 0.78);
    ctx.lineTo(-s * 0.3 + leg, s * 1.35);
    ctx.moveTo(s * 0.22, s * 0.78);
    ctx.lineTo(s * 0.3 - leg, s * 1.35);
    ctx.stroke();

    ctx.fillStyle = "#ef9c70";
    ctx.beginPath();
    ctx.ellipse(0, s * 0.45, s * 0.65, s * 0.88, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = COLORS.brown;
    ctx.lineWidth = s * 0.1;
    ctx.stroke();

    ctx.fillStyle = "#fff2d6";
    ctx.beginPath();
    ctx.ellipse(-s * 0.34, -s * 1.03, s * 0.25, s * 0.68, -0.16, 0, Math.PI * 2);
    ctx.ellipse(s * 0.34, -s * 1.03, s * 0.25, s * 0.68, 0.16, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, -s * 0.32, s * 0.72, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = COLORS.brown;
    ctx.beginPath();
    ctx.arc(-s * 0.25, -s * 0.37, s * 0.075, 0, Math.PI * 2);
    ctx.arc(s * 0.25, -s * 0.37, s * 0.075, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = COLORS.brown;
    ctx.lineWidth = s * 0.06;
    ctx.beginPath();
    ctx.arc(0, -s * 0.18, s * 0.15, 0.12, Math.PI - 0.12);
    ctx.stroke();
    ctx.restore();
  }

  private drawDamageVignette(ctx: CanvasRenderingContext2D): void {
    const g = ctx.createRadialGradient(this.w / 2, this.h / 2, this.w * 0.2, this.w / 2, this.h / 2, this.h * 0.72);
    g.addColorStop(0, "rgba(255,110,100,0)");
    g.addColorStop(1, "rgba(255,90,82,0.28)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.w, this.h);
  }
}

function pathTrapezoid(ctx: CanvasRenderingContext2D, cx: number, topY: number, topW: number, botW: number, bottomY: number): void {
  ctx.beginPath();
  ctx.moveTo(cx - topW / 2, topY);
  ctx.lineTo(cx + topW / 2, topY);
  ctx.lineTo(cx + botW / 2, bottomY);
  ctx.lineTo(cx - botW / 2, bottomY);
  ctx.closePath();
}

function archPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  const r = w * 0.47;
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x, y + r);
  ctx.bezierCurveTo(x, y + r * 0.18, x + w, y + r * 0.18, x + w, y + r);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function fitText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, fontSize: number): void {
  let size = fontSize;
  const family = 'Nunito, "Noto Sans SC", "PingFang SC", sans-serif';
  ctx.font = `900 ${size}px ${family}`;
  while (size > 10 && ctx.measureText(text).width > maxW) {
    size -= 1;
    ctx.font = `900 ${size}px ${family}`;
  }
  ctx.fillText(text, x, y);
}

function easeApproach(t: number): number {
  return t * (0.55 + 0.45 * t);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function positiveMod(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus;
}

function hash01(value: number): number {
  return Math.abs(Math.sin(value) * 43758.5453) % 1;
}

function mixColor(from: string, to: string, t: number): string {
  const a = hexRgb(from);
  const b = hexRgb(to);
  const amount = Math.max(0, Math.min(1, t));
  return `rgb(${Math.round(lerp(a[0], b[0], amount))}, ${Math.round(lerp(a[1], b[1], amount))}, ${Math.round(lerp(a[2], b[2], amount))})`;
}

function hexRgb(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}
