import type Phaser from 'phaser';
import { t } from '@/content/locale';
import { HOME_TIERS, buildingById, RESIDENTS } from '@/content/buildings';
import { RINGS } from '@/content/rings';
import { STAGES } from '@/content/stages';
import { equipmentById } from '@/content/equipment';
import { buildingsKey, buildingMeta } from '@/systems/assets';
import { footprintOf } from '@/systems/building';
import { effectiveRank } from '@/systems/rings';
import type { GameState } from '@/systems/state';
import type { RingSlot } from '@/types';

/**
 * Draws a shareable picture of the player's settlement and loadout.
 *
 * Everything is composed from textures already in memory and from the player's
 * own save, on a plain 2D canvas — nothing is uploaded, and no network call is
 * made. The caller decides whether to show it or offer it as a download.
 */

const CARD_W = 900;
const CARD_H = 560;
const TILE = 64;

const INK = '#141a18';
const PARCHMENT = '#e4d8bc';
const GOLD = '#c2a264';
const MUTED = '#9a8f78';

interface Frame {
  image: CanvasImageSource;
  cutX: number; cutY: number; cutW: number; cutH: number;
  anchorX: number; anchorY: number;
}

function frameFor(scene: Phaser.Scene, key: string, name: string, anchorX: number, anchorY: number): Frame | null {
  if (!scene.textures.exists(key)) return null;
  const tex = scene.textures.get(key);
  if (!tex.has(name)) return null;
  const f = tex.get(name);
  const src = f.source.image as CanvasImageSource;
  // A compressed or not-yet-decoded source has no usable bitmap to copy from.
  if (!src || (src as HTMLImageElement).width === 0) return null;
  return { image: src, cutX: f.cutX, cutY: f.cutY, cutW: f.cutWidth, cutH: f.cutHeight, anchorX, anchorY };
}

/** The same 2:1 isometric projection the world renderer uses, at card scale. */
function project(wx: number, wy: number, scale: number): { x: number; y: number } {
  return { x: (wx - wy) * 0.5 * scale, y: (wx + wy) * 0.25 * scale };
}

export interface CardPiece { frame: Frame; wx: number; wy: number; depth: number }

function collectPieces(scene: Phaser.Scene, state: GameState): CardPiece[] {
  const season = state.calendar.season;
  const key = buildingsKey(season);
  const pieces: CardPiece[] = [];

  const tier = HOME_TIERS[Math.max(0, Math.min(HOME_TIERS.length - 1, state.home.tier))]!;
  const tierMeta = buildingMeta(season, tier.art);
  const tierFrame = frameFor(scene, key, `${tier.art}_0_lit`, tierMeta?.anchorX ?? 0.5, tierMeta?.anchorY ?? 0.9);
  // The keep sits at the plot's near corner, matching the home scene's anchor.
  const plotW = tier.plotW, plotD = tier.plotD;
  if (tierFrame) pieces.push({ frame: tierFrame, wx: -2.5 * TILE, wy: (plotD / 2) * TILE, depth: 0 });

  for (const b of state.home.buildings) {
    const def = buildingById(b.id);
    if (!def) continue;
    const meta = buildingMeta(season, def.art);
    const variants = meta?.variants ?? 1;
    const f = footprintOf(b);
    const frame = frameFor(scene, key, `${def.art}_${b.variant % variants}_lit`, meta?.anchorX ?? 0.5, meta?.anchorY ?? 0.9);
    if (!frame) continue;
    pieces.push({
      frame,
      wx: (f.gx + f.w / 2) * TILE,
      wy: (f.gy + f.d / 2) * TILE,
      depth: 0,
    });
  }
  void plotW;
  for (const p of pieces) p.depth = p.wx + p.wy;
  pieces.sort((a, b) => a.depth - b.depth);
  return pieces;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function renderStrongholdCard(scene: Phaser.Scene, state: GameState): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  // --- ground
  const sky = ctx.createLinearGradient(0, 0, 0, CARD_H);
  sky.addColorStop(0, '#1d2724');
  sky.addColorStop(0.55, '#243029');
  sky.addColorStop(1, '#141a18');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // --- settlement
  const pieces = collectPieces(scene, state);
  const artW = CARD_W - 300;
  if (pieces.length > 0) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    const at = pieces.map((p) => {
      const s = project(p.wx, p.wy, 1);
      const w = p.frame.cutW, h = p.frame.cutH;
      const left = s.x - w * p.frame.anchorX, top = s.y - h * p.frame.anchorY;
      minX = Math.min(minX, left); maxX = Math.max(maxX, left + w);
      minY = Math.min(minY, top); maxY = Math.max(maxY, top + h);
      return { p, left, top, w, h };
    });
    const scale = Math.min((artW - 48) / Math.max(1, maxX - minX), (CARD_H - 160) / Math.max(1, maxY - minY), 1.1);
    const ox = 24 + (artW - 48 - (maxX - minX) * scale) / 2 - minX * scale;
    const oy = 92 + (CARD_H - 180 - (maxY - minY) * scale) / 2 - minY * scale;
    // A soft ground disc so the buildings do not float on the gradient.
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#2f3a2c';
    ctx.beginPath();
    ctx.ellipse(ox + ((minX + maxX) / 2) * scale, oy + (maxY - 30) * scale, (maxX - minX) * scale * 0.62, (maxY - minY) * scale * 0.38, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    for (const a of at) {
      const f = a.p.frame;
      ctx.drawImage(f.image, f.cutX, f.cutY, f.cutW, f.cutH,
        Math.round(ox + a.left * scale), Math.round(oy + a.top * scale),
        Math.round(a.w * scale), Math.round(a.h * scale));
    }
  }

  // --- side panel
  const px = CARD_W - 288;
  ctx.fillStyle = 'rgba(20,26,24,0.86)';
  roundRect(ctx, px, 74, 264, CARD_H - 120, 10);
  ctx.fill();
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2;
  ctx.stroke();

  // --- header
  ctx.fillStyle = 'rgba(20,26,24,0.9)';
  ctx.fillRect(0, 0, CARD_W, 66);
  ctx.fillStyle = GOLD;
  ctx.font = '600 28px Georgia, serif';
  ctx.fillText(t('game.title'), 26, 41);
  ctx.fillStyle = MUTED;
  ctx.font = '13px system-ui, sans-serif';
  const tierName = t(HOME_TIERS[Math.max(0, Math.min(HOME_TIERS.length - 1, state.home.tier))]!.nameKey);
  ctx.fillText(`${tierName}  ·  ${t('hud.level')} ${state.player.level}  ·  ${t(seasonKey(state))}`, 28, 58);

  // --- loadout lines
  let y = 106;
  const line = (text: string, colour: string, size = 13, gap = 20): void => {
    ctx.fillStyle = colour;
    ctx.font = `${size}px system-ui, sans-serif`;
    ctx.fillText(clip(ctx, text, 240), px + 16, y);
    y += gap;
  };
  line(t('inv.rings').toUpperCase(), GOLD, 12, 22);
  const slots: RingSlot[] = ['active1', 'active2', 'support1', 'support2'];
  let anyRing = false;
  for (const s of slots) {
    const id = state.ringSlots[s];
    if (!id) continue;
    anyRing = true;
    line(`${t(`ring.${id}.name`)} — ${t('ring.rank')} ${effectiveRank(state, id)}`, PARCHMENT);
  }
  if (!anyRing) line(t('common.none'), MUTED);
  y += 6;

  line(t('inv.equipped').toUpperCase(), GOLD, 12, 22);
  for (const k of ['weapon', 'armour', 'boots'] as const) {
    const def = equipmentById(state.player.equipment[k]);
    line(def ? t(def.nameKey) : t('common.none'), def ? PARCHMENT : MUTED);
  }
  y += 6;

  line(t('replay.collection').toUpperCase(), GOLD, 12, 22);
  const found = Object.values(state.rings).filter((r) => r.discovered).length;
  line(`${t('inv.rings')}  ${found}/${RINGS.length}`, PARCHMENT);
  line(`${t('map.cleared')}  ${state.campaign.cleared.length}/${STAGES.length}`, PARCHMENT);
  line(`${t('home.residents')}  ${state.home.residents.length}/${RESIDENTS.length}`, PARCHMENT);
  line(`${t('replay.structures')}  ${state.home.buildings.length}`, PARCHMENT);
  if (state.replay.gauntletBest !== null) {
    line(`${t('replay.gauntlet')}  ${formatMs(state.replay.gauntletBest)}`, GOLD);
  }

  // --- footer: fan-project attribution travels with the image
  ctx.fillStyle = 'rgba(20,26,24,0.9)';
  ctx.fillRect(0, CARD_H - 34, CARD_W, 34);
  ctx.fillStyle = MUTED;
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillText(t('credits.fan_notice_short'), 26, CARD_H - 13);
  void INK;
  return canvas;
}

function seasonKey(state: GameState): string {
  return `season.${state.calendar.season}`;
}

function clip(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let s = text;
  while (s.length > 3 && ctx.measureText(`${s}…`).width > maxW) s = s.slice(0, -1);
  return `${s}…`;
}

function formatMs(ms: number): string {
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * Offers the card as a file. Returns false when the browser refuses the
 * download (some mobile browsers do), so the caller can fall back to showing
 * the image for a long-press save instead of claiming a save that never happened.
 */
export function downloadCard(canvas: HTMLCanvasElement, filename: string): boolean {
  try {
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    return true;
  } catch (err) {
    console.warn('[card] download refused', err);
    return false;
  }
}
