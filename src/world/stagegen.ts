import type { RegionKey, Season, StageDef } from '@/types';
import { Rng, hashSeed } from '@/systems/rng';
import { TILE, tileCentre } from '@/systems/iso';
import { seasonProfile } from '@/systems/seasons';

/**
 * Stage layout.
 *
 * Maps are generated from the stage's authored seed, so a stage is the same
 * place every time it is played, but each of the thirty stages has its own
 * shape, objective placement and boss arena. Generation guarantees that the
 * mandatory route is walkable in every season; seasonal changes only ever open
 * an *extra* route, never close the required one.
 */

export type TileKind =
  | 'ground' | 'groundAlt' | 'path' | 'water' | 'rock' | 'floor' | 'rubble'
  | 'lava' | 'ice' | 'bridge' | 'grass' | 'ash' | 'blocked';

export const TILE_KINDS: TileKind[] = [
  'ground', 'groundAlt', 'path', 'water', 'rock', 'floor', 'rubble',
  'lava', 'ice', 'bridge', 'grass', 'ash', 'blocked',
];

export interface PropSpawn { id: string; variant: number; x: number; y: number; blocking: boolean; interact?: string }
export interface EnemySpawn { id: string; x: number; y: number; group: number; elite: boolean }
export interface NodeSpawn { kind: 'objective' | 'cache' | 'checkpoint' | 'exit' | 'entrance' | 'ringsight' | 'seasonal' | 'bossdoor' | 'escortStop'; id: string; x: number; y: number; data?: string }

export interface StageMap {
  w: number;
  h: number;
  tiles: Uint8Array;
  /** 1 = impassable. */
  blocked: Uint8Array;
  /** Height offset in world units for cliffs; kept simple and flat for combat. */
  region: RegionKey;
  season: Season;
  entrance: { x: number; y: number };
  bossArena: { x: number; y: number; radius: number };
  props: PropSpawn[];
  enemies: EnemySpawn[];
  nodes: NodeSpawn[];
  /** World bounds in pixels. */
  worldW: number;
  worldH: number;
}

/**
 * Per-region tile palette. `block` is always the dedicated `blocked` tile so the
 * impassable mass is visually unmistakable, whatever the region's ground is.
 */
const REGION_TILES: Record<RegionKey, { base: TileKind[]; path: TileKind; block: TileKind; special: TileKind }> = {
  farmland: { base: ['ground', 'groundAlt', 'grass'], path: 'path', block: 'blocked', special: 'water' },
  woodland: { base: ['ground', 'grass', 'groundAlt'], path: 'path', block: 'blocked', special: 'water' },
  mountain: { base: ['rock', 'rubble', 'ground'], path: 'floor', block: 'blocked', special: 'ice' },
  borderland: { base: ['ground', 'groundAlt', 'rubble'], path: 'path', block: 'blocked', special: 'water' },
  winterland: { base: ['ground', 'groundAlt', 'rubble'], path: 'path', block: 'blocked', special: 'ice' },
  fortress: { base: ['ash', 'floor', 'rubble'], path: 'floor', block: 'blocked', special: 'lava' },
};

const REGION_PROPS: Record<RegionKey, { scatter: string[]; blocking: string[]; ruin: string[] }> = {
  farmland: { scatter: ['bush', 'rock_small', 'reeds', 'dry_thicket'], blocking: ['tree_oak', 'boulder', 'fence', 'cart'], ruin: ['ruin_column', 'rubble_pile', 'signpost'] },
  woodland: { scatter: ['bush', 'mushrooms', 'web_patch', 'rock_small'], blocking: ['tree_oak', 'tree_pine', 'boulder', 'egg_sac'], ruin: ['ruin_arch', 'ruin_column', 'standing_stone'] },
  mountain: { scatter: ['rock_small', 'rubble_pile', 'bramble'], blocking: ['boulder', 'furnace', 'tree_dead'], ruin: ['ruin_column', 'ruin_arch', 'rubble_pile'] },
  borderland: { scatter: ['dry_thicket', 'rock_small', 'barrel', 'crate'], blocking: ['tent', 'ballista', 'siege_ladder', 'tree_dead'], ruin: ['rubble_pile', 'banner_pole', 'war_drum'] },
  winterland: { scatter: ['ice_spike', 'rock_small', 'gravestone'], blocking: ['tree_dead', 'boulder', 'standing_stone'], ruin: ['gravestone', 'standing_stone', 'ruin_column'] },
  fortress: { scatter: ['ash', 'rock_small', 'lava_vent', 'rubble_pile'], blocking: ['boulder', 'furnace', 'crate'], ruin: ['ruin_column', 'rubble_pile', 'banner_pole'] },
};

function idx(map: { w: number }, x: number, y: number): number { return y * map.w + x; }

/**
 * Carve an opening. The radius wobbles with a deterministic hash so clearings
 * read as worn ground rather than stamped circles, while staying seeded and
 * therefore identical on every replay of the stage.
 */
function carveDisc(map: StageMap, cx: number, cy: number, r: number, kind: TileKind, wobble = 0.22): void {
  const k = TILE_KINDS.indexOf(kind);
  const seed = Math.round(cx * 31 + cy * 17);
  const span = Math.ceil(r * (1 + wobble)) + 1;
  for (let y = Math.max(0, Math.floor(cy - span)); y <= Math.min(map.h - 1, Math.ceil(cy + span)); y++) {
    for (let x = Math.max(0, Math.floor(cx - span)); x <= Math.min(map.w - 1, Math.ceil(cx + span)); x++) {
      const dx = x - cx, dy = y - cy;
      const d = Math.hypot(dx, dy);
      if (d > r * (1 + wobble)) continue;
      const ang = Math.atan2(dy, dx);
      const n = wobbleAt(ang, seed);
      if (d <= r * (1 + (n - 0.5) * 2 * wobble)) {
        map.tiles[idx(map, x, y)] = k;
        map.blocked[idx(map, x, y)] = 0;
      }
    }
  }
}

function wobbleAt(angle: number, seed: number): number {
  const a = angle + Math.PI;
  return 0.5
    + Math.sin(a * 3 + seed * 0.37) * 0.22
    + Math.sin(a * 5 + seed * 0.11) * 0.14
    + Math.sin(a * 2 + seed * 0.71) * 0.14;
}

function carveCorridor(map: StageMap, ax: number, ay: number, bx: number, by: number, width: number, kind: TileKind): void {
  const steps = Math.max(2, Math.ceil(Math.hypot(bx - ax, by - ay)));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    carveDisc(map, ax + (bx - ax) * t, ay + (by - ay) * t, width, kind);
  }
}

/** Waypoint spine from entrance to boss arena, with a natural wander. */
function buildSpine(rng: Rng, w: number, h: number, count: number): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  const startX = 4 + rng.range(0, 3);
  const startY = h / 2 + rng.range(-h * 0.12, h * 0.12);
  pts.push({ x: startX, y: startY });
  for (let i = 1; i <= count; i++) {
    const t = i / (count + 1);
    const x = startX + (w - 9 - startX) * t;
    const y = h / 2 + Math.sin(t * Math.PI * (1.2 + rng.next())) * h * 0.24 + rng.range(-h * 0.06, h * 0.06);
    pts.push({ x, y: Math.max(4, Math.min(h - 5, y)) });
  }
  pts.push({ x: w - 7, y: Math.max(6, Math.min(h - 7, h / 2 + rng.range(-h * 0.1, h * 0.1))) });
  return pts;
}

export function generateStage(def: StageDef, season: Season): StageMap {
  const rng = new Rng(hashSeed(def.mapSeed, def.id, 'layout'));
  const w = def.mapWidth;
  const h = def.mapHeight;
  const palette = REGION_TILES[def.region];
  const propSet = REGION_PROPS[def.region];
  const profile = seasonProfile(season);

  const map: StageMap = {
    w, h,
    tiles: new Uint8Array(w * h),
    blocked: new Uint8Array(w * h),
    region: def.region,
    season,
    entrance: { x: 0, y: 0 },
    bossArena: { x: 0, y: 0, radius: 7 },
    props: [],
    enemies: [],
    nodes: [],
    worldW: w * TILE,
    worldH: h * TILE,
  };

  // Everything starts solid; the spine and its rooms are carved out of it.
  const blockKind = TILE_KINDS.indexOf(palette.block);
  map.tiles.fill(blockKind);
  map.blocked.fill(1);

  const spine = buildSpine(rng, w, h, Math.max(3, Math.round(def.encounters * 0.7)));
  map.entrance = { x: spine[0]!.x, y: spine[0]!.y };
  const last = spine[spine.length - 1]!;
  map.bossArena = { x: last.x, y: last.y, radius: def.chapterBoss ? 8.5 : 7 };

  // Carve the mandatory route. This is walked in every season.
  for (let i = 0; i + 1 < spine.length; i++) {
    const a = spine[i]!, b = spine[i + 1]!;
    carveCorridor(map, a.x, a.y, b.x, b.y, 2.4 + rng.range(0, 0.8), palette.path);
    carveDisc(map, a.x, a.y, 3.2 + rng.range(0, 1.6), rng.pick(palette.base));
  }
  carveDisc(map, map.entrance.x, map.entrance.y, 4, palette.path);
  carveDisc(map, map.bossArena.x, map.bossArena.y, map.bossArena.radius, palette.path);
  // A ring of floor inside the arena reads as a prepared place.
  carveDisc(map, map.bossArena.x, map.bossArena.y, map.bossArena.radius - 2, 'floor');

  // Side rooms: caches, optional encounters and the ring-sight secret.
  const sideRooms: { x: number; y: number; r: number }[] = [];
  for (let i = 0; i < def.caches + 2; i++) {
    const anchor = spine[1 + Math.floor(rng.next() * (spine.length - 2))]!;
    const ang = rng.range(0, Math.PI * 2);
    const dist = 5 + rng.range(0, 5);
    const x = Math.max(4, Math.min(w - 5, anchor.x + Math.cos(ang) * dist));
    const y = Math.max(4, Math.min(h - 5, anchor.y + Math.sin(ang) * dist));
    carveCorridor(map, anchor.x, anchor.y, x, y, 1.6, palette.path);
    carveDisc(map, x, y, 2.6 + rng.range(0, 1.2), rng.pick(palette.base));
    sideRooms.push({ x, y, r: 2.6 });
  }

  // The seasonal route: a second way through, open only in the stage's season.
  const routeOpen = def.seasonRoute.season === season;
  {
    const a = spine[Math.max(1, Math.floor(spine.length * 0.3))]!;
    const b = spine[Math.min(spine.length - 2, Math.floor(spine.length * 0.75))]!;
    const midX = (a.x + b.x) / 2;
    const midY = Math.max(3, Math.min(h - 4, (a.y + b.y) / 2 + (rng.next() < 0.5 ? -1 : 1) * h * 0.26));
    const special = def.seasonRoute.season === 'winter' && profile.frozenWater ? 'ice'
      : def.seasonRoute.season === 'summer' && profile.lowWater ? 'ground'
        : palette.special;
    carveCorridor(map, a.x, a.y, midX, midY, 1.7, routeOpen ? special : palette.special);
    carveCorridor(map, midX, midY, b.x, b.y, 1.7, routeOpen ? special : palette.special);
    if (!routeOpen) {
      // The route exists but is impassable out of season: water, or thin ice.
      const k = TILE_KINDS.indexOf(palette.special);
      const steps = 40;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const px = Math.round(a.x + (midX - a.x) * t);
        const py = Math.round(a.y + (midY - a.y) * t);
        for (let oy = -1; oy <= 1; oy++) {
          for (let ox = -1; ox <= 1; ox++) {
            const nx = px + ox, ny = py + oy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            map.tiles[idx(map, nx, ny)] = k;
            map.blocked[idx(map, nx, ny)] = 1;
          }
        }
      }
    }
    map.nodes.push({
      kind: 'seasonal', id: `seasonal:${def.id}`,
      ...tileCentre(Math.round(midX), Math.round(midY)),
      data: routeOpen ? 'open' : 'closed',
    });
  }

  // ------------------------------------------------------------- placement
  const centre = (p: { x: number; y: number }) => tileCentre(Math.round(p.x), Math.round(p.y));

  map.nodes.push({ kind: 'entrance', id: 'entrance', ...centre(map.entrance) });
  map.nodes.push({ kind: 'exit', id: 'exit', ...centre(map.entrance) });

  // Checkpoint immediately before the boss arena.
  const approach = spine[spine.length - 2] ?? spine[0]!;
  const cpx = (approach.x + map.bossArena.x) / 2;
  const cpy = (approach.y + map.bossArena.y) / 2;
  map.nodes.push({ kind: 'checkpoint', id: `checkpoint:${def.id}`, ...centre({ x: cpx, y: cpy }) });
  map.nodes.push({
    kind: 'bossdoor', id: `bossdoor:${def.id}`,
    ...centre({ x: map.bossArena.x - map.bossArena.radius - 1, y: map.bossArena.y }),
  });

  // Objectives sit along the spine so the mandatory route always reaches them.
  const objCount = def.objective.count;
  for (let i = 0; i < objCount; i++) {
    const t = (i + 1) / (objCount + 1);
    const pos = spinePoint(spine, t * 0.82 + 0.08);
    const jitterAng = rng.range(0, Math.PI * 2);
    const jx = Math.max(3, Math.min(w - 4, pos.x + Math.cos(jitterAng) * 1.6));
    const jy = Math.max(3, Math.min(h - 4, pos.y + Math.sin(jitterAng) * 1.6));
    map.nodes.push({
      kind: def.objective.kind === 'escort' ? 'escortStop' : 'objective',
      id: `obj:${def.id}:${i}`,
      ...centre({ x: jx, y: jy }),
      data: String(i),
    });
  }

  // Caches in the side rooms.
  for (let i = 0; i < def.caches; i++) {
    const room = sideRooms[i % sideRooms.length]!;
    map.nodes.push({ kind: 'cache', id: `cache:${def.id}:${i}`, ...centre(room) });
  }

  // Ring-sight secret, when the stage has one.
  if (def.ringSight) {
    const room = sideRooms[sideRooms.length - 1]!;
    map.nodes.push({
      kind: 'ringsight', id: `sight:${def.id}`,
      ...centre({ x: room.x, y: room.y - 1 }),
      data: def.ringSight.ring,
    });
  }

  // Encounters spread along the spine, with an elite in the later half.
  const enemyPool = def.enemies;
  for (let g = 0; g < def.encounters; g++) {
    const t = 0.1 + (g / Math.max(1, def.encounters - 1)) * 0.78;
    const pos = spinePoint(spine, t);
    const size = 2 + Math.floor(rng.range(0, 2)) + (g > def.encounters * 0.6 ? 1 : 0);
    for (let i = 0; i < size; i++) {
      const ang = (i / size) * Math.PI * 2 + rng.range(0, 1);
      const r = 0.8 + rng.range(0, 1.6);
      const ex = Math.max(2, Math.min(w - 3, pos.x + Math.cos(ang) * r));
      const ey = Math.max(2, Math.min(h - 3, pos.y + Math.sin(ang) * r));
      map.enemies.push({
        id: rng.pick(enemyPool),
        ...tileCentre(Math.round(ex), Math.round(ey)),
        group: g,
        elite: g === def.encounters - 1 && i === 0 && def.id > 3,
      });
    }
  }

  // ------------------------------------------------------------------ props
  const propRng = rng.fork('props');
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = idx(map, x, y);
      if (map.blocked[i]) {
        // Dress the solid mass so the edges read as woodland, cliff or ruin.
        const openNeighbour =
          !map.blocked[idx(map, x - 1, y)] || !map.blocked[idx(map, x + 1, y)] ||
          !map.blocked[idx(map, x, y - 1)] || !map.blocked[idx(map, x, y + 1)];
        if (openNeighbour && propRng.chance(0.55)) {
          const id = propRng.pick(propSet.blocking);
          map.props.push({ id, variant: propRng.int(0, 2), ...tileCentre(x, y), blocking: true });
        }
        continue;
      }
      if (propRng.chance(0.06)) {
        const id = propRng.pick(propSet.scatter);
        map.props.push({ id, variant: propRng.int(0, 2), ...tileCentre(x, y), blocking: false });
      } else if (propRng.chance(0.012)) {
        const id = propRng.pick(propSet.ruin);
        map.props.push({ id, variant: propRng.int(0, 1), ...tileCentre(x, y), blocking: true, interact: 'inspect' });
      }
    }
  }

  // Marked, ignitable growth near the route for Ember, and a bramble gate on
  // stage 1 so the first ring immediately has a use.
  const markRng = rng.fork('marks');
  const marks = def.id === 1 ? 3 : 1 + Math.floor(def.id / 8);
  for (let i = 0; i < marks; i++) {
    const pos = spinePoint(spine, 0.2 + markRng.next() * 0.6);
    map.props.push({
      id: profile.dryGrowth ? 'dry_thicket' : 'bramble',
      variant: markRng.int(0, 2),
      ...tileCentre(Math.round(pos.x), Math.round(pos.y + (markRng.next() < 0.5 ? -1 : 1))),
      blocking: true,
      interact: 'burnable',
    });
  }

  // Blocking props also block movement.
  for (const p of map.props) {
    if (!p.blocking) continue;
    const tx = Math.floor(p.x / TILE);
    const ty = Math.floor(p.y / TILE);
    if (tx > 0 && ty > 0 && tx < w - 1 && ty < h - 1) {
      // Never block a node or the arena.
      const nearNode = map.nodes.some((n) => Math.hypot(n.x - p.x, n.y - p.y) < TILE * 1.2);
      const inArena = Math.hypot(tx - map.bossArena.x, ty - map.bossArena.y) < map.bossArena.radius;
      if (!nearNode && !inArena) map.blocked[idx(map, tx, ty)] = 1;
    }
  }

  ensureConnectivity(map);
  return map;
}

function spinePoint(spine: { x: number; y: number }[], t: number): { x: number; y: number } {
  const clamped = Math.max(0, Math.min(0.999, t));
  const f = clamped * (spine.length - 1);
  const i = Math.floor(f);
  const a = spine[i]!, b = spine[Math.min(spine.length - 1, i + 1)]!;
  const k = f - i;
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
}

/**
 * Guarantee the mandatory route: flood fill from the entrance and clear any
 * blocking prop that has cut off a node. Critical doors and boss triggers are
 * reachable in every season by construction, and this is the safety net.
 */
export function ensureConnectivity(map: StageMap): void {
  const reach = floodFrom(map, Math.round(map.entrance.x), Math.round(map.entrance.y));
  const mustReach = map.nodes.filter((n) => n.kind !== 'seasonal' && n.kind !== 'cache' && n.kind !== 'ringsight');
  for (const n of mustReach) {
    const tx = Math.floor(n.x / TILE);
    const ty = Math.floor(n.y / TILE);
    if (reach[idx(map, tx, ty)]) continue;
    // Clear a straight lane from the entrance to the node.
    carveCorridor(map, map.entrance.x, map.entrance.y, tx, ty, 1.6, 'path');
    map.props = map.props.filter((p) => {
      if (!p.blocking) return true;
      const px = p.x, py = p.y;
      return distanceToSegment(px / TILE, py / TILE, map.entrance.x, map.entrance.y, tx, ty) > 2;
    });
  }
  // Recompute blocked flags for cleared props.
  const again = floodFrom(map, Math.round(map.entrance.x), Math.round(map.entrance.y));
  for (const n of mustReach) {
    const tx = Math.floor(n.x / TILE);
    const ty = Math.floor(n.y / TILE);
    if (!again[idx(map, tx, ty)]) {
      // Last resort: open the node's own tile and a lane of three tiles.
      carveCorridor(map, map.entrance.x, map.entrance.y, tx, ty, 2.2, 'path');
    }
  }
}

function distanceToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

export function floodFrom(map: StageMap, sx: number, sy: number): Uint8Array {
  const seen = new Uint8Array(map.w * map.h);
  if (sx < 0 || sy < 0 || sx >= map.w || sy >= map.h) return seen;
  const queue: number[] = [idx(map, sx, sy)];
  seen[queue[0]!] = 1;
  while (queue.length) {
    const i = queue.pop()!;
    const x = i % map.w;
    const y = Math.floor(i / map.w);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as [number, number][]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= map.w || ny >= map.h) continue;
      const ni = idx(map, nx, ny);
      if (seen[ni] || map.blocked[ni]) continue;
      seen[ni] = 1;
      queue.push(ni);
    }
  }
  return seen;
}

/** World-space blocking test used by movement and line of sight. */
export function isBlockedAt(map: StageMap, wx: number, wy: number): boolean {
  const tx = Math.floor(wx / TILE);
  const ty = Math.floor(wy / TILE);
  if (tx < 0 || ty < 0 || tx >= map.w || ty >= map.h) return true;
  return map.blocked[ty * map.w + tx] === 1;
}

export function tileKindAt(map: StageMap, wx: number, wy: number): TileKind {
  const tx = Math.floor(wx / TILE);
  const ty = Math.floor(wy / TILE);
  if (tx < 0 || ty < 0 || tx >= map.w || ty >= map.h) return 'blocked';
  return TILE_KINDS[map.tiles[ty * map.w + tx]!] ?? 'ground';
}

/** Is every mandatory node reachable from the entrance? Used by the tests. */
export function validateReachability(map: StageMap): { ok: boolean; unreachable: string[] } {
  const reach = floodFrom(map, Math.round(map.entrance.x), Math.round(map.entrance.y));
  const unreachable: string[] = [];
  for (const n of map.nodes) {
    if (n.kind === 'seasonal' || n.kind === 'cache' || n.kind === 'ringsight') continue;
    const tx = Math.floor(n.x / TILE);
    const ty = Math.floor(n.y / TILE);
    if (tx < 0 || ty < 0 || tx >= map.w || ty >= map.h || !reach[ty * map.w + tx]) unreachable.push(n.id);
  }
  // The boss arena centre must be reachable too.
  const bx = Math.round(map.bossArena.x);
  const by = Math.round(map.bossArena.y);
  if (!reach[by * map.w + bx]) unreachable.push('bossArena');
  return { ok: unreachable.length === 0, unreachable };
}
