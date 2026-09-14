/**
 * Keyframe pose library. Every animation is authored once per rig and reused
 * across characters, which is what keeps 40+ actors affordable.
 */
import type { Pose } from './skeleton.ts';
import { sampleTrack, addPose } from './skeleton.ts';

const D = Math.PI / 180;

export type AnimName =
  | 'idle' | 'walk' | 'run' | 'attack' | 'attack2' | 'heavy' | 'cast' | 'shoot'
  | 'block' | 'hit' | 'death' | 'roar' | 'leap' | 'slam' | 'dodge' | 'build' | 'sit';

export interface AnimDef {
  frames: number;
  /** Seconds for one full cycle at 1x speed. */
  duration: number;
  loop: boolean;
  track: [number, Pose][];
  /** Vertical body offset per normalised time (hops, lunges). */
  lift?: (t: number) => number;
}

// ------------------------------------------------------------- humanoid

const H_REST: Pose = {
  pelvis: [0, 0, 0], spine: [0, 0, 0], chest: [0, 0, 0], neck: [0, 0, 0], head: [0, 0, 0],
  shoulderL: [6 * D, 0, 10 * D], elbowL: [10 * D, 0, 0], handL: [-28 * D, 0, 0],
  shoulderR: [6 * D, 0, -10 * D], elbowR: [10 * D, 0, 0], handR: [-62 * D, 0, 0],
  hipL: [0, 0, 2 * D], kneeL: [4 * D, 0, 0], footL: [0, 0, 0],
  hipR: [0, 0, -2 * D], kneeR: [4 * D, 0, 0], footR: [0, 0, 0],
};

function pose(p: Partial<Pose>): Pose { return { ...H_REST, ...p } as Pose; }

export const HUMANOID_ANIMS: Record<AnimName, AnimDef> = {
  idle: {
    frames: 6, duration: 2.2, loop: true,
    track: [
      [0, pose({ chest: [-1 * D, 0, 0], shoulderL: [8 * D, 0, 11 * D], shoulderR: [8 * D, 0, -11 * D] })],
      [0.5, pose({ chest: [2.5 * D, 0, 0], head: [-2 * D, 0, 0], shoulderL: [2 * D, 0, 13 * D], shoulderR: [2 * D, 0, -13 * D], kneeL: [6 * D, 0, 0], kneeR: [6 * D, 0, 0] })],
      [1, pose({ chest: [-1 * D, 0, 0], shoulderL: [8 * D, 0, 11 * D], shoulderR: [8 * D, 0, -11 * D] })],
    ],
    lift: (t) => Math.sin(t * Math.PI * 2) * 0.006,
  },
  walk: {
    frames: 8, duration: 0.78, loop: true,
    track: [
      [0, pose({ hipL: [30 * D, 0, 2 * D], kneeL: [10 * D, 0, 0], hipR: [-24 * D, 0, -2 * D], kneeR: [38 * D, 0, 0], shoulderL: [-24 * D, 0, 12 * D], shoulderR: [26 * D, 0, -12 * D], elbowL: [16 * D, 0, 0], elbowR: [20 * D, 0, 0], spine: [2 * D, -6 * D, 0] })],
      [0.25, pose({ hipL: [6 * D, 0, 2 * D], kneeL: [4 * D, 0, 0], hipR: [2 * D, 0, -2 * D], kneeR: [12 * D, 0, 0], shoulderL: [0, 0, 12 * D], shoulderR: [0, 0, -12 * D], spine: [3 * D, 0, 0] })],
      [0.5, pose({ hipL: [-24 * D, 0, 2 * D], kneeL: [38 * D, 0, 0], hipR: [30 * D, 0, -2 * D], kneeR: [10 * D, 0, 0], shoulderL: [26 * D, 0, 12 * D], shoulderR: [-24 * D, 0, -12 * D], elbowL: [20 * D, 0, 0], elbowR: [16 * D, 0, 0], spine: [2 * D, 6 * D, 0] })],
      [0.75, pose({ hipL: [2 * D, 0, 2 * D], kneeL: [12 * D, 0, 0], hipR: [6 * D, 0, -2 * D], kneeR: [4 * D, 0, 0], shoulderL: [0, 0, 12 * D], shoulderR: [0, 0, -12 * D], spine: [3 * D, 0, 0] })],
      [1, pose({ hipL: [30 * D, 0, 2 * D], kneeL: [10 * D, 0, 0], hipR: [-24 * D, 0, -2 * D], kneeR: [38 * D, 0, 0], shoulderL: [-24 * D, 0, 12 * D], shoulderR: [26 * D, 0, -12 * D], elbowL: [16 * D, 0, 0], elbowR: [20 * D, 0, 0], spine: [2 * D, -6 * D, 0] })],
    ],
    lift: (t) => Math.abs(Math.sin(t * Math.PI * 2)) * 0.016,
  },
  run: {
    frames: 8, duration: 0.56, loop: true,
    track: [
      [0, pose({ hipL: [48 * D, 0, 2 * D], kneeL: [22 * D, 0, 0], hipR: [-38 * D, 0, -2 * D], kneeR: [66 * D, 0, 0], shoulderL: [-44 * D, 0, 14 * D], shoulderR: [44 * D, 0, -14 * D], elbowL: [54 * D, 0, 0], elbowR: [54 * D, 0, 0], spine: [10 * D, -8 * D, 0], chest: [6 * D, 0, 0] })],
      [0.25, pose({ hipL: [10 * D, 0, 2 * D], kneeL: [12 * D, 0, 0], hipR: [4 * D, 0, -2 * D], kneeR: [28 * D, 0, 0], shoulderL: [-8 * D, 0, 14 * D], shoulderR: [8 * D, 0, -14 * D], elbowL: [50 * D, 0, 0], elbowR: [50 * D, 0, 0], spine: [12 * D, 0, 0] })],
      [0.5, pose({ hipL: [-38 * D, 0, 2 * D], kneeL: [66 * D, 0, 0], hipR: [48 * D, 0, -2 * D], kneeR: [22 * D, 0, 0], shoulderL: [44 * D, 0, 14 * D], shoulderR: [-44 * D, 0, -14 * D], elbowL: [54 * D, 0, 0], elbowR: [54 * D, 0, 0], spine: [10 * D, 8 * D, 0], chest: [6 * D, 0, 0] })],
      [0.75, pose({ hipL: [4 * D, 0, 2 * D], kneeL: [28 * D, 0, 0], hipR: [10 * D, 0, -2 * D], kneeR: [12 * D, 0, 0], shoulderL: [8 * D, 0, 14 * D], shoulderR: [-8 * D, 0, -14 * D], elbowL: [50 * D, 0, 0], elbowR: [50 * D, 0, 0], spine: [12 * D, 0, 0] })],
      [1, pose({ hipL: [48 * D, 0, 2 * D], kneeL: [22 * D, 0, 0], hipR: [-38 * D, 0, -2 * D], kneeR: [66 * D, 0, 0], shoulderL: [-44 * D, 0, 14 * D], shoulderR: [44 * D, 0, -14 * D], elbowL: [54 * D, 0, 0], elbowR: [54 * D, 0, 0], spine: [10 * D, -8 * D, 0], chest: [6 * D, 0, 0] })],
    ],
    lift: (t) => Math.abs(Math.sin(t * Math.PI * 2)) * 0.03,
  },
  attack: {
    frames: 6, duration: 0.46, loop: false,
    track: [
      [0, pose({ spine: [0, 26 * D, 0], chest: [0, 14 * D, 0], shoulderR: [-30 * D, 0, -58 * D], elbowR: [78 * D, 0, 0], handR: [-30 * D, 0, 0], shoulderL: [12 * D, 0, 26 * D] })],
      [0.28, pose({ spine: [0, 34 * D, 0], chest: [-6 * D, 20 * D, 0], shoulderR: [-70 * D, 0, -72 * D], elbowR: [96 * D, 0, 0], handR: [-46 * D, 0, 0], shoulderL: [20 * D, 0, 34 * D], hipR: [-8 * D, 0, 0] })],
      [0.46, pose({ spine: [4 * D, -26 * D, 0], chest: [10 * D, -18 * D, 0], shoulderR: [56 * D, 0, -16 * D], elbowR: [8 * D, 0, 0], handR: [16 * D, 0, 0], shoulderL: [-16 * D, 0, 20 * D], hipL: [14 * D, 0, 0] })],
      [0.66, pose({ spine: [2 * D, -32 * D, 0], chest: [6 * D, -22 * D, 0], shoulderR: [44 * D, 0, -12 * D], elbowR: [18 * D, 0, 0], handR: [2 * D, 0, 0], shoulderL: [-10 * D, 0, 18 * D] })],
      [1, pose({ spine: [0, 0, 0], chest: [0, 0, 0] })],
    ],
    lift: (t) => (t > 0.3 && t < 0.6 ? 0.012 : 0),
  },
  attack2: {
    frames: 6, duration: 0.5, loop: false,
    track: [
      [0, pose({ spine: [0, -20 * D, 0], shoulderR: [64 * D, 0, 22 * D], elbowR: [40 * D, 0, 0] })],
      [0.3, pose({ spine: [-4 * D, -32 * D, 0], chest: [-8 * D, -18 * D, 0], shoulderR: [92 * D, 0, 40 * D], elbowR: [60 * D, 0, 0], handR: [-50 * D, 0, 0] })],
      [0.48, pose({ spine: [6 * D, 30 * D, 0], chest: [12 * D, 20 * D, 0], shoulderR: [-34 * D, 0, -44 * D], elbowR: [16 * D, 0, 0], handR: [10 * D, 0, 0], hipR: [12 * D, 0, 0] })],
      [0.7, pose({ spine: [3 * D, 24 * D, 0], shoulderR: [-18 * D, 0, -30 * D], elbowR: [26 * D, 0, 0] })],
      [1, pose({})],
    ],
  },
  heavy: {
    frames: 8, duration: 0.86, loop: false,
    track: [
      [0, pose({ spine: [-6 * D, 30 * D, 0], shoulderR: [-96 * D, 0, -30 * D], elbowR: [40 * D, 0, 0], shoulderL: [-80 * D, 0, 30 * D], elbowL: [40 * D, 0, 0] })],
      [0.42, pose({ spine: [-18 * D, 40 * D, 0], chest: [-16 * D, 18 * D, 0], shoulderR: [-142 * D, 0, -24 * D], elbowR: [20 * D, 0, 0], handR: [-40 * D, 0, 0], shoulderL: [-130 * D, 0, 24 * D], elbowL: [20 * D, 0, 0], handL: [-40 * D, 0, 0], kneeL: [16 * D, 0, 0], kneeR: [16 * D, 0, 0] })],
      [0.62, pose({ spine: [26 * D, -18 * D, 0], chest: [20 * D, -10 * D, 0], shoulderR: [54 * D, 0, -10 * D], elbowR: [6 * D, 0, 0], handR: [26 * D, 0, 0], shoulderL: [50 * D, 0, 10 * D], elbowL: [6 * D, 0, 0], handL: [26 * D, 0, 0], hipL: [24 * D, 0, 0], kneeL: [10 * D, 0, 0] })],
      [0.8, pose({ spine: [20 * D, -14 * D, 0], shoulderR: [46 * D, 0, -12 * D], shoulderL: [42 * D, 0, 12 * D] })],
      [1, pose({})],
    ],
    lift: (t) => (t < 0.45 ? 0.02 * t : t < 0.65 ? -0.02 : 0),
  },
  cast: {
    frames: 6, duration: 0.8, loop: false,
    track: [
      [0, pose({ shoulderR: [-40 * D, 0, -20 * D], elbowR: [70 * D, 0, 0], shoulderL: [-40 * D, 0, 20 * D], elbowL: [70 * D, 0, 0] })],
      [0.4, pose({ spine: [-10 * D, 0, 0], chest: [-8 * D, 0, 0], head: [-10 * D, 0, 0], shoulderR: [-138 * D, 0, -36 * D], elbowR: [26 * D, 0, 0], shoulderL: [-138 * D, 0, 36 * D], elbowL: [26 * D, 0, 0] })],
      [0.7, pose({ spine: [6 * D, 0, 0], chest: [8 * D, 0, 0], shoulderR: [-56 * D, 0, -60 * D], elbowR: [40 * D, 0, 0], shoulderL: [-56 * D, 0, 60 * D], elbowL: [40 * D, 0, 0] })],
      [1, pose({})],
    ],
    lift: (t) => Math.sin(Math.min(1, t / 0.7) * Math.PI) * 0.018,
  },
  shoot: {
    frames: 6, duration: 0.62, loop: false,
    track: [
      [0, pose({ spine: [0, -34 * D, 0], shoulderL: [-84 * D, 0, 26 * D], elbowL: [10 * D, 0, 0], handL: [-84 * D, 0, 0], shoulderR: [-60 * D, 0, -50 * D], elbowR: [72 * D, 0, 0], handR: [-40 * D, 0, 0] })],
      [0.42, pose({ spine: [0, -40 * D, 0], chest: [0, -12 * D, 0], shoulderL: [-90 * D, 0, 22 * D], elbowL: [6 * D, 0, 0], handL: [-90 * D, 0, 0], shoulderR: [-72 * D, 0, -76 * D], elbowR: [104 * D, 0, 0], handR: [-40 * D, 0, 0] })],
      [0.56, pose({ spine: [0, -36 * D, 0], chest: [2 * D, -8 * D, 0], shoulderL: [-88 * D, 0, 24 * D], elbowL: [8 * D, 0, 0], handL: [-90 * D, 0, 0], shoulderR: [-56 * D, 0, -40 * D], elbowR: [40 * D, 0, 0], handR: [-40 * D, 0, 0] })],
      [1, pose({ spine: [0, -20 * D, 0] })],
    ],
  },
  block: {
    frames: 4, duration: 0.5, loop: true,
    track: [
      [0, pose({ spine: [4 * D, -18 * D, 0], shoulderL: [-72 * D, 0, 46 * D], elbowL: [70 * D, 0, 0], handL: [-70 * D, 0, 0], shoulderR: [16 * D, 0, -22 * D], elbowR: [56 * D, 0, 0], handR: [-70 * D, 0, 0], hipL: [8 * D, 0, 0], kneeL: [14 * D, 0, 0] })],
      [0.5, pose({ spine: [6 * D, -20 * D, 0], shoulderL: [-78 * D, 0, 44 * D], elbowL: [74 * D, 0, 0], shoulderR: [18 * D, 0, -24 * D], elbowR: [58 * D, 0, 0], hipL: [8 * D, 0, 0], kneeL: [16 * D, 0, 0] })],
      [1, pose({ spine: [4 * D, -18 * D, 0], shoulderL: [-72 * D, 0, 46 * D], elbowL: [70 * D, 0, 0], shoulderR: [16 * D, 0, -22 * D], elbowR: [56 * D, 0, 0], hipL: [8 * D, 0, 0], kneeL: [14 * D, 0, 0] })],
    ],
  },
  hit: {
    frames: 3, duration: 0.3, loop: false,
    track: [
      [0, pose({ spine: [-16 * D, 0, 0], chest: [-14 * D, 0, 0], head: [-18 * D, 0, 0], shoulderL: [-26 * D, 0, 34 * D], shoulderR: [-26 * D, 0, -34 * D], kneeL: [16 * D, 0, 0], kneeR: [16 * D, 0, 0] })],
      [0.45, pose({ spine: [-22 * D, 0, 0], chest: [-18 * D, 0, 0], head: [-24 * D, 0, 0], shoulderL: [-34 * D, 0, 40 * D], shoulderR: [-34 * D, 0, -40 * D], hipL: [-10 * D, 0, 0], hipR: [-10 * D, 0, 0] })],
      [1, pose({ spine: [-4 * D, 0, 0] })],
    ],
    lift: (t) => -0.01 * Math.sin(t * Math.PI),
  },
  death: {
    frames: 6, duration: 0.95, loop: false,
    track: [
      [0, pose({ spine: [-20 * D, 0, 0], head: [-22 * D, 0, 0] })],
      [0.3, pose({ spine: [-40 * D, 0, 10 * D], chest: [-20 * D, 0, 0], head: [-30 * D, 0, 0], hipL: [-30 * D, 0, 0], kneeL: [56 * D, 0, 0], hipR: [-16 * D, 0, 0], kneeR: [30 * D, 0, 0], shoulderL: [-50 * D, 0, 40 * D], shoulderR: [-50 * D, 0, -40 * D] })],
      [0.65, pose({ pelvis: [0, 0, 24 * D], spine: [-56 * D, 0, 16 * D], chest: [-26 * D, 0, 0], head: [-34 * D, 0, 0], hipL: [-70 * D, 0, 0], kneeL: [88 * D, 0, 0], hipR: [-50 * D, 0, 0], kneeR: [70 * D, 0, 0], shoulderL: [-70 * D, 0, 60 * D], shoulderR: [-70 * D, 0, -60 * D] })],
      [1, pose({ pelvis: [0, 0, 30 * D], spine: [-62 * D, 0, 18 * D], chest: [-28 * D, 0, 0], head: [-36 * D, 0, 0], hipL: [-78 * D, 0, 0], kneeL: [92 * D, 0, 0], hipR: [-58 * D, 0, 0], kneeR: [78 * D, 0, 0], shoulderL: [-76 * D, 0, 66 * D], shoulderR: [-76 * D, 0, -66 * D] })],
    ],
    lift: (t) => -0.34 * Math.min(1, t / 0.7),
  },
  roar: {
    frames: 6, duration: 1.1, loop: false,
    track: [
      [0, pose({})],
      [0.3, pose({ spine: [-24 * D, 0, 0], chest: [-16 * D, 0, 0], head: [-30 * D, 0, 0], shoulderL: [-108 * D, 0, 56 * D], elbowL: [44 * D, 0, 0], shoulderR: [-108 * D, 0, -56 * D], elbowR: [44 * D, 0, 0] })],
      [0.68, pose({ spine: [-28 * D, 0, 0], chest: [-20 * D, 0, 0], head: [-34 * D, 0, 0], shoulderL: [-124 * D, 0, 66 * D], elbowL: [34 * D, 0, 0], shoulderR: [-124 * D, 0, -66 * D], elbowR: [34 * D, 0, 0], kneeL: [12 * D, 0, 0], kneeR: [12 * D, 0, 0] })],
      [1, pose({})],
    ],
    lift: (t) => Math.sin(Math.min(1, t / 0.7) * Math.PI) * 0.02,
  },
  leap: {
    frames: 6, duration: 0.86, loop: false,
    track: [
      [0, pose({ hipL: [-30 * D, 0, 0], kneeL: [56 * D, 0, 0], hipR: [-30 * D, 0, 0], kneeR: [56 * D, 0, 0], spine: [-14 * D, 0, 0], shoulderL: [-30 * D, 0, 30 * D], shoulderR: [-30 * D, 0, -30 * D] })],
      [0.34, pose({ hipL: [42 * D, 0, 0], kneeL: [10 * D, 0, 0], hipR: [40 * D, 0, 0], kneeR: [12 * D, 0, 0], spine: [12 * D, 0, 0], shoulderL: [-110 * D, 0, 38 * D], shoulderR: [-110 * D, 0, -38 * D] })],
      [0.66, pose({ hipL: [24 * D, 0, 0], kneeL: [46 * D, 0, 0], hipR: [20 * D, 0, 0], kneeR: [50 * D, 0, 0], spine: [-6 * D, 0, 0], shoulderL: [-60 * D, 0, 34 * D], shoulderR: [-60 * D, 0, -34 * D] })],
      [0.82, pose({ hipL: [-26 * D, 0, 0], kneeL: [54 * D, 0, 0], hipR: [-26 * D, 0, 0], kneeR: [54 * D, 0, 0], spine: [-18 * D, 0, 0] })],
      [1, pose({})],
    ],
    lift: (t) => Math.sin(Math.max(0, Math.min(1, (t - 0.2) / 0.55)) * Math.PI) * 0.34,
  },
  slam: {
    frames: 7, duration: 0.96, loop: false,
    track: [
      [0, pose({ shoulderL: [-50 * D, 0, 26 * D], shoulderR: [-50 * D, 0, -26 * D], elbowL: [40 * D, 0, 0], elbowR: [40 * D, 0, 0] })],
      [0.45, pose({ spine: [-22 * D, 0, 0], chest: [-14 * D, 0, 0], shoulderL: [-158 * D, 0, 28 * D], shoulderR: [-158 * D, 0, -28 * D], elbowL: [12 * D, 0, 0], elbowR: [12 * D, 0, 0] })],
      [0.6, pose({ spine: [34 * D, 0, 0], chest: [22 * D, 0, 0], shoulderL: [42 * D, 0, 18 * D], shoulderR: [42 * D, 0, -18 * D], elbowL: [4 * D, 0, 0], elbowR: [4 * D, 0, 0], hipL: [26 * D, 0, 0], hipR: [26 * D, 0, 0], kneeL: [26 * D, 0, 0], kneeR: [26 * D, 0, 0] })],
      [0.82, pose({ spine: [22 * D, 0, 0], shoulderL: [30 * D, 0, 20 * D], shoulderR: [30 * D, 0, -20 * D] })],
      [1, pose({})],
    ],
    lift: (t) => (t < 0.5 ? 0.05 * (t / 0.5) : t < 0.62 ? -0.03 : 0),
  },
  dodge: {
    frames: 5, duration: 0.42, loop: false,
    track: [
      [0, pose({ spine: [12 * D, 0, 0], hipL: [-24 * D, 0, 0], kneeL: [44 * D, 0, 0], hipR: [-24 * D, 0, 0], kneeR: [44 * D, 0, 0] })],
      [0.35, pose({ spine: [34 * D, 0, 0], chest: [22 * D, 0, 0], head: [16 * D, 0, 0], hipL: [66 * D, 0, 0], kneeL: [78 * D, 0, 0], hipR: [58 * D, 0, 0], kneeR: [84 * D, 0, 0], shoulderL: [-70 * D, 0, 40 * D], shoulderR: [-70 * D, 0, -40 * D] })],
      [0.7, pose({ spine: [18 * D, 0, 0], hipL: [20 * D, 0, 0], kneeL: [40 * D, 0, 0], hipR: [12 * D, 0, 0], kneeR: [44 * D, 0, 0] })],
      [1, pose({})],
    ],
    lift: (t) => Math.sin(Math.min(1, t / 0.75) * Math.PI) * 0.06,
  },
  build: {
    frames: 6, duration: 1.2, loop: true,
    track: [
      [0, pose({ spine: [10 * D, 12 * D, 0], shoulderR: [-70 * D, 0, -30 * D], elbowR: [70 * D, 0, 0], shoulderL: [-40 * D, 0, 28 * D], elbowL: [60 * D, 0, 0], hipL: [16 * D, 0, 0], hipR: [12 * D, 0, 0] })],
      [0.45, pose({ spine: [26 * D, 14 * D, 0], chest: [10 * D, 0, 0], shoulderR: [-10 * D, 0, -22 * D], elbowR: [26 * D, 0, 0], shoulderL: [-20 * D, 0, 24 * D], elbowL: [44 * D, 0, 0], hipL: [20 * D, 0, 0], kneeL: [26 * D, 0, 0] })],
      [1, pose({ spine: [10 * D, 12 * D, 0], shoulderR: [-70 * D, 0, -30 * D], elbowR: [70 * D, 0, 0], shoulderL: [-40 * D, 0, 28 * D], elbowL: [60 * D, 0, 0], hipL: [16 * D, 0, 0], hipR: [12 * D, 0, 0] })],
    ],
  },
  sit: {
    frames: 4, duration: 3, loop: true,
    track: [
      [0, pose({ pelvis: [0, 0, 0], spine: [8 * D, 0, 0], hipL: [-84 * D, 0, 6 * D], kneeL: [92 * D, 0, 0], hipR: [-84 * D, 0, -6 * D], kneeR: [92 * D, 0, 0], shoulderL: [-14 * D, 0, 18 * D], shoulderR: [-14 * D, 0, -18 * D], elbowL: [44 * D, 0, 0], elbowR: [44 * D, 0, 0] })],
      [0.5, pose({ pelvis: [0, 0, 0], spine: [11 * D, 0, 0], head: [-3 * D, 0, 0], hipL: [-84 * D, 0, 6 * D], kneeL: [92 * D, 0, 0], hipR: [-84 * D, 0, -6 * D], kneeR: [92 * D, 0, 0], shoulderL: [-12 * D, 0, 19 * D], shoulderR: [-12 * D, 0, -19 * D], elbowL: [42 * D, 0, 0], elbowR: [42 * D, 0, 0] })],
      [1, pose({ pelvis: [0, 0, 0], spine: [8 * D, 0, 0], hipL: [-84 * D, 0, 6 * D], kneeL: [92 * D, 0, 0], hipR: [-84 * D, 0, -6 * D], kneeR: [92 * D, 0, 0], shoulderL: [-14 * D, 0, 18 * D], shoulderR: [-14 * D, 0, -18 * D], elbowL: [44 * D, 0, 0], elbowR: [44 * D, 0, 0] })],
    ],
    lift: () => -0.22,
  },
};

// ------------------------------------------------------------ quadruped

const Q_REST: Pose = {
  pelvis: [0, 0, 0], spine: [0, 0, 0], chest: [0, 0, 0], neck: [10 * D, 0, 0], head: [-10 * D, 0, 0], jaw: [0, 0, 0],
  tail1: [-30 * D, 0, 0], tail2: [-20 * D, 0, 0],
  shoulderL: [0, 0, 0], kneeL: [-8 * D, 0, 0], pawL: [8 * D, 0, 0],
  shoulderR: [0, 0, 0], kneeR: [-8 * D, 0, 0], pawR: [8 * D, 0, 0],
  hipL: [0, 0, 0], hockL: [12 * D, 0, 0], footL: [-10 * D, 0, 0],
  hipR: [0, 0, 0], hockR: [12 * D, 0, 0], footR: [-10 * D, 0, 0],
};
function qp(p: Partial<Pose>): Pose { return { ...Q_REST, ...p } as Pose; }

export const QUADRUPED_ANIMS: Record<AnimName, AnimDef> = {
  idle: {
    frames: 4, duration: 2.4, loop: true,
    track: [
      [0, qp({ neck: [8 * D, 0, 0], tail1: [-26 * D, 6 * D, 0] })],
      [0.5, qp({ neck: [13 * D, 0, 0], head: [-13 * D, 0, 0], tail1: [-34 * D, -6 * D, 0], chest: [1 * D, 0, 0] })],
      [1, qp({ neck: [8 * D, 0, 0], tail1: [-26 * D, 6 * D, 0] })],
    ],
    lift: (t) => Math.sin(t * Math.PI * 2) * 0.005,
  },
  walk: {
    frames: 8, duration: 0.7, loop: true,
    track: [
      [0, qp({ shoulderL: [30 * D, 0, 0], kneeL: [-24 * D, 0, 0], shoulderR: [-26 * D, 0, 0], kneeR: [6 * D, 0, 0], hipL: [-24 * D, 0, 0], hockL: [30 * D, 0, 0], hipR: [28 * D, 0, 0], hockR: [4 * D, 0, 0] })],
      [0.5, qp({ shoulderL: [-26 * D, 0, 0], kneeL: [6 * D, 0, 0], shoulderR: [30 * D, 0, 0], kneeR: [-24 * D, 0, 0], hipL: [28 * D, 0, 0], hockL: [4 * D, 0, 0], hipR: [-24 * D, 0, 0], hockR: [30 * D, 0, 0] })],
      [1, qp({ shoulderL: [30 * D, 0, 0], kneeL: [-24 * D, 0, 0], shoulderR: [-26 * D, 0, 0], kneeR: [6 * D, 0, 0], hipL: [-24 * D, 0, 0], hockL: [30 * D, 0, 0], hipR: [28 * D, 0, 0], hockR: [4 * D, 0, 0] })],
    ],
    lift: (t) => Math.abs(Math.sin(t * Math.PI * 2)) * 0.012,
  },
  run: {
    frames: 8, duration: 0.44, loop: true,
    track: [
      [0, qp({ spine: [-10 * D, 0, 0], shoulderL: [58 * D, 0, 0], kneeL: [-46 * D, 0, 0], shoulderR: [52 * D, 0, 0], kneeR: [-40 * D, 0, 0], hipL: [-48 * D, 0, 0], hockL: [62 * D, 0, 0], hipR: [-44 * D, 0, 0], hockR: [58 * D, 0, 0], neck: [2 * D, 0, 0] })],
      [0.5, qp({ spine: [12 * D, 0, 0], shoulderL: [-50 * D, 0, 0], kneeL: [18 * D, 0, 0], shoulderR: [-46 * D, 0, 0], kneeR: [14 * D, 0, 0], hipL: [56 * D, 0, 0], hockL: [-18 * D, 0, 0], hipR: [52 * D, 0, 0], hockR: [-14 * D, 0, 0], neck: [16 * D, 0, 0] })],
      [1, qp({ spine: [-10 * D, 0, 0], shoulderL: [58 * D, 0, 0], kneeL: [-46 * D, 0, 0], shoulderR: [52 * D, 0, 0], kneeR: [-40 * D, 0, 0], hipL: [-48 * D, 0, 0], hockL: [62 * D, 0, 0], hipR: [-44 * D, 0, 0], hockR: [58 * D, 0, 0], neck: [2 * D, 0, 0] })],
    ],
    lift: (t) => Math.sin(t * Math.PI * 2) * 0.04 + 0.03,
  },
  attack: {
    frames: 6, duration: 0.56, loop: false,
    track: [
      [0, qp({ neck: [22 * D, 0, 0], head: [-16 * D, 0, 0], jaw: [0, 0, 0] })],
      [0.3, qp({ spine: [-12 * D, 0, 0], neck: [-18 * D, 0, 0], head: [14 * D, 0, 0], jaw: [34 * D, 0, 0], shoulderL: [-34 * D, 0, 0], shoulderR: [-30 * D, 0, 0] })],
      [0.5, qp({ spine: [14 * D, 0, 0], neck: [30 * D, 0, 0], head: [-24 * D, 0, 0], jaw: [4 * D, 0, 0], shoulderL: [44 * D, 0, 0], shoulderR: [40 * D, 0, 0], hipL: [-20 * D, 0, 0], hipR: [-18 * D, 0, 0] })],
      [1, qp({})],
    ],
    lift: (t) => (t > 0.25 && t < 0.62 ? 0.05 : 0),
  },
  attack2: {
    frames: 5, duration: 0.5, loop: false,
    track: [
      [0, qp({ neck: [16 * D, 12 * D, 0] })],
      [0.35, qp({ spine: [0, -18 * D, 0], neck: [-6 * D, -26 * D, 0], jaw: [30 * D, 0, 0] })],
      [0.55, qp({ spine: [0, 22 * D, 0], neck: [10 * D, 30 * D, 0], jaw: [6 * D, 0, 0] })],
      [1, qp({})],
    ],
  },
  heavy: { frames: 6, duration: 0.8, loop: false, track: [[0, qp({})], [0.4, qp({ spine: [-20 * D, 0, 0], neck: [-24 * D, 0, 0], jaw: [40 * D, 0, 0] })], [0.62, qp({ spine: [18 * D, 0, 0], neck: [26 * D, 0, 0], jaw: [8 * D, 0, 0] })], [1, qp({})]] },
  cast: { frames: 4, duration: 0.9, loop: false, track: [[0, qp({})], [0.5, qp({ neck: [-30 * D, 0, 0], head: [22 * D, 0, 0], jaw: [38 * D, 0, 0] })], [1, qp({})]] },
  shoot: { frames: 4, duration: 0.6, loop: false, track: [[0, qp({})], [0.5, qp({ neck: [-24 * D, 0, 0], jaw: [34 * D, 0, 0] })], [1, qp({})]] },
  block: { frames: 2, duration: 0.6, loop: true, track: [[0, qp({ spine: [8 * D, 0, 0], neck: [20 * D, 0, 0], hipL: [16 * D, 0, 0], hipR: [16 * D, 0, 0] })], [1, qp({ spine: [8 * D, 0, 0], neck: [22 * D, 0, 0], hipL: [16 * D, 0, 0], hipR: [16 * D, 0, 0] })]] },
  hit: {
    frames: 3, duration: 0.28, loop: false,
    track: [[0, qp({ spine: [10 * D, 0, 0], neck: [22 * D, 0, 0], head: [-10 * D, 0, 0] })], [0.5, qp({ spine: [16 * D, 0, 8 * D], neck: [28 * D, 0, 0], jaw: [22 * D, 0, 0], hockL: [24 * D, 0, 0], hockR: [24 * D, 0, 0] })], [1, qp({})]],
  },
  death: {
    frames: 6, duration: 0.9, loop: false,
    track: [
      [0, qp({ spine: [10 * D, 0, 0], neck: [20 * D, 0, 0] })],
      [0.45, qp({ pelvis: [0, 0, 34 * D], spine: [16 * D, 0, 16 * D], neck: [30 * D, 0, 0], jaw: [20 * D, 0, 0], hipL: [-40 * D, 0, 0], hipR: [-30 * D, 0, 0], shoulderL: [40 * D, 0, 0], shoulderR: [34 * D, 0, 0] })],
      [1, qp({ pelvis: [0, 0, 52 * D], spine: [22 * D, 0, 24 * D], neck: [36 * D, 0, 0], jaw: [10 * D, 0, 0], hipL: [-56 * D, 0, 0], hipR: [-46 * D, 0, 0], shoulderL: [56 * D, 0, 0], shoulderR: [48 * D, 0, 0], tail1: [-4 * D, 0, 0] })],
    ],
    lift: (t) => -0.24 * Math.min(1, t / 0.7),
  },
  roar: {
    frames: 5, duration: 1, loop: false,
    track: [[0, qp({})], [0.35, qp({ neck: [-40 * D, 0, 0], head: [30 * D, 0, 0], jaw: [42 * D, 0, 0], spine: [-8 * D, 0, 0] })], [0.75, qp({ neck: [-44 * D, 0, 0], head: [34 * D, 0, 0], jaw: [46 * D, 0, 0] })], [1, qp({})]],
  },
  leap: {
    frames: 6, duration: 0.8, loop: false,
    track: [
      [0, qp({ spine: [14 * D, 0, 0], hipL: [40 * D, 0, 0], hockL: [-30 * D, 0, 0], hipR: [40 * D, 0, 0], hockR: [-30 * D, 0, 0], shoulderL: [20 * D, 0, 0], shoulderR: [20 * D, 0, 0] })],
      [0.35, qp({ spine: [-16 * D, 0, 0], hipL: [-46 * D, 0, 0], hockL: [30 * D, 0, 0], hipR: [-46 * D, 0, 0], hockR: [30 * D, 0, 0], shoulderL: [-56 * D, 0, 0], shoulderR: [-56 * D, 0, 0], neck: [-6 * D, 0, 0], jaw: [30 * D, 0, 0] })],
      [0.72, qp({ spine: [8 * D, 0, 0], hipL: [16 * D, 0, 0], hipR: [16 * D, 0, 0], shoulderL: [30 * D, 0, 0], shoulderR: [30 * D, 0, 0] })],
      [1, qp({})],
    ],
    lift: (t) => Math.sin(Math.max(0, Math.min(1, (t - 0.15) / 0.62)) * Math.PI) * 0.3,
  },
  slam: { frames: 5, duration: 0.7, loop: false, track: [[0, qp({})], [0.4, qp({ spine: [-18 * D, 0, 0], shoulderL: [-60 * D, 0, 0], shoulderR: [-60 * D, 0, 0] })], [0.6, qp({ spine: [20 * D, 0, 0], shoulderL: [50 * D, 0, 0], shoulderR: [50 * D, 0, 0] })], [1, qp({})]], lift: (t) => (t < 0.45 ? 0.06 * t : 0) },
  dodge: { frames: 4, duration: 0.4, loop: false, track: [[0, qp({})], [0.4, qp({ spine: [0, 22 * D, 0], pelvis: [0, 0, 16 * D] })], [1, qp({})]], lift: (t) => Math.sin(t * Math.PI) * 0.08 },
  build: { frames: 2, duration: 1, loop: true, track: [[0, qp({})], [1, qp({})]] },
  sit: { frames: 2, duration: 3, loop: true, track: [[0, qp({ hipL: [-60 * D, 0, 0], hockL: [70 * D, 0, 0], hipR: [-60 * D, 0, 0], hockR: [70 * D, 0, 0], spine: [-14 * D, 0, 0] })], [1, qp({ hipL: [-60 * D, 0, 0], hockL: [70 * D, 0, 0], hipR: [-60 * D, 0, 0], hockR: [70 * D, 0, 0], spine: [-12 * D, 0, 0] })]], lift: () => -0.1 },
};

// ------------------------------------------------------------- arachnid

function legPose(phase: number, amp = 1): Pose {
  const p: Pose = { pelvis: [0, 0, 0], spine: [0, 0, 0], chest: [0, 0, 0], head: [0, 0, 0], fangL: [0, 0, 0], fangR: [0, 0, 0] };
  for (let i = 0; i < 4; i++) {
    for (const s of ['L', 'R'] as const) {
      const sign = s === 'L' ? -1 : 1;
      const ph = phase + i * 0.25 + (s === 'L' ? 0.5 : 0);
      const sw = Math.sin(ph * Math.PI * 2) * amp;
      const lift = Math.max(0, Math.cos(ph * Math.PI * 2)) * amp;
      p[`coxa${i}${s}`] = [0, sign * sw * 18 * D, 0];
      p[`femur${i}${s}`] = [0, 0, sign * (20 * D + lift * 24 * D)];
      p[`tibia${i}${s}`] = [0, 0, sign * (-38 * D - lift * 14 * D)];
      p[`tip${i}${s}`] = [0, 0, sign * -14 * D];
    }
  }
  return p;
}

export const ARACHNID_ANIMS: Record<AnimName, AnimDef> = {
  idle: { frames: 4, duration: 2.6, loop: true, track: [[0, legPose(0, 0.12)], [0.5, legPose(0.5, 0.12)], [1, legPose(1, 0.12)]], lift: (t) => Math.sin(t * Math.PI * 2) * 0.006 },
  walk: { frames: 8, duration: 0.64, loop: true, track: [[0, legPose(0)], [0.25, legPose(0.25)], [0.5, legPose(0.5)], [0.75, legPose(0.75)], [1, legPose(1)]], lift: (t) => Math.abs(Math.sin(t * Math.PI * 4)) * 0.008 },
  run: { frames: 8, duration: 0.4, loop: true, track: [[0, legPose(0, 1.35)], [0.25, legPose(0.25, 1.35)], [0.5, legPose(0.5, 1.35)], [0.75, legPose(0.75, 1.35)], [1, legPose(1, 1.35)]], lift: (t) => Math.abs(Math.sin(t * Math.PI * 4)) * 0.016 },
  attack: {
    frames: 6, duration: 0.5, loop: false,
    track: [
      [0, addPose(legPose(0, 0.3), { chest: [-8 * D, 0, 0] })],
      [0.35, addPose(legPose(0.3, 0.9), { chest: [-26 * D, 0, 0], head: [-16 * D, 0, 0], fangL: [0, 0, 34 * D], fangR: [0, 0, -34 * D] })],
      [0.55, addPose(legPose(0.5, 0.5), { chest: [22 * D, 0, 0], head: [14 * D, 0, 0], fangL: [0, 0, -12 * D], fangR: [0, 0, 12 * D] })],
      [1, legPose(0.8, 0.3)],
    ],
    lift: (t) => (t < 0.4 ? 0.05 * (t / 0.4) : t < 0.6 ? -0.02 : 0),
  },
  attack2: { frames: 5, duration: 0.6, loop: false, track: [[0, legPose(0, 0.3)], [0.4, addPose(legPose(0.2, 0.6), { pelvis: [-22 * D, 0, 0], chest: [10 * D, 0, 0] })], [0.62, addPose(legPose(0.4, 0.4), { pelvis: [12 * D, 0, 0] })], [1, legPose(0.8, 0.3)]] },
  heavy: { frames: 6, duration: 0.8, loop: false, track: [[0, legPose(0, 0.3)], [0.45, addPose(legPose(0.2, 1.1), { chest: [-30 * D, 0, 0] })], [0.62, addPose(legPose(0.5, 0.6), { chest: [26 * D, 0, 0] })], [1, legPose(0.9, 0.3)]], lift: (t) => (t < 0.5 ? 0.08 * t : 0) },
  cast: { frames: 5, duration: 0.85, loop: false, track: [[0, legPose(0, 0.2)], [0.5, addPose(legPose(0.25, 0.7), { pelvis: [-26 * D, 0, 0], chest: [16 * D, 0, 0] })], [1, legPose(0.9, 0.2)]] },
  shoot: { frames: 5, duration: 0.7, loop: false, track: [[0, legPose(0, 0.2)], [0.45, addPose(legPose(0.2, 0.6), { pelvis: [-32 * D, 0, 0] })], [0.62, addPose(legPose(0.4, 0.4), { pelvis: [-6 * D, 0, 0] })], [1, legPose(0.9, 0.2)]] },
  block: { frames: 2, duration: 0.6, loop: true, track: [[0, legPose(0, 0.2)], [1, legPose(0.1, 0.2)]] },
  hit: { frames: 3, duration: 0.26, loop: false, track: [[0, legPose(0, 0.9)], [0.45, addPose(legPose(0.2, 1.3), { chest: [16 * D, 0, 0], pelvis: [0, 0, 10 * D] })], [1, legPose(0.6, 0.4)]] },
  death: {
    frames: 6, duration: 0.9, loop: false,
    track: [
      [0, legPose(0, 0.8)],
      [0.5, addPose(legPose(0.3, -1.3), { chest: [18 * D, 0, 0], pelvis: [0, 0, 22 * D] })],
      [1, addPose(legPose(0.5, -2.1), { chest: [24 * D, 0, 0], pelvis: [0, 0, 30 * D] })],
    ],
    lift: (t) => -0.16 * Math.min(1, t / 0.75),
  },
  roar: { frames: 5, duration: 1, loop: false, track: [[0, legPose(0, 0.3)], [0.4, addPose(legPose(0.2, 1.2), { chest: [-24 * D, 0, 0], fangL: [0, 0, 40 * D], fangR: [0, 0, -40 * D] })], [1, legPose(0.9, 0.3)]], lift: (t) => Math.sin(Math.min(1, t / 0.8) * Math.PI) * 0.05 },
  leap: { frames: 6, duration: 0.8, loop: false, track: [[0, legPose(0, 0.9)], [0.35, legPose(0.3, -0.8)], [0.72, legPose(0.6, 0.6)], [1, legPose(0.9, 0.3)]], lift: (t) => Math.sin(Math.max(0, Math.min(1, (t - 0.15) / 0.6)) * Math.PI) * 0.26 },
  slam: { frames: 5, duration: 0.7, loop: false, track: [[0, legPose(0, 0.4)], [0.4, legPose(0.2, 1.4)], [0.6, legPose(0.4, -0.4)], [1, legPose(0.8, 0.3)]], lift: (t) => (t < 0.45 ? 0.07 * t : 0) },
  dodge: { frames: 4, duration: 0.38, loop: false, track: [[0, legPose(0, 0.5)], [0.4, addPose(legPose(0.4, 1.2), { pelvis: [0, 18 * D, 0] })], [1, legPose(0.9, 0.3)]], lift: (t) => Math.sin(t * Math.PI) * 0.06 },
  build: { frames: 2, duration: 1, loop: true, track: [[0, legPose(0, 0.2)], [1, legPose(0.2, 0.2)]] },
  sit: { frames: 2, duration: 3, loop: true, track: [[0, legPose(0, 0.1)], [1, legPose(0.1, 0.1)]], lift: () => -0.08 },
};

// --------------------------------------------------------------- wraith

const W_REST: Pose = {
  pelvis: [0, 0, 0], spine: [0, 0, 0], chest: [0, 0, 0], neck: [0, 0, 0], head: [0, 0, 0],
  shoulderL: [10 * D, 0, 16 * D], elbowL: [24 * D, 0, 0], handL: [0, 0, 0],
  shoulderR: [10 * D, 0, -16 * D], elbowR: [24 * D, 0, 0], handR: [0, 0, 0],
  hem1: [0, 0, 0], hem2: [0, 0, 0], hem3: [0, 0, 0],
};
function wp(p: Partial<Pose>): Pose { return { ...W_REST, ...p } as Pose; }

export const WRAITH_ANIMS: Record<AnimName, AnimDef> = {
  idle: { frames: 6, duration: 2.8, loop: true, track: [[0, wp({ hem1: [0, 0, 6 * D], hem3: [0, 0, -6 * D] })], [0.5, wp({ chest: [-3 * D, 0, 0], hem1: [0, 0, -8 * D], hem3: [0, 0, 8 * D], shoulderL: [6 * D, 0, 19 * D], shoulderR: [6 * D, 0, -19 * D] })], [1, wp({ hem1: [0, 0, 6 * D], hem3: [0, 0, -6 * D] })]], lift: (t) => 0.04 + Math.sin(t * Math.PI * 2) * 0.022 },
  walk: { frames: 8, duration: 1.05, loop: true, track: [[0, wp({ hem1: [0, 0, 10 * D], hem2: [6 * D, 0, 0], hem3: [0, 0, -4 * D], shoulderL: [-12 * D, 0, 18 * D] })], [0.5, wp({ hem1: [0, 0, -4 * D], hem2: [-6 * D, 0, 0], hem3: [0, 0, 10 * D], shoulderR: [-12 * D, 0, -18 * D] })], [1, wp({ hem1: [0, 0, 10 * D], hem2: [6 * D, 0, 0], hem3: [0, 0, -4 * D], shoulderL: [-12 * D, 0, 18 * D] })]], lift: (t) => 0.05 + Math.sin(t * Math.PI * 2) * 0.03 },
  run: { frames: 8, duration: 0.6, loop: true, track: [[0, wp({ spine: [10 * D, 0, 0], hem1: [0, 0, 20 * D], hem2: [16 * D, 0, 0], hem3: [0, 0, -14 * D] })], [0.5, wp({ spine: [12 * D, 0, 0], hem1: [0, 0, -14 * D], hem2: [20 * D, 0, 0], hem3: [0, 0, 20 * D] })], [1, wp({ spine: [10 * D, 0, 0], hem1: [0, 0, 20 * D], hem2: [16 * D, 0, 0], hem3: [0, 0, -14 * D] })]], lift: (t) => 0.09 + Math.sin(t * Math.PI * 2) * 0.03 },
  attack: {
    frames: 6, duration: 0.55, loop: false,
    track: [
      [0, wp({ spine: [0, 24 * D, 0], shoulderR: [-40 * D, 0, -50 * D], elbowR: [70 * D, 0, 0] })],
      [0.32, wp({ spine: [0, 36 * D, 0], chest: [-8 * D, 20 * D, 0], shoulderR: [-88 * D, 0, -68 * D], elbowR: [88 * D, 0, 0] })],
      [0.5, wp({ spine: [4 * D, -30 * D, 0], chest: [10 * D, -18 * D, 0], shoulderR: [56 * D, 0, -14 * D], elbowR: [10 * D, 0, 0] })],
      [1, wp({})],
    ],
    lift: () => 0.05,
  },
  attack2: { frames: 5, duration: 0.6, loop: false, track: [[0, wp({ spine: [0, -22 * D, 0], shoulderL: [-50 * D, 0, 50 * D] })], [0.4, wp({ spine: [0, -36 * D, 0], shoulderL: [-96 * D, 0, 68 * D] })], [0.58, wp({ spine: [0, 28 * D, 0], shoulderL: [48 * D, 0, 18 * D] })], [1, wp({})]], lift: () => 0.05 },
  heavy: { frames: 7, duration: 0.9, loop: false, track: [[0, wp({})], [0.45, wp({ spine: [-16 * D, 0, 0], shoulderL: [-150 * D, 0, 30 * D], shoulderR: [-150 * D, 0, -30 * D] })], [0.64, wp({ spine: [24 * D, 0, 0], shoulderL: [40 * D, 0, 16 * D], shoulderR: [40 * D, 0, -16 * D] })], [1, wp({})]], lift: (t) => 0.05 + (t < 0.5 ? 0.09 * t : 0) },
  cast: { frames: 6, duration: 0.95, loop: false, track: [[0, wp({})], [0.45, wp({ spine: [-12 * D, 0, 0], head: [-14 * D, 0, 0], shoulderL: [-150 * D, 0, 38 * D], elbowL: [16 * D, 0, 0], shoulderR: [-150 * D, 0, -38 * D], elbowR: [16 * D, 0, 0] })], [0.75, wp({ shoulderL: [-70 * D, 0, 62 * D], shoulderR: [-70 * D, 0, -62 * D] })], [1, wp({})]], lift: (t) => 0.05 + Math.sin(Math.min(1, t / 0.75) * Math.PI) * 0.1 },
  shoot: { frames: 5, duration: 0.7, loop: false, track: [[0, wp({ spine: [0, -20 * D, 0] })], [0.42, wp({ shoulderR: [-120 * D, 0, -40 * D], elbowR: [20 * D, 0, 0] })], [0.6, wp({ shoulderR: [-80 * D, 0, -20 * D], elbowR: [8 * D, 0, 0] })], [1, wp({})]], lift: () => 0.05 },
  block: { frames: 2, duration: 0.6, loop: true, track: [[0, wp({ shoulderL: [-80 * D, 0, 46 * D], elbowL: [70 * D, 0, 0], shoulderR: [-80 * D, 0, -46 * D], elbowR: [70 * D, 0, 0] })], [1, wp({ shoulderL: [-84 * D, 0, 44 * D], elbowL: [72 * D, 0, 0], shoulderR: [-84 * D, 0, -44 * D], elbowR: [72 * D, 0, 0] })]], lift: () => 0.05 },
  hit: { frames: 3, duration: 0.28, loop: false, track: [[0, wp({ spine: [-14 * D, 0, 0], head: [-16 * D, 0, 0] })], [0.5, wp({ spine: [-24 * D, 0, 0], head: [-26 * D, 0, 0], hem1: [0, 0, 14 * D], hem3: [0, 0, -14 * D] })], [1, wp({})]], lift: () => 0.04 },
  death: { frames: 6, duration: 1.05, loop: false, track: [[0, wp({ spine: [-14 * D, 0, 0] })], [0.5, wp({ spine: [-34 * D, 0, 0], head: [-30 * D, 0, 0], shoulderL: [-110 * D, 0, 50 * D], shoulderR: [-110 * D, 0, -50 * D], hem1: [0, 0, 26 * D], hem3: [0, 0, -26 * D] })], [1, wp({ spine: [-48 * D, 0, 0], head: [-40 * D, 0, 0], shoulderL: [-140 * D, 0, 70 * D], shoulderR: [-140 * D, 0, -70 * D] })]], lift: (t) => 0.05 - 0.3 * Math.min(1, t / 0.8) },
  roar: { frames: 6, duration: 1.15, loop: false, track: [[0, wp({})], [0.35, wp({ spine: [-20 * D, 0, 0], head: [-26 * D, 0, 0], shoulderL: [-130 * D, 0, 60 * D], shoulderR: [-130 * D, 0, -60 * D] })], [0.72, wp({ spine: [-24 * D, 0, 0], head: [-30 * D, 0, 0], shoulderL: [-142 * D, 0, 70 * D], shoulderR: [-142 * D, 0, -70 * D] })], [1, wp({})]], lift: (t) => 0.05 + Math.sin(Math.min(1, t / 0.8) * Math.PI) * 0.14 },
  leap: { frames: 6, duration: 0.7, loop: false, track: [[0, wp({ spine: [-10 * D, 0, 0] })], [0.4, wp({ spine: [14 * D, 0, 0], shoulderL: [-120 * D, 0, 40 * D], shoulderR: [-120 * D, 0, -40 * D], hem2: [20 * D, 0, 0] })], [1, wp({})]], lift: (t) => 0.05 + Math.sin(Math.min(1, t / 0.85) * Math.PI) * 0.3 },
  slam: { frames: 6, duration: 0.85, loop: false, track: [[0, wp({})], [0.45, wp({ spine: [-18 * D, 0, 0], shoulderL: [-158 * D, 0, 28 * D], shoulderR: [-158 * D, 0, -28 * D] })], [0.62, wp({ spine: [28 * D, 0, 0], shoulderL: [44 * D, 0, 18 * D], shoulderR: [44 * D, 0, -18 * D] })], [1, wp({})]], lift: (t) => 0.05 + (t < 0.5 ? 0.1 * t : t < 0.65 ? -0.03 : 0) },
  dodge: { frames: 4, duration: 0.4, loop: false, track: [[0, wp({})], [0.4, wp({ spine: [0, 30 * D, 0], hem1: [0, 0, 22 * D], hem3: [0, 0, -22 * D] })], [1, wp({})]], lift: (t) => 0.05 + Math.sin(t * Math.PI) * 0.1 },
  build: { frames: 2, duration: 1, loop: true, track: [[0, wp({})], [1, wp({})]], lift: () => 0.05 },
  sit: { frames: 2, duration: 3, loop: true, track: [[0, wp({})], [1, wp({ chest: [-3 * D, 0, 0] })]], lift: () => 0.02 },
};

export const ANIM_SETS = {
  humanoid: HUMANOID_ANIMS,
  quadruped: QUADRUPED_ANIMS,
  arachnid: ARACHNID_ANIMS,
  wraith: WRAITH_ANIMS,
} as const;

export function sampleAnim(def: AnimDef, frameIndex: number): { pose: Pose; lift: number } {
  const t = def.loop ? frameIndex / def.frames : def.frames === 1 ? 0 : frameIndex / (def.frames - 1);
  return { pose: sampleTrack(def.track, t, def.loop), lift: def.lift ? def.lift(t) : 0 };
}
