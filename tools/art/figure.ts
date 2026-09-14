/**
 * Figure renderer: turns a posed skeleton into a shaded, outlined character
 * drawing. Shared by the player, every enemy family and every boss.
 */
import { Canvas, mix, shade, withAlpha, type RGBA, hashNoise } from './raster.ts';
import { INK, MAT } from './palette.ts';
import { Skeleton, makeProjector, type Pose, type V3, apply, v3, type PosedJoint, type Projection } from './skeleton.ts';

export { Skeleton };

// --------------------------------------------------------------- skeletons

export const HUMANOID = new Skeleton([
  { name: 'pelvis', parent: null, offset: v3(0, 0.5, 0) },
  { name: 'spine', parent: 'pelvis', offset: v3(0, 0.11, 0) },
  { name: 'chest', parent: 'spine', offset: v3(0, 0.13, 0) },
  { name: 'neck', parent: 'chest', offset: v3(0, 0.07, 0) },
  { name: 'head', parent: 'neck', offset: v3(0, 0.08, 0) },
  { name: 'shoulderL', parent: 'chest', offset: v3(-0.115, 0.035, 0) },
  { name: 'elbowL', parent: 'shoulderL', offset: v3(0, -0.15, 0) },
  { name: 'handL', parent: 'elbowL', offset: v3(0, -0.145, 0) },
  { name: 'shoulderR', parent: 'chest', offset: v3(0.115, 0.035, 0) },
  { name: 'elbowR', parent: 'shoulderR', offset: v3(0, -0.15, 0) },
  { name: 'handR', parent: 'elbowR', offset: v3(0, -0.145, 0) },
  { name: 'hipL', parent: 'pelvis', offset: v3(-0.062, -0.02, 0) },
  { name: 'kneeL', parent: 'hipL', offset: v3(0, -0.235, 0) },
  { name: 'footL', parent: 'kneeL', offset: v3(0, -0.235, 0) },
  { name: 'hipR', parent: 'pelvis', offset: v3(0.062, -0.02, 0) },
  { name: 'kneeR', parent: 'hipR', offset: v3(0, -0.235, 0) },
  { name: 'footR', parent: 'kneeR', offset: v3(0, -0.235, 0) },
]);

export const QUADRUPED = new Skeleton([
  { name: 'pelvis', parent: null, offset: v3(0, 0.42, 0.18) },
  { name: 'spine', parent: 'pelvis', offset: v3(0, 0.02, -0.16) },
  { name: 'chest', parent: 'spine', offset: v3(0, 0.03, -0.18) },
  { name: 'neck', parent: 'chest', offset: v3(0, 0.06, -0.12) },
  { name: 'head', parent: 'neck', offset: v3(0, 0.02, -0.12) },
  { name: 'jaw', parent: 'head', offset: v3(0, -0.05, -0.05) },
  { name: 'tail1', parent: 'pelvis', offset: v3(0, 0.02, 0.14) },
  { name: 'tail2', parent: 'tail1', offset: v3(0, -0.02, 0.16) },
  { name: 'shoulderL', parent: 'chest', offset: v3(-0.085, -0.02, 0) },
  { name: 'kneeL', parent: 'shoulderL', offset: v3(0, -0.2, 0) },
  { name: 'pawL', parent: 'kneeL', offset: v3(0, -0.2, 0) },
  { name: 'shoulderR', parent: 'chest', offset: v3(0.085, -0.02, 0) },
  { name: 'kneeR', parent: 'shoulderR', offset: v3(0, -0.2, 0) },
  { name: 'pawR', parent: 'kneeR', offset: v3(0, -0.2, 0) },
  { name: 'hipL', parent: 'pelvis', offset: v3(-0.085, -0.02, 0) },
  { name: 'hockL', parent: 'hipL', offset: v3(0, -0.2, 0) },
  { name: 'footL', parent: 'hockL', offset: v3(0, -0.2, 0) },
  { name: 'hipR', parent: 'pelvis', offset: v3(0.085, -0.02, 0) },
  { name: 'hockR', parent: 'hipR', offset: v3(0, -0.2, 0) },
  { name: 'footR', parent: 'hockR', offset: v3(0, -0.2, 0) },
]);

export const ARACHNID = (() => {
  const bones = [
    { name: 'pelvis', parent: null, offset: v3(0, 0.34, 0.1) },
    { name: 'spine', parent: 'pelvis', offset: v3(0, 0.0, -0.16) },
    { name: 'chest', parent: 'spine', offset: v3(0, 0.0, -0.1) },
    { name: 'head', parent: 'chest', offset: v3(0, 0.0, -0.09) },
    { name: 'fangL', parent: 'head', offset: v3(-0.04, -0.03, -0.06) },
    { name: 'fangR', parent: 'head', offset: v3(0.04, -0.03, -0.06) },
  ];
  for (let i = 0; i < 4; i++) {
    for (const side of [-1, 1]) {
      const s = side < 0 ? 'L' : 'R';
      bones.push({ name: `coxa${i}${s}`, parent: 'chest', offset: v3(side * 0.07, 0.0, -0.02 + i * 0.07) });
      bones.push({ name: `femur${i}${s}`, parent: `coxa${i}${s}`, offset: v3(side * 0.19, 0.07, 0) });
      bones.push({ name: `tibia${i}${s}`, parent: `femur${i}${s}`, offset: v3(side * 0.1, -0.24, 0) });
      bones.push({ name: `tip${i}${s}`, parent: `tibia${i}${s}`, offset: v3(side * 0.05, -0.16, 0) });
    }
  }
  return new Skeleton(bones);
})();

export const WRAITH = new Skeleton([
  { name: 'pelvis', parent: null, offset: v3(0, 0.52, 0) },
  { name: 'spine', parent: 'pelvis', offset: v3(0, 0.12, 0) },
  { name: 'chest', parent: 'spine', offset: v3(0, 0.14, 0) },
  { name: 'neck', parent: 'chest', offset: v3(0, 0.08, 0) },
  { name: 'head', parent: 'neck', offset: v3(0, 0.09, 0) },
  { name: 'shoulderL', parent: 'chest', offset: v3(-0.12, 0.04, 0) },
  { name: 'elbowL', parent: 'shoulderL', offset: v3(0, -0.17, 0) },
  { name: 'handL', parent: 'elbowL', offset: v3(0, -0.16, 0) },
  { name: 'shoulderR', parent: 'chest', offset: v3(0.12, 0.04, 0) },
  { name: 'elbowR', parent: 'shoulderR', offset: v3(0, -0.17, 0) },
  { name: 'handR', parent: 'elbowR', offset: v3(0, -0.16, 0) },
  { name: 'hem1', parent: 'pelvis', offset: v3(-0.14, -0.3, 0) },
  { name: 'hem2', parent: 'pelvis', offset: v3(0, -0.4, 0) },
  { name: 'hem3', parent: 'pelvis', offset: v3(0.14, -0.3, 0) },
]);

// -------------------------------------------------------------- appearance

export type HelmetKind = 'none' | 'cap' | 'hood' | 'horned' | 'full' | 'crown' | 'greathelm' | 'tattered' | 'antlers';
export type ShoulderKind = 'none' | 'pads' | 'spikes' | 'plates' | 'fur';

export interface WeaponSpec {
  kind:
    | 'none' | 'sword' | 'greatsword' | 'axe' | 'greataxe' | 'bow' | 'shield' | 'spear' | 'club'
    | 'hook' | 'hammer' | 'staff' | 'scythe' | 'dagger' | 'torch' | 'banner' | 'bell' | 'lantern'
    | 'crossbow' | 'chain' | 'morningstar' | 'pick' | 'wand' | 'anvilhammer';
  metal?: RGBA;
  wood?: RGBA;
  accent?: RGBA;
  scale?: number;
  glow?: RGBA;
}

export interface FigureSpec {
  rig: 'humanoid' | 'quadruped' | 'arachnid' | 'wraith';
  /** World height in rig units (1.0 = an ordinary human). */
  height: number;
  bulk: number;
  skin: RGBA;
  cloth: RGBA;
  clothAlt: RGBA;
  metal: RGBA;
  accent: RGBA;
  hair?: RGBA;
  eyes?: RGBA;
  eyeGlow?: boolean;
  helmet?: HelmetKind;
  shoulders?: ShoulderKind;
  cloak?: RGBA | null;
  cloakLength?: number;
  armour?: 'none' | 'light' | 'mail' | 'plate' | 'heavy';
  weaponR?: WeaponSpec;
  weaponL?: WeaponSpec;
  trousers?: RGBA;
  hunch?: number;
  tusks?: boolean;
  horns?: number;
  spikes?: number;
  tattered?: boolean;
  fur?: RGBA;
  glowAura?: RGBA | null;
  legs?: number;
  seed?: number;
}

export interface DrawOpts {
  /** Pixels per rig unit. */
  scale: number;
  originX: number;
  originY: number;
  yaw: number;
  flipShadow?: boolean;
  /** Extra per-frame vertical offset in rig units (hops, floats). */
  lift?: number;
  fade?: number;
  tint?: RGBA | null;
  tintAmount?: number;
}

interface Part { depth: number; draw: () => void }

function taper(base: number, t: number): number { return base * (1 - 0.35 * t); }

export function pickSkeleton(rig: FigureSpec['rig']): Skeleton {
  switch (rig) {
    case 'quadruped': return QUADRUPED;
    case 'arachnid': return ARACHNID;
    case 'wraith': return WRAITH;
    default: return HUMANOID;
  }
}

export function drawFigure(c: Canvas, spec: FigureSpec, pose: Pose, o: DrawOpts): void {
  const skel = pickSkeleton(spec.rig);
  const joints = skel.solve(pose, v3(0, (o.lift ?? 0), 0));
  const S = o.scale * spec.height;
  const project = makeProjector(o.yaw, o.originX, o.originY, S);
  const P = (name: string): Projection => project(joints.get(name)!.pos);
  const parts: Part[] = [];
  const bulk = spec.bulk;
  const seed = spec.seed ?? 11;

  const grain = (amount: number) => (x: number, y: number, base: RGBA): RGBA =>
    shade(base, (hashNoise(Math.round(x * 1.3), Math.round(y * 1.3), seed) - 0.5) * amount);

  const limbShader = (a: Projection, b: Projection, r: number, amount = 0.2) => {
    const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
    const rad = Math.max(2, Math.hypot(b.x - a.x, b.y - a.y) / 2 + r);
    const lamp = Canvas.lampShader(cx - rad * 0.24, cy - rad * 0.3, rad * 1.25, 0.3, 0.42);
    const g = grain(amount);
    return (x: number, y: number, base: RGBA) => g(x, y, lamp(x, y, base));
  };

  const seg = (an: string, bn: string, r0: number, r1: number, col: RGBA, depthBias = 0) => {
    const a = P(an), b = P(bn);
    const ja = joints.get(an)!, jb = joints.get(bn)!;
    parts.push({
      depth: (a.depth + b.depth) / 2 + depthBias,
      draw: () => c.capsule(a.x, a.y, b.x, b.y, r0 * S * bulk, r1 * S * bulk, col, limbShader(a, b, r0 * S * bulk)),
    });
    void ja; void jb;
  };

  // ------------------------------------------------------------- humanoids
  if (spec.rig === 'humanoid' || spec.rig === 'wraith') {
    const isWraith = spec.rig === 'wraith';
    const armour = spec.armour ?? 'light';
    const plate = armour === 'plate' || armour === 'heavy';
    const limbCol = plate ? spec.metal : armour === 'mail' ? mix(spec.metal, spec.cloth, 0.45) : spec.cloth;
    const legCol = spec.trousers ?? (plate ? shade(spec.metal, -0.1) : armour === 'mail' ? mix(spec.metal, spec.clothAlt, 0.5) : shade(spec.clothAlt, -0.2));
    const bootCol = shade(MAT.leatherDark, plate ? 0.25 : 0);

    if (!isWraith) {
      // legs
      for (const s of ['L', 'R'] as const) {
        seg(`hip${s}`, `knee${s}`, 0.055, 0.048, legCol);
        seg(`knee${s}`, `foot${s}`, 0.048, 0.04, legCol);
        const f = P(`foot${s}`);
        parts.push({
          depth: f.depth + 0.01,
          draw: () => {
            c.ellipse(f.x, f.y + 0.012 * S, 0.062 * S * bulk, 0.036 * S * bulk, bootCol, 0, Canvas.lampShader(f.x - 0.02 * S, f.y - 0.02 * S, 0.09 * S, 0.3, 0.4));
          },
        });
      }
    } else {
      // ragged hem instead of legs
      const p = P('pelvis');
      const h1 = P('hem1'), h2 = P('hem2'), h3 = P('hem3');
      parts.push({
        depth: p.depth,
        draw: () => {
          const pts = [
            { x: p.x - 0.11 * S, y: p.y },
            { x: h1.x, y: h1.y },
            { x: (h1.x + h2.x) / 2, y: h2.y - 0.05 * S },
            { x: h2.x, y: h2.y },
            { x: (h3.x + h2.x) / 2, y: h2.y - 0.04 * S },
            { x: h3.x, y: h3.y },
            { x: p.x + 0.11 * S, y: p.y },
          ];
          c.poly(pts, spec.cloth, Canvas.combine(Canvas.rampShader(p.y, h2.y, 0.05, -0.55), grain(0.18)));
        },
      });
    }

    // torso
    const pel = P('pelvis'), sp = P('spine'), ch = P('chest');
    const shl = P('shoulderL'), shr = P('shoulderR');
    parts.push({
      depth: (pel.depth + ch.depth) / 2,
      draw: () => {
        const w0 = 0.096 * S * bulk, w1 = 0.118 * S * bulk;
        c.poly([
          { x: pel.x - w0, y: pel.y + 0.02 * S },
          { x: sp.x - w0 * 1.06, y: sp.y },
          { x: shl.x - 0.016 * S, y: shl.y - 0.02 * S },
          { x: ch.x, y: ch.y - 0.045 * S },
          { x: shr.x + 0.016 * S, y: shr.y - 0.02 * S },
          { x: sp.x + w0 * 1.06, y: sp.y },
          { x: pel.x + w0, y: pel.y + 0.02 * S },
        ], spec.cloth, Canvas.combine(Canvas.lampShader(ch.x - 0.05 * S, ch.y - 0.02 * S, 0.24 * S, 0.3, 0.45), grain(0.16)));
        void w1;
        // chest plate / tunic panel
        if (armour !== 'none') {
          const pc = plate ? spec.metal : armour === 'mail' ? mix(spec.metal, INK, 0.25) : shade(spec.clothAlt, -0.14);
          const pw = (plate || armour === 'mail' ? 0.08 : 0.062) * S * bulk;
          c.poly([
            { x: ch.x - pw, y: ch.y - 0.038 * S },
            { x: ch.x + pw, y: ch.y - 0.038 * S },
            { x: ch.x + pw * 0.86, y: sp.y + 0.04 * S },
            { x: ch.x, y: sp.y + 0.066 * S },
            { x: ch.x - pw * 0.86, y: sp.y + 0.04 * S },
          ], pc, Canvas.combine(Canvas.lampShader(ch.x - 0.04 * S, ch.y - 0.03 * S, 0.17 * S, 0.34, 0.4), grain(armour === 'mail' ? 0.34 : 0.14)));
          if (!plate && armour !== 'mail') {
            // cross-strap over the tunic
            c.capsule(ch.x - pw * 1.5, ch.y - 0.05 * S, ch.x + pw * 1.2, sp.y + 0.03 * S, 0.016 * S, 0.016 * S, shade(spec.clothAlt, -0.3));
          }
        }
        // belt
        c.capsule(pel.x - 0.078 * S * bulk, pel.y + 0.012 * S, pel.x + 0.078 * S * bulk, pel.y + 0.012 * S, 0.02 * S, 0.02 * S, MAT.leatherDark);
        if (armour === 'plate' || armour === 'heavy') {
          c.disc(pel.x, pel.y + 0.012 * S, 0.024 * S, spec.accent, Canvas.lampShader(pel.x - 0.01 * S, pel.y, 0.03 * S, 0.5, 0.4));
        }
      },
    });

    // arms
    for (const s of ['L', 'R'] as const) {
      seg(`shoulder${s}`, `elbow${s}`, 0.05, 0.042, limbCol);
      seg(`elbow${s}`, `hand${s}`, 0.042, 0.033, limbCol);
      const hp = P(`hand${s}`);
      parts.push({
        depth: hp.depth + 0.005,
        draw: () => c.disc(hp.x, hp.y, 0.036 * S * bulk, isWraith ? shade(spec.skin, -0.25) : spec.skin, Canvas.lampShader(hp.x - 0.012 * S, hp.y - 0.012 * S, 0.05 * S, 0.3, 0.4)),
      });
      // shoulder armour
      if (spec.shoulders && spec.shoulders !== 'none') {
        const sh = P(`shoulder${s}`);
        parts.push({
          depth: sh.depth + 0.02,
          draw: () => drawShoulder(c, sh, S * bulk, spec, s === 'L' ? -1 : 1),
        });
      }
    }

    // head
    const hd = P('head'), nk = P('neck');
    parts.push({
      depth: hd.depth + 0.01,
      draw: () => drawHead(c, hd, nk, S, spec, o.yaw, seed),
    });

    // cloak behind the body
    if (spec.cloak) {
      const len = spec.cloakLength ?? 0.42;
      const back = { x: (shl.x + shr.x) / 2, y: ch.y - 0.02 * S };
      parts.push({
        depth: Math.min(shl.depth, shr.depth) - 0.09,
        draw: () => {
          const swayA = Math.sin(seed) * 0.02 * S;
          const pts = [
            { x: shl.x - 0.02 * S, y: shl.y - 0.03 * S },
            { x: back.x, y: back.y - 0.02 * S },
            { x: shr.x + 0.02 * S, y: shr.y - 0.03 * S },
            { x: shr.x + 0.075 * S + swayA, y: pel.y + len * 0.45 * S },
            { x: back.x + 0.02 * S + swayA, y: pel.y + len * S },
            { x: back.x - 0.05 * S + swayA, y: pel.y + len * 0.82 * S },
            { x: shl.x - 0.085 * S + swayA, y: pel.y + len * 0.4 * S },
          ];
          c.poly(pts, spec.cloak!, Canvas.combine(Canvas.rampShader(shl.y, pel.y + len * S, 0.12, -0.5), grain(0.2)));
          c.polyline(pts.slice(3, 7), shade(spec.cloak!, -0.35), 0.012 * S);
        },
      });
    }

    if (spec.weaponR && spec.weaponR.kind !== 'none') {
      const j = joints.get('handR')!;
      parts.push({ depth: P('handR').depth + 0.03, draw: () => drawWeapon(c, spec.weaponR!, j, project, S, spec) });
    }
    if (spec.weaponL && spec.weaponL.kind !== 'none') {
      const j = joints.get('handL')!;
      parts.push({ depth: P('handL').depth + 0.03, draw: () => drawWeapon(c, spec.weaponL!, j, project, S, spec) });
    }
  }

  // ------------------------------------------------------------ quadrupeds
  if (spec.rig === 'quadruped') {
    const fur = spec.fur ?? spec.skin;
    for (const s of ['L', 'R'] as const) {
      seg(`hip${s}`, `hock${s}`, 0.05, 0.04, shade(fur, -0.08));
      seg(`hock${s}`, `foot${s}`, 0.04, 0.03, shade(fur, -0.16));
      seg(`shoulder${s}`, `knee${s}`, 0.048, 0.038, shade(fur, -0.05));
      seg(`knee${s}`, `paw${s}`, 0.038, 0.028, shade(fur, -0.14));
      for (const p of [P(`paw${s}`), P(`foot${s}`)]) {
        parts.push({ depth: p.depth + 0.01, draw: () => c.ellipse(p.x, p.y + 0.008 * S, 0.042 * S, 0.026 * S, shade(fur, -0.3)) });
      }
    }
    const pel = P('pelvis'), sp = P('spine'), ch = P('chest'), nk = P('neck'), hd = P('head'), jw = P('jaw');
    parts.push({
      depth: (pel.depth + ch.depth) / 2,
      draw: () => {
        c.capsule(pel.x, pel.y, sp.x, sp.y, 0.1 * S * bulk, 0.095 * S * bulk, fur, limbShader(pel, sp, 0.1 * S, 0.22));
        c.capsule(sp.x, sp.y, ch.x, ch.y, 0.095 * S * bulk, 0.105 * S * bulk, fur, limbShader(sp, ch, 0.1 * S, 0.22));
        c.capsule(ch.x, ch.y, nk.x, nk.y, 0.095 * S * bulk, 0.07 * S * bulk, shade(fur, 0.05), limbShader(ch, nk, 0.08 * S, 0.2));
        // shoulder ruff
        c.ellipse(ch.x, ch.y - 0.01 * S, 0.115 * S * bulk, 0.09 * S * bulk, shade(fur, 0.08), 0, Canvas.combine(Canvas.lampShader(ch.x - 0.04 * S, ch.y - 0.04 * S, 0.14 * S, 0.3, 0.4), grain(0.26)));
      },
    });
    parts.push({
      depth: hd.depth + 0.02,
      draw: () => {
        c.ellipse(hd.x, hd.y, 0.075 * S * bulk, 0.062 * S * bulk, fur, 0, Canvas.lampShader(hd.x - 0.02 * S, hd.y - 0.025 * S, 0.1 * S, 0.34, 0.42));
        // muzzle
        c.capsule(hd.x, hd.y + 0.005 * S, jw.x, jw.y, 0.045 * S, 0.03 * S, shade(fur, -0.08), Canvas.lampShader(hd.x, hd.y, 0.08 * S, 0.3, 0.4));
        c.disc(jw.x, jw.y, 0.017 * S, INK);
        // ears
        for (const k of [-1, 1]) {
          c.poly([
            { x: hd.x + k * 0.045 * S, y: hd.y - 0.04 * S },
            { x: hd.x + k * 0.072 * S, y: hd.y - 0.115 * S },
            { x: hd.x + k * 0.016 * S, y: hd.y - 0.055 * S },
          ], shade(fur, -0.12));
        }
        // eyes
        const ec = spec.eyes ?? MAT.flame;
        for (const k of [-1, 1]) {
          c.disc(hd.x + k * 0.03 * S, hd.y - 0.012 * S, 0.012 * S, ec);
          if (spec.eyeGlow) c.glow(hd.x + k * 0.03 * S, hd.y - 0.012 * S, 0.05 * S, withAlpha(ec, 180), 0.8);
        }
        // fangs
        c.poly([{ x: jw.x - 0.02 * S, y: jw.y - 0.006 * S }, { x: jw.x - 0.008 * S, y: jw.y + 0.03 * S }, { x: jw.x - 0.002 * S, y: jw.y - 0.004 * S }], MAT.clothCream);
        c.poly([{ x: jw.x + 0.02 * S, y: jw.y - 0.006 * S }, { x: jw.x + 0.008 * S, y: jw.y + 0.03 * S }, { x: jw.x + 0.002 * S, y: jw.y - 0.004 * S }], MAT.clothCream);
      },
    });
    const t1 = P('tail1'), t2 = P('tail2');
    parts.push({ depth: t2.depth - 0.02, draw: () => c.capsule(t1.x, t1.y, t2.x, t2.y, 0.04 * S, 0.018 * S, shade(fur, -0.05), limbShader(t1, t2, 0.04 * S, 0.3)) });
  }

  // -------------------------------------------------------------- arachnid
  if (spec.rig === 'arachnid') {
    const body = spec.skin;
    for (let i = 0; i < 4; i++) {
      for (const s of ['L', 'R'] as const) {
        seg(`coxa${i}${s}`, `femur${i}${s}`, 0.028, 0.024, shade(body, -0.05));
        seg(`femur${i}${s}`, `tibia${i}${s}`, 0.024, 0.017, shade(body, -0.12));
        seg(`tibia${i}${s}`, `tip${i}${s}`, 0.017, 0.006, shade(body, -0.25));
      }
    }
    const pel = P('pelvis'), sp = P('spine'), ch = P('chest'), hd = P('head');
    parts.push({
      depth: pel.depth + 0.02,
      draw: () => {
        c.ellipse(pel.x, pel.y, 0.16 * S * bulk, 0.135 * S * bulk, body, 0, Canvas.combine(Canvas.lampShader(pel.x - 0.05 * S, pel.y - 0.06 * S, 0.2 * S, 0.34, 0.45), grain(0.14)));
        // abdomen marking
        c.poly([
          { x: pel.x, y: pel.y - 0.08 * S }, { x: pel.x + 0.05 * S, y: pel.y - 0.01 * S },
          { x: pel.x, y: pel.y + 0.075 * S }, { x: pel.x - 0.05 * S, y: pel.y - 0.01 * S },
        ], spec.accent);
        c.ellipse(sp.x, sp.y, 0.085 * S * bulk, 0.07 * S * bulk, shade(body, -0.06));
        c.ellipse(ch.x, ch.y, 0.1 * S * bulk, 0.08 * S * bulk, shade(body, 0.02), 0, Canvas.lampShader(ch.x - 0.03 * S, ch.y - 0.03 * S, 0.12 * S, 0.3, 0.42));
      },
    });
    parts.push({
      depth: hd.depth + 0.03,
      draw: () => {
        c.ellipse(hd.x, hd.y, 0.07 * S * bulk, 0.055 * S * bulk, shade(body, 0.05));
        const ec = spec.eyes ?? MAT.flame;
        const eyeRows = [[-0.035, -0.018, 0.012], [-0.015, -0.03, 0.009], [0.015, -0.03, 0.009], [0.035, -0.018, 0.012], [-0.022, 0.0, 0.007], [0.022, 0.0, 0.007]];
        for (const [ex, ey, er] of eyeRows) {
          c.disc(hd.x + ex! * S, hd.y + ey! * S, er! * S, ec);
        }
        if (spec.eyeGlow) c.glow(hd.x, hd.y - 0.015 * S, 0.1 * S, withAlpha(ec, 150), 0.7);
        for (const k of [-1, 1]) {
          c.capsule(hd.x + k * 0.03 * S, hd.y + 0.03 * S, hd.x + k * 0.05 * S, hd.y + 0.085 * S, 0.016 * S, 0.005 * S, shade(body, -0.3));
        }
      },
    });
  }

  // aura sits behind the silhouette so it never washes out the character
  if (spec.glowAura) {
    const ch = P('chest');
    c.glow(ch.x, ch.y, 0.42 * S, withAlpha(spec.glowAura, 42), 0.3);
  }

  // paint, far to near
  parts.sort((a, b) => a.depth - b.depth);
  for (const p of parts) p.draw();
}

// ------------------------------------------------------------------ pieces

function drawShoulder(c: Canvas, sh: Projection, S: number, spec: FigureSpec, side: number): void {
  const k = spec.shoulders;
  const col = k === 'fur' ? (spec.fur ?? MAT.furDark) : k === 'pads' ? shade(spec.clothAlt, -0.05) : spec.metal;
  if (k === 'pads') {
    c.ellipse(sh.x + side * 0.02 * S, sh.y + 0.012 * S, 0.046 * S, 0.036 * S, col, 0, Canvas.lampShader(sh.x - 0.015 * S, sh.y - 0.01 * S, 0.06 * S, 0.3, 0.42));
  } else if (k === 'plates') {
    c.poly([
      { x: sh.x - 0.05 * S, y: sh.y - 0.014 * S },
      { x: sh.x + 0.05 * S, y: sh.y - 0.014 * S },
      { x: sh.x + 0.058 * S, y: sh.y + 0.05 * S },
      { x: sh.x - 0.058 * S, y: sh.y + 0.05 * S },
    ], col, Canvas.lampShader(sh.x - 0.025 * S, sh.y - 0.01 * S, 0.08 * S, 0.34, 0.42));
    c.line(sh.x - 0.05 * S, sh.y + 0.022 * S, sh.x + 0.05 * S, sh.y + 0.022 * S, shade(col, -0.35), 0.008 * S);
  } else if (k === 'spikes') {
    c.ellipse(sh.x, sh.y + 0.012 * S, 0.05 * S, 0.04 * S, col, 0, Canvas.lampShader(sh.x - 0.016 * S, sh.y, 0.06 * S, 0.28, 0.42));
    for (let i = -1; i <= 1; i++) {
      c.poly([
        { x: sh.x + i * 0.026 * S - 0.008 * S, y: sh.y + 0.002 * S },
        { x: sh.x + i * 0.026 * S, y: sh.y - 0.048 * S },
        { x: sh.x + i * 0.026 * S + 0.008 * S, y: sh.y + 0.002 * S },
      ], shade(col, -0.05));
    }
  } else if (k === 'fur') {
    c.ellipse(sh.x, sh.y + 0.006 * S, 0.058 * S, 0.044 * S, col, 0, Canvas.combine(Canvas.lampShader(sh.x - 0.02 * S, sh.y - 0.03 * S, 0.09 * S, 0.3, 0.4), Canvas.grainShader(7, 0.4, 2.4)));
  }
}

function drawHead(c: Canvas, hd: Projection, nk: Projection, S: number, spec: FigureSpec, yaw: number, seed: number): void {
  const facing = Math.cos(yaw); // 1 = facing camera (south), -1 = away (north)
  const r = 0.084 * S;
  c.capsule(nk.x, nk.y, hd.x, hd.y, 0.035 * S, 0.05 * S, shade(spec.skin, -0.12));
  const headShader = Canvas.lampShader(hd.x - r * 0.3, hd.y - r * 0.35, r * 1.5, 0.32, 0.44);
  c.ellipse(hd.x, hd.y, r * (spec.rig === 'wraith' ? 0.92 : 1), r * 1.06, spec.skin, 0, headShader);

  if (spec.hunch && spec.hunch > 0.2) {
    c.ellipse(hd.x, hd.y + r * 0.42, r * 0.7, r * 0.5, shade(spec.skin, -0.08), 0, headShader);
  }

  const showFace = facing > -0.25;
  if (showFace && spec.rig !== 'wraith') {
    const ec = spec.eyes ?? INK;
    const ex = r * 0.36, ey = -r * 0.1;
    const skew = Math.sin(yaw) * r * 0.22;
    for (const k of [-1, 1]) {
      const px = hd.x + k * ex + skew, py = hd.y + ey;
      if (spec.eyeGlow) {
        c.glow(px, py, r * 0.8, withAlpha(ec, 150), 0.6);
        c.disc(px, py, r * 0.15, mix(ec, [255, 255, 255, 255], 0.5));
      } else {
        c.ellipse(px, py, r * 0.14, r * 0.17, ec);
      }
    }
    // brow
    c.capsule(hd.x - ex * 1.35 + skew, hd.y - r * 0.32, hd.x + ex * 1.35 + skew, hd.y - r * 0.32, r * 0.09, r * 0.09, shade(spec.skin, -0.34));
    if (spec.tusks) {
      for (const k of [-1, 1]) {
        c.poly([
          { x: hd.x + k * r * 0.34 + skew, y: hd.y + r * 0.42 },
          { x: hd.x + k * r * 0.46 + skew, y: hd.y + r * 0.02 },
          { x: hd.x + k * r * 0.2 + skew, y: hd.y + r * 0.4 },
        ], MAT.clothCream);
      }
    }
    // mouth line
    c.capsule(hd.x - r * 0.24 + skew, hd.y + r * 0.44, hd.x + r * 0.24 + skew, hd.y + r * 0.44, r * 0.045, r * 0.045, shade(spec.skin, -0.42));
  } else if (spec.rig === 'wraith' && showFace) {
    const ec = spec.eyes ?? MAT.wardBlue;
    for (const k of [-1, 1]) {
      c.glow(hd.x + k * r * 0.34, hd.y - r * 0.05, r * 0.85, withAlpha(ec, 170), 0.7);
      c.ellipse(hd.x + k * r * 0.34, hd.y - r * 0.05, r * 0.13, r * 0.09, mix(ec, [255, 255, 255, 255], 0.55));
    }
  }

  // hair
  if (spec.hair) {
    c.poly([
      { x: hd.x - r * 1.02, y: hd.y - r * 0.1 },
      { x: hd.x - r * 0.78, y: hd.y - r * 0.96 },
      { x: hd.x + r * 0.78, y: hd.y - r * 0.96 },
      { x: hd.x + r * 1.02, y: hd.y - r * 0.1 },
      { x: hd.x + r * 0.86, y: hd.y - r * 0.4 },
      { x: hd.x, y: hd.y - r * 0.62 },
      { x: hd.x - r * 0.86, y: hd.y - r * 0.4 },
    ], spec.hair, Canvas.combine(Canvas.lampShader(hd.x - r * 0.4, hd.y - r * 0.6, r * 1.6, 0.26, 0.4), Canvas.grainShader(seed + 3, 0.34, 2.2)));
  }

  drawHelmet(c, hd, r, spec, yaw);
}

function drawHelmet(c: Canvas, hd: Projection, r: number, spec: FigureSpec, yaw: number): void {
  const k = spec.helmet ?? 'none';
  if (k === 'none') return;
  const m = spec.metal;
  const lamp = Canvas.lampShader(hd.x - r * 0.35, hd.y - r * 0.5, r * 1.6, 0.4, 0.4);
  const facing = Math.cos(yaw);
  switch (k) {
    case 'cap':
      c.poly([
        { x: hd.x - r * 1.02, y: hd.y - r * 0.18 },
        { x: hd.x - r * 0.72, y: hd.y - r * 1.02 },
        { x: hd.x + r * 0.72, y: hd.y - r * 1.02 },
        { x: hd.x + r * 1.02, y: hd.y - r * 0.18 },
      ], m, lamp);
      c.capsule(hd.x - r * 1.05, hd.y - r * 0.18, hd.x + r * 1.05, hd.y - r * 0.18, r * 0.1, r * 0.1, shade(m, -0.2));
      break;
    case 'hood': {
      const col = spec.cloak ?? spec.clothAlt;
      c.poly([
        { x: hd.x - r * 1.14, y: hd.y + r * 0.5 },
        { x: hd.x - r * 1.0, y: hd.y - r * 0.72 },
        { x: hd.x, y: hd.y - r * 1.3 },
        { x: hd.x + r * 1.0, y: hd.y - r * 0.72 },
        { x: hd.x + r * 1.14, y: hd.y + r * 0.5 },
        { x: hd.x + r * 0.72, y: hd.y + r * 0.2 },
        { x: hd.x, y: hd.y + r * (facing > 0 ? 0.05 : 0.35) },
        { x: hd.x - r * 0.72, y: hd.y + r * 0.2 },
      ], col, Canvas.combine(Canvas.rampShader(hd.y - r * 1.3, hd.y + r * 0.5, 0.18, -0.4), Canvas.grainShader(5, 0.2, 2)));
      if (facing > -0.2) {
        c.ellipse(hd.x, hd.y - r * 0.04, r * 0.62, r * 0.5, [12, 14, 16, 220]);
      }
      break;
    }
    case 'horned':
      c.poly([
        { x: hd.x - r * 1.04, y: hd.y - r * 0.12 },
        { x: hd.x - r * 0.7, y: hd.y - r * 1.04 },
        { x: hd.x + r * 0.7, y: hd.y - r * 1.04 },
        { x: hd.x + r * 1.04, y: hd.y - r * 0.12 },
      ], m, lamp);
      for (const s of [-1, 1]) {
        c.curve(
          { x: hd.x + s * r * 0.95, y: hd.y - r * 0.45 },
          { x: hd.x + s * r * 1.9, y: hd.y - r * 1.15 },
          { x: hd.x + s * r * 1.35, y: hd.y - r * 1.75 },
          MAT.clothCream, r * 0.3, r * 0.07, 10,
        );
      }
      break;
    case 'antlers':
      for (const s of [-1, 1]) {
        c.curve({ x: hd.x + s * r * 0.5, y: hd.y - r * 0.8 }, { x: hd.x + s * r * 1.2, y: hd.y - r * 1.9 }, { x: hd.x + s * r * 0.9, y: hd.y - r * 2.6 }, MAT.woodDark, r * 0.22, r * 0.07, 10);
        c.curve({ x: hd.x + s * r * 0.8, y: hd.y - r * 1.5 }, { x: hd.x + s * r * 1.7, y: hd.y - r * 1.8 }, { x: hd.x + s * r * 1.9, y: hd.y - r * 2.3 }, MAT.woodDark, r * 0.14, r * 0.05, 8);
      }
      break;
    case 'full':
    case 'greathelm': {
      const tall = k === 'greathelm' ? 1.3 : 1.12;
      c.poly([
        { x: hd.x - r * 1.06, y: hd.y + r * 0.42 },
        { x: hd.x - r * 0.98, y: hd.y - r * 0.6 },
        { x: hd.x, y: hd.y - r * tall },
        { x: hd.x + r * 0.98, y: hd.y - r * 0.6 },
        { x: hd.x + r * 1.06, y: hd.y + r * 0.42 },
        { x: hd.x, y: hd.y + r * 0.64 },
      ], m, lamp);
      if (facing > -0.2) {
        const ec = spec.eyes ?? MAT.flame;
        for (const s of [-1, 1]) {
          c.poly([
            { x: hd.x + s * r * 0.18, y: hd.y - r * 0.2 },
            { x: hd.x + s * r * 0.66, y: hd.y - r * 0.24 },
            { x: hd.x + s * r * 0.66, y: hd.y - r * 0.02 },
            { x: hd.x + s * r * 0.18, y: hd.y + r * 0.02 },
          ], [10, 12, 14, 255]);
          if (spec.eyeGlow) c.glow(hd.x + s * r * 0.42, hd.y - r * 0.12, r * 0.55, withAlpha(ec, 150), 0.65);
        }
        c.capsule(hd.x, hd.y - r * tall, hd.x, hd.y + r * 0.5, r * 0.08, r * 0.1, shade(m, 0.22));
      }
      if (k === 'greathelm') {
        c.poly([
          { x: hd.x - r * 0.3, y: hd.y - r * tall },
          { x: hd.x, y: hd.y - r * (tall + 0.75) },
          { x: hd.x + r * 0.3, y: hd.y - r * tall },
        ], spec.accent);
      }
      break;
    }
    case 'crown':
      c.capsule(hd.x - r * 1.0, hd.y - r * 0.72, hd.x + r * 1.0, hd.y - r * 0.72, r * 0.16, r * 0.16, spec.accent, lamp);
      for (let i = -2; i <= 2; i++) {
        c.poly([
          { x: hd.x + i * r * 0.44 - r * 0.12, y: hd.y - r * 0.82 },
          { x: hd.x + i * r * 0.44, y: hd.y - r * (1.3 + (i % 2 === 0 ? 0.2 : 0)) },
          { x: hd.x + i * r * 0.44 + r * 0.12, y: hd.y - r * 0.82 },
        ], spec.accent);
      }
      break;
    case 'tattered': {
      const col = spec.cloak ?? spec.clothAlt;
      c.poly([
        { x: hd.x - r * 1.2, y: hd.y + r * 0.7 },
        { x: hd.x - r * 0.95, y: hd.y - r * 0.85 },
        { x: hd.x, y: hd.y - r * 1.45 },
        { x: hd.x + r * 0.95, y: hd.y - r * 0.85 },
        { x: hd.x + r * 1.2, y: hd.y + r * 0.7 },
        { x: hd.x + r * 0.8, y: hd.y + r * 0.3 },
        { x: hd.x + r * 0.45, y: hd.y + r * 0.85 },
        { x: hd.x, y: hd.y + r * 0.35 },
        { x: hd.x - r * 0.5, y: hd.y + r * 0.95 },
        { x: hd.x - r * 0.8, y: hd.y + r * 0.28 },
      ], col, Canvas.combine(Canvas.rampShader(hd.y - r * 1.45, hd.y + r, 0.1, -0.55), Canvas.grainShader(9, 0.28, 2.4)));
      if (facing > -0.2) c.ellipse(hd.x, hd.y, r * 0.66, r * 0.52, [8, 9, 12, 235]);
      break;
    }
  }
}

// ----------------------------------------------------------------- weapons

export function drawWeapon(
  c: Canvas,
  w: WeaponSpec,
  hand: PosedJoint,
  project: (p: V3) => Projection,
  S: number,
  spec: FigureSpec,
): void {
  const metal = w.metal ?? spec.metal;
  const wood = w.wood ?? MAT.wood;
  const accent = w.accent ?? spec.accent;
  const k = w.scale ?? 1;
  // local(x,y,z) in hand space -> world -> screen
  const L = (x: number, y: number, z: number): Projection => {
    const off = apply(hand.mat, { x: x * k, y: y * k, z: z * k });
    return project({ x: hand.pos.x + off.x, y: hand.pos.y + off.y, z: hand.pos.z + off.z });
  };
  const poly = (pts: [number, number, number][], col: RGBA, sh?: (x: number, y: number, b: RGBA) => RGBA) =>
    c.poly(pts.map(([x, y, z]) => { const p = L(x, y, z); return { x: p.x, y: p.y }; }), col, sh);
  const cap = (a: [number, number, number], b: [number, number, number], r0: number, r1: number, col: RGBA) => {
    const pa = L(a[0], a[1], a[2]), pb = L(b[0], b[1], b[2]);
    c.capsule(pa.x, pa.y, pb.x, pb.y, r0 * S, r1 * S, col, Canvas.lampShader((pa.x + pb.x) / 2 - 0.02 * S, (pa.y + pb.y) / 2 - 0.02 * S, Math.hypot(pb.x - pa.x, pb.y - pa.y) / 2 + r0 * S, 0.4, 0.4));
  };
  const metalShade = (cx: number, cy: number, r: number) => Canvas.lampShader(cx - r * 0.3, cy - r * 0.4, r * 1.4, 0.55, 0.4);

  switch (w.kind) {
    case 'sword':
    case 'greatsword': {
      const len = w.kind === 'greatsword' ? 0.68 : 0.47;
      const wdt = w.kind === 'greatsword' ? 0.055 : 0.044;
      cap([0, -0.06, 0], [0, 0.03, 0], 0.018, 0.018, MAT.leatherDark);
      c.disc(L(0, -0.08, 0).x, L(0, -0.08, 0).y, 0.022 * S, accent);
      const g = L(0, 0.04, 0);
      cap([-0.075, 0.04, 0], [0.075, 0.04, 0], 0.016, 0.016, shade(metal, -0.1));
      void g;
      const tip = L(0, 0.04 + len, 0);
      poly([
        [-wdt, 0.05, 0], [wdt, 0.05, 0], [wdt * 0.62, 0.04 + len * 0.82, 0], [0, 0.04 + len, 0], [-wdt * 0.62, 0.04 + len * 0.82, 0],
      ], metal, metalShade(tip.x, tip.y, len * S * 0.6));
      poly([[-wdt * 0.2, 0.06, 0], [wdt * 0.2, 0.06, 0], [0, 0.04 + len * 0.92, 0]], shade(metal, 0.3));
      if (w.glow) c.glow(tip.x, tip.y, 0.2 * S, withAlpha(w.glow, 150), 0.8);
      break;
    }
    case 'dagger':
      cap([0, -0.05, 0], [0, 0.02, 0], 0.016, 0.016, MAT.leatherDark);
      cap([-0.035, 0.03, 0], [0.035, 0.03, 0], 0.012, 0.012, shade(metal, -0.1));
      poly([[-0.024, 0.035, 0], [0.024, 0.035, 0], [0.012, 0.18, 0], [0, 0.22, 0], [-0.016, 0.17, 0]], metal, metalShade(L(0, 0.14, 0).x, L(0, 0.14, 0).y, 0.12 * S));
      break;
    case 'axe':
    case 'greataxe': {
      const len = w.kind === 'greataxe' ? 0.66 : 0.46;
      cap([0, -0.14, 0], [0, len, 0], 0.021, 0.018, wood);
      const hx = w.kind === 'greataxe' ? 0.2 : 0.15;
      const topY = len - 0.03;
      poly([
        [0, topY - 0.17, 0], [hx * 0.35, topY - 0.2, 0], [hx, topY - 0.12, 0], [hx * 1.02, topY + 0.02, 0], [hx * 0.4, topY + 0.06, 0], [0, topY + 0.02, 0],
      ], metal, metalShade(L(hx * 0.6, topY - 0.06, 0).x, L(hx * 0.6, topY - 0.06, 0).y, 0.16 * S));
      if (w.kind === 'greataxe') {
        poly([
          [0, topY - 0.17, 0], [-hx * 0.35, topY - 0.2, 0], [-hx, topY - 0.12, 0], [-hx * 1.02, topY + 0.02, 0], [-hx * 0.4, topY + 0.06, 0], [0, topY + 0.02, 0],
        ], shade(metal, -0.14));
      }
      cap([0, topY + 0.06, 0], [0, topY + 0.14, 0], 0.016, 0.006, shade(metal, 0.1));
      break;
    }
    case 'pick':
      cap([0, -0.12, 0], [0, 0.42, 0], 0.02, 0.017, wood);
      poly([[-0.02, 0.36, 0], [0.22, 0.3, 0], [0.24, 0.35, 0], [-0.02, 0.42, 0]], metal);
      poly([[0.02, 0.36, 0], [-0.14, 0.32, 0], [-0.15, 0.37, 0], [0.02, 0.42, 0]], shade(metal, -0.15));
      break;
    case 'hammer':
    case 'anvilhammer': {
      const len = 0.48;
      cap([0, -0.12, 0], [0, len, 0], 0.022, 0.019, wood);
      poly([[-0.12, len - 0.1, 0], [0.12, len - 0.1, 0], [0.13, len + 0.05, 0], [-0.13, len + 0.05, 0]], metal, metalShade(L(0, len, 0).x, L(0, len, 0).y, 0.16 * S));
      c.line(L(-0.12, len - 0.02, 0).x, L(-0.12, len - 0.02, 0).y, L(0.12, len - 0.02, 0).x, L(0.12, len - 0.02, 0).y, shade(metal, -0.3), 0.012 * S);
      break;
    }
    case 'morningstar': {
      cap([0, -0.1, 0], [0, 0.3, 0], 0.02, 0.018, wood);
      const bx = L(0, 0.42, 0);
      c.disc(bx.x, bx.y, 0.075 * S, metal, metalShade(bx.x, bx.y, 0.09 * S));
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        c.capsule(bx.x + Math.cos(a) * 0.05 * S, bx.y + Math.sin(a) * 0.05 * S, bx.x + Math.cos(a) * 0.12 * S, bx.y + Math.sin(a) * 0.12 * S, 0.016 * S, 0.003 * S, shade(metal, -0.12));
      }
      break;
    }
    case 'club':
      cap([0, -0.12, 0], [0, 0.18, 0], 0.024, 0.032, wood);
      cap([0, 0.18, 0], [0, 0.46, 0], 0.032, 0.062, shade(wood, -0.08));
      for (let i = 0; i < 5; i++) {
        const t = 0.24 + i * 0.05;
        const p = L(((i % 2) * 2 - 1) * 0.05, t, 0.02);
        c.capsule(p.x, p.y, p.x + ((i % 2) * 2 - 1) * 0.04 * S, p.y - 0.02 * S, 0.012 * S, 0.002 * S, MAT.ironDark);
      }
      break;
    case 'spear':
      cap([0, -0.3, 0], [0, 0.6, 0], 0.017, 0.015, wood);
      poly([[-0.035, 0.58, 0], [0, 0.78, 0], [0.035, 0.58, 0], [0, 0.54, 0]], metal, metalShade(L(0, 0.66, 0).x, L(0, 0.66, 0).y, 0.12 * S));
      break;
    case 'hook':
      cap([0, -0.1, 0], [0, 0.26, 0], 0.02, 0.017, MAT.leatherDark);
      c.curve(
        { x: L(0, 0.26, 0).x, y: L(0, 0.26, 0).y },
        { x: L(0.16, 0.42, 0).x, y: L(0.16, 0.42, 0).y },
        { x: L(0.02, 0.5, 0).x, y: L(0.02, 0.5, 0).y },
        metal, 0.03 * S, 0.008 * S, 12,
      );
      break;
    case 'scythe':
      cap([0, -0.3, 0], [0, 0.5, 0], 0.019, 0.016, wood);
      c.curve(
        { x: L(0, 0.5, 0).x, y: L(0, 0.5, 0).y },
        { x: L(0.34, 0.6, 0).x, y: L(0.34, 0.6, 0).y },
        { x: L(0.52, 0.34, 0).x, y: L(0.52, 0.34, 0).y },
        metal, 0.05 * S, 0.006 * S, 14,
      );
      break;
    case 'staff':
    case 'wand': {
      const len = w.kind === 'wand' ? 0.3 : 0.72;
      cap([0, -0.28, 0], [0, len, 0], 0.018, 0.015, wood);
      const tp = L(0, len + 0.03, 0);
      c.disc(tp.x, tp.y, 0.045 * S, accent);
      c.glow(tp.x, tp.y, 0.22 * S, withAlpha(w.glow ?? accent, 190), 1);
      break;
    }
    case 'torch':
      cap([0, -0.1, 0], [0, 0.26, 0], 0.018, 0.016, wood);
      {
        const tp = L(0, 0.3, 0);
        c.ellipse(tp.x, tp.y - 0.03 * S, 0.05 * S, 0.085 * S, MAT.flame);
        c.ellipse(tp.x, tp.y - 0.04 * S, 0.026 * S, 0.05 * S, MAT.flameCore);
        c.glow(tp.x, tp.y - 0.04 * S, 0.34 * S, withAlpha(MAT.flame, 200), 1.1);
      }
      break;
    case 'lantern':
      cap([0, 0.02, 0], [0, 0.16, 0], 0.008, 0.008, MAT.ironDark);
      poly([[-0.05, -0.12, 0], [0.05, -0.12, 0], [0.05, 0.02, 0], [-0.05, 0.02, 0]], withAlpha(MAT.flameCore, 230));
      c.strokePoly([L(-0.055, -0.13, 0), L(0.055, -0.13, 0), L(0.055, 0.03, 0), L(-0.055, 0.03, 0)].map((p) => ({ x: p.x, y: p.y })), MAT.ironDark, 0.012 * S);
      c.glow(L(0, -0.05, 0).x, L(0, -0.05, 0).y, 0.3 * S, withAlpha(MAT.flame, 170), 1);
      break;
    case 'bell':
      cap([0, 0.02, 0], [0, 0.2, 0], 0.008, 0.008, MAT.ironDark);
      poly([[-0.09, -0.16, 0], [0.09, -0.16, 0], [0.05, 0.04, 0], [-0.05, 0.04, 0]], MAT.bronze, metalShade(L(0, -0.06, 0).x, L(0, -0.06, 0).y, 0.12 * S));
      c.disc(L(0, -0.18, 0).x, L(0, -0.18, 0).y, 0.018 * S, shade(MAT.bronze, -0.3));
      break;
    case 'banner':
      cap([0, -0.3, 0], [0, 0.78, 0], 0.016, 0.013, wood);
      poly([[0.01, 0.72, 0], [0.24, 0.68, 0], [0.2, 0.34, 0], [0.24, 0.3, 0], [0.01, 0.32, 0]], accent, Canvas.rampShader(L(0, 0.72, 0).y, L(0, 0.3, 0).y, 0.14, -0.4));
      break;
    case 'bow': {
      const up = L(0, 0.42, 0), dn = L(0, -0.42, 0), mid = L(-0.06, 0, 0);
      c.curve({ x: dn.x, y: dn.y }, { x: mid.x - 0.16 * S, y: mid.y }, { x: up.x, y: up.y }, wood, 0.028 * S, 0.014 * S, 16);
      c.line(dn.x, dn.y, up.x, up.y, MAT.clothCream, 0.008 * S);
      break;
    }
    case 'crossbow': {
      poly([[-0.06, -0.02, 0], [0.34, -0.02, 0], [0.34, 0.03, 0], [-0.06, 0.03, 0]], wood);
      poly([[0.2, -0.2, 0], [0.26, -0.2, 0], [0.26, 0.21, 0], [0.2, 0.21, 0]], shade(metal, -0.1));
      c.line(L(0.23, -0.2, 0).x, L(0.23, -0.2, 0).y, L(0.0, 0.0, 0).x, L(0, 0, 0).y, MAT.clothCream, 0.007 * S);
      c.line(L(0.23, 0.21, 0).x, L(0.23, 0.21, 0).y, L(0.0, 0.0, 0).x, L(0, 0, 0).y, MAT.clothCream, 0.007 * S);
      break;
    }
    case 'chain': {
      for (let i = 0; i < 7; i++) {
        const p = L(i * 0.06, -i * 0.045, 0);
        c.disc(p.x, p.y, 0.022 * S, i % 2 ? shade(metal, -0.2) : metal);
      }
      break;
    }
    case 'shield': {
      const r = 0.125;
      const ox = -0.065, oy = 0.05, oz = -0.14;
      const ctr = L(ox, oy, oz);
      const rim = [
        L(ox - r, oy + r * 0.85, oz), L(ox + r, oy + r * 0.85, oz), L(ox + r * 1.05, oy - r * 0.35, oz),
        L(ox, oy - r * 1.35, oz), L(ox - r * 1.05, oy - r * 0.35, oz),
      ].map((p) => ({ x: p.x, y: p.y }));
      c.poly(rim, wood, Canvas.combine(Canvas.lampShader(ctr.x - r * S * 0.3, ctr.y - r * S * 0.4, r * S * 1.6, 0.36, 0.42), Canvas.grainShader(4, 0.26, 1.6)));
      c.strokePoly(rim, shade(metal, -0.15), 0.02 * S);
      c.polyline([rim[0]!, rim[3]!], shade(wood, -0.28), 0.012 * S);
      c.disc(ctr.x, ctr.y, 0.042 * S, metal, metalShade(ctr.x, ctr.y, 0.05 * S));
      c.disc(ctr.x, ctr.y, 0.017 * S, accent);
      break;
    }
    case 'none':
    default:
      break;
  }
}
