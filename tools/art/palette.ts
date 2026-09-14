import { rgb, mix, shade, type RGBA } from './raster.ts';

/** Art-direction palette from the design brief. */
export const BRAND = {
  forest: rgb('#203B2D'),
  charcoal: rgb('#171C1B'),
  gold: rgb('#C2A264'),
  parchment: rgb('#E4D8BC'),
  ember: rgb('#CE7144'),
  winter: rgb('#95B6C6'),
} as const;

export const INK = rgb('#0E1211');
export const INK_SOFT = rgb('#141A19');

/** Named material ramps. Every asset pulls from here so the world reads as one place. */
export const MAT = {
  // flesh + hide
  skinPale: rgb('#D9A77E'),
  skinTan: rgb('#B9825A'),
  skinOrcGreen: rgb('#6E7F55'),
  skinOrcGrey: rgb('#7C7A6C'),
  skinUruk: rgb('#4E4A42'),
  skinGoblin: rgb('#8A9660'),
  skinTroll: rgb('#6B6455'),
  skinSpider: rgb('#2C2430'),
  skinWight: rgb('#B9C4BE'),
  skinWraith: rgb('#221E27'),
  furGrey: rgb('#6C6A63'),
  furDark: rgb('#39352F'),
  furWhite: rgb('#CFD6D4'),
  // worked materials
  iron: rgb('#6E7679'),
  ironDark: rgb('#454C4F'),
  steel: rgb('#8E999C'),
  bronze: rgb('#9A7442'),
  goldMetal: rgb('#C2A264'),
  rust: rgb('#7A4A32'),
  leather: rgb('#6B4A33'),
  leatherDark: rgb('#463022'),
  clothGreen: rgb('#2F4A39'),
  clothRed: rgb('#7A2F2C'),
  clothBlue: rgb('#35506B'),
  clothCream: rgb('#C6B792'),
  clothGrey: rgb('#4A5150'),
  wood: rgb('#6A4E33'),
  woodPale: rgb('#8A6B47'),
  woodDark: rgb('#3E2C1D'),
  stone: rgb('#7C7E78'),
  stoneDark: rgb('#4B4F4C'),
  stonePale: rgb('#9AA096'),
  moss: rgb('#4B6340'),
  snow: rgb('#DDE7EA'),
  ice: rgb('#A9CBD8'),
  ash: rgb('#4A4744'),
  // light
  flame: rgb('#FFB35C'),
  flameCore: rgb('#FFE4A8'),
  emberGlow: rgb('#CE7144'),
  wardBlue: rgb('#7FD2E8'),
  wardGreen: rgb('#8FE0A3'),
  wardPurple: rgb('#A98BE0'),
  blood: rgb('#6E2320'),
  venom: rgb('#8FC24A'),
  frost: rgb('#BFE6F2'),
  storm: rgb('#CFE3FF'),
  shadow: rgb('#2A2436'),
} as const;

export type MatKey = keyof typeof MAT;

/** Per-region ground/ambience colours, used by tile and prop generation. */
export const REGION_PALETTE = {
  farmland: { ground: rgb('#5F6E42'), groundAlt: rgb('#6E7A4A'), dirt: rgb('#6A5539'), accent: rgb('#8C7A4A'), sky: rgb('#7E9075') },
  woodland: { ground: rgb('#3C5738'), groundAlt: rgb('#46603D'), dirt: rgb('#4A3D2A'), accent: rgb('#2F4A39'), sky: rgb('#2F4536') },
  mountain: { ground: rgb('#5B5A55'), groundAlt: rgb('#67665F'), dirt: rgb('#4A443C'), accent: rgb('#7A4A32'), sky: rgb('#3B3A38') },
  borderland: { ground: rgb('#6A6249'), groundAlt: rgb('#746B50'), dirt: rgb('#5B4B34'), accent: rgb('#7A2F2C'), sky: rgb('#5A5140') },
  winterland: { ground: rgb('#96A7AC'), groundAlt: rgb('#A4B3B7'), dirt: rgb('#6E7276'), accent: rgb('#95B6C6'), sky: rgb('#6E8290') },
  fortress: { ground: rgb('#4A4744'), groundAlt: rgb('#55514D'), dirt: rgb('#3A3734'), accent: rgb('#CE7144'), sky: rgb('#332F2E') },
  home: { ground: rgb('#5A6A44'), groundAlt: rgb('#66764C'), dirt: rgb('#6A5539'), accent: rgb('#C2A264'), sky: rgb('#4A5A3E') },
} as const;

export type RegionKey = keyof typeof REGION_PALETTE;

export const SEASON_TINT = {
  spring: { tint: rgb('#9FD08A'), amount: 0.16, light: rgb('#E8F2D8') },
  summer: { tint: rgb('#E7C878'), amount: 0.18, light: rgb('#FFF0CE') },
  autumn: { tint: rgb('#C98A45'), amount: 0.2, light: rgb('#F5D9A8') },
  winter: { tint: rgb('#B7D2DE'), amount: 0.26, light: rgb('#E9F4F8') },
} as const;

export function ramp(base: RGBA, steps = 5): RGBA[] {
  const out: RGBA[] = [];
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    out.push(shade(base, (t - 0.5) * 1.1));
  }
  return out;
}

export function tinted(base: RGBA, tint: RGBA, amount: number): RGBA {
  return mix(base, tint, amount);
}
