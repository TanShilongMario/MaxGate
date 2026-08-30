export type LaneIntent = { type: "lane"; delta: -1 | 1 };

const SWIPE_PX = 28;

export class InputManager {
  private queue: LaneIntent[] = [];
  private startX = 0;
  private startY = 0;
  private tracking = false;
  private committed = false;
  private bound = false;

  private onKey = (e: KeyboardEvent) => {
    if (e.code === "ArrowLeft" || e.code === "KeyA") {
      e.preventDefault();
      this.queue.push({ type: "lane", delta: -1 });
    } else if (e.code === "ArrowRight" || e.code === "KeyD") {
      e.preventDefault();
      this.queue.push({ type: "lane", delta: 1 });
    }
  };

  private onTouchStart = (e: TouchEvent) => {
    const t = e.changedTouches[0];
    if (!t) return;
    this.tracking = true;
    this.committed = false;
    this.startX = t.clientX;
    this.startY = t.clientY;
  };

  private onTouchMove = (e: TouchEvent) => {
    if (!this.tracking || this.committed) return;
    const t = e.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - this.startX;
    const dy = t.clientY - this.startY;
    if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < Math.abs(dy)) return;
    e.preventDefault();
    this.committed = true;
    this.queue.push({ type: "lane", delta: dx > 0 ? 1 : -1 });
  };

  private onTouchEnd = () => {
    this.tracking = false;
    this.committed = false;
  };

  attach(target: HTMLElement): void {
    if (this.bound) return;
    this.bound = true;
    window.addEventListener("keydown", this.onKey);
    target.addEventListener("touchstart", this.onTouchStart, { passive: true });
    target.addEventListener("touchmove", this.onTouchMove, { passive: false });
    target.addEventListener("touchend", this.onTouchEnd, { passive: true });
  }

  detach(target: HTMLElement): void {
    if (!this.bound) return;
    this.bound = false;
    window.removeEventListener("keydown", this.onKey);
    target.removeEventListener("touchstart", this.onTouchStart);
    target.removeEventListener("touchmove", this.onTouchMove);
    target.removeEventListener("touchend", this.onTouchEnd);
  }

  drain(): LaneIntent[] {
    const q = this.queue;
    this.queue = [];
    return q;
  }
}
