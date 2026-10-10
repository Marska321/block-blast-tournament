import {
  BlockShape,
  TrayBlock,
  getRandomColor,
  getRandomShape,
  getRandomShapeFromPool,
  ShapeTier,
  BLOCK_DEFS,
} from "./blocks";
import { PRNG } from "./prng";
import { particles } from "./particles";
import { WorldTheme } from "./levels";

export interface GridOffset {
  x: number;
  y: number;
  cellSize: number;
}

export interface LayoutMetrics {
  pad: number;
  cellSize: number;
  boardSize: number;
  boardX: number;
  boardY: number;
  trayY: number;
  trayH: number;
}

export function computePieceCellSize(
  shape: BlockShape,
  slotWidth: number,
  slotHeight: number,
  boardCellSize: number
): number {
  const cols = shape[0].length;
  const rows = shape.length;
  const usableW = Math.max(36, slotWidth * 0.82);
  const usableH = Math.max(36, slotHeight * 0.82);
  const baseScale = 0.72;
  const baseCellSize = boardCellSize * baseScale;
  const maxCellW = usableW / cols;
  const maxCellH = usableH / rows;
  return Math.max(12, Math.floor(Math.min(baseCellSize, maxCellW, maxCellH)));
}

export function computeLayout(
  w: number,
  h: number,
  topInset: number,
  gridSize: number = 8
): LayoutMetrics {
  const pad = Math.max(8, Math.round(w * 0.035));
  const reservedTrayH = Math.max(115, Math.round(h * 0.20));
  const maxAvailableHeight = h - topInset - reservedTrayH - pad * 3;
  const maxAvailableWidth = w - pad * 2;
  const rawBoardSize = Math.min(maxAvailableWidth, maxAvailableHeight);
  const cellSize = Math.max(26, Math.floor(rawBoardSize / gridSize));
  const boardSize = cellSize * gridSize;
  const boardX = Math.floor((w - boardSize) / 2);
  const boardY = Math.floor(topInset + pad);
  const trayY = Math.floor(boardY + boardSize + pad);
  const trayH = Math.max(115, h - trayY - pad);

  return { pad, cellSize, boardSize, boardX, boardY, trayY, trayH };
}

// Backward compatibility wrapper
export function computeGridOffset(
  canvasWidth: number,
  canvasHeight: number,
  gridSize: number = 8,
  topHudSpace: number = 92
): GridOffset {
  const layout = computeLayout(canvasWidth, canvasHeight, topHudSpace, gridSize);
  return {
    x: layout.boardX,
    y: layout.boardY,
    cellSize: layout.cellSize,
  };
}

// Fast brightness adjustment for glossy gradients
function adjustColorBrightness(hex: string, percent: number): string {
  if (!hex.startsWith("#")) return hex;
  const cleanHex = hex.replace("#", "");
  const num = parseInt(
    cleanHex.length === 3
      ? cleanHex
          .split("")
          .map((c) => c + c)
          .join("")
      : cleanHex,
    16
  );
  let r = (num >> 16) + Math.round(255 * (percent / 100));
  let g = ((num >> 8) & 0x00ff) + Math.round(255 * (percent / 100));
  let b = (num & 0x0000ff) + Math.round(255 * (percent / 100));
  r = Math.min(255, Math.max(0, r));
  g = Math.min(255, Math.max(0, g));
  b = Math.min(255, Math.max(0, b));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

// ---------------------------------------------------------------------------
// Block sprite cache
// Each (color, size) block is rendered once to an offscreen canvas, then blitted
// with drawImage every frame. This replaces ~4 gradients + ~8 paths per cell per
// frame with a single image copy.
// ---------------------------------------------------------------------------
// Visual style for all blocks:
// - "bevel": mitered 4-facet gem tiles (Screenshot 1)
// - "jelly": translucent glossy candy glass with highlights (Screenshot 2)
// - "cushion": soft rounded pillowy tiles with inset indent (Screenshot 3)
// - "stitched": tufted velvet/leather pillow with stitched perimeter seams & button (Screenshot 4)
// - "cosmic": crystalline tiles with sparkling starfield (Screenshot 5)
// - "candy": glossy rounded pill reflection
// - "flat": clean matte editorial tiles
export type BlockStyle = "bevel" | "candy" | "flat" | "jelly" | "cushion" | "stitched" | "cosmic";

export interface BlockStylePreset {
  id: BlockStyle;
  name: string;
  icon: string;
  previewColor: string;
  desc: string;
}

export const BLOCK_STYLE_PRESETS: BlockStylePreset[] = [
  {
    id: "bevel",
    name: "3D Gem Bevel",
    icon: "💎",
    previewColor: "#3b82f6",
    desc: "Original Block Blast faceted chiseled tiles",
  },
  {
    id: "jelly",
    name: "Gummy Jelly",
    icon: "🍬",
    previewColor: "#ec4899",
    desc: "Translucent glossy candy glass with highlights",
  },
  {
    id: "cushion",
    name: "Pastel Cushion",
    icon: "🧸",
    previewColor: "#f472b6",
    desc: "Soft rounded pillowy tiles with inset indent",
  },
  {
    id: "stitched",
    name: "Stitched Leather",
    icon: "🧵",
    previewColor: "#a855f7",
    desc: "Tufted velvet pillow with perimeter seams & button",
  },
  {
    id: "cosmic",
    name: "Cosmic Nebula",
    icon: "🌌",
    previewColor: "#6366f1",
    desc: "Crystalline tiles with sparkling starfield",
  },
  {
    id: "candy",
    name: "Modern Candy",
    icon: "🍭",
    previewColor: "#10b981",
    desc: "Glossy rounded pill reflection",
  },
  {
    id: "flat",
    name: "Clean Matte",
    icon: "📐",
    previewColor: "#f59e0b",
    desc: "Minimalist editorial flat tiles",
  },
];

let blockStyle: BlockStyle = (typeof localStorage !== "undefined" && (localStorage.getItem("bb_block_style") as BlockStyle)) || "bevel";

export function setBlockStyle(style: BlockStyle) {
  if (style !== blockStyle) {
    blockStyle = style;
    try {
      localStorage.setItem("bb_block_style", style);
    } catch {}
    spriteCache.clear();
    invalidateBoardCache();
  }
}

export function getBlockStyle(): BlockStyle {
  return blockStyle;
}

// Proportional mix toward white (amt > 0) or black (amt < 0). Keeps colours saturated,
// unlike adjustColorBrightness which adds a flat amount to every channel.
function shade(hex: string, amt: number): string {
  if (!hex.startsWith("#")) return hex;
  const h = hex.length === 4 ? hex.slice(1).split("").map((c) => c + c).join("") : hex.slice(1);
  const n = parseInt(h, 16);
  const target = amt >= 0 ? 255 : 0;
  const t = Math.abs(amt);
  const mix = (c: number) => Math.round(c + (target - c) * t);
  const r = mix(n >> 16), g = mix((n >> 8) & 255), b = mix(n & 255);
  return `rgb(${r}, ${g}, ${b})`;
}

const SPRITE_MARGIN = 2; // logical px of room around the tile for its drop shadow
const SPRITE_CACHE_LIMIT = 96; // safety cap so odd sizes can never grow it unbounded
const spriteCache = new Map<string, HTMLCanvasElement>();
let spriteScale = 1; // device pixel ratio the sprites are rendered at

// Call whenever the canvas DPR or cell size changes (resizeCanvas does this).
export function setSpriteScale(dpr: number) {
  if (dpr !== spriteScale) {
    spriteScale = dpr;
    spriteCache.clear();
  }
}

export function clearSpriteCache() {
  spriteCache.clear();
}

function getBlockSprite(color: string, size: number): HTMLCanvasElement {
  const key = `${blockStyle}|${color}|${size}|${spriteScale}`;
  let sprite = spriteCache.get(key);
  if (sprite) return sprite;

  if (spriteCache.size >= SPRITE_CACHE_LIMIT) spriteCache.clear();

  const logical = size + SPRITE_MARGIN * 2;
  sprite = document.createElement("canvas");
  sprite.width = Math.ceil(logical * spriteScale);
  sprite.height = Math.ceil(logical * spriteScale);

  const sctx = sprite.getContext("2d") as CanvasRenderingContext2D;
  sctx.scale(spriteScale, spriteScale);
  if (blockStyle === "bevel") {
    renderBevelBlock(sctx, SPRITE_MARGIN, SPRITE_MARGIN, size, color);
  } else if (blockStyle === "flat") {
    renderFlatBlock(sctx, SPRITE_MARGIN, SPRITE_MARGIN, size, color);
  } else if (blockStyle === "jelly") {
    renderJellyBlock(sctx, SPRITE_MARGIN, SPRITE_MARGIN, size, color);
  } else if (blockStyle === "cushion") {
    renderCushionBlock(sctx, SPRITE_MARGIN, SPRITE_MARGIN, size, color);
  } else if (blockStyle === "stitched") {
    renderStitchedBlock(sctx, SPRITE_MARGIN, SPRITE_MARGIN, size, color);
  } else if (blockStyle === "cosmic") {
    renderCosmicBlock(sctx, SPRITE_MARGIN, SPRITE_MARGIN, size, color);
  } else {
    renderCandyBlock(sctx, SPRITE_MARGIN, SPRITE_MARGIN, size, color, 1);
  }

  spriteCache.set(key, sprite);
  return sprite;
}

// Flat matte tile renderer: solid vibrant fill with crisp subtle bevel/seam definition.
function renderFlatBlock(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  size: number,
  color: string
) {
  ctx.save();
  const pad = 0.5;
  const s = size - pad * 2;
  const r = Math.max(1, Math.round(s * 0.08));

  // 1. Clean solid matte fill
  ctx.fillStyle = color;
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(px + pad, py + pad, s, s, r);
    ctx.fill();
  } else {
    ctx.fillRect(px + pad, py + pad, s, s);
  }

  // 2. Subtle top-edge light lip for clean tile definition
  ctx.strokeStyle = "rgba(255, 255, 255, 0.16)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(px + pad + r, py + pad + 0.5);
  ctx.lineTo(px + pad + s - r, py + pad + 0.5);
  ctx.stroke();

  // 3. Crisp outer seam so adjacent same-color blocks retain clean boundaries
  ctx.strokeStyle = "rgba(0, 0, 0, 0.28)";
  ctx.lineWidth = 1;
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(px + pad + 0.5, py + pad + 0.5, s - 1, s - 1, r);
    ctx.stroke();
  } else {
    ctx.strokeRect(px + pad + 0.5, py + pad + 0.5, s - 1, s - 1);
  }

  ctx.restore();
}

// 1. Gummy Jelly / Glass Block Renderer (Screenshot 2)
function renderJellyBlock(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  size: number,
  color: string
) {
  ctx.save();
  const pad = 1;
  const s = size - pad * 2;
  const r = Math.max(3, Math.round(s * 0.22));
  const x = px + pad;
  const y = py + pad;

  // Outer soft drop shadow
  ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(x + 1, y + 2, s, s, r);
    ctx.fill();
  }

  // Translucent gummy body with rich vertical jelly gradient
  const grad = ctx.createLinearGradient(x, y, x, y + s);
  grad.addColorStop(0, shade(color, 0.35));
  grad.addColorStop(0.4, color);
  grad.addColorStop(1, shade(color, -0.4));
  ctx.fillStyle = grad;
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(x, y, s, s, r);
    ctx.fill();
  } else {
    ctx.fillRect(x, y, s, s);
  }

  // Top curved white glossy lip / glass highlight
  const hlMargin = Math.max(2, s * 0.1);
  const hlW = s - hlMargin * 2;
  const hlH = Math.max(3, s * 0.28);
  const hlGrad = ctx.createLinearGradient(x, y, x, y + hlH);
  hlGrad.addColorStop(0, "rgba(255, 255, 255, 0.88)");
  hlGrad.addColorStop(0.5, "rgba(255, 255, 255, 0.45)");
  hlGrad.addColorStop(1, "rgba(255, 255, 255, 0.0)");
  ctx.fillStyle = hlGrad;
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(x + hlMargin, y + hlMargin * 0.8, hlW, hlH, Math.max(2, r * 0.7));
    ctx.fill();
  }

  // Bottom internal reflection glow
  const botGrad = ctx.createLinearGradient(x, y + s - hlH, x, y + s);
  botGrad.addColorStop(0, "rgba(255, 255, 255, 0.0)");
  botGrad.addColorStop(1, "rgba(255, 255, 255, 0.32)");
  ctx.fillStyle = botGrad;
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(x + hlMargin, y + s - hlH - 1, hlW, hlH, Math.max(2, r * 0.6));
    ctx.fill();
  }

  // Glistening micro-sparkles inside the jelly
  ctx.fillStyle = "rgba(255, 255, 255, 0.65)";
  const b1x = x + s * 0.3, b1y = y + s * 0.65, b1r = Math.max(1, s * 0.04);
  const b2x = x + s * 0.7, b2y = y + s * 0.55, b2r = Math.max(1, s * 0.03);
  ctx.beginPath(); ctx.arc(b1x, b1y, b1r, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(b2x, b2y, b2r, 0, Math.PI * 2); ctx.fill();

  // Translucent glassy rim outline
  ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
  ctx.lineWidth = 1;
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(x + 0.5, y + 0.5, s - 1, s - 1, r);
    ctx.stroke();
  }

  ctx.restore();
}

// 2. Pastel Pillowy Cushion Block Renderer (Screenshot 3)
function renderCushionBlock(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  size: number,
  color: string
) {
  ctx.save();
  const pad = 1;
  const s = size - pad * 2;
  const r = Math.max(4, Math.round(s * 0.22));
  const x = px + pad;
  const y = py + pad;

  // Soft cushion drop shadow
  ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(x + 1, y + 2, s, s, r);
    ctx.fill();
  }

  // Outer pillowy cushion puff (warm satin bevel)
  const outerGrad = ctx.createLinearGradient(x, y, x, y + s);
  outerGrad.addColorStop(0, shade(color, 0.28));
  outerGrad.addColorStop(1, shade(color, -0.22));
  ctx.fillStyle = outerGrad;
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(x, y, s, s, r);
    ctx.fill();
  } else {
    ctx.fillRect(x, y, s, s);
  }

  // Inset center cushion depression (the hallmark of Screenshot 3!)
  const insetPad = Math.max(3, Math.round(s * 0.22));
  const inW = s - insetPad * 2;
  const inR = Math.max(2, Math.round(inW * 0.18));
  const inX = x + insetPad;
  const inY = y + insetPad;

  // Inset shadow at top of center indent
  const innerGrad = ctx.createLinearGradient(inX, inY, inX, inY + inW);
  innerGrad.addColorStop(0, shade(color, -0.15));
  innerGrad.addColorStop(0.5, color);
  innerGrad.addColorStop(1, shade(color, 0.2));
  ctx.fillStyle = innerGrad;
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(inX, inY, inW, inW, inR);
    ctx.fill();
  }

  // Subtle inner highlight lip around inset bevel
  ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
  ctx.lineWidth = 1;
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(inX + 0.5, inY + 0.5, inW - 1, inW - 1, inR);
    ctx.stroke();
  }

  // Outer edge seam
  ctx.strokeStyle = "rgba(0, 0, 0, 0.2)";
  ctx.lineWidth = 1;
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(x + 0.5, y + 0.5, s - 1, s - 1, r);
    ctx.stroke();
  }

  ctx.restore();
}

// 3. Stitched Leather / Tufted Velvet Pillow Block (Screenshot 4)
function renderStitchedBlock(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  size: number,
  color: string
) {
  ctx.save();
  const pad = 1;
  const s = size - pad * 2;
  const r = Math.max(4, Math.round(s * 0.24));
  const x = px + pad;
  const y = py + pad;

  // Soft cushion drop shadow
  ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(x + 1, y + 2, s, s, r);
    ctx.fill();
  }

  // Leather/velvet domed pillow puff
  const cx = x + s / 2;
  const cy = y + s / 2;
  const radGrad = ctx.createRadialGradient(cx, cy * 0.95, s * 0.1, cx, cy, s * 0.65);
  radGrad.addColorStop(0, shade(color, 0.38));
  radGrad.addColorStop(0.7, color);
  radGrad.addColorStop(1, shade(color, -0.42));
  ctx.fillStyle = radGrad;
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(x, y, s, s, r);
    ctx.fill();
  } else {
    ctx.fillRect(x, y, s, s);
  }

  // Perimeter running stitch seam (the stitched thread effect!)
  const stitchInset = Math.max(2.5, Math.round(s * 0.12));
  const stW = s - stitchInset * 2;
  const stR = Math.max(2, Math.round(stW * 0.2));
  ctx.save();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
  ctx.lineWidth = 1.2;
  if (ctx.setLineDash) ctx.setLineDash([2.5, 2]);
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(x + stitchInset, y + stitchInset, stW, stW, stR);
    ctx.stroke();
  }
  ctx.restore();

  // Subtle diagonal tufting creases radiating to corners
  ctx.strokeStyle = "rgba(0, 0, 0, 0.15)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - 3, cy - 3); ctx.lineTo(x + stitchInset + 2, y + stitchInset + 2);
  ctx.moveTo(cx + 3, cy - 3); ctx.lineTo(x + s - stitchInset - 2, y + stitchInset + 2);
  ctx.moveTo(cx - 3, cy + 3); ctx.lineTo(x + stitchInset + 2, y + s - stitchInset - 2);
  ctx.moveTo(cx + 3, cy + 3); ctx.lineTo(x + s - stitchInset - 2, y + s - stitchInset - 2);
  ctx.stroke();

  // Center button / tuft depression
  const btnR = Math.max(1.5, Math.round(s * 0.08));
  ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
  ctx.beginPath();
  ctx.arc(cx, cy + 0.8, btnR + 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = shade(color, 0.2);
  ctx.beginPath();
  ctx.arc(cx, cy, btnR, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(cx - btnR * 0.3, cy - btnR * 0.3, Math.max(0.8, btnR * 0.35), 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// 4. Cosmic Nebula / Starfield Crystal Block (Screenshot 5)
function renderCosmicBlock(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  size: number,
  color: string
) {
  ctx.save();
  const pad = 0.5;
  const s = size - pad * 2;
  const b = Math.max(3, Math.round(s * 0.18));
  const r = Math.max(2, Math.round(s * 0.08));
  const x = px + pad;
  const y = py + pad;

  const tracePath = () => {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, s, s, r);
    else ctx.rect(x, y, s, s);
  };

  ctx.fillStyle = "#0c0a1a";
  tracePath();
  ctx.fill();
  ctx.save();
  tracePath();
  ctx.clip();

  // Cosmic Nebula Cloud Gradient
  const nebGrad = ctx.createLinearGradient(x, y, x + s, y + s);
  nebGrad.addColorStop(0, "#311042");
  nebGrad.addColorStop(0.5, "#1e1b4b");
  nebGrad.addColorStop(1, "#0f172a");
  ctx.fillStyle = nebGrad;
  ctx.fillRect(x, y, s, s);

  // Tint with block color
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.45;
  ctx.fillRect(x, y, s, s);
  ctx.globalAlpha = 1;

  // Faceted Crystalline Borders
  const facet = (pts: number[][], fill: string) => {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  };

  const x2 = x + s, y2 = y + s;
  facet([[x, y], [x2, y], [x2 - b, y + b], [x + b, y + b]], "rgba(192, 132, 252, 0.42)");
  facet([[x, y], [x + b, y + b], [x + b, y2 - b], [x, y2]], "rgba(147, 197, 253, 0.3)");
  facet([[x2, y], [x2, y2], [x2 - b, y2 - b], [x2 - b, y + b]], "rgba(15, 23, 42, 0.55)");
  facet([[x, y2], [x + b, y2 - b], [x2 - b, y2 - b], [x2, y2]], "rgba(10, 10, 20, 0.65)");

  // Sparkling Star Cluster inside the nebula
  const starX = x + s * 0.65;
  const starY = y + s * 0.35;
  const starR = Math.max(1.8, s * 0.09);
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(starX, starY - starR);
  ctx.lineTo(starX + starR * 0.35, starY);
  ctx.lineTo(starX, starY + starR);
  ctx.lineTo(starX - starR * 0.35, starY);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(starX - starR, starY);
  ctx.lineTo(starX, starY + starR * 0.35);
  ctx.lineTo(starX + starR, starY);
  ctx.lineTo(starX - starR * 0.35, starY);
  ctx.closePath();
  ctx.fill();

  // Secondary starlight pinpricks
  ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
  ctx.beginPath(); ctx.arc(x + s * 0.28, y + s * 0.65, Math.max(0.8, s * 0.035), 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + s * 0.45, y + s * 0.48, Math.max(0.7, s * 0.025), 0, Math.PI * 2); ctx.fill();

  ctx.restore(); // end clip

  ctx.strokeStyle = "rgba(168, 85, 247, 0.5)";
  ctx.lineWidth = 1;
  tracePath();
  ctx.stroke();

  ctx.restore();
}

// 5. Authentic Carved Plaque Tile Base for Jewel Blocks (Screenshot 1)
export function drawCarvedPlaqueBlock(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  size: number
) {
  ctx.save();
  const pad = 1;
  const s = size - pad * 2;
  const r = Math.max(3, Math.round(s * 0.12));
  const b = Math.max(2, Math.round(s * 0.14));
  const x = px + pad;
  const y = py + pad;

  // Carved wooden/golden plaque base
  const grad = ctx.createLinearGradient(x, y, x, y + s);
  grad.addColorStop(0, "#e2bb7b");
  grad.addColorStop(0.5, "#c89b53");
  grad.addColorStop(1, "#8c6225");
  ctx.fillStyle = grad;
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(x, y, s, s, r);
    ctx.fill();
  } else {
    ctx.fillRect(x, y, s, s);
  }

  // Chiseled bevels
  const x2 = x + s, y2 = y + s;
  ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
  ctx.beginPath();
  ctx.moveTo(x, y); ctx.lineTo(x2, y); ctx.lineTo(x2 - b, y + b); ctx.lineTo(x + b, y + b);
  ctx.closePath(); ctx.fill();

  ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
  ctx.beginPath();
  ctx.moveTo(x, y2); ctx.lineTo(x + b, y2 - b); ctx.lineTo(x2 - b, y2 - b); ctx.lineTo(x2, y2);
  ctx.closePath(); ctx.fill();

  // Inset gem socket
  ctx.fillStyle = "rgba(60, 36, 12, 0.35)";
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(x + b, y + b, s - b * 2, s - b * 2, Math.max(2, r * 0.6));
    ctx.fill();
  }

  ctx.restore();
}

// 5 Authentic Jewel Emblems (Screenshot 1)
export enum JewelType {
  DIAMOND = "diamond",   // Cyan rhombus (Screenshot 1 top left)
  EMERALD = "emerald",   // Green 4-point flare star (Screenshot 1)
  PENTAGON = "pentagon", // Orange 5-sided beveled shield (Screenshot 1)
  STAR = "star",         // Golden 5-pointed star (Screenshot 1)
  RUBY = "ruby",         // Red 8-pointed rosette/gem (Screenshot 1)
}

export function drawJewelEmblem(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  jewelType: JewelType = JewelType.DIAMOND
) {
  ctx.save();
  const r = size * 0.32;

  if (jewelType === JewelType.DIAMOND) {
    // Cyan Diamond Rhombus
    ctx.beginPath();
    ctx.moveTo(cx, cy - r * 1.1);
    ctx.lineTo(cx + r * 0.85, cy);
    ctx.lineTo(cx, cy + r * 1.1);
    ctx.lineTo(cx - r * 0.85, cy);
    ctx.closePath();
    const g = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
    g.addColorStop(0, "#38bdf8");
    g.addColorStop(0.5, "#00e5ff");
    g.addColorStop(1, "#0284c7");
    ctx.fillStyle = g;
    ctx.fill();

    // Inner bright facet
    ctx.beginPath();
    ctx.moveTo(cx, cy - r * 0.55);
    ctx.lineTo(cx + r * 0.45, cy);
    ctx.lineTo(cx, cy + r * 0.55);
    ctx.lineTo(cx - r * 0.45, cy);
    ctx.closePath();
    ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(cx + r * 0.22, cy - r * 0.35, Math.max(1.2, r * 0.18), 0, Math.PI * 2);
    ctx.fill();
  } else if (jewelType === JewelType.EMERALD) {
    // Green 4-point Radiant Flare Star
    ctx.beginPath();
    ctx.moveTo(cx, cy - r * 1.05);
    ctx.quadraticCurveTo(cx, cy, cx + r * 1.05, cy);
    ctx.quadraticCurveTo(cx, cy, cx, cy + r * 1.05);
    ctx.quadraticCurveTo(cx, cy, cx - r * 1.05, cy);
    ctx.quadraticCurveTo(cx, cy, cx, cy - r * 1.05);
    ctx.closePath();
    const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, r);
    g.addColorStop(0, "#a3e635");
    g.addColorStop(0.5, "#10b981");
    g.addColorStop(1, "#047857");
    ctx.fillStyle = g;
    ctx.fill();

    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    ctx.beginPath();
    ctx.moveTo(cx, cy - r * 0.35);
    ctx.lineTo(cx + r * 0.35, cy);
    ctx.lineTo(cx, cy + r * 0.35);
    ctx.lineTo(cx - r * 0.35, cy);
    ctx.closePath();
    ctx.fill();
  } else if (jewelType === JewelType.PENTAGON) {
    // Orange Beveled Pentagon
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
      const ppx = cx + Math.cos(angle) * r;
      const ppy = cy + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(ppx, ppy);
      else ctx.lineTo(ppx, ppy);
    }
    ctx.closePath();
    const g = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
    g.addColorStop(0, "#fbbf24");
    g.addColorStop(0.5, "#f97316");
    g.addColorStop(1, "#c2410c");
    ctx.fillStyle = g;
    ctx.fill();

    ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
      ctx.stroke();
    }
  } else if (jewelType === JewelType.STAR) {
    // Golden 5-point Star
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const rad = i % 2 === 0 ? r : r * 0.45;
      const angle = -Math.PI / 2 + (i * Math.PI) / 5;
      const ppx = cx + Math.cos(angle) * rad;
      const ppy = cy + Math.sin(angle) * rad;
      if (i === 0) ctx.moveTo(ppx, ppy);
      else ctx.lineTo(ppx, ppy);
    }
    ctx.closePath();
    const g = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
    g.addColorStop(0, "#fffbeb");
    g.addColorStop(0.4, "#ffd700");
    g.addColorStop(1, "#d97706");
    ctx.fillStyle = g;
    ctx.fill();

    ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
    ctx.lineWidth = 1;
    ctx.stroke();
  } else {
    // Ruby 8-point Faceted Rosette Gem
    ctx.beginPath();
    for (let i = 0; i < 16; i++) {
      const rad = i % 2 === 0 ? r : r * 0.72;
      const angle = (i * 2 * Math.PI) / 16;
      const ppx = cx + Math.cos(angle) * rad;
      const ppy = cy + Math.sin(angle) * rad;
      if (i === 0) ctx.moveTo(ppx, ppy);
      else ctx.lineTo(ppx, ppy);
    }
    ctx.closePath();
    const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, r);
    g.addColorStop(0, "#f43f5e");
    g.addColorStop(0.6, "#e11d48");
    g.addColorStop(1, "#881337");
    ctx.fillStyle = g;
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.globalAlpha = 0.65;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

// Public entry point: same signature as before, now a cached blit.
export function drawCandyBlock(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  size: number,
  color: string,
  alpha: number = 1
) {
  const sprite = getBlockSprite(color, size);
  const logical = size + SPRITE_MARGIN * 2;

  // Snap to device pixels so dragged (fractional) pieces stay crisp
  const dx = Math.round((px - SPRITE_MARGIN) * spriteScale) / spriteScale;
  const dy = Math.round((py - SPRITE_MARGIN) * spriteScale) / spriteScale;

  if (alpha !== 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.drawImage(sprite, dx, dy, logical, logical);
    ctx.restore();
  } else {
    ctx.drawImage(sprite, dx, dy, logical, logical);
  }
}

// Mitered gem-tile renderer: four lit facets around a flat centre plateau.
// Light comes from the top-left: top facet brightest, bottom darkest.
// Slow path: runs once per (colour, size) when the sprite is first built.
function renderBevelBlock(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  size: number,
  color: string
) {
  ctx.save();

  const inset = 0.5; // tiles nearly touch; the dark outline forms the seam
  const x = px + inset;
  const y = py + inset;
  const s = size - inset * 2;
  const b = Math.max(3, Math.round(s * 0.17)); // bevel width
  const r = Math.max(2, Math.round(s * 0.06)); // barely-rounded outer corners

  // Falls back to a plain rect on browsers without roundRect (same as the rest of the file)
  const tracePath = () => {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, s, s, r);
    else ctx.rect(x, y, s, s);
  };

  // Base fill + outer clip so facets inherit the rounded corners
  ctx.fillStyle = shade(color, -0.45);
  tracePath();
  ctx.fill();
  ctx.save();
  tracePath();
  ctx.clip();

  const facet = (pts: number[][], fill: string) => {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  };

  const x2 = x + s, y2 = y + s;
  facet([[x, y], [x2, y], [x2 - b, y + b], [x + b, y + b]], shade(color, 0.42)); // top
  facet([[x, y], [x + b, y + b], [x + b, y2 - b], [x, y2]], shade(color, 0.2)); // left
  facet([[x2, y], [x2, y2], [x2 - b, y2 - b], [x2 - b, y + b]], shade(color, -0.2)); // right
  facet([[x, y2], [x + b, y2 - b], [x2 - b, y2 - b], [x2, y2]], shade(color, -0.38)); // bottom

  // Flat centre plateau with a faint vertical gradient
  const g = ctx.createLinearGradient(0, y + b, 0, y2 - b);
  g.addColorStop(0, shade(color, 0.06));
  g.addColorStop(1, shade(color, -0.06));
  ctx.fillStyle = g;
  ctx.fillRect(x + b, y + b, s - b * 2, s - b * 2);

  // Crisp seam between facets and plateau
  ctx.strokeStyle = "rgba(0, 0, 0, 0.22)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x + b + 0.5, y + b + 0.5, s - b * 2 - 1, s - b * 2 - 1);

  ctx.restore(); // end clip

  // Thin specular line along the top edge + dark outer outline
  ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + r, y + 1);
  ctx.lineTo(x2 - r, y + 1);
  ctx.stroke();

  ctx.strokeStyle = shade(color, -0.6);
  ctx.lineWidth = 1;
  tracePath();
  ctx.stroke();

  ctx.restore();
}

// Juicy Modern Candy Block Renderer (Unified 3D look for Board and Tray)
// Slow path: only runs once per (color, size) when the sprite is first built.
function renderCandyBlock(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  size: number,
  color: string,
  alpha: number = 1
) {
  ctx.save();
  ctx.globalAlpha = alpha;

  const pad = 1;
  const s = size - pad * 2;
  const radius = Math.max(3, Math.floor(s * 0.16));
  const x = px + pad;
  const y = py + pad;

  // 1. Subtle drop shadow beneath the tile
  ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(x + 1, y + 2, s, s, radius);
    ctx.fill();
  } else {
    ctx.fillRect(x + 1, y + 2, s, s);
  }

  // 2. Base Block with Rich Vertical Gradient (light tinted top to deep saturated bottom)
  const grad = ctx.createLinearGradient(x, y, x, y + s);
  grad.addColorStop(0, adjustColorBrightness(color, 26));
  grad.addColorStop(0.5, color);
  grad.addColorStop(1, adjustColorBrightness(color, -28));

  ctx.fillStyle = grad;
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(x, y, s, s, radius);
    ctx.fill();
  } else {
    ctx.fillRect(x, y, s, s);
  }

  // 3. Subtle inner bevel facet shadows
  const b = Math.max(2, Math.floor(s * 0.14));

  // Top highlight facet
  ctx.fillStyle = "rgba(255, 255, 255, 0.32)";
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + s - radius, y);
  ctx.lineTo(x + s - radius - b, y + b);
  ctx.lineTo(x + radius + b, y + b);
  ctx.closePath();
  ctx.fill();

  // Bottom shadow facet
  ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
  ctx.beginPath();
  ctx.moveTo(x + radius, y + s);
  ctx.lineTo(x + s - radius, y + s);
  ctx.lineTo(x + s - radius - b, y + s - b);
  ctx.lineTo(x + radius + b, y + s - b);
  ctx.closePath();
  ctx.fill();

  // 4. Glossy Specular "Pill" Capsule Reflection on the Top Half
  const hlMargin = Math.max(2, s * 0.12);
  const hlWidth = s - hlMargin * 2;
  const hlHeight = Math.max(3, s * 0.32);
  const hlRadius = Math.max(2, hlHeight * 0.45);

  const hlGrad = ctx.createLinearGradient(x + hlMargin, y + hlMargin, x + hlMargin, y + hlMargin + hlHeight);
  hlGrad.addColorStop(0, "rgba(255, 255, 255, 0.65)");
  hlGrad.addColorStop(0.65, "rgba(255, 255, 255, 0.2)");
  hlGrad.addColorStop(1, "rgba(255, 255, 255, 0.0)");

  ctx.fillStyle = hlGrad;
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(x + hlMargin, y + hlMargin * 0.85, hlWidth, hlHeight, hlRadius);
    ctx.fill();
  } else {
    ctx.fillRect(x + hlMargin, y + hlMargin * 0.85, hlWidth, hlHeight);
  }

  // 5. Crisp tile groove seam
  ctx.strokeStyle = "rgba(0, 0, 0, 0.38)";
  ctx.lineWidth = 1;
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(x + 0.5, y + 0.5, s - 1, s - 1, radius);
    ctx.stroke();
  } else {
    ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);
  }

  ctx.restore();
}

// Backward compatibility alias
export const drawBeveledBlock = drawCandyBlock;

// Procedural Gem Overlay for Gem Target Blocks (Authentic Jewel Emblems)
export function drawGemOverlay(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  size: number,
  _gemColor: string = "#ffd600",
  jewelType: JewelType = JewelType.DIAMOND
) {
  drawJewelEmblem(ctx, px + size / 2, py + size / 2, size, jewelType);
}

// Weathered stone / obsidian fixed obstacle block (chiseled facets & corner rivets)
export function drawObstacleBlock(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  cellSize: number
) {
  const pad = 1.5;
  const s = cellSize - pad * 2;
  const x = px + pad;
  const y = py + pad;
  const r = Math.max(2, Math.round(s * 0.12));

  ctx.save();
  // 1. Dark chiseled stone body
  const grad = ctx.createLinearGradient(x, y, x, y + s);
  grad.addColorStop(0, "#475569");
  grad.addColorStop(0.5, "#334155");
  grad.addColorStop(1, "#1e293b");

  ctx.fillStyle = grad;
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(x, y, s, s, r);
    ctx.fill();
  } else {
    ctx.fillRect(x, y, s, s);
  }

  // 2. Chiseled bevel highlights
  const b = Math.max(2, Math.floor(s * 0.15));
  ctx.fillStyle = "rgba(255, 255, 255, 0.22)";
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + s - r, y);
  ctx.lineTo(x + s - r - b, y + b);
  ctx.lineTo(x + r + b, y + b);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
  ctx.beginPath();
  ctx.moveTo(x + r, y + s);
  ctx.lineTo(x + s - r, y + s);
  ctx.lineTo(x + s - r - b, y + s - b);
  ctx.lineTo(x + r + b, y + s - b);
  ctx.closePath();
  ctx.fill();

  // 3. Dark outline
  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 1.2;
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(x, y, s, s, r);
    ctx.stroke();
  } else {
    ctx.strokeRect(x, y, s, s);
  }

  // 4. Corner rivets
  const rivetOffset = Math.max(3, Math.floor(s * 0.18));
  const rivetR = Math.max(1, Math.floor(s * 0.05));
  ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
  const corners = [
    [x + rivetOffset, y + rivetOffset],
    [x + s - rivetOffset, y + rivetOffset],
    [x + rivetOffset, y + s - rivetOffset],
    [x + s - rivetOffset, y + s - rivetOffset],
  ];
  for (const [cx, cy] of corners) {
    ctx.beginPath();
    ctx.arc(cx, cy, rivetR, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

let staticBoardCanvas: HTMLCanvasElement | null = null;
let staticBoardKey = "";

export function invalidateBoardCache() {
  staticBoardKey = "";
}

export function drawGrid(
  ctx: CanvasRenderingContext2D,
  grid: (string | 0)[][],
  offset: GridOffset,
  theme?: WorldTheme,
  gemPositions?: Set<string>,
  obstaclePositions?: Set<string>,
  isPaperTheme: boolean = false,
  glowingPositions?: Set<string>,
  goldenPositions?: Set<string>,
  revealedTiles?: Set<string>,
  revealMode: "unmask" | "all-glass" | "classic" = "unmask"
) {
  const { x: startX, y: startY, cellSize } = offset;
  const gridSize = grid.length;

  const bgBorder = isPaperTheme
    ? "#e5dec9"
    : theme
    ? theme.gridBorder
    : "#3b82f6";
  const bgCell = isPaperTheme
    ? "#efe7d8"
    : theme
    ? theme.gridBgEven
    : "#344a7a";
  const frameBg = isPaperTheme
    ? "#fbf8f2"
    : theme
    ? theme.gridBgOdd
    : "#18223c";
  const gridDim = gridSize * cellSize;
  const framePad = 6;
  const frameRadius = 18;

  // 1. Offscreen static board caching (outer frame + glowing border + recessed sockets)
  if (typeof document !== "undefined") {
    const transform = ctx.getTransform ? ctx.getTransform() : { a: 1, d: 1 };
    const dprX = transform.a || 1;
    const dprY = transform.d || 1;
    const canvasW = ctx.canvas.width;
    const canvasH = ctx.canvas.height;
    const isAllGlass = revealMode === "all-glass";
    const hasRevealed = isAllGlass || (revealedTiles && revealedTiles.size > 0);
    const revealedKey = revealedTiles ? Array.from(revealedTiles).sort().join(";") : "";
    const currentKey = `${isPaperTheme},${startX},${startY},${cellSize},${gridSize},${theme ? theme.name : "default"},${bgCell},${bgBorder},${dprX},${canvasW},${canvasH},${revealMode},${revealedKey}`;

    if (!staticBoardCanvas) {
      staticBoardCanvas = document.createElement("canvas");
    }
    if (staticBoardKey !== currentKey) {
      staticBoardCanvas.width = canvasW;
      staticBoardCanvas.height = canvasH;
      const bCtx = staticBoardCanvas.getContext("2d");
      if (bCtx) {
        bCtx.setTransform(dprX, 0, 0, dprY, 0, 0);

        // Frame with outer glow
        bCtx.save();
        bCtx.fillStyle = frameBg;
        bCtx.strokeStyle = bgBorder;
        bCtx.lineWidth = isPaperTheme ? 1.8 : 2.5;
        bCtx.shadowColor = isPaperTheme
          ? "rgba(0, 0, 0, 0.04)"
          : theme
          ? theme.accentColor
          : "#3b82f6";
        bCtx.shadowBlur = isPaperTheme ? 4 : 14;

        if (bCtx.roundRect) {
          bCtx.beginPath();
          bCtx.roundRect(
            startX - framePad,
            startY - framePad,
            gridDim + framePad * 2,
            gridDim + framePad * 2,
            frameRadius
          );
          bCtx.fill();
          bCtx.shadowBlur = 0;
          bCtx.stroke();
        } else {
          bCtx.fillRect(
            startX - framePad,
            startY - framePad,
            gridDim + framePad * 2,
            gridDim + framePad * 2
          );
          bCtx.shadowBlur = 0;
          bCtx.strokeRect(
            startX - framePad,
            startY - framePad,
            gridDim + framePad * 2,
            gridDim + framePad * 2
          );
        }
        bCtx.restore();

        // 64 (or 100) sunken recessed sockets
        for (let gy = 0; gy < gridSize; gy++) {
          for (let gx = 0; gx < gridSize; gx++) {
            const px = startX + gx * cellSize;
            const py = startY + gy * cellSize;
            const pad = 1.5;
            const slotSize = cellSize - pad * 2;
            const slotRadius = Math.max(3, Math.floor(cellSize * 0.14));
            const sx = px + pad;
            const sy = py + pad;

            bCtx.fillStyle = bgCell;
            if (bCtx.roundRect) {
              bCtx.beginPath();
              bCtx.roundRect(sx, sy, slotSize, slotSize, slotRadius);
              bCtx.fill();
            } else {
              bCtx.fillRect(sx, sy, slotSize, slotSize);
            }

            // 1px Inner Top Shadow for sunken depth
            bCtx.strokeStyle = isPaperTheme
              ? "rgba(0, 0, 0, 0.08)"
              : "rgba(0, 0, 0, 0.55)";
            bCtx.lineWidth = 1.2;
            bCtx.beginPath();
            bCtx.moveTo(sx + slotRadius, sy);
            bCtx.lineTo(sx + slotSize - slotRadius, sy);
            bCtx.stroke();

            // Bottom highlight lip
            bCtx.strokeStyle = isPaperTheme
              ? "rgba(255, 255, 255, 0.65)"
              : "rgba(255, 255, 255, 0.11)";
            bCtx.lineWidth = 1;
            bCtx.beginPath();
            bCtx.moveTo(sx + slotRadius, sy + slotSize);
            bCtx.lineTo(sx + slotSize - slotRadius, sy + slotSize);
            bCtx.stroke();
          }
        }

        // Bake transparent windows directly onto static board cache once per board update
        if (hasRevealed && !isPaperTheme && revealMode !== "classic") {
          for (let gy = 0; gy < gridSize; gy++) {
            for (let gx = 0; gx < gridSize; gx++) {
              const key = `${gx},${gy}`;
              if (isAllGlass || (revealedTiles && revealedTiles.has(key))) {
                const px = startX + gx * cellSize;
                const py = startY + gy * cellSize;
                const pad = 1.5;
                const slotSize = cellSize - pad * 2;
                const slotRadius = Math.max(3, Math.floor(cellSize * 0.14));
                const sx = px + pad;
                const sy = py + pad;

                // Punch transparent window through static board to underlying wallpaper
                bCtx.save();
                bCtx.globalCompositeOperation = "destination-out";
                if (bCtx.roundRect) {
                  bCtx.beginPath();
                  bCtx.roundRect(sx, sy, slotSize, slotSize, slotRadius);
                  bCtx.fill();
                } else {
                  bCtx.fillRect(sx, sy, slotSize, slotSize);
                }
                bCtx.restore();

                // High-tech etched glass outline
                bCtx.strokeStyle = "rgba(255, 255, 255, 0.35)";
                bCtx.lineWidth = 1.2;
                if (bCtx.roundRect) {
                  bCtx.beginPath();
                  bCtx.roundRect(sx, sy, slotSize, slotSize, slotRadius);
                  bCtx.stroke();
                } else {
                  bCtx.strokeRect(sx, sy, slotSize, slotSize);
                }
              }
            }
          }
        }
      }
      staticBoardKey = currentKey;
    }

    // Blit cached static board layer directly at 1:1 pixel resolution in a single ultra-fast draw
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(staticBoardCanvas, 0, 0);
    ctx.restore();
  } else {
    // Non-DOM fallback
    ctx.save();
    ctx.fillStyle = theme ? theme.gridBgOdd : "#18223c";
    ctx.strokeStyle = bgBorder;
    ctx.lineWidth = 2.5;
    ctx.fillRect(startX - framePad, startY - framePad, gridDim + framePad * 2, gridDim + framePad * 2);
    ctx.restore();

    for (let gy = 0; gy < gridSize; gy++) {
      for (let gx = 0; gx < gridSize; gx++) {
        const px = startX + gx * cellSize;
        const py = startY + gy * cellSize;
        ctx.fillStyle = bgCell;
        ctx.fillRect(px + 1.5, py + 1.5, cellSize - 3, cellSize - 3);
      }
    }
  }

  // 2. Render only occupied cells (placed player blocks, fixed obstacles, gems)
  for (let gy = 0; gy < gridSize; gy++) {
    for (let gx = 0; gx < gridSize; gx++) {
      const cell = grid[gy][gx];
      if (cell) {
        const px = startX + gx * cellSize;
        const py = startY + gy * cellSize;
        const key = `${gx},${gy}`;
        if (obstaclePositions && obstaclePositions.has(key)) {
          drawObstacleBlock(ctx, px, py, cellSize);
        } else if (gemPositions && gemPositions.has(key)) {
          drawCarvedPlaqueBlock(ctx, px, py, cellSize);
          const jewelTypes = [JewelType.DIAMOND, JewelType.EMERALD, JewelType.PENTAGON, JewelType.STAR, JewelType.RUBY];
          const jewelIndex = Math.abs((gx * 3 + gy * 7) % jewelTypes.length);
          drawJewelEmblem(ctx, px + cellSize / 2, py + cellSize / 2, cellSize, jewelTypes[jewelIndex]);
        } else {
          drawCandyBlock(ctx, px, py, cellSize, cell);
        }

        // Radiant aura for glowing placed blocks on grid
        if (glowingPositions && glowingPositions.has(key)) {
          ctx.save();
          const pulse = 0.28 + Math.sin(Date.now() / 150) * 0.16;
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 1.4;
          ctx.globalAlpha = pulse;
          const pad = 1.5;
          if (ctx.strokeRect) {
            ctx.strokeRect(px + pad, py + pad, cellSize - pad * 2, cellSize - pad * 2);
          }
          ctx.restore();
        }

        // Golden star glint for golden placed blocks on grid
        if (goldenPositions && goldenPositions.has(key)) {
          ctx.save();
          ctx.fillStyle = "#ffffff";
          ctx.globalAlpha = 0.85;
          const glintR = Math.max(1.5, cellSize * 0.08);
          ctx.beginPath();
          ctx.arc(px + cellSize * 0.25, py + cellSize * 0.25, glintR, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
    }
  }
}

export function drawPiece(
  ctx: CanvasRenderingContext2D,
  shape: BlockShape,
  startX: number,
  startY: number,
  cellSize: number,
  color: string,
  alpha: number = 1,
  isGlowing: boolean = false,
  isGolden: boolean = false
) {
  if (isGlowing || isGolden) {
    ctx.save();
    const glowRadius = 8 + Math.sin(Date.now() / 150) * 4;
    ctx.shadowColor = isGolden ? "#ffd700" : color;
    ctx.shadowBlur = glowRadius;
  }

  for (let y = 0; y < shape.length; y++) {
    for (let x = 0; x < shape[y].length; x++) {
      if (shape[y][x]) {
        const px = startX + x * cellSize;
        const py = startY + y * cellSize;
        drawCandyBlock(
          ctx,
          px,
          py,
          cellSize,
          isGolden ? "#ffd700" : color,
          alpha
        );

        if (isGlowing) {
          ctx.save();
          const pulse = 0.25 + Math.sin(Date.now() / 140) * 0.15;
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 1.2;
          ctx.globalAlpha = pulse;
          const pad = 1;
          if (ctx.strokeRect) {
            ctx.strokeRect(px + pad, py + pad, cellSize - pad * 2, cellSize - pad * 2);
          }
          ctx.restore();
        }

        if (isGolden) {
          ctx.save();
          ctx.fillStyle = "#ffffff";
          ctx.globalAlpha = 0.85;
          const glintR = Math.max(1.5, cellSize * 0.08);
          ctx.beginPath();
          ctx.arc(px + cellSize * 0.25, py + cellSize * 0.25, glintR, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
    }
  }

  if (isGlowing || isGolden) {
    ctx.restore();
  }
}

export function drawGhostBlock(
  ctx: CanvasRenderingContext2D,
  shape: BlockShape,
  gridX: number,
  gridY: number,
  offset: GridOffset,
  color: string,
  grid?: (string | 0)[][],
  gemPositions?: Set<string>,
  _gemColor: string = "#ffd600"
) {
  const { x: startX, y: startY, cellSize } = offset;
  const gridSize = grid ? grid.length : 8;
  const gridDim = gridSize * cellSize;

  const clearingCellKeys = new Set<string>();

  // 1. Highlight rows or columns that will clear if placed here!
  if (grid) {
    const willClearRows: number[] = [];
    const willClearCols: number[] = [];

    for (let gy = 0; gy < gridSize; gy++) {
      let full = true;
      for (let gx = 0; gx < gridSize; gx++) {
        const hasExisting = grid[gy][gx] !== 0;
        const fromPiece =
          gx >= gridX &&
          gx < gridX + shape[0].length &&
          gy >= gridY &&
          gy < gridY + shape.length &&
          shape[gy - gridY][gx - gridX] !== 0;
        if (!hasExisting && !fromPiece) {
          full = false;
          break;
        }
      }
      if (full) willClearRows.push(gy);
    }

    for (let gx = 0; gx < gridSize; gx++) {
      let full = true;
      for (let gy = 0; gy < gridSize; gy++) {
        const hasExisting = grid[gy][gx] !== 0;
        const fromPiece =
          gx >= gridX &&
          gx < gridX + shape[0].length &&
          gy >= gridY &&
          gy < gridY + shape.length &&
          shape[gy - gridY][gx - gridX] !== 0;
        if (!hasExisting && !fromPiece) {
          full = false;
          break;
        }
      }
      if (full) willClearCols.push(gx);
    }

    if (willClearRows.length > 0 || willClearCols.length > 0) {
      for (const r of willClearRows) {
        for (let gx = 0; gx < gridSize; gx++) {
          clearingCellKeys.add(`${gx},${r}`);
        }
      }
      for (const c of willClearCols) {
        for (let gy = 0; gy < gridSize; gy++) {
          clearingCellKeys.add(`${c},${gy}`);
        }
      }

      // A. RECOLOR ALL EXISTING TILES in the blasted lines to the EXACT color of the placed piece!
      const pulseHighlight = 0.22 + Math.sin(Date.now() / 120) * 0.12;

      for (const key of clearingCellKeys) {
        const [gxStr, gyStr] = key.split(",");
        const gx = Number(gxStr);
        const gy = Number(gyStr);

        // If an existing piece sits on the board, paint it in the placed piece's color
        if (grid[gy][gx] !== 0) {
          const px = startX + gx * cellSize;
          const py = startY + gy * cellSize;

          drawCandyBlock(ctx, px, py, cellSize, color, 1);

          // Subtle pulsing shine overlay
          ctx.save();
          ctx.fillStyle = `rgba(255, 255, 255, ${pulseHighlight})`;
          const pad = 1.5;
          const s = cellSize - pad * 2;
          const r = Math.max(2, Math.round(s * 0.14));
          if (ctx.roundRect) {
            ctx.beginPath();
            ctx.roundRect(px + pad, py + pad, s, s, r);
            ctx.fill();
          } else {
            ctx.fillRect(px + pad, py + pad, s, s);
          }
          ctx.restore();

          // Preserve gem target overlay if present
          if (gemPositions && gemPositions.has(key)) {
            const jewelTypes = [JewelType.DIAMOND, JewelType.EMERALD, JewelType.PENTAGON, JewelType.STAR, JewelType.RUBY];
            const jewelIndex = Math.abs((gx * 3 + gy * 7) % jewelTypes.length);
            drawJewelEmblem(ctx, px + cellSize / 2, py + cellSize / 2, cellSize, jewelTypes[jewelIndex]);
          }
        }
      }

      // B. Radiant energy beam in the piece's color across the completed rows & cols
      ctx.save();
      const beamAlpha = 0.22 + Math.sin(Date.now() / 140) * 0.1;
      ctx.fillStyle = color;
      ctx.globalAlpha = beamAlpha;

      for (const r of willClearRows) {
        ctx.fillRect(startX, startY + r * cellSize, gridDim, cellSize);
      }
      for (const c of willClearCols) {
        ctx.fillRect(startX + c * cellSize, startY, cellSize, gridDim);
      }
      ctx.restore();
    }
  }

  // 2. Ghost placement rendering for the dragged piece itself
  ctx.save();
  const pad = 1.5;
  const blockSize = cellSize - pad * 2;
  const radius = Math.max(3, Math.floor(cellSize * 0.16));

  for (let y = 0; y < shape.length; y++) {
    for (let x = 0; x < shape[y].length; x++) {
      if (shape[y][x]) {
        const gx = gridX + x;
        const gy = gridY + y;
        const px = startX + gx * cellSize + pad;
        const py = startY + gy * cellSize + pad;
        const isClearingCell = clearingCellKeys.has(`${gx},${gy}`);

        if (isClearingCell) {
          // Part of the blasted line: render solid in piece color to unify the full row/col
          drawCandyBlock(ctx, startX + gx * cellSize, startY + gy * cellSize, cellSize, color, 1);

          ctx.save();
          const pulse = 0.22 + Math.sin(Date.now() / 120) * 0.12;
          ctx.fillStyle = `rgba(255, 255, 255, ${pulse})`;
          if (ctx.roundRect) {
            ctx.beginPath();
            ctx.roundRect(px, py, blockSize, blockSize, radius);
            ctx.fill();
          } else {
            ctx.fillRect(px, py, blockSize, blockSize);
          }
          ctx.restore();
        } else {
          // Standard translucent ghost block
          ctx.fillStyle = color;
          ctx.globalAlpha = 0.42;
          if (ctx.roundRect) {
            ctx.beginPath();
            ctx.roundRect(px, py, blockSize, blockSize, radius);
            ctx.fill();
          } else {
            ctx.fillRect(px, py, blockSize, blockSize);
          }

          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 1.5;
          ctx.globalAlpha = 0.75;
          ctx.stroke();
        }
      }
    }
  }

  ctx.restore();
}

export function drawTray(
  ctx: CanvasRenderingContext2D,
  availableBlocks: TrayBlock[],
  layout?: LayoutMetrics,
  fallbackBlockSize?: number,
  isPaperTheme: boolean = false,
  grid?: (string | 0)[][]
) {
  // 1. Tray framing: Subtle rounded container and slot cradles
  if (layout) {
    const count = availableBlocks.length || 3;
    const trayWidth = layout.boardSize;
    const trayStartX = layout.boardX;
    const trayY = layout.trayY;
    const trayH = layout.trayH;
    const slotW = trayWidth / count;

    ctx.save();
    // Subtle rounded tray container panel matching board width
    ctx.fillStyle = isPaperTheme
      ? "rgba(0, 0, 0, 0.03)"
      : "rgba(0, 0, 0, 0.22)";
    ctx.strokeStyle = isPaperTheme
      ? "#e5dec9"
      : "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 1;
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(trayStartX, trayY, trayWidth, trayH, 16);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillRect(trayStartX, trayY, trayWidth, trayH);
      ctx.strokeRect(trayStartX, trayY, trayWidth, trayH);
    }

    // Faint slot cradle outlines
    for (let i = 0; i < count; i++) {
      const slotPad = 6;
      const sx = trayStartX + i * slotW + slotPad;
      const sy = trayY + slotPad;
      const sw = slotW - slotPad * 2;
      const sh = trayH - slotPad * 2;

      ctx.fillStyle = isPaperTheme
        ? "rgba(0, 0, 0, 0.02)"
        : "rgba(255, 255, 255, 0.025)";
      ctx.strokeStyle = isPaperTheme
        ? "rgba(0, 0, 0, 0.06)"
        : "rgba(255, 255, 255, 0.05)";
      ctx.lineWidth = 1;

      if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(sx, sy, sw, sh, 12);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.fillRect(sx, sy, sw, sh);
        ctx.strokeRect(sx, sy, sw, sh);
      }
    }
    ctx.restore();
  }

  // 2. Render active pieces inside slots
  const gridSize = grid ? grid.length : 0;
  for (const block of availableBlocks) {
    if (block.active) {
      let isPlayable = true;
      if (grid && gridSize > 0) {
        isPlayable = false;
        for (let gy = 0; gy <= gridSize - block.shape.length; gy++) {
          for (let gx = 0; gx <= gridSize - block.shape[0].length; gx++) {
            if (canPlaceBlockAtPosition(grid, block.shape, gx, gy)) {
              isPlayable = true;
              break;
            }
          }
          if (isPlayable) break;
        }
      }

      const alpha = isPlayable ? 1 : 0.32;
      const size = block.cellSize || fallbackBlockSize || 32;
      drawPiece(
        ctx,
        block.shape,
        block.x,
        block.y,
        size,
        block.color,
        alpha,
        isPlayable && block.isGlowing,
        isPlayable && block.isGolden
      );
    }
  }
}

export interface BoardPressureMetrics {
  pressure: number; // 0.0 (calm/generous) to 1.0 (tense/demanding)
  density: number;
  fragmentation: number;
  deadCellRatio: number;
  progressRamp: number;
}

export function computeBoardPressure(
  grid: (string | 0)[][],
  blocksPlaced: number = 0,
  maxMoves?: number
): BoardPressureMetrics {
  const size = grid.length;
  const totalCells = size * size;
  let filledCells = 0;
  let emptyCells = 0;
  let isolatedDeadHoles = 0;
  let exposedFilledEdges = 0;

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const isFilled = grid[r][c] !== 0;
      if (isFilled) {
        filledCells++;
        const neighbors = [
          [r - 1, c],
          [r + 1, c],
          [r, c - 1],
          [r, c + 1],
        ];
        for (const [nr, nc] of neighbors) {
          if (nr < 0 || nr >= size || nc < 0 || nc >= size || grid[nr][nc] === 0) {
            exposedFilledEdges++;
          }
        }
      } else {
        emptyCells++;
        const hasEmptyNeighbor = [
          [r - 1, c],
          [r + 1, c],
          [r, c - 1],
          [r, c + 1],
        ].some(([nr, nc]) => nr >= 0 && nr < size && nc >= 0 && nc < size && grid[nr][nc] === 0);

        if (!hasEmptyNeighbor) {
          isolatedDeadHoles++;
        }
      }
    }
  }

  const density = totalCells > 0 ? filledCells / totalCells : 0;
  const fragmentation = filledCells > 0 ? Math.min(1.0, exposedFilledEdges / (filledCells * 4)) : 0;
  const deadCellRatio = emptyCells > 0 ? isolatedDeadHoles / emptyCells : 0;

  const targetRamp = maxMoves || 100;
  const progressRamp = Math.min(1.0, blocksPlaced / targetRamp);

  const rawPressure =
    density * 0.38 +
    fragmentation * 0.22 +
    deadCellRatio * 0.25 +
    progressRamp * 0.15;

  const pressure = Math.max(0.0, Math.min(1.0, rawPressure));
  return { pressure, density, fragmentation, deadCellRatio, progressRamp };
}

interface SolvableCandidate {
  shapes: BlockShape[];
  helpfulness: number;
}

function evaluateCandidateSolvability(
  grid: (string | 0)[][],
  shapes: BlockShape[]
): SolvableCandidate | null {
  const size = grid.length;
  let currentGrid = grid.map((r) => [...r]);
  let totalLinesCleared = 0;

  for (const shape of shapes) {
    let placed = false;
    let bestCleared = -1;
    let bestScore = -999;
    let nextGrid: (string | 0)[][] = [];

    for (let gy = 0; gy <= size - shape.length; gy++) {
      for (let gx = 0; gx <= size - shape[0].length; gx++) {
        if (!canPlaceBlockAtPosition(currentGrid, shape, gx, gy)) continue;

        placed = true;
        const sim = currentGrid.map((r) => [...r]);
        for (let r = 0; r < shape.length; r++) {
          for (let c = 0; c < shape[r].length; c++) {
            if (shape[r][c]) sim[gy + r][gx + c] = "#solv";
          }
        }

        let cleared = 0;
        const rowsToClear: number[] = [];
        const colsToClear: number[] = [];
        for (let r = 0; r < size; r++) {
          if (sim[r].every((cell) => cell !== 0)) rowsToClear.push(r);
        }
        for (let c = 0; c < size; c++) {
          let full = true;
          for (let r = 0; r < size; r++) {
            if (sim[r][c] === 0) { full = false; break; }
          }
          if (full) colsToClear.push(c);
        }

        cleared = rowsToClear.length + colsToClear.length;
        for (const r of rowsToClear) {
          for (let c = 0; c < size; c++) sim[r][c] = 0;
        }
        for (const c of colsToClear) {
          for (let r = 0; r < size; r++) sim[r][c] = 0;
        }

        const score = cleared * 15 - gy * 0.5;
        if (score > bestScore) {
          bestScore = score;
          bestCleared = cleared;
          nextGrid = sim;
        }
      }
    }

    if (!placed) {
      return null;
    }

    currentGrid = nextGrid;
    totalLinesCleared += Math.max(0, bestCleared);
  }

  let remainingEmpty = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (currentGrid[r][c] === 0) remainingEmpty++;
    }
  }

  const helpfulness = totalLinesCleared * 25 + remainingEmpty;
  return { shapes, helpfulness };
}

export function createTrayBlocks({
  availableBlocks,
  canvasWidth,
  trayY,
  trayH = 120,
  boardCellSize = 42,
  boardX,
  boardSize,
  rng,
  handSize = 3,
  allowedTiers,
  failCount = 0,
  grid,
  blocksPlaced = 0,
  maxMoves,
  isSpecialDeal = false,
}: {
  availableBlocks: TrayBlock[];
  canvasWidth: number;
  trayY: number;
  trayH?: number;
  boardCellSize?: number;
  boardX?: number;
  boardSize?: number;
  rng: PRNG;
  handSize?: number;
  allowedTiers?: ShapeTier[];
  failCount?: number;
  grid?: (string | 0)[][];
  blocksPlaced?: number;
  maxMoves?: number;
  isSpecialDeal?: boolean;
}) {
  availableBlocks.length = 0;
  const count = handSize;
  const trayWidth = boardSize || canvasWidth;
  const trayStartX = boardX !== undefined ? boardX : Math.floor((canvasWidth - trayWidth) / 2);
  const slotWidth = trayWidth / count;
  const centerY = trayY + trayH / 2;

  let effectiveTiers = allowedTiers;
  if (allowedTiers && allowedTiers.length > 0) {
    if (failCount >= 3) {
      effectiveTiers = [ShapeTier.HELPER];
    } else if (failCount >= 2) {
      effectiveTiers = allowedTiers.filter((t) => t !== ShapeTier.CHUNK);
    }
  }

  const sampleShapes = (tiers?: ShapeTier[]): BlockShape[] => {
    const list: BlockShape[] = [];
    for (let i = 0; i < count; i++) {
      const shape =
        tiers && tiers.length > 0
          ? getRandomShapeFromPool(tiers, rng)
          : getRandomShape(rng);
      list.push(shape);
    }
    return list;
  };

  let chosenShapes: BlockShape[] | null = null;

  // If a grid is provided, run Constructive Solvability with Board Pressure ranking
  if (grid && grid.length > 0) {
    const pressureMetrics = computeBoardPressure(grid, blocksPlaced, maxMoves);
    const solvableCandidates: SolvableCandidate[] = [];
    const candidateRounds = 7;

    for (let c = 0; c < candidateRounds; c++) {
      const candidateShapes = sampleShapes(effectiveTiers);
      const evalRes = evaluateCandidateSolvability(grid, candidateShapes);
      if (evalRes) {
        solvableCandidates.push(evalRes);
      }
    }

    if (solvableCandidates.length > 0) {
      // Sort from least helpful to most helpful
      solvableCandidates.sort((a, b) => a.helpfulness - b.helpfulness);
      // Low pressure picks high quantile (most helpful), high pressure picks lower quantile
      const quantile = Math.max(0, Math.min(1, 1.0 - pressureMetrics.pressure));
      const pickIdx = Math.round(quantile * (solvableCandidates.length - 1));
      chosenShapes = solvableCandidates[pickIdx].shapes;
    } else {
      // Fallback: If no unconstrained candidate was solvable on a crowded board,
      // generate from HELPER tier so the player gets placeable pieces to clear space
      const helperCandidates: SolvableCandidate[] = [];
      for (let c = 0; c < 5; c++) {
        const helperShapes = sampleShapes([ShapeTier.HELPER]);
        const evalRes = evaluateCandidateSolvability(grid, helperShapes);
        if (evalRes) {
          helperCandidates.push(evalRes);
        }
      }
      if (helperCandidates.length > 0) {
        chosenShapes = helperCandidates[helperCandidates.length - 1].shapes;
      }
    }
  }

  // Final fallback to standard random draw if needed
  if (!chosenShapes) {
    chosenShapes = sampleShapes(effectiveTiers);
  }

  // Solvability Guarantee: If grid is provided, ensure at least one piece (and ideally all pieces)
  // can definitely be placed into the board's existing empty spaces so board blocks/jewels are never destroyed!
  if (grid && grid.length > 0) {
    const checkCanPlace = (shape: BlockShape): boolean => {
      const gSize = grid.length;
      for (let gy = 0; gy <= gSize - shape.length; gy++) {
        for (let gx = 0; gx <= gSize - shape[0].length; gx++) {
          if (canPlaceBlockAtPosition(grid, shape, gx, gy)) return true;
        }
      }
      return false;
    };

    const hasPlayable = chosenShapes.some((shape) => checkCanPlace(shape));
    if (!hasPlayable) {
      // Find all shapes from the catalog that fit into current empty spaces on the board
      const fittingShapes: BlockShape[] = [];
      for (const def of BLOCK_DEFS) {
        if (checkCanPlace(def.shape)) {
          fittingShapes.push(def.shape);
        }
      }

      if (fittingShapes.length > 0) {
        // Sort ascending by cell count (e.g. 1x1 dot, 2x1 domino first)
        fittingShapes.sort((a, b) => {
          const countA = a.reduce((sum, row) => sum + row.reduce((s, c) => s + c, 0), 0);
          const countB = b.reduce((sum, row) => sum + row.reduce((s, c) => s + c, 0), 0);
          return countA - countB;
        });

        chosenShapes = [];
        for (let i = 0; i < count; i++) {
          chosenShapes.push(fittingShapes[i % fittingShapes.length]);
        }
      } else {
        // As long as there is any empty cell on the board, a 1x1 dot can always fit
        chosenShapes = Array.from({ length: count }, () => [[1]]);
      }
    }
  }

  // Special All Clear deal theme roll
  let specialColor: string | null = null;
  let specialGlowing = false;
  let specialGolden = false;

  if (isSpecialDeal) {
    const roll = rng.next ? rng.next() : Math.random();
    const curatedPalette = ["#ff007f", "#00f0ff", "#ffd700", "#a855f7", "#10b981", "#ff5722"];
    const pickColor = curatedPalette[Math.floor((rng.next ? rng.next() : Math.random()) * curatedPalette.length)];

    if (roll < 0.45) {
      // Monochromatic Glowing Deal: All pieces share vibrant color & pulse with radiant aura
      specialColor = pickColor;
      specialGlowing = true;
    } else if (roll < 0.75) {
      // Pure Monochromatic Deal: All pieces share single curated color
      specialColor = pickColor;
    } else {
      // Royal Golden Deal: All pieces gleam with metallic gold stars
      specialColor = "#ffd700";
      specialGolden = true;
    }
  }

  for (let i = 0; i < count; i++) {
    const shape = chosenShapes[i];
    const color = specialColor || getRandomColor(rng);

    const cols = shape[0].length;
    const rows = shape.length;

    // Scale each piece individually to fit its slot with safe margins
    const pieceCellSize = computePieceCellSize(shape, slotWidth, trayH, boardCellSize);
    const pieceWidth = cols * pieceCellSize;
    const pieceHeight = rows * pieceCellSize;

    const slotCenterX = trayStartX + slotWidth * i + slotWidth / 2;
    const x = Math.floor(slotCenterX - pieceWidth / 2);
    const y = Math.floor(centerY - pieceHeight / 2);

    availableBlocks.push({
      shape,
      color,
      x,
      y,
      active: true,
      originalIndex: i,
      cellSize: pieceCellSize,
      isGlowing: specialGlowing,
      isGolden: specialGolden,
    });
  }
}

export function canPlaceBlockAtPosition(
  grid: (string | 0)[][],
  shape: BlockShape,
  gridX: number,
  gridY: number
): boolean {
  const gridSize = grid.length;
  if (
    gridX < 0 ||
    gridY < 0 ||
    gridX + shape[0].length > gridSize ||
    gridY + shape.length > gridSize
  ) {
    return false;
  }

  for (let y = 0; y < shape.length; y++) {
    for (let x = 0; x < shape[y].length; x++) {
      if (shape[y][x] && grid[gridY + y][gridX + x] !== 0) {
        return false;
      }
    }
  }

  return true;
}

export function findBestGridPlacement({
  grid,
  block,
  blockVisualX,
  blockVisualY,
  offset,
}: {
  grid: (string | 0)[][];
  block: { shape: BlockShape };
  blockVisualX: number;
  blockVisualY: number;
  offset: GridOffset;
}): { gridX: number; gridY: number; canPlace: boolean } {
  const { x: startX, y: startY, cellSize } = offset;

  const targetGridX = Math.round((blockVisualX - startX) / cellSize);
  const targetGridY = Math.round((blockVisualY - startY) / cellSize);

  let bestGridX = -1;
  let bestGridY = -1;
  let minDistance = cellSize * 1.2;

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const gx = targetGridX + dx;
      const gy = targetGridY + dy;

      if (canPlaceBlockAtPosition(grid, block.shape, gx, gy)) {
        const snapPixelX = startX + gx * cellSize;
        const snapPixelY = startY + gy * cellSize;
        const dist = Math.hypot(blockVisualX - snapPixelX, blockVisualY - snapPixelY);

        if (dist < minDistance) {
          minDistance = dist;
          bestGridX = gx;
          bestGridY = gy;
        }
      }
    }
  }

  return {
    gridX: bestGridX,
    gridY: bestGridY,
    canPlace: bestGridX !== -1 && bestGridY !== -1,
  };
}

export function checkAndClearLines(
  grid: (string | 0)[][],
  offset: GridOffset,
  gemPositions?: Set<string>,
  obstaclePositions?: Set<string>,
  clearingColor?: string
): {
  linesCleared: number;
  clearedBlockCount: number;
  gemsCleared: number;
  isAllClear: boolean;
  rowsToClear: number[];
  colsToClear: number[];
  clearedKeys: Set<string>;
} {
  const gridSize = grid.length;
  const rowsToClear: number[] = [];
  const colsToClear: number[] = [];

  // Check rows
  for (let y = 0; y < gridSize; y++) {
    if (grid[y].every((cell) => cell !== 0)) {
      rowsToClear.push(y);
    }
  }

  // Check cols
  for (let x = 0; x < gridSize; x++) {
    let colComplete = true;
    for (let y = 0; y < gridSize; y++) {
      if (grid[y][x] === 0) {
        colComplete = false;
        break;
      }
    }
    if (colComplete) {
      colsToClear.push(x);
    }
  }

  const { x: startX, y: startY, cellSize } = offset;
  const gridDim = gridSize * cellSize;

  // Recolor all tiles in completed rows & cols to the placed piece's color
  if (clearingColor) {
    for (const row of rowsToClear) {
      for (let x = 0; x < gridSize; x++) {
        grid[row][x] = clearingColor;
      }
    }
    for (const col of colsToClear) {
      for (let y = 0; y < gridSize; y++) {
        grid[y][col] = clearingColor;
      }
    }
  }

  // 1. Spawn line sweep energy flashes in the clearing color
  for (const row of rowsToClear) {
    const rowColor = clearingColor || (grid[row][0] ? String(grid[row][0]) : "#00e5ff");
    particles.spawnLineFlash(startX, startY + row * cellSize, gridDim, cellSize, rowColor);
  }

  for (const col of colsToClear) {
    const colColor = clearingColor || (grid[0][col] ? String(grid[0][col]) : "#76ff03");
    particles.spawnLineFlash(startX + col * cellSize, startY, cellSize, gridDim, colColor);
  }

  // 2. Clear cells and spawn particle bursts in the clearing color
  let clearedBlockCount = 0;
  let gemsCleared = 0;
  const clearedSet = new Set<string>();

  for (const row of rowsToClear) {
    for (let x = 0; x < gridSize; x++) {
      const cellColor = clearingColor || grid[row][x];
      const key = `${x},${row}`;
      if (cellColor && !clearedSet.has(key)) {
        clearedSet.add(key);
        clearedBlockCount++;

        if (gemPositions && gemPositions.has(key)) {
          gemsCleared++;
          gemPositions.delete(key);
        }
        if (obstaclePositions && obstaclePositions.has(key)) {
          obstaclePositions.delete(key);
        }

        const centerX = startX + x * cellSize + cellSize / 2;
        const centerY = startY + row * cellSize + cellSize / 2;
        particles.spawnBlockBurst(centerX, centerY, String(cellColor), 8);
      }
      grid[row][x] = 0;
    }
  }

  for (const col of colsToClear) {
    for (let y = 0; y < gridSize; y++) {
      const cellColor = clearingColor || grid[y][col];
      const key = `${col},${y}`;
      if (cellColor && !clearedSet.has(key)) {
        clearedSet.add(key);
        clearedBlockCount++;

        if (gemPositions && gemPositions.has(key)) {
          gemsCleared++;
          gemPositions.delete(key);
        }
        if (obstaclePositions && obstaclePositions.has(key)) {
          obstaclePositions.delete(key);
        }

        const centerX = startX + col * cellSize + cellSize / 2;
        const centerY = startY + y * cellSize + cellSize / 2;
        particles.spawnBlockBurst(centerX, centerY, String(cellColor), 8);
      }
      grid[y][col] = 0;
    }
  }

  const linesCleared = rowsToClear.length + colsToClear.length;
  const isAllClear =
    linesCleared > 0 && grid.every((row) => row.every((c) => c === 0));
  return {
    linesCleared,
    clearedBlockCount,
    gemsCleared,
    isAllClear,
    rowsToClear,
    colsToClear,
    clearedKeys: clearedSet,
  };
}

export function canPlaceAnyBlock({
  grid,
  availableBlocks,
}: {
  grid: (string | 0)[][];
  availableBlocks: TrayBlock[];
}): boolean {
  const gridSize = grid.length;
  for (const block of availableBlocks) {
    if (!block.active) continue;

    for (let gy = 0; gy <= gridSize - block.shape.length; gy++) {
      for (let gx = 0; gx <= gridSize - block.shape[0].length; gx++) {
        if (canPlaceBlockAtPosition(grid, block.shape, gx, gy)) {
          return true;
        }
      }
    }
  }
  return false;
}
