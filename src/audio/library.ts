import { audio, type Bus } from './engine';

/**
 * The sound library. Each entry is a small synthesis recipe; there are no
 * sample files. Sounds are grouped so combat feedback, ring effects and boss
 * cues each have a recognisable family.
 */

interface PlayOpts {
  /** Stereo position, -1..1, derived from screen offset. */
  pan?: number;
  /** Volume multiplier. */
  volume?: number;
  /** Pitch multiplier, for variation. */
  pitch?: number;
  bus?: Bus;
  reverb?: number;
}

function out(bus: Bus = 'sfx'): GainNode | null {
  return audio.busNode(bus);
}

function connectOut(node: AudioNode, opts: PlayOpts): void {
  const dest = out(opts.bus ?? 'sfx');
  if (!dest) return;
  const pan = opts.pan ? audio.panner(opts.pan) : null;
  if (pan) {
    node.connect(pan);
    pan.connect(dest);
    if (opts.reverb && audio.reverb()) pan.connect(audio.reverb()!);
  } else {
    node.connect(dest);
    if (opts.reverb && audio.reverb()) node.connect(audio.reverb()!);
  }
}

/** A percussive noise burst: footsteps, impacts, bursts. */
function noiseHit(o: {
  duration: number; filterType: BiquadFilterType; freq: number; q?: number;
  attack?: number; curve?: number; gain?: number; sweepTo?: number;
}, opts: PlayOpts = {}): void {
  const ctx = audio.context;
  if (!ctx) return;
  const src = audio.noiseSource();
  const flt = audio.filter(o.filterType, o.freq * (opts.pitch ?? 1), o.q ?? 1);
  const g = audio.gain(0);
  if (!src || !flt || !g) return;
  const t = ctx.currentTime;
  const dur = o.duration;
  const peak = (o.gain ?? 0.5) * (opts.volume ?? 1);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + (o.attack ?? 0.004));
  g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  if (o.sweepTo) flt.frequency.exponentialRampToValueAtTime(Math.max(40, o.sweepTo * (opts.pitch ?? 1)), t + dur);
  src.connect(flt); flt.connect(g);
  connectOut(g, opts);
  src.start(t);
  src.stop(t + dur + 0.05);
}

/** A pitched tone with an envelope: rings, cues, UI. */
function tone(o: {
  type: OscillatorType; freq: number; to?: number; duration: number;
  attack?: number; gain?: number; detune?: number; filter?: number;
}, opts: PlayOpts = {}): void {
  const ctx = audio.context;
  if (!ctx) return;
  const osc = audio.osc(o.type, o.freq * (opts.pitch ?? 1));
  const g = audio.gain(0);
  if (!osc || !g) return;
  const t = ctx.currentTime;
  const peak = (o.gain ?? 0.25) * (opts.volume ?? 1);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + (o.attack ?? 0.006));
  g.gain.exponentialRampToValueAtTime(0.0008, t + o.duration);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to * (opts.pitch ?? 1)), t + o.duration);
  if (o.detune) osc.detune.value = o.detune;
  let node: AudioNode = osc;
  if (o.filter) {
    const f = audio.filter('lowpass', o.filter, 0.8);
    if (f) { osc.connect(f); node = f; }
  }
  node.connect(g);
  connectOut(g, opts);
  osc.start(t);
  osc.stop(t + o.duration + 0.05);
}

/** Two detuned tones, for weight and a metallic edge. */
function chord(freqs: number[], o: { type: OscillatorType; duration: number; gain?: number; attack?: number; to?: number }, opts: PlayOpts = {}): void {
  freqs.forEach((f, i) => tone({
    type: o.type, freq: f, duration: o.duration, attack: o.attack,
    gain: (o.gain ?? 0.2) / Math.sqrt(freqs.length), detune: i * 4 - 4,
    to: o.to ? o.to * (f / freqs[0]!) : undefined,
  }, opts));
}

export type SoundId =
  | 'step_grass' | 'step_stone' | 'step_snow' | 'step_wood' | 'step_water'
  | 'swing_light' | 'swing_heavy' | 'swing_whoosh'
  | 'hit_flesh' | 'hit_armour' | 'hit_shield' | 'hit_wood' | 'hit_stone' | 'hit_crit'
  | 'bow_draw' | 'bow_release' | 'crossbow' | 'arrow_hit'
  | 'dodge' | 'parry' | 'guard' | 'stagger'
  | 'player_hurt' | 'enemy_hurt' | 'enemy_die' | 'player_die'
  | 'heal' | 'pickup_coin' | 'pickup_mat' | 'pickup_shard' | 'ring_found'
  | 'level_up' | 'stage_clear' | 'checkpoint'
  | 'ring_ember' | 'ring_stoneward' | 'ring_windstep' | 'ring_thornwake'
  | 'ring_dawnward' | 'ring_venomcoil' | 'ring_frostwake' | 'ring_iron_oath'
  | 'ring_echo' | 'ring_stormcall' | 'ring_duskveil' | 'ring_last_hearth'
  | 'synergy' | 'ring_ready' | 'ring_fail'
  | 'boss_intro' | 'boss_phase' | 'boss_defeat' | 'boss_roar' | 'boss_bell'
  | 'boss_drum' | 'boss_horn' | 'boss_telegraph' | 'boss_slam' | 'boss_charge'
  | 'ui_click' | 'ui_hover' | 'ui_confirm' | 'ui_deny' | 'ui_open' | 'ui_close'
  | 'build_place' | 'build_deny' | 'forge' | 'craft' | 'door' | 'fire' | 'bell_light';

const RECIPES: Record<SoundId, (opts: PlayOpts) => void> = {
  step_grass: (o) => noiseHit({ duration: 0.09, filterType: 'bandpass', freq: 1400, q: 0.9, gain: 0.16, sweepTo: 700 }, o),
  step_stone: (o) => noiseHit({ duration: 0.07, filterType: 'bandpass', freq: 2600, q: 1.6, gain: 0.2, sweepTo: 1100 }, o),
  step_snow: (o) => noiseHit({ duration: 0.12, filterType: 'lowpass', freq: 900, q: 0.6, gain: 0.14, sweepTo: 420 }, o),
  step_wood: (o) => noiseHit({ duration: 0.08, filterType: 'bandpass', freq: 800, q: 2.4, gain: 0.2, sweepTo: 420 }, o),
  step_water: (o) => noiseHit({ duration: 0.16, filterType: 'bandpass', freq: 1900, q: 0.7, gain: 0.18, sweepTo: 3200 }, o),

  swing_light: (o) => noiseHit({ duration: 0.18, filterType: 'bandpass', freq: 1700, q: 1.1, gain: 0.26, sweepTo: 520 }, o),
  swing_heavy: (o) => { noiseHit({ duration: 0.3, filterType: 'bandpass', freq: 900, q: 0.9, gain: 0.3, sweepTo: 260 }, o); tone({ type: 'sine', freq: 140, to: 70, duration: 0.22, gain: 0.12 }, o); },
  swing_whoosh: (o) => noiseHit({ duration: 0.24, filterType: 'bandpass', freq: 1200, q: 0.7, gain: 0.18, sweepTo: 380 }, o),

  hit_flesh: (o) => { noiseHit({ duration: 0.11, filterType: 'lowpass', freq: 820, gain: 0.34, sweepTo: 220 }, o); tone({ type: 'sine', freq: 180, to: 80, duration: 0.1, gain: 0.16 }, o); },
  hit_armour: (o) => { noiseHit({ duration: 0.13, filterType: 'bandpass', freq: 3200, q: 3.2, gain: 0.3 }, o); chord([620, 930], { type: 'triangle', duration: 0.16, gain: 0.12, to: 0.7 }, o); },
  hit_shield: (o) => { noiseHit({ duration: 0.16, filterType: 'bandpass', freq: 520, q: 2.2, gain: 0.3 }, o); tone({ type: 'triangle', freq: 240, to: 150, duration: 0.2, gain: 0.14 }, o); },
  hit_wood: (o) => noiseHit({ duration: 0.11, filterType: 'bandpass', freq: 680, q: 3.4, gain: 0.28, sweepTo: 320 }, o),
  hit_stone: (o) => noiseHit({ duration: 0.14, filterType: 'bandpass', freq: 1800, q: 2.4, gain: 0.28, sweepTo: 600 }, o),
  hit_crit: (o) => { noiseHit({ duration: 0.16, filterType: 'bandpass', freq: 2600, q: 1.8, gain: 0.34 }, o); chord([740, 1110, 1480], { type: 'triangle', duration: 0.24, gain: 0.14 }, o); },

  bow_draw: (o) => noiseHit({ duration: 0.34, filterType: 'bandpass', freq: 420, q: 1.6, gain: 0.12, sweepTo: 900 }, o),
  bow_release: (o) => { noiseHit({ duration: 0.13, filterType: 'bandpass', freq: 2200, q: 1.4, gain: 0.26, sweepTo: 700 }, o); tone({ type: 'triangle', freq: 420, to: 180, duration: 0.1, gain: 0.1 }, o); },
  crossbow: (o) => { noiseHit({ duration: 0.1, filterType: 'bandpass', freq: 1500, q: 3, gain: 0.3, sweepTo: 500 }, o); tone({ type: 'square', freq: 200, to: 110, duration: 0.09, gain: 0.08, filter: 1200 }, o); },
  arrow_hit: (o) => noiseHit({ duration: 0.09, filterType: 'bandpass', freq: 2400, q: 2.6, gain: 0.24, sweepTo: 800 }, o),

  dodge: (o) => noiseHit({ duration: 0.26, filterType: 'bandpass', freq: 700, q: 0.8, gain: 0.18, sweepTo: 240 }, o),
  parry: (o) => { noiseHit({ duration: 0.1, filterType: 'bandpass', freq: 4200, q: 4, gain: 0.3 }, o); chord([980, 1470], { type: 'triangle', duration: 0.34, gain: 0.16 }, { ...o, reverb: 0.4 }); },
  guard: (o) => noiseHit({ duration: 0.14, filterType: 'bandpass', freq: 460, q: 2.6, gain: 0.22 }, o),
  stagger: (o) => { tone({ type: 'sine', freq: 110, to: 55, duration: 0.3, gain: 0.2 }, o); noiseHit({ duration: 0.22, filterType: 'lowpass', freq: 600, gain: 0.2, sweepTo: 180 }, o); },

  player_hurt: (o) => { tone({ type: 'sawtooth', freq: 220, to: 110, duration: 0.24, gain: 0.16, filter: 900 }, o); noiseHit({ duration: 0.18, filterType: 'lowpass', freq: 700, gain: 0.22, sweepTo: 200 }, o); },
  enemy_hurt: (o) => { tone({ type: 'sawtooth', freq: 300, to: 160, duration: 0.16, gain: 0.12, filter: 1400 }, o); noiseHit({ duration: 0.12, filterType: 'bandpass', freq: 1100, q: 1.2, gain: 0.18 }, o); },
  enemy_die: (o) => { tone({ type: 'sawtooth', freq: 260, to: 70, duration: 0.5, gain: 0.16, filter: 1100 }, o); noiseHit({ duration: 0.4, filterType: 'lowpass', freq: 800, gain: 0.2, sweepTo: 150 }, o); },
  player_die: (o) => { chord([160, 190], { type: 'sine', duration: 1.6, gain: 0.22, to: 0.4 }, { ...o, reverb: 0.6 }); noiseHit({ duration: 1.1, filterType: 'lowpass', freq: 500, gain: 0.16, sweepTo: 90 }, o); },

  heal: (o) => { chord([523, 659, 784], { type: 'sine', duration: 0.6, gain: 0.16, attack: 0.02 }, { ...o, reverb: 0.4 }); noiseHit({ duration: 0.3, filterType: 'bandpass', freq: 2200, q: 1.2, gain: 0.08, sweepTo: 4200 }, o); },
  pickup_coin: (o) => chord([1046, 1568], { type: 'triangle', duration: 0.18, gain: 0.14 }, o),
  pickup_mat: (o) => noiseHit({ duration: 0.12, filterType: 'bandpass', freq: 900, q: 2, gain: 0.16, sweepTo: 1600 }, o),
  pickup_shard: (o) => chord([1318, 1760, 2093], { type: 'sine', duration: 0.34, gain: 0.12 }, { ...o, reverb: 0.4 }),
  ring_found: (o) => { chord([392, 523, 659, 784], { type: 'sine', duration: 1.8, gain: 0.16, attack: 0.08 }, { ...o, reverb: 0.7 }); tone({ type: 'triangle', freq: 1046, duration: 1.2, gain: 0.08, attack: 0.3 }, { ...o, reverb: 0.7 }); },

  level_up: (o) => { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone({ type: 'triangle', freq: f, duration: 0.5, gain: 0.14, attack: 0.01 }, { ...o, reverb: 0.5 }), i * 90)); },
  stage_clear: (o) => { [392, 494, 587, 784].forEach((f, i) => setTimeout(() => chord([f, f * 1.5], { type: 'sine', duration: 0.9, gain: 0.14, attack: 0.03 }, { ...o, reverb: 0.6 }), i * 160)); },
  checkpoint: (o) => chord([440, 660], { type: 'sine', duration: 0.7, gain: 0.1, attack: 0.05 }, { ...o, reverb: 0.5 }),

  ring_ember: (o) => { noiseHit({ duration: 0.5, filterType: 'bandpass', freq: 900, q: 0.7, gain: 0.28, sweepTo: 2400 }, o); tone({ type: 'sawtooth', freq: 180, to: 420, duration: 0.4, gain: 0.12, filter: 1600 }, o); },
  ring_stoneward: (o) => { tone({ type: 'sine', freq: 90, to: 160, duration: 0.6, gain: 0.2 }, o); noiseHit({ duration: 0.4, filterType: 'lowpass', freq: 500, gain: 0.2, sweepTo: 1200 }, o); },
  ring_windstep: (o) => noiseHit({ duration: 0.42, filterType: 'bandpass', freq: 1400, q: 0.6, gain: 0.24, sweepTo: 4200 }, o),
  ring_thornwake: (o) => { noiseHit({ duration: 0.5, filterType: 'bandpass', freq: 420, q: 1.8, gain: 0.2, sweepTo: 180 }, o); tone({ type: 'triangle', freq: 130, to: 210, duration: 0.5, gain: 0.12 }, o); },
  ring_dawnward: (o) => chord([784, 1046, 1318], { type: 'sine', duration: 1.0, gain: 0.18, attack: 0.02 }, { ...o, reverb: 0.6 }),
  ring_venomcoil: (o) => { tone({ type: 'sawtooth', freq: 320, to: 180, duration: 0.34, gain: 0.14, filter: 1200 }, o); noiseHit({ duration: 0.3, filterType: 'bandpass', freq: 1800, q: 2.2, gain: 0.14, sweepTo: 600 }, o); },
  ring_frostwake: (o) => { noiseHit({ duration: 0.7, filterType: 'highpass', freq: 2200, gain: 0.2, sweepTo: 5200 }, o); chord([880, 1174], { type: 'sine', duration: 0.7, gain: 0.1 }, { ...o, reverb: 0.5 }); },
  ring_iron_oath: (o) => { noiseHit({ duration: 0.16, filterType: 'bandpass', freq: 3600, q: 3.6, gain: 0.26 }, o); chord([330, 494], { type: 'triangle', duration: 0.8, gain: 0.16 }, { ...o, reverb: 0.5 }); },
  ring_echo: (o) => { tone({ type: 'triangle', freq: 660, duration: 0.3, gain: 0.14 }, o); setTimeout(() => tone({ type: 'triangle', freq: 660, duration: 0.4, gain: 0.08 }, { ...o, reverb: 0.6 }), 170); },
  ring_stormcall: (o) => { noiseHit({ duration: 0.34, filterType: 'highpass', freq: 3200, gain: 0.32, sweepTo: 900 }, o); tone({ type: 'square', freq: 90, to: 40, duration: 0.5, gain: 0.14, filter: 700 }, o); },
  ring_duskveil: (o) => { tone({ type: 'sine', freq: 440, to: 140, duration: 0.5, gain: 0.16, filter: 1400 }, { ...o, reverb: 0.5 }); noiseHit({ duration: 0.3, filterType: 'lowpass', freq: 600, gain: 0.14, sweepTo: 180 }, o); },
  ring_last_hearth: (o) => { chord([261, 392, 523], { type: 'sine', duration: 1.5, gain: 0.18, attack: 0.1 }, { ...o, reverb: 0.7 }); tone({ type: 'triangle', freq: 1046, duration: 1.0, gain: 0.06, attack: 0.4 }, { ...o, reverb: 0.7 }); },

  synergy: (o) => { chord([523, 784, 1046, 1568], { type: 'sine', duration: 1.1, gain: 0.16, attack: 0.02 }, { ...o, reverb: 0.7 }); noiseHit({ duration: 0.4, filterType: 'bandpass', freq: 2600, q: 1.1, gain: 0.12, sweepTo: 5200 }, o); },
  ring_ready: (o) => tone({ type: 'sine', freq: 880, duration: 0.24, gain: 0.07, attack: 0.02 }, o),
  ring_fail: (o) => tone({ type: 'square', freq: 160, to: 110, duration: 0.14, gain: 0.08, filter: 800 }, o),

  boss_intro: (o) => { chord([73, 110, 146], { type: 'sawtooth', duration: 2.6, gain: 0.2, attack: 0.5 }, { ...o, reverb: 0.8, bus: 'music' }); setTimeout(() => chord([196, 233], { type: 'sine', duration: 2.0, gain: 0.12, attack: 0.3 }, { ...o, reverb: 0.8, bus: 'music' }), 700); },
  boss_phase: (o) => { chord([98, 147, 196], { type: 'sawtooth', duration: 1.6, gain: 0.2, attack: 0.08 }, { ...o, reverb: 0.7 }); noiseHit({ duration: 0.9, filterType: 'lowpass', freq: 500, gain: 0.2, sweepTo: 120 }, o); },
  boss_defeat: (o) => { [147, 196, 262, 349].forEach((f, i) => setTimeout(() => chord([f, f * 1.5], { type: 'sine', duration: 1.6, gain: 0.16, attack: 0.05 }, { ...o, reverb: 0.8 }), i * 240)); },
  boss_roar: (o) => { tone({ type: 'sawtooth', freq: 120, to: 55, duration: 1.2, gain: 0.26, filter: 800 }, { ...o, reverb: 0.6 }); noiseHit({ duration: 1.0, filterType: 'lowpass', freq: 900, gain: 0.24, sweepTo: 220 }, o); },
  boss_bell: (o) => { chord([196, 294, 466, 622], { type: 'sine', duration: 3.2, gain: 0.2, attack: 0.005 }, { ...o, reverb: 0.9 }); },
  boss_drum: (o) => { tone({ type: 'sine', freq: 82, to: 44, duration: 0.5, gain: 0.3 }, o); noiseHit({ duration: 0.22, filterType: 'lowpass', freq: 420, gain: 0.18, sweepTo: 110 }, o); },
  boss_horn: (o) => chord([146, 220, 293], { type: 'sawtooth', duration: 1.6, gain: 0.2, attack: 0.12 }, { ...o, reverb: 0.7 }),
  boss_telegraph: (o) => tone({ type: 'triangle', freq: 330, to: 440, duration: 0.3, gain: 0.1, attack: 0.05 }, o),
  boss_slam: (o) => { tone({ type: 'sine', freq: 70, to: 32, duration: 0.7, gain: 0.32 }, o); noiseHit({ duration: 0.5, filterType: 'lowpass', freq: 600, gain: 0.28, sweepTo: 110 }, o); },
  boss_charge: (o) => noiseHit({ duration: 0.6, filterType: 'bandpass', freq: 500, q: 0.6, gain: 0.24, sweepTo: 1800 }, o),

  ui_click: (o) => tone({ type: 'triangle', freq: 660, to: 880, duration: 0.07, gain: 0.08 }, o),
  ui_hover: (o) => tone({ type: 'sine', freq: 880, duration: 0.05, gain: 0.04 }, o),
  ui_confirm: (o) => chord([587, 880], { type: 'sine', duration: 0.26, gain: 0.1 }, o),
  ui_deny: (o) => tone({ type: 'square', freq: 220, to: 150, duration: 0.16, gain: 0.08, filter: 900 }, o),
  ui_open: (o) => noiseHit({ duration: 0.2, filterType: 'bandpass', freq: 1200, q: 1.1, gain: 0.1, sweepTo: 2600 }, o),
  ui_close: (o) => noiseHit({ duration: 0.18, filterType: 'bandpass', freq: 2400, q: 1.1, gain: 0.09, sweepTo: 900 }, o),

  build_place: (o) => { noiseHit({ duration: 0.22, filterType: 'bandpass', freq: 700, q: 1.8, gain: 0.22, sweepTo: 300 }, o); chord([330, 494], { type: 'triangle', duration: 0.4, gain: 0.1 }, o); },
  build_deny: (o) => tone({ type: 'square', freq: 180, to: 120, duration: 0.2, gain: 0.1, filter: 700 }, o),
  forge: (o) => { noiseHit({ duration: 0.16, filterType: 'bandpass', freq: 3200, q: 3.4, gain: 0.26 }, o); chord([523, 784], { type: 'triangle', duration: 0.5, gain: 0.12 }, { ...o, reverb: 0.4 }); },
  craft: (o) => chord([440, 660, 880], { type: 'sine', duration: 0.6, gain: 0.12, attack: 0.02 }, { ...o, reverb: 0.4 }),
  door: (o) => noiseHit({ duration: 0.5, filterType: 'lowpass', freq: 400, gain: 0.2, sweepTo: 140 }, o),
  fire: (o) => noiseHit({ duration: 0.8, filterType: 'bandpass', freq: 700, q: 0.6, gain: 0.12, sweepTo: 1800 }, o),
  bell_light: (o) => chord([392, 588, 784], { type: 'sine', duration: 2.4, gain: 0.16, attack: 0.01 }, { ...o, reverb: 0.85 }),
};

const THROTTLE: Partial<Record<SoundId, number>> = {
  step_grass: 90, step_stone: 90, step_snow: 90, step_wood: 90, step_water: 90,
  hit_flesh: 40, hit_armour: 40, enemy_hurt: 50, pickup_coin: 60, pickup_mat: 60,
  arrow_hit: 45, hit_wood: 45, hit_stone: 45,
};

export function play(id: SoundId, opts: PlayOpts = {}): void {
  if (!audio.isStarted) return;
  const gap = THROTTLE[id];
  if (gap && !audio.throttle(id, gap)) return;
  const recipe = RECIPES[id];
  if (!recipe) return;
  try {
    recipe({ pitch: 1, volume: 1, ...opts });
  } catch {
    // A failed voice must never interrupt gameplay.
  }
}

/** Convert a screen offset from the camera centre into a stereo position. */
export function panFor(screenX: number, viewWidth: number): number {
  if (viewWidth <= 0) return 0;
  return Math.max(-0.8, Math.min(0.8, ((screenX / viewWidth) - 0.5) * 1.6));
}

export const SOUND_IDS = Object.keys(RECIPES) as SoundId[];
