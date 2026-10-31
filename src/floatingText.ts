import { getPraise, type PraiseCue } from "./praise";

interface FloatingItem {
  text: string;
  subText: string;
  color: string;
  x: number;
  y: number;
  age: number;
}

export class FloatingTextManager {
  private item: FloatingItem | null = null;
  private lastFrame = 0;

  public spawnPraise(lines: number, combo: number, centerX: number, centerY: number,
    points = 0, allClear = false): PraiseCue {
    const cue = getPraise(lines, combo, allClear);
    const detail = allClear ? "ALL CLEAR" : combo >= 2 ? `COMBO ×${combo}` :
      lines > 1 ? `${lines} LINES` : "LINE CLEAR";
    // One clear = one celebration. The score stays below the phrase.
    this.item = { text: cue.text, color: cue.color, subText: `${detail} · +${points}`,
      x: centerX, y: centerY - 6, age: 0 };
    this.lastFrame = performance.now();
    return cue;
  }

  public getVisibleText() {
    return this.item ? { text: this.item.text, detail: this.item.subText } : null;
  }

  public updateAndDraw(ctx: CanvasRenderingContext2D) {
    const item = this.item;
    if (!item) return;
    const now = performance.now();
    item.age += Math.max(0, now - this.lastFrame);
    this.lastFrame = now;
    if (item.age >= 1500) { this.item = null; return; }
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    // A compact squash/pop, then settle; reduced motion keeps the words still.
    const progress = Math.min(1, item.age / 240);
    const pop = 1 + 2.7 * Math.pow(progress - 1, 3) + 1.7 * Math.pow(progress - 1, 2);
    const scale = reduced ? 1 : 0.7 + 0.3 * pop;
    const alpha = reduced ? 1 : Math.min(1, item.age / 50, (1500 - item.age) / 300);
    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.translate(item.x, item.y - (reduced ? 0 : Math.min(9, item.age / 90)));
    ctx.scale(scale, reduced ? 1 : scale * (1 + 0.07 * Math.sin(progress * Math.PI)));
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.font = '700 36px Fredoka, "Arial Rounded MT Bold", sans-serif';
    // Dark outline and small extrusion stay legible over every block skin.
    ctx.lineWidth = 8;
    ctx.strokeStyle = "#132f3a";
    ctx.strokeText(item.text, 0, 4);
    ctx.fillStyle = "#132f3a";
    ctx.fillText(item.text, 0, 4);
    ctx.strokeText(item.text, 0, 0);
    const gradient = ctx.createLinearGradient(0, -18, 0, 18);
    gradient.addColorStop(0, "#fff6d8");
    gradient.addColorStop(0.35, item.color);
    gradient.addColorStop(1, item.color);
    ctx.fillStyle = gradient;
    ctx.fillText(item.text, 0, 0);
    ctx.font = '800 12px "DM Sans", sans-serif';
    ctx.lineWidth = 5;
    ctx.strokeText(item.subText, 0, 32);
    ctx.fillStyle = "#fffdf3";
    ctx.fillText(item.subText, 0, 32);
    ctx.restore();
  }

  public clear() { this.item = null; }
}

export const floatingTexts = new FloatingTextManager();
