import type { Season } from '@/types';
import { Rng, hashSeed } from '@/systems/rng';
import { TILE } from '@/systems/iso';
import { homeTier } from '@/content/buildings';
import type { GameState } from '@/systems/state';
import { TILE_KINDS, type StageMap } from './stagegen';

export interface HomeMap extends StageMap {
  plotOrigin: { x: number; y: number };
  homeAnchor: { x: number; y: number };
  departure: { x: number; y: number };
  spawn: { x: number; y: number };
}

/**
 * The settlement grounds.
 *
 * A walkable clearing that grows with the home tier: a bigger plot, a wider
 * ring of cleared ground and a longer approach path. The building grid sits at
 * `plotOrigin`, so placement coordinates map straight onto world tiles.
 */
export function generateHome(state: GameState, season: Season): HomeMap {
  const tier = homeTier(Math.max(0, state.home.tier));
  const pad = 8;
  const w = tier.plotW + pad * 2;
  const h = tier.plotD + pad * 2;
  const rng = new Rng(hashSeed('home', tier.tier, season));

  const map: HomeMap = {
    w, h,
    tiles: new Uint8Array(w * h),
    blocked: new Uint8Array(w * h),
    region: 'farmland',
    season,
    entrance: { x: 2, y: Math.floor(h / 2) },
    bossArena: { x: 0, y: 0, radius: 0 },
    props: [],
    enemies: [],
    nodes: [],
    worldW: w * TILE,
    worldH: h * TILE,
    plotOrigin: { x: pad, y: pad },
    homeAnchor: { x: 0, y: 0 },
    departure: { x: 0, y: 0 },
    spawn: { x: 0, y: 0 },
  };

  const ground = TILE_KINDS.indexOf('ground');
  const grass = TILE_KINDS.indexOf('grass');
  const path = TILE_KINDS.indexOf('path');
  const rock = TILE_KINDS.indexOf('rock');

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const edge = x < 2 || y < 2 || x >= w - 2 || y >= h - 2;
      map.tiles[i] = edge ? rock : rng.chance(0.24) ? grass : ground;
      map.blocked[i] = edge ? 1 : 0;
    }
  }
  // The plot itself is trodden ground.
  for (let y = 0; y < tier.plotD; y++) {
    for (let x = 0; x < tier.plotW; x++) {
      map.tiles[(pad + y) * w + (pad + x)] = ground;
    }
  }
  // The approach path from the gate to the house.
  const gateY = pad + tier.plotD - 1;
  for (let x = 2; x < pad + Math.floor(tier.plotW / 2); x++) {
    map.tiles[gateY * w + x] = path;
    map.tiles[(gateY - 1) * w + x] = path;
  }

  map.homeAnchor = {
    x: (pad + tier.plotW / 2) * TILE,
    y: (pad + tier.plotD * 0.34) * TILE,
  };
  map.departure = { x: 3.5 * TILE, y: (gateY + 0.5) * TILE };
  map.spawn = { x: (pad + 1.5) * TILE, y: (gateY - 0.5) * TILE };
  map.entrance = { x: map.spawn.x / TILE, y: map.spawn.y / TILE };

  // Dressing outside the plot: trees, rocks and a few lanterns along the path.
  const decor = rng.fork('decor');
  for (let y = 2; y < h - 2; y++) {
    for (let x = 2; x < w - 2; x++) {
      const insidePlot = x >= pad - 1 && y >= pad - 1 && x < pad + tier.plotW + 1 && y < pad + tier.plotD + 1;
      if (insidePlot) continue;
      if (Math.abs(y - gateY) <= 1 && x < pad) continue;
      const r = decor.next();
      if (r < 0.14) {
        map.props.push({
          id: season === 'winter' ? 'tree_pine' : decor.chance(0.5) ? 'tree_oak' : 'tree_pine',
          variant: decor.int(0, 2), x: x * TILE + TILE / 2, y: y * TILE + TILE / 2, blocking: true,
        });
        map.blocked[y * w + x] = 1;
      } else if (r < 0.2) {
        map.props.push({ id: 'bush', variant: decor.int(0, 2), x: x * TILE + TILE / 2, y: y * TILE + TILE / 2, blocking: false });
      } else if (r < 0.225) {
        map.props.push({ id: 'rock_small', variant: decor.int(0, 2), x: x * TILE + TILE / 2, y: y * TILE + TILE / 2, blocking: false });
      }
    }
  }
  // A well and a signpost near the gate give the place a centre.
  map.props.push({ id: 'well', variant: 0, x: (pad + 1) * TILE, y: (gateY - 2.5) * TILE, blocking: true });
  map.props.push({ id: 'signpost', variant: 0, x: 4.5 * TILE, y: (gateY - 1.2) * TILE, blocking: false });

  // Monuments for the chapter bosses already beaten.
  state.home.trophies.forEach((trophy, i) => {
    map.props.push({
      id: 'beacon', variant: 3,
      x: (pad + 1 + i * 2) * TILE,
      y: (pad - 1.5) * TILE,
      blocking: true,
    });
    void trophy;
  });

  for (const p of map.props) {
    if (!p.blocking) continue;
    const tx = Math.floor(p.x / TILE);
    const ty = Math.floor(p.y / TILE);
    if (tx > 1 && ty > 1 && tx < w - 2 && ty < h - 2) map.blocked[ty * w + tx] = 1;
  }

  return map;
}
