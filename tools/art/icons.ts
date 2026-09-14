/** Ring icons, resource icons and interface glyphs. */
import { Canvas, mix, shade, withAlpha, rgb, type RGBA, type Vec } from './raster.ts';
import { MAT, INK, BRAND } from './palette.ts';

export const ICON = 64;

export interface RingLook {
  band: RGBA;
  gem: RGBA;
  glow: RGBA;
  motif: 'flame' | 'shield' | 'wing' | 'thorn' | 'sun' | 'fang' | 'frost' | 'oath' | 'echo' | 'bolt' | 'veil' | 'hearth';
}

export const RING_LOOKS: Record<string, RingLook> = {
  ember: { band: rgb('#8A5A32'), gem: rgb('#E08348'), glow: MAT.emberGlow, motif: 'flame' },
  stoneward: { band: rgb('#6E7268'), gem: rgb('#9AA096'), glow: rgb('#C6CFC2'), motif: 'shield' },
  windstep: { band: rgb('#7E8E86'), gem: rgb('#AFD6C8'), glow: rgb('#CFEDE2'), motif: 'wing' },
  thornwake: { band: rgb('#4E6238'), gem: rgb('#8FC24A'), glow: MAT.wardGreen, motif: 'thorn' },
  dawnward: { band: rgb('#9A8348'), gem: rgb('#F0DCA0'), glow: rgb('#FFF3CE'), motif: 'sun' },
  venomcoil: { band: rgb('#4A5A3A'), gem: rgb('#9AD05A'), glow: MAT.venom, motif: 'fang' },
  frostwake: { band: rgb('#6E8290'), gem: rgb('#BFE6F2'), glow: MAT.frost, motif: 'frost' },
  iron_oath: { band: rgb('#5E6468'), gem: rgb('#98A4AA'), glow: rgb('#CBD8DE'), motif: 'oath' },
  echo: { band: rgb('#6A6072'), gem: rgb('#B9A8CE'), glow: rgb('#DCCDEE'), motif: 'echo' },
  stormcall: { band: rgb('#5A6478'), gem: rgb('#AFC8F0'), glow: MAT.storm, motif: 'bolt' },
  duskveil: { band: rgb('#43394E'), gem: rgb('#8E78B4'), glow: MAT.wardPurple, motif: 'veil' },
  last_hearth: { band: rgb('#8A6A3A'), gem: rgb('#F2C87A'), glow: BRAND.gold, motif: 'hearth' },
};

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export const RARITY_COLOR: Record<Rarity, RGBA> = {
  common: rgb('#9AA096'),
  rare: rgb('#6FA8C4'),
  epic: rgb('#A98BE0'),
  legendary: rgb('#E0A44E'),
};

function motif(c: Canvas, kind: RingLook['motif'], cx: number, cy: number, r: number, col: RGBA): void {
  switch (kind) {
    case 'flame':
      c.poly([{ x: cx, y: cy - r }, { x: cx + r * 0.6, y: cy + r * 0.2 }, { x: cx + r * 0.2, y: cy + r * 0.8 }, { x: cx - r * 0.3, y: cy + r * 0.7 }, { x: cx - r * 0.6, y: cy - r * 0.1 }], col);
      c.poly([{ x: cx, y: cy - r * 0.4 }, { x: cx + r * 0.3, y: cy + r * 0.3 }, { x: cx - r * 0.25, y: cy + r * 0.4 }], mix(col, [255, 250, 220, 255], 0.6));
      break;
    case 'shield':
      c.poly([{ x: cx - r * 0.7, y: cy - r * 0.7 }, { x: cx + r * 0.7, y: cy - r * 0.7 }, { x: cx + r * 0.6, y: cy + r * 0.2 }, { x: cx, y: cy + r }, { x: cx - r * 0.6, y: cy + r * 0.2 }], col);
      c.polyline([{ x: cx, y: cy - r * 0.55 }, { x: cx, y: cy + r * 0.7 }], shade(col, -0.35), r * 0.16);
      break;
    case 'wing':
      c.curve({ x: cx - r, y: cy + r * 0.5 }, { x: cx - r * 0.2, y: cy - r }, { x: cx + r * 0.9, y: cy - r * 0.3 }, col, r * 0.42, r * 0.12, 12);
      c.curve({ x: cx - r * 0.9, y: cy + r * 0.9 }, { x: cx - r * 0.1, y: cy - r * 0.3 }, { x: cx + r * 0.8, y: cy + r * 0.3 }, shade(col, -0.2), r * 0.3, r * 0.08, 12);
      break;
    case 'thorn':
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
        c.poly([
          { x: cx + Math.cos(a) * r * 0.25, y: cy + Math.sin(a) * r * 0.25 },
          { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r },
          { x: cx + Math.cos(a + 0.5) * r * 0.32, y: cy + Math.sin(a + 0.5) * r * 0.32 },
        ], col);
      }
      break;
    case 'sun':
      c.disc(cx, cy, r * 0.42, col);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        c.capsule(cx + Math.cos(a) * r * 0.54, cy + Math.sin(a) * r * 0.54, cx + Math.cos(a) * r, cy + Math.sin(a) * r, r * 0.11, r * 0.04, col);
      }
      break;
    case 'fang':
      c.poly([{ x: cx - r * 0.55, y: cy - r * 0.8 }, { x: cx - r * 0.1, y: cy + r }, { x: cx - r * 0.02, y: cy - r * 0.7 }], col);
      c.poly([{ x: cx + r * 0.55, y: cy - r * 0.8 }, { x: cx + r * 0.1, y: cy + r }, { x: cx + r * 0.02, y: cy - r * 0.7 }], col);
      c.disc(cx, cy + r * 0.2, r * 0.18, mix(col, MAT.venom, 0.7));
      break;
    case 'frost':
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        c.capsule(cx, cy, cx + Math.cos(a) * r, cy + Math.sin(a) * r, r * 0.11, r * 0.05, col);
        c.capsule(cx + Math.cos(a) * r * 0.55, cy + Math.sin(a) * r * 0.55,
          cx + Math.cos(a) * r * 0.55 + Math.cos(a + 1) * r * 0.3, cy + Math.sin(a) * r * 0.55 + Math.sin(a + 1) * r * 0.3, r * 0.07, r * 0.03, col);
      }
      break;
    case 'oath':
      c.polyline([{ x: cx - r * 0.8, y: cy - r * 0.2 }, { x: cx, y: cy + r * 0.8 }, { x: cx + r * 0.8, y: cy - r * 0.9 }], col, r * 0.28);
      break;
    case 'echo':
      for (let i = 1; i <= 3; i++) {
        const pts: Vec[] = [];
        for (let k = 0; k <= 20; k++) {
          const a = -Math.PI * 0.45 + (k / 20) * Math.PI * 0.9;
          pts.push({ x: cx - r * 0.5 + Math.cos(a) * r * (i / 3) * 1.1, y: cy + Math.sin(a) * r * (i / 3) * 1.1 });
        }
        c.polyline(pts, withAlpha(col, 255 - i * 45), r * 0.12);
      }
      break;
    case 'bolt':
      c.poly([
        { x: cx + r * 0.25, y: cy - r }, { x: cx - r * 0.5, y: cy + r * 0.12 }, { x: cx - r * 0.03, y: cy + r * 0.12 },
        { x: cx - r * 0.3, y: cy + r }, { x: cx + r * 0.55, y: cy - r * 0.16 }, { x: cx + r * 0.06, y: cy - r * 0.16 },
      ], col);
      break;
    case 'veil':
      c.poly([{ x: cx - r, y: cy + r * 0.8 }, { x: cx - r * 0.7, y: cy - r * 0.6 }, { x: cx, y: cy - r }, { x: cx + r * 0.7, y: cy - r * 0.6 }, { x: cx + r, y: cy + r * 0.8 },
        { x: cx + r * 0.5, y: cy + r * 0.4 }, { x: cx, y: cy + r * 0.9 }, { x: cx - r * 0.5, y: cy + r * 0.4 }], col);
      break;
    case 'hearth':
      c.poly([{ x: cx - r, y: cy + r * 0.2 }, { x: cx, y: cy - r }, { x: cx + r, y: cy + r * 0.2 }], col);
      c.rect(cx - r * 0.7, cy + r * 0.2, r * 1.4, r * 0.7, shade(col, -0.18));
      c.ellipse(cx, cy + r * 0.55, r * 0.3, r * 0.34, mix(col, MAT.flameCore, 0.8));
      break;
  }
}

export function drawRingIcon(c: Canvas, key: string, rarity: Rarity, discovered = true): void {
  const look = RING_LOOKS[key] ?? RING_LOOKS.ember!;
  const cx = ICON / 2, cy = ICON / 2 + 2;
  const R = 20;
  if (!discovered) {
    c.disc(cx, cy - R * 0.82, 6.5, withAlpha(rgb('#30363A'), 225));
    c.ellipse(cx, cy, R, R * 0.96, withAlpha(rgb('#30363A'), 225));
    c.eraseEllipse(cx, cy, R * 0.6, R * 0.58);
    c.polyline([{ x: cx - 4, y: cy - 4 }, { x: cx, y: cy + 1 }, { x: cx, y: cy + 3 }], withAlpha(rgb('#5A6064'), 220), 2);
    c.disc(cx, cy + 7, 1.6, withAlpha(rgb('#5A6064'), 220));
    return;
  }
  const rc = RARITY_COLOR[rarity];
  c.glow(cx, cy, 30, withAlpha(look.glow, 110), 0.7);
  // band, with the centre punched out so it reads as a ring
  c.ellipse(cx, cy + 1.4, R, R * 0.97, shade(look.band, -0.34));
  c.ellipse(cx, cy, R, R * 0.97, look.band, 0, Canvas.lampShader(cx - R * 0.35, cy - R * 0.45, R * 1.7, 0.5, 0.42));
  c.eraseEllipse(cx, cy + 0.6, R * 0.62, R * 0.58);
  // motif floating in the band opening
  motif(c, look.motif, cx, cy + 1, 7.6, withAlpha(look.glow, 245));
  // setting + gem sit on top of the band
  c.ellipse(cx, cy - R * 0.84, 10.5, 9, shade(look.band, 0.3), 0, Canvas.lampShader(cx - 4, cy - R * 0.84 - 4, 12, 0.5, 0.4));
  c.ellipse(cx, cy - R * 0.88, 7.2, 6.2, look.gem, 0, Canvas.lampShader(cx - 3, cy - R * 0.88 - 3, 9, 0.6, 0.4));
  c.ellipse(cx - 2, cy - R * 1.02, 2.2, 1.6, mix(look.gem, [255, 255, 255, 255], 0.8));
  // rarity marks
  const pips = rarity === 'common' ? 1 : rarity === 'rare' ? 2 : rarity === 'epic' ? 3 : 4;
  for (let i = 0; i < pips; i++) {
    c.disc(ICON / 2 - (pips - 1) * 3.6 + i * 7.2, ICON - 5.5, 2.6, rc);
  }
}

// ------------------------------------------------------------- ui glyphs

export type GlyphKind =
  | 'heart' | 'stamina' | 'gold' | 'wood' | 'stone' | 'iron' | 'shard' | 'flask'
  | 'sword' | 'bow' | 'axe' | 'shield' | 'boots' | 'helmet' | 'armour'
  | 'map' | 'bag' | 'pause' | 'settings' | 'sound' | 'mute' | 'star' | 'lock'
  | 'spring' | 'summer' | 'autumn' | 'winter' | 'guardian' | 'ranger' | 'ringkeeper'
  | 'dodge' | 'attack' | 'heal' | 'ring' | 'skull' | 'home' | 'check' | 'cross'
  | 'chevron' | 'plus' | 'minus' | 'rotate' | 'trash' | 'move' | 'undo' | 'camera' | 'export';

export const GLYPHS: GlyphKind[] = [
  'heart', 'stamina', 'gold', 'wood', 'stone', 'iron', 'shard', 'flask',
  'sword', 'bow', 'axe', 'shield', 'boots', 'helmet', 'armour',
  'map', 'bag', 'pause', 'settings', 'sound', 'mute', 'star', 'lock',
  'spring', 'summer', 'autumn', 'winter', 'guardian', 'ranger', 'ringkeeper',
  'dodge', 'attack', 'heal', 'ring', 'skull', 'home', 'check', 'cross',
  'chevron', 'plus', 'minus', 'rotate', 'trash', 'move', 'undo', 'camera', 'export',
];

export const GLYPH_SIZE = 40;

export function drawGlyph(c: Canvas, kind: GlyphKind): void {
  const S = GLYPH_SIZE;
  const cx = S / 2, cy = S / 2;
  const gold = BRAND.gold, parch = BRAND.parchment;
  const line = (pts: Vec[], col: RGBA, w = 3, closed = false) => c.polyline(pts, col, w, closed);
  switch (kind) {
    case 'heart':
      c.poly([{ x: cx, y: cy + 11 }, { x: cx - 12, y: cy - 2 }, { x: cx - 12, y: cy - 8 }, { x: cx - 6, y: cy - 12 }, { x: cx, y: cy - 6 },
        { x: cx + 6, y: cy - 12 }, { x: cx + 12, y: cy - 8 }, { x: cx + 12, y: cy - 2 }], rgb('#B8453F'));
      c.ellipse(cx - 5, cy - 6, 3, 2.2, withAlpha(parch, 120));
      break;
    case 'stamina':
      c.poly([{ x: cx + 3, y: cy - 13 }, { x: cx - 8, y: cy + 2 }, { x: cx - 1, y: cy + 2 }, { x: cx - 4, y: cy + 13 }, { x: cx + 9, y: cy - 3 }, { x: cx + 1, y: cy - 3 }], rgb('#7FBF7A'));
      break;
    case 'gold':
      c.disc(cx, cy, 12, rgb('#C2A264'), Canvas.lampShader(cx - 4, cy - 5, 14, 0.45, 0.35));
      c.disc(cx, cy, 8, rgb('#A88A4E'));
      line([{ x: cx - 4, y: cy - 4 }, { x: cx + 4, y: cy - 4 }], rgb('#E4D8BC'), 2);
      line([{ x: cx, y: cy - 6 }, { x: cx, y: cy + 6 }], rgb('#E4D8BC'), 2);
      break;
    case 'wood':
      c.capsule(cx - 11, cy + 6, cx + 11, cy - 4, 5, 5, MAT.wood, Canvas.grainShader(3, 0.3, 1.2));
      c.ellipse(cx + 10, cy - 4, 4, 4.6, shade(MAT.wood, 0.25));
      c.capsule(cx - 8, cy - 6, cx + 7, cy - 12, 4, 4, shade(MAT.wood, -0.1));
      break;
    case 'stone':
      c.poly([{ x: cx - 12, y: cy + 8 }, { x: cx - 9, y: cy - 6 }, { x: cx + 2, y: cy - 11 }, { x: cx + 12, y: cy - 2 }, { x: cx + 8, y: cy + 9 }], MAT.stone, Canvas.lampShader(cx - 4, cy - 5, 14, 0.3, 0.35));
      line([{ x: cx - 6, y: cy + 2 }, { x: cx + 6, y: cy - 1 }], shade(MAT.stone, -0.3), 1.6);
      break;
    case 'iron':
      c.poly([{ x: cx - 12, y: cy + 6 }, { x: cx + 6, y: cy + 6 }, { x: cx + 12, y: cy - 1 }, { x: cx - 6, y: cy - 1 }], MAT.steel, Canvas.lampShader(cx - 4, cy, 12, 0.5, 0.3));
      c.poly([{ x: cx - 9, y: cy - 2 }, { x: cx + 9, y: cy - 2 }, { x: cx + 14, y: cy - 9 }, { x: cx - 4, y: cy - 9 }], shade(MAT.steel, 0.12));
      break;
    case 'shard':
      c.poly([{ x: cx, y: cy - 13 }, { x: cx + 8, y: cy + 1 }, { x: cx + 2, y: cy + 13 }, { x: cx - 7, y: cy + 4 }], rgb('#8FD0E0'), Canvas.lampShader(cx - 3, cy - 4, 12, 0.6, 0.35));
      c.glow(cx, cy, 16, withAlpha(rgb('#8FD0E0'), 130), 0.8);
      break;
    case 'flask':
      c.poly([{ x: cx - 4, y: cy - 13 }, { x: cx + 4, y: cy - 13 }, { x: cx + 4, y: cy - 6 }, { x: cx + 10, y: cy + 9 }, { x: cx - 10, y: cy + 9 }, { x: cx - 4, y: cy - 6 }], withAlpha(rgb('#C6D8CE'), 150));
      c.poly([{ x: cx - 7, y: cy + 1 }, { x: cx + 7, y: cy + 1 }, { x: cx + 10, y: cy + 9 }, { x: cx - 10, y: cy + 9 }], rgb('#C25A4A'));
      c.capsule(cx - 5, cy - 14, cx + 5, cy - 14, 2, 2, MAT.leatherDark);
      break;
    case 'sword':
      c.poly([{ x: cx - 2, y: cy + 8 }, { x: cx + 2, y: cy + 8 }, { x: cx + 3, y: cy - 8 }, { x: cx, y: cy - 14 }, { x: cx - 3, y: cy - 8 }], MAT.steel, Canvas.lampShader(cx - 2, cy - 6, 10, 0.55, 0.3));
      c.capsule(cx - 8, cy + 9, cx + 8, cy + 9, 2.2, 2.2, gold);
      c.capsule(cx, cy + 10, cx, cy + 15, 2, 2.6, MAT.leatherDark);
      break;
    case 'bow':
      c.curve({ x: cx + 4, y: cy - 14 }, { x: cx - 12, y: cy }, { x: cx + 4, y: cy + 14 }, MAT.wood, 4, 4, 14);
      line([{ x: cx + 4, y: cy - 14 }, { x: cx + 4, y: cy + 14 }], parch, 1.6);
      line([{ x: cx - 6, y: cy }, { x: cx + 12, y: cy }], MAT.woodDark, 2);
      break;
    case 'axe':
      c.capsule(cx - 1, cy + 14, cx + 1, cy - 12, 2.4, 2, MAT.woodDark);
      c.poly([{ x: cx + 1, y: cy - 12 }, { x: cx + 13, y: cy - 8 }, { x: cx + 13, y: cy + 2 }, { x: cx + 1, y: cy - 1 }], MAT.steel, Canvas.lampShader(cx + 5, cy - 8, 10, 0.5, 0.3));
      c.poly([{ x: cx - 1, y: cy - 12 }, { x: cx - 10, y: cy - 8 }, { x: cx - 10, y: cy }, { x: cx - 1, y: cy - 1 }], shade(MAT.steel, -0.16));
      break;
    case 'shield':
      c.poly([{ x: cx - 11, y: cy - 11 }, { x: cx + 11, y: cy - 11 }, { x: cx + 10, y: cy + 3 }, { x: cx, y: cy + 14 }, { x: cx - 10, y: cy + 3 }], MAT.wood, Canvas.lampShader(cx - 4, cy - 6, 14, 0.36, 0.35));
      c.strokePoly([{ x: cx - 11, y: cy - 11 }, { x: cx + 11, y: cy - 11 }, { x: cx + 10, y: cy + 3 }, { x: cx, y: cy + 14 }, { x: cx - 10, y: cy + 3 }], MAT.steel, 2.4);
      c.disc(cx, cy - 1, 4, MAT.steel);
      break;
    case 'boots':
      c.poly([{ x: cx - 9, y: cy - 12 }, { x: cx - 1, y: cy - 12 }, { x: cx - 1, y: cy + 4 }, { x: cx + 11, y: cy + 6 }, { x: cx + 11, y: cy + 12 }, { x: cx - 9, y: cy + 12 }], MAT.leather, Canvas.lampShader(cx - 4, cy - 2, 14, 0.3, 0.35));
      c.capsule(cx - 9, cy + 11, cx + 11, cy + 11, 2, 2, MAT.leatherDark);
      break;
    case 'helmet':
      c.poly([{ x: cx - 11, y: cy + 8 }, { x: cx - 10, y: cy - 4 }, { x: cx, y: cy - 13 }, { x: cx + 10, y: cy - 4 }, { x: cx + 11, y: cy + 8 }, { x: cx, y: cy + 11 }], MAT.steel, Canvas.lampShader(cx - 4, cy - 6, 14, 0.5, 0.35));
      c.poly([{ x: cx - 7, y: cy - 1 }, { x: cx - 2, y: cy - 1 }, { x: cx - 2, y: cy + 4 }, { x: cx - 7, y: cy + 4 }], INK);
      c.poly([{ x: cx + 2, y: cy - 1 }, { x: cx + 7, y: cy - 1 }, { x: cx + 7, y: cy + 4 }, { x: cx + 2, y: cy + 4 }], INK);
      break;
    case 'armour':
      c.poly([{ x: cx - 10, y: cy - 10 }, { x: cx - 4, y: cy - 13 }, { x: cx + 4, y: cy - 13 }, { x: cx + 10, y: cy - 10 }, { x: cx + 8, y: cy + 8 }, { x: cx, y: cy + 13 }, { x: cx - 8, y: cy + 8 }],
        MAT.steel, Canvas.lampShader(cx - 4, cy - 6, 14, 0.44, 0.36));
      line([{ x: cx, y: cy - 10 }, { x: cx, y: cy + 11 }], shade(MAT.steel, -0.3), 2);
      break;
    case 'map':
      c.poly([{ x: cx - 13, y: cy - 9 }, { x: cx - 4, y: cy - 12 }, { x: cx + 5, y: cy - 8 }, { x: cx + 13, y: cy - 11 }, { x: cx + 13, y: cy + 10 }, { x: cx + 5, y: cy + 13 }, { x: cx - 4, y: cy + 9 }, { x: cx - 13, y: cy + 12 }],
        parch, Canvas.grainShader(9, 0.2, 1.4));
      line([{ x: cx - 4, y: cy - 12 }, { x: cx - 4, y: cy + 9 }], withAlpha(MAT.leatherDark, 150), 1.4);
      line([{ x: cx + 5, y: cy - 8 }, { x: cx + 5, y: cy + 13 }], withAlpha(MAT.leatherDark, 150), 1.4);
      c.disc(cx + 8, cy + 2, 2.4, rgb('#B8453F'));
      break;
    case 'bag':
      c.poly([{ x: cx - 11, y: cy - 4 }, { x: cx + 11, y: cy - 4 }, { x: cx + 9, y: cy + 13 }, { x: cx - 9, y: cy + 13 }], MAT.leather, Canvas.lampShader(cx - 4, cy + 2, 14, 0.3, 0.35));
      c.curve({ x: cx - 6, y: cy - 4 }, { x: cx, y: cy - 16 }, { x: cx + 6, y: cy - 4 }, MAT.leatherDark, 3, 3, 10);
      c.capsule(cx - 11, cy + 2, cx + 11, cy + 2, 2, 2, MAT.leatherDark);
      break;
    case 'pause':
      c.rect(cx - 9, cy - 11, 6, 22, parch);
      c.rect(cx + 3, cy - 11, 6, 22, parch);
      break;
    case 'settings':
      c.disc(cx, cy, 8, parch);
      c.disc(cx, cy, 4, INK);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        c.capsule(cx + Math.cos(a) * 8, cy + Math.sin(a) * 8, cx + Math.cos(a) * 13, cy + Math.sin(a) * 13, 3, 2.4, parch);
      }
      break;
    case 'sound':
      c.poly([{ x: cx - 12, y: cy - 4 }, { x: cx - 6, y: cy - 4 }, { x: cx + 1, y: cy - 11 }, { x: cx + 1, y: cy + 11 }, { x: cx - 6, y: cy + 4 }, { x: cx - 12, y: cy + 4 }], parch);
      for (let i = 1; i <= 2; i++) {
        const pts: Vec[] = [];
        for (let k = 0; k <= 12; k++) {
          const a = -Math.PI * 0.4 + (k / 12) * Math.PI * 0.8;
          pts.push({ x: cx + 2 + Math.cos(a) * i * 5, y: cy + Math.sin(a) * i * 5 });
        }
        c.polyline(pts, parch, 2);
      }
      break;
    case 'mute':
      c.poly([{ x: cx - 12, y: cy - 4 }, { x: cx - 6, y: cy - 4 }, { x: cx + 1, y: cy - 11 }, { x: cx + 1, y: cy + 11 }, { x: cx - 6, y: cy + 4 }, { x: cx - 12, y: cy + 4 }], parch);
      line([{ x: cx + 4, y: cy - 6 }, { x: cx + 13, y: cy + 6 }], rgb('#C25A4A'), 3);
      line([{ x: cx + 13, y: cy - 6 }, { x: cx + 4, y: cy + 6 }], rgb('#C25A4A'), 3);
      break;
    case 'star': {
      const pts: Vec[] = [];
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
        const r = i % 2 ? 5.4 : 13;
        pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
      }
      c.poly(pts, gold, Canvas.lampShader(cx - 4, cy - 5, 14, 0.4, 0.35));
      break;
    }
    case 'lock':
      c.curve({ x: cx - 6, y: cy - 1 }, { x: cx, y: cy - 16 }, { x: cx + 6, y: cy - 1 }, MAT.steel, 3.4, 3.4, 10);
      c.rect(cx - 9, cy - 2, 18, 14, gold, Canvas.lampShader(cx - 4, cy + 2, 12, 0.4, 0.3));
      c.disc(cx, cy + 5, 2.6, INK);
      break;
    case 'spring':
      c.capsule(cx, cy + 12, cx, cy - 2, 2, 1.6, rgb('#5E7A42'));
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i / 5) * Math.PI * 2;
        c.ellipse(cx + Math.cos(a) * 6, cy - 4 + Math.sin(a) * 6, 4.4, 3.6, rgb('#E8C0D0'));
      }
      c.disc(cx, cy - 4, 3, rgb('#F0DCA0'));
      break;
    case 'summer':
      c.disc(cx, cy, 7.6, rgb('#E7C878'));
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        c.capsule(cx + Math.cos(a) * 9.6, cy + Math.sin(a) * 9.6, cx + Math.cos(a) * 14, cy + Math.sin(a) * 14, 2.2, 1, rgb('#E7C878'));
      }
      break;
    case 'autumn':
      c.poly([{ x: cx, y: cy - 13 }, { x: cx + 9, y: cy - 4 }, { x: cx + 6, y: cy - 1 }, { x: cx + 11, y: cy + 4 }, { x: cx + 2, y: cy + 4 }, { x: cx + 1, y: cy + 13 },
        { x: cx - 1, y: cy + 13 }, { x: cx - 2, y: cy + 4 }, { x: cx - 11, y: cy + 4 }, { x: cx - 6, y: cy - 1 }, { x: cx - 9, y: cy - 4 }], rgb('#C98A45'));
      break;
    case 'winter':
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        c.capsule(cx, cy, cx + Math.cos(a) * 13, cy + Math.sin(a) * 13, 2, 1.2, rgb('#B7DCEA'));
        c.capsule(cx + Math.cos(a) * 7, cy + Math.sin(a) * 7, cx + Math.cos(a) * 7 + Math.cos(a + 1) * 4.4, cy + Math.sin(a) * 7 + Math.sin(a + 1) * 4.4, 1.4, 0.8, rgb('#B7DCEA'));
      }
      break;
    case 'guardian':
      c.poly([{ x: cx - 11, y: cy - 11 }, { x: cx + 11, y: cy - 11 }, { x: cx + 10, y: cy + 3 }, { x: cx, y: cy + 14 }, { x: cx - 10, y: cy + 3 }], rgb('#5E7E8E'));
      c.polyline([{ x: cx - 5, y: cy - 2 }, { x: cx - 1, y: cy + 5 }, { x: cx + 6, y: cy - 6 }], parch, 2.6);
      break;
    case 'ranger':
      c.curve({ x: cx + 5, y: cy - 13 }, { x: cx - 11, y: cy }, { x: cx + 5, y: cy + 13 }, rgb('#6E8E5E'), 3.4, 3.4, 12);
      line([{ x: cx + 5, y: cy - 13 }, { x: cx + 5, y: cy + 13 }], parch, 1.4);
      line([{ x: cx - 7, y: cy }, { x: cx + 12, y: cy }], rgb('#B7A986'), 2.2);
      break;
    case 'ringkeeper':
      c.ellipse(cx, cy + 2, 11, 10.5, rgb('#A98BE0'));
      c.ellipse(cx, cy + 2, 6.6, 6.2, [0, 0, 0, 0]);
      c.disc(cx, cy - 9, 4.4, rgb('#E0CDF4'));
      c.glow(cx, cy - 8, 12, withAlpha(rgb('#A98BE0'), 160), 0.8);
      break;
    case 'dodge':
      for (let i = 0; i < 3; i++) {
        c.poly([{ x: cx - 12 + i * 5, y: cy - 9 }, { x: cx - 4 + i * 5, y: cy }, { x: cx - 12 + i * 5, y: cy + 9 }], withAlpha(parch, 255 - i * 70));
      }
      break;
    case 'attack':
      c.curve({ x: cx - 12, y: cy + 10 }, { x: cx, y: cy - 16 }, { x: cx + 12, y: cy + 6 }, parch, 5, 1.6, 14);
      break;
    case 'heal':
      c.rect(cx - 4, cy - 12, 8, 24, rgb('#7FBF7A'));
      c.rect(cx - 12, cy - 4, 24, 8, rgb('#7FBF7A'));
      break;
    case 'ring':
      c.ellipse(cx, cy + 1, 12, 11.4, gold, 0, Canvas.lampShader(cx - 4, cy - 4, 14, 0.5, 0.35));
      c.ellipse(cx, cy + 1, 7.4, 7, [0, 0, 0, 0]);
      c.disc(cx, cy - 10, 4.6, rgb('#E08348'));
      break;
    case 'skull':
      c.ellipse(cx, cy - 2, 10, 9.4, parch, 0, Canvas.lampShader(cx - 4, cy - 6, 12, 0.3, 0.35));
      c.rect(cx - 5, cy + 5, 10, 6, parch);
      c.ellipse(cx - 4, cy - 2, 3, 3.4, INK);
      c.ellipse(cx + 4, cy - 2, 3, 3.4, INK);
      c.poly([{ x: cx, y: cy + 1 }, { x: cx + 2.4, y: cy + 5 }, { x: cx - 2.4, y: cy + 5 }], INK);
      break;
    case 'home':
      c.poly([{ x: cx - 13, y: cy }, { x: cx, y: cy - 12 }, { x: cx + 13, y: cy }], rgb('#8A6A4E'));
      c.rect(cx - 9, cy, 18, 12, rgb('#B7A986'));
      c.rect(cx - 3, cy + 4, 6, 8, MAT.woodDark);
      c.glow(cx, cy + 6, 14, withAlpha(rgb('#F2C87A'), 120), 0.7);
      break;
    case 'check':
      c.polyline([{ x: cx - 10, y: cy }, { x: cx - 3, y: cy + 8 }, { x: cx + 11, y: cy - 9 }], rgb('#7FBF7A'), 4.4);
      break;
    case 'cross':
      c.polyline([{ x: cx - 9, y: cy - 9 }, { x: cx + 9, y: cy + 9 }], rgb('#C25A4A'), 4.4);
      c.polyline([{ x: cx + 9, y: cy - 9 }, { x: cx - 9, y: cy + 9 }], rgb('#C25A4A'), 4.4);
      break;
    case 'chevron':
      c.polyline([{ x: cx - 5, y: cy - 10 }, { x: cx + 5, y: cy }, { x: cx - 5, y: cy + 10 }], parch, 4);
      break;
    case 'plus':
      c.rect(cx - 3, cy - 11, 6, 22, parch);
      c.rect(cx - 11, cy - 3, 22, 6, parch);
      break;
    case 'minus':
      c.rect(cx - 11, cy - 3, 22, 6, parch);
      break;
    case 'rotate': {
      const pts: Vec[] = [];
      for (let i = 0; i <= 24; i++) {
        const a = -Math.PI * 0.8 + (i / 24) * Math.PI * 1.55;
        pts.push({ x: cx + Math.cos(a) * 10, y: cy + Math.sin(a) * 10 });
      }
      c.polyline(pts, parch, 3.4);
      const e = pts[pts.length - 1]!;
      c.poly([{ x: e.x - 5, y: e.y - 5 }, { x: e.x + 6, y: e.y - 1 }, { x: e.x - 2, y: e.y + 6 }], parch);
      break;
    }
    case 'trash':
      c.rect(cx - 8, cy - 6, 16, 17, rgb('#8A9096'));
      c.capsule(cx - 11, cy - 8, cx + 11, cy - 8, 2.4, 2.4, parch);
      c.rect(cx - 4, cy - 12, 8, 4, parch);
      for (const x of [-3.4, 0, 3.4]) c.rect(cx + x - 1, cy - 3, 2, 11, INK);
      break;
    case 'move':
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        c.poly([
          { x: cx + Math.cos(a) * 13, y: cy + Math.sin(a) * 13 },
          { x: cx + Math.cos(a + 0.36) * 8, y: cy + Math.sin(a + 0.36) * 8 },
          { x: cx + Math.cos(a - 0.36) * 8, y: cy + Math.sin(a - 0.36) * 8 },
        ], parch);
      }
      c.rect(cx - 2, cy - 7, 4, 14, parch);
      c.rect(cx - 7, cy - 2, 14, 4, parch);
      break;
    case 'undo': {
      const pts: Vec[] = [];
      for (let i = 0; i <= 24; i++) {
        const a = -Math.PI * 0.15 - (i / 24) * Math.PI * 1.5;
        pts.push({ x: cx + Math.cos(a) * 10, y: cy + Math.sin(a) * 10 });
      }
      c.polyline(pts, parch, 3.4);
      const e = pts[pts.length - 1]!;
      c.poly([{ x: e.x - 6, y: e.y - 3 }, { x: e.x + 4, y: e.y - 6 }, { x: e.x + 2, y: e.y + 6 }], parch);
      break;
    }
    case 'camera':
      c.rect(cx - 13, cy - 7, 26, 17, rgb('#8A9096'));
      c.rect(cx - 5, cy - 11, 10, 5, rgb('#8A9096'));
      c.disc(cx, cy + 1, 6, INK);
      c.disc(cx, cy + 1, 3.6, rgb('#B7DCEA'));
      break;
    case 'export':
      c.rect(cx - 11, cy + 2, 22, 10, rgb('#8A9096'));
      c.polyline([{ x: cx, y: cy + 3 }, { x: cx, y: cy - 12 }], parch, 3.4);
      c.poly([{ x: cx - 6, y: cy - 6 }, { x: cx + 6, y: cy - 6 }, { x: cx, y: cy - 14 }], parch);
      break;
  }
}
