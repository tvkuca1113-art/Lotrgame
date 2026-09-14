import { mix, shade, type RGBA } from './raster.ts';
import { MAT } from './palette.ts';

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export const SEASONS: Season[] = ['spring', 'summer', 'autumn', 'winter'];

/** Ground tinting per season. Kept subtle so terrain reads the same everywhere. */
export function seasonalGround(base: RGBA, kind: string, season: Season): RGBA {
  switch (season) {
    case 'spring':
      if (kind === 'ground' || kind === 'groundAlt' || kind === 'grass') return mix(base, [126, 168, 96, 255], 0.22);
      if (kind === 'path') return shade(mix(base, [92, 84, 64, 255], 0.2), -0.06);
      return base;
    case 'summer':
      if (kind === 'ground' || kind === 'groundAlt' || kind === 'grass') return mix(base, [188, 174, 92, 255], 0.2);
      if (kind === 'water') return shade(base, -0.08);
      return shade(base, 0.05);
    case 'autumn':
      if (kind === 'ground' || kind === 'groundAlt' || kind === 'grass') return mix(base, [170, 122, 62, 255], 0.28);
      if (kind === 'path') return mix(base, [140, 104, 58, 255], 0.2);
      return shade(base, -0.02);
    case 'winter':
      if (kind === 'lava') return base;
      if (kind === 'water') return mix(base, MAT.ice, 0.45);
      if (kind === 'ground' || kind === 'groundAlt' || kind === 'grass' || kind === 'path' || kind === 'rubble')
        return mix(base, MAT.snow, 0.62);
      return mix(base, MAT.snow, 0.3);
  }
}

/** Foliage colour by season, used by trees and bushes. */
export function seasonalFoliage(base: RGBA, season: Season): RGBA {
  switch (season) {
    case 'spring': return mix(base, [146, 190, 104, 255], 0.35);
    case 'summer': return mix(base, [86, 128, 66, 255], 0.3);
    case 'autumn': return mix(base, [196, 126, 52, 255], 0.55);
    case 'winter': return mix(base, [96, 106, 102, 255], 0.5);
  }
}
