/**
 * World <-> screen projection.
 *
 * Collision, movement and every hitbox live in world coordinates (a flat plane
 * measured in pixels). Only rendering converts to the isometric screen, so
 * physics never has to reason about the camera.
 */
export const TILE = 64;            // world units per tile
export const ISO_W = 64;           // screen width of one tile diamond
export const ISO_H = 32;           // screen height of one tile diamond
export const ISO_SCALE_X = ISO_W / (2 * TILE);
export const ISO_SCALE_Y = ISO_H / (2 * TILE);

export interface Point { x: number; y: number }

/** World (x, y) on the ground plane, plus optional height, to screen pixels. */
export function worldToScreen(x: number, y: number, h = 0): Point {
  return {
    x: (x - y) * ISO_SCALE_X,
    y: (x + y) * ISO_SCALE_Y - h,
  };
}

/** Screen pixels back to the ground plane. Used for pointer aiming and picking. */
export function screenToWorld(sx: number, sy: number): Point {
  const a = sx / ISO_SCALE_X;
  const b = sy / ISO_SCALE_Y;
  return { x: (a + b) / 2, y: (b - a) / 2 };
}

/** Painter-order depth for a world position. */
export function depthFor(x: number, y: number, bias = 0): number {
  return (x + y) * ISO_SCALE_Y + bias;
}

export function tileOf(x: number, y: number): Point {
  return { x: Math.floor(x / TILE), y: Math.floor(y / TILE) };
}

export function tileCentre(tx: number, ty: number): Point {
  return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 };
}

/**
 * The eight facings used by the sprite sheets. Screen-space direction is what
 * the player sees, so the aim vector is converted to screen space first.
 */
export const FACING_SHEETS = ['s', 'se', 'e', 'ne', 'n'] as const;
export type FacingSheet = (typeof FACING_SHEETS)[number];

export interface Facing { sheet: FacingSheet; flip: boolean }

const FACING_TABLE: Facing[] = [
  { sheet: 's', flip: false },   // 0: screen-down
  { sheet: 'se', flip: false },  // 1: down-right
  { sheet: 'e', flip: false },   // 2: right
  { sheet: 'ne', flip: false },  // 3: up-right
  { sheet: 'n', flip: false },   // 4: up
  { sheet: 'ne', flip: true },   // 5: up-left
  { sheet: 'e', flip: true },    // 6: left
  { sheet: 'se', flip: true },   // 7: down-left
];

/** Map a world-space direction to one of eight rendered facings. */
export function facingFor(dx: number, dy: number): Facing {
  if (dx === 0 && dy === 0) return FACING_TABLE[0]!;
  const s = worldToScreen(dx, dy);
  // Screen y grows downward; index 0 is screen-down.
  const angle = Math.atan2(-s.x, s.y); // 0 = down, +pi/2 = right
  let idx = Math.round((angle / (Math.PI / 4)));
  idx = ((idx % 8) + 8) % 8;
  return FACING_TABLE[idx]!;
}

/** Index 0..7 for AI and logic that needs a coarse direction. */
export function facingIndex(dx: number, dy: number): number {
  if (dx === 0 && dy === 0) return 0;
  const s = worldToScreen(dx, dy);
  const angle = Math.atan2(-s.x, s.y);
  return (((Math.round(angle / (Math.PI / 4)) % 8) + 8) % 8);
}

export function lengthOf(x: number, y: number): number { return Math.hypot(x, y); }

export function normalise(x: number, y: number): Point {
  const l = Math.hypot(x, y);
  return l < 1e-6 ? { x: 0, y: 0 } : { x: x / l, y: y / l };
}

export function angleDiff(a: number, b: number): number {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
