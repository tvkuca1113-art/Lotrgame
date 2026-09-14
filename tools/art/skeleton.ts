/**
 * A very small 3D skeletal poser + isometric projector.
 *
 * Characters are authored once as a bone hierarchy in 3D, then projected for
 * each of the five unique isometric facings (S, SE, E, NE, N; the remaining
 * three are horizontal mirrors). That keeps every direction consistent instead
 * of hand-drawing eight separate sets.
 */

export interface V3 { x: number; y: number; z: number }

export function v3(x: number, y: number, z: number): V3 { return { x, y, z }; }

export type Mat3 = [number, number, number, number, number, number, number, number, number];

export const IDENTITY: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

export function mul(a: Mat3, b: Mat3): Mat3 {
  const o = new Array(9) as Mat3;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      o[r * 3 + c] = a[r * 3]! * b[c]! + a[r * 3 + 1]! * b[3 + c]! + a[r * 3 + 2]! * b[6 + c]!;
    }
  }
  return o;
}

export function apply(m: Mat3, p: V3): V3 {
  return {
    x: m[0]! * p.x + m[1]! * p.y + m[2]! * p.z,
    y: m[3]! * p.x + m[4]! * p.y + m[5]! * p.z,
    z: m[6]! * p.x + m[7]! * p.y + m[8]! * p.z,
  };
}

export function rotX(a: number): Mat3 { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, c, -s, 0, s, c]; }
export function rotY(a: number): Mat3 { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 1, 0, -s, 0, c]; }
export function rotZ(a: number): Mat3 { const c = Math.cos(a), s = Math.sin(a); return [c, -s, 0, s, c, 0, 0, 0, 1]; }

export function euler(rx: number, ry: number, rz: number): Mat3 {
  return mul(mul(rotY(ry), rotX(rx)), rotZ(rz));
}

export interface BoneDef {
  name: string;
  parent: string | null;
  /** Offset from the parent joint, expressed in the parent's local frame. */
  offset: V3;
}

export type Pose = Record<string, [number, number, number] | undefined>;

export interface PosedJoint { pos: V3; mat: Mat3 }

export class Skeleton {
  readonly bones: BoneDef[];
  private byName = new Map<string, BoneDef>();
  constructor(bones: BoneDef[]) {
    this.bones = bones;
    for (const b of bones) this.byName.set(b.name, b);
  }
  has(name: string): boolean { return this.byName.has(name); }

  /** Forward kinematics. Returns world-space joint positions and frames. */
  solve(pose: Pose, rootPos: V3 = v3(0, 0, 0), rootRot: Mat3 = IDENTITY): Map<string, PosedJoint> {
    const out = new Map<string, PosedJoint>();
    for (const b of this.bones) {
      const local = pose[b.name];
      const rot = local ? euler(local[0], local[1], local[2]) : IDENTITY;
      if (b.parent === null) {
        const m = mul(rootRot, rot);
        out.set(b.name, { pos: { x: rootPos.x + b.offset.x, y: rootPos.y + b.offset.y, z: rootPos.z + b.offset.z }, mat: m });
      } else {
        const p = out.get(b.parent);
        if (!p) throw new Error(`bone ${b.name} references missing parent ${b.parent}`);
        const off = apply(p.mat, b.offset);
        out.set(b.name, { pos: { x: p.pos.x + off.x, y: p.pos.y + off.y, z: p.pos.z + off.z }, mat: mul(p.mat, rot) });
      }
    }
    return out;
  }
}

export interface Projection {
  /** Screen x/y in sprite pixels, plus a depth key for painter ordering. */
  x: number; y: number; depth: number;
}

/**
 * Isometric camera. `yaw` rotates the character, the camera itself is fixed at
 * a 2:1 isometric pitch, matching the world-to-screen transform used in game.
 */
export function makeProjector(yaw: number, originX: number, originY: number, scale: number, pitch = 0.5) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  return (p: V3): Projection => {
    // rotate around the vertical (y) axis
    const rx = p.x * cy + p.z * sy;
    const rz = -p.x * sy + p.z * cy;
    return {
      x: originX + rx * scale,
      y: originY - p.y * scale + rz * scale * pitch,
      depth: rz,
    };
  };
}

export function lerpPose(a: Pose, b: Pose, t: number): Pose {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const out: Pose = {};
  for (const k of keys) {
    const pa = a[k] ?? [0, 0, 0];
    const pb = b[k] ?? [0, 0, 0];
    out[k] = [pa[0] + (pb[0] - pa[0]) * t, pa[1] + (pb[1] - pa[1]) * t, pa[2] + (pb[2] - pa[2]) * t];
  }
  return out;
}

export function addPose(a: Pose, b: Pose): Pose {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const out: Pose = {};
  for (const k of keys) {
    const pa = a[k] ?? [0, 0, 0];
    const pb = b[k] ?? [0, 0, 0];
    out[k] = [pa[0] + pb[0], pa[1] + pb[1], pa[2] + pb[2]];
  }
  return out;
}

/** Sample a keyframe track: `frames` are [time0..1, pose] sorted ascending, looped. */
export function sampleTrack(frames: [number, Pose][], t: number, loop = true): Pose {
  if (frames.length === 0) return {};
  if (frames.length === 1) return frames[0]![1];
  const tt = loop ? ((t % 1) + 1) % 1 : Math.max(0, Math.min(1, t));
  for (let i = 0; i < frames.length - 1; i++) {
    const [t0, p0] = frames[i]!;
    const [t1, p1] = frames[i + 1]!;
    if (tt >= t0 && tt <= t1) {
      const k = t1 === t0 ? 0 : (tt - t0) / (t1 - t0);
      const eased = k * k * (3 - 2 * k);
      return lerpPose(p0, p1, eased);
    }
  }
  if (loop) {
    const [tl, pl] = frames[frames.length - 1]!;
    const [tf, pf] = frames[0]!;
    const span = 1 - tl + tf;
    const k = span <= 0 ? 0 : (tt >= tl ? tt - tl : 1 - tl + tt) / span;
    return lerpPose(pl, pf, k * k * (3 - 2 * k));
  }
  return frames[frames.length - 1]![1];
}
