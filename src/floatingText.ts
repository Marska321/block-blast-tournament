export interface FloatingItem {
  text: string;
  x: number;
  y: number;
  color: string;
  subText?: string;
  scale: number;
  targetScale: number;
  alpha: number;
  vy: number;
  age: number;
  maxAge: number;
}

export class FloatingTextManager {
  private items: FloatingItem[] = [];

  public spawnPraise(lines: number, combo: number, centerX: number, centerY: number) {
    let mainText = "";
    let subText: string | undefined = undefined;
    let color = "#ffd600"; // gold default

    if (combo >= 2 && lines === 1) {
      mainText = `COMBO ×${combo}`;
      color = combo >= 4 ? "#ff007f" : combo >= 3 ? "#00e5ff" : "#76ff03";
    } else if (lines >= 4) {
      mainText = "UNBELIEVABLE!!";
      subText = combo >= 2 ? `×${combo} COMBO BLAST` : "QUAD BLAST";
      color = "#ff3366";
    } else if (lines === 3) {
      mainText = "AMAZING!";
      subText = combo >= 2 ? `×${combo} COMBO` : "TRIPLE CLEAR";
      color = "#ffd600";
    } else if (lines === 2) {
      mainText = "GREAT!";
      subText = combo >= 2 ? `×${combo} COMBO` : "DOUBLE CLEAR";
      color = "#00e5ff";
    } else if (lines === 1) {
      mainText = "NICE!";
      color = "#ff9100";
    }

    if (!mainText) return;

    this.items.push({
      text: mainText,
      subText,
      x: centerX,
      y: centerY - 10,
      color,
      scale: 0.3,
      targetScale: lines >= 3 || combo >= 3 ? 1.35 : 1.15,
      alpha: 1,
      vy: -1.8,
      age: 0,
      maxAge: 55, // frames (~0.9 seconds)
    });
  }

  public spawnScoreBonus(points: number, x: number, y: number) {
    this.items.push({
      text: `+${points}`,
      x,
      y: y - 5,
      color: "#00e5ff",
      scale: 0.6,
      targetScale: 1.0,
      alpha: 1,
      vy: -1.2,
      age: 0,
      maxAge: 40,
    });
  }

  public spawnAllClear(centerX: number, centerY: number, bonusPoints: number = 500) {
    this.items.push({
      text: "🌟 ALL CLEAR! 🌟",
      subText: `+${bonusPoints} PERFECT BONUS`,
      x: centerX,
      y: centerY - 15,
      color: "#ffd700",
      scale: 0.2,
      targetScale: 1.45,
      alpha: 1,
      vy: -1.0,
      age: 0,
      maxAge: 75,
    });
  }

  public spawnMilestone(text: string, subText: string, centerX: number, centerY: number) {
    this.items.push({
      text,
      subText,
      x: centerX,
      y: centerY - 20,
      color: "#ffd700",
      scale: 0.25,
      targetScale: 1.4,
      alpha: 1,
      vy: -1.2,
      age: 0,
      maxAge: 80,
    });
  }

  public updateAndDraw(ctx: CanvasRenderingContext2D) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      item.age++;
      item.y += item.vy;
      item.vy *= 0.95; // decelerate upward drift

      // Spring / pop-in scale
      item.scale += (item.targetScale - item.scale) * 0.25;

      // Fade out near end of life
      if (item.age > item.maxAge * 0.6) {
        item.alpha = Math.max(0, 1 - (item.age - item.maxAge * 0.6) / (item.maxAge * 0.4));
      }

      if (item.age >= item.maxAge || item.alpha <= 0) {
        this.items.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.globalAlpha = item.alpha;
      ctx.translate(item.x, item.y);
      ctx.scale(item.scale, item.scale);

      // Main praise text
      ctx.font = '900 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Impact, Roboto, sans-serif';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // Heavy 3D shadow & stroke for comic/arcade readability
      ctx.shadowColor = "rgba(0, 0, 0, 0.85)";
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 3;

      ctx.lineWidth = 5;
      ctx.strokeStyle = "#080911";
      ctx.strokeText(item.text, 0, 0);

      ctx.shadowBlur = 0;
      ctx.fillStyle = item.color;
      ctx.fillText(item.text, 0, 0);

      // Optional Subtitle
      if (item.subText) {
        ctx.font = '800 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.lineWidth = 3;
        ctx.strokeStyle = "#080911";
        ctx.strokeText(item.subText, 0, 18);

        ctx.fillStyle = "#ffffff";
        ctx.fillText(item.subText, 0, 18);
      }

      ctx.restore();
    }
  }

  public clear() {
    this.items = [];
  }
}

export const floatingTexts = new FloatingTextManager();
