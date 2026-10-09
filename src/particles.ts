export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  decay: number;
  rotation: number;
  vRot: number;
  isSpark?: boolean;
}

export interface LineFlash {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  alpha: number;
  decay: number;
}

export class ParticleSystem {
  private particles: Particle[] = [];
  private lineFlashes: LineFlash[] = [];

  public spawnBlockBurst(
    centerX: number,
    centerY: number,
    color: string,
    count: number = 8
  ) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2.5 + Math.random() * 5.5;
      const isSpark = Math.random() > 0.4;

      this.particles.push({
        x: centerX + (Math.random() - 0.5) * 12,
        y: centerY + (Math.random() - 0.5) * 12,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2.0, // buoyant pop
        size: isSpark ? 4 + Math.random() * 5 : 5 + Math.random() * 6,
        color: isSpark && Math.random() > 0.5 ? "#ffffff" : color,
        alpha: 1,
        decay: 0.022 + Math.random() * 0.025,
        rotation: Math.random() * Math.PI,
        vRot: (Math.random() - 0.5) * 0.35,
        isSpark,
      });
    }
  }

  public spawnLineFlash(x: number, y: number, w: number, h: number, color: string = "#ffffff") {
    this.lineFlashes.push({
      x,
      y,
      w,
      h,
      color,
      alpha: 0.85,
      decay: 0.08, // fades in ~150ms
    });
  }

  public spawnFireworks(centerX: number, centerY: number, count: number = 36) {
    const rainbowColors = [
      "#ff007f",
      "#00e5ff",
      "#ffd700",
      "#76ff03",
      "#d500f9",
      "#ff9100",
    ];
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.3;
      const speed = 4.5 + Math.random() * 5.0;
      const color = rainbowColors[i % rainbowColors.length];
      this.particles.push({
        x: centerX,
        y: centerY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.5,
        size: 5 + Math.random() * 6,
        color,
        alpha: 1,
        decay: 0.015 + Math.random() * 0.015,
        rotation: Math.random() * Math.PI,
        vRot: (Math.random() - 0.5) * 0.4,
        isSpark: true,
      });
    }
  }

  public updateAndDraw(ctx: CanvasRenderingContext2D) {
    // 1. Draw glowing line sweep flashes
    for (let i = this.lineFlashes.length - 1; i >= 0; i--) {
      const flash = this.lineFlashes[i];
      flash.alpha -= flash.decay;

      if (flash.alpha <= 0) {
        this.lineFlashes.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.globalAlpha = Math.max(0, flash.alpha);

      // White-hot core beam
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = flash.color;
      ctx.shadowBlur = 16;
      ctx.fillRect(flash.x, flash.y, flash.w, flash.h);

      // Colorful outer glow halo
      ctx.fillStyle = flash.color;
      ctx.globalAlpha = Math.max(0, flash.alpha * 0.5);
      ctx.fillRect(flash.x - 2, flash.y - 2, flash.w + 4, flash.h + 4);

      ctx.restore();
    }

    // 2. Draw sparkling shard & diamond particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.22; // gravity
      p.vx *= 0.98; // air drag
      p.rotation += p.vRot;
      p.alpha -= p.decay;

      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);

      if (p.isSpark) {
        // Sparkling diamond facet
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.moveTo(0, -p.size);
        ctx.lineTo(p.size * 0.6, 0);
        ctx.lineTo(0, p.size);
        ctx.lineTo(-p.size * 0.6, 0);
        ctx.closePath();
        ctx.fill();
      } else {
        // Rounded gem block chunk
        ctx.fillStyle = p.color;
        const rad = Math.max(1, p.size * 0.25);
        if (ctx.roundRect) {
          ctx.beginPath();
          ctx.roundRect(-p.size / 2, -p.size / 2, p.size, p.size, rad);
          ctx.fill();
        } else {
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        }
      }

      ctx.restore();
    }
  }

  public clear() {
    this.particles = [];
    this.lineFlashes = [];
  }
}

export const particles = new ParticleSystem();
