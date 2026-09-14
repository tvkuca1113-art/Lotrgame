import { audio } from './engine';
import type { RegionKey, Season } from '@/types';

/**
 * Ambience and music.
 *
 * Both are generated live: a slow drone bed plus sparse melodic phrases drawn
 * from a mode chosen per region, and a wind/weather layer that follows the
 * season. Nothing loops audibly and nothing is streamed from disk.
 */

type Voice = { stop: () => void };

const MODES: Record<string, number[]> = {
  // semitone offsets; all minor-leaning, which suits the valley
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
};

interface Palette {
  root: number;
  mode: keyof typeof MODES;
  droneGain: number;
  phraseGain: number;
  phraseEvery: [number, number];
  timbre: OscillatorType;
}

const REGION_PALETTES: Record<RegionKey | 'home' | 'title' | 'boss', Palette> = {
  farmland: { root: 146.83, mode: 'dorian', droneGain: 0.1, phraseGain: 0.07, phraseEvery: [5, 11], timbre: 'triangle' },
  woodland: { root: 130.81, mode: 'aeolian', droneGain: 0.11, phraseGain: 0.06, phraseEvery: [6, 13], timbre: 'sine' },
  mountain: { root: 110.0, mode: 'aeolian', droneGain: 0.13, phraseGain: 0.06, phraseEvery: [7, 15], timbre: 'triangle' },
  borderland: { root: 123.47, mode: 'phrygian', droneGain: 0.12, phraseGain: 0.07, phraseEvery: [4, 9], timbre: 'sawtooth' },
  winterland: { root: 98.0, mode: 'aeolian', droneGain: 0.12, phraseGain: 0.05, phraseEvery: [8, 17], timbre: 'sine' },
  fortress: { root: 87.31, mode: 'phrygian', droneGain: 0.14, phraseGain: 0.07, phraseEvery: [4, 8], timbre: 'sawtooth' },
  home: { root: 164.81, mode: 'dorian', droneGain: 0.09, phraseGain: 0.07, phraseEvery: [6, 12], timbre: 'triangle' },
  title: { root: 146.83, mode: 'dorian', droneGain: 0.1, phraseGain: 0.08, phraseEvery: [4, 9], timbre: 'sine' },
  boss: { root: 82.41, mode: 'phrygian', droneGain: 0.16, phraseGain: 0.06, phraseEvery: [3, 6], timbre: 'sawtooth' },
};

function semitone(root: number, n: number): number {
  return root * Math.pow(2, n / 12);
}

class MusicDirector {
  private voices: Voice[] = [];
  private phraseTimer: number | null = null;
  private current: string | null = null;
  private seed = 20260914;
  private intensity = 0;

  private rand(): number {
    this.seed ^= this.seed << 13; this.seed >>>= 0;
    this.seed ^= this.seed >>> 17;
    this.seed ^= this.seed << 5; this.seed >>>= 0;
    return this.seed / 0xffffffff;
  }

  /** Start (or cross-fade to) a bed. Safe to call with the same key repeatedly. */
  play(key: keyof typeof REGION_PALETTES): void {
    if (!audio.isStarted) return;
    if (this.current === key) return;
    this.stop(1.4);
    this.current = key;
    const pal = REGION_PALETTES[key];
    const ctx = audio.context;
    const bus = audio.busNode('music');
    if (!ctx || !bus) return;

    // Drone: root + fifth + a slow detuned pair for movement.
    for (const [mult, detune] of [[1, 0], [1.5, 4], [2, -6], [1, 7]] as [number, number][]) {
      const osc = audio.osc(pal.timbre, pal.root * mult);
      const g = audio.gain(0);
      const flt = audio.filter('lowpass', 900, 0.7);
      if (!osc || !g || !flt) continue;
      osc.detune.value = detune;
      const lfo = audio.osc('sine', 0.05 + this.rand() * 0.08);
      const lfoGain = audio.gain(3.5);
      if (lfo && lfoGain) {
        lfo.connect(lfoGain);
        lfoGain.connect(osc.detune);
        lfo.start();
      }
      osc.connect(flt); flt.connect(g); g.connect(bus);
      g.gain.setValueAtTime(0, ctx.currentTime);
      g.gain.linearRampToValueAtTime(pal.droneGain / 2, ctx.currentTime + 3.5);
      osc.start();
      this.voices.push({
        stop: () => {
          const t = audio.currentTime;
          g.gain.cancelScheduledValues(t);
          g.gain.setValueAtTime(g.gain.value, t);
          g.gain.linearRampToValueAtTime(0, t + 1.4);
          try { osc.stop(t + 1.6); lfo?.stop(t + 1.6); } catch { /* already stopped */ }
        },
      });
    }
    this.schedulePhrase(pal);
  }

  private schedulePhrase(pal: Palette): void {
    if (this.phraseTimer !== null) clearTimeout(this.phraseTimer);
    const [lo, hi] = pal.phraseEvery;
    const wait = (lo + this.rand() * (hi - lo)) * 1000 * (1 - this.intensity * 0.4);
    this.phraseTimer = setTimeout(() => {
      this.playPhrase(pal);
      this.schedulePhrase(pal);
    }, wait) as unknown as number;
  }

  private playPhrase(pal: Palette): void {
    const ctx = audio.context;
    const bus = audio.busNode('music');
    if (!ctx || !bus) return;
    const scale = MODES[pal.mode]!;
    const notes = 2 + Math.floor(this.rand() * 3);
    let degree = Math.floor(this.rand() * scale.length);
    for (let i = 0; i < notes; i++) {
      const octave = this.rand() < 0.35 ? 24 : 12;
      const freq = semitone(pal.root, scale[degree % scale.length]! + octave);
      const when = ctx.currentTime + i * (0.42 + this.rand() * 0.3);
      const osc = audio.osc('sine', freq);
      const g = audio.gain(0);
      if (!osc || !g) return;
      osc.connect(g);
      g.connect(bus);
      const rev = audio.reverb();
      if (rev) g.connect(rev);
      g.gain.setValueAtTime(0, when);
      g.gain.linearRampToValueAtTime(pal.phraseGain * (1 - i * 0.12), when + 0.12);
      g.gain.exponentialRampToValueAtTime(0.0008, when + 1.8);
      osc.start(when);
      osc.stop(when + 2);
      degree += this.rand() < 0.5 ? 1 : -1;
      if (degree < 0) degree += scale.length;
    }
  }

  /** 0..1, raises phrase density and drone weight during fights. */
  setIntensity(v: number): void {
    this.intensity = Math.max(0, Math.min(1, v));
  }

  stop(fade = 1.2): void {
    if (this.phraseTimer !== null) { clearTimeout(this.phraseTimer); this.phraseTimer = null; }
    for (const v of this.voices) v.stop();
    this.voices = [];
    this.current = null;
    void fade;
  }

  get playing(): string | null { return this.current; }
}

export const music = new MusicDirector();

class AmbienceDirector {
  private voices: Voice[] = [];
  private current: string | null = null;

  /** Wind bed plus a season layer: rain hiss, snow hush, dry rustle. */
  play(season: Season, indoor = false): void {
    const key = `${season}:${indoor ? 'in' : 'out'}`;
    if (this.current === key) return;
    this.stop();
    this.current = key;
    const ctx = audio.context;
    const bus = audio.busNode('ambience');
    if (!ctx || !bus) return;

    const src = audio.noiseSource();
    const flt = audio.filter('bandpass', indoor ? 320 : 540, 0.6);
    const g = audio.gain(0);
    if (!src || !flt || !g) return;
    const level = indoor ? 0.05 : season === 'winter' ? 0.12 : season === 'spring' ? 0.14 : 0.09;
    src.connect(flt); flt.connect(g); g.connect(bus);
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(level, ctx.currentTime + 3);

    // Slow gusts.
    const lfo = audio.osc('sine', 0.06);
    const lfoGain = audio.gain(level * 0.5);
    if (lfo && lfoGain) {
      lfo.connect(lfoGain);
      lfoGain.connect(g.gain);
      lfo.start();
    }
    src.start();
    this.voices.push({
      stop: () => {
        const t = audio.currentTime;
        g.gain.cancelScheduledValues(t);
        g.gain.setValueAtTime(g.gain.value, t);
        g.gain.linearRampToValueAtTime(0, t + 1.2);
        try { src.stop(t + 1.4); lfo?.stop(t + 1.4); } catch { /* already stopped */ }
      },
    });

    if (season === 'spring' && !indoor) {
      const rain = audio.noiseSource();
      const rf = audio.filter('highpass', 2200, 0.5);
      const rg = audio.gain(0);
      if (rain && rf && rg) {
        rain.connect(rf); rf.connect(rg); rg.connect(bus);
        rg.gain.setValueAtTime(0, ctx.currentTime);
        rg.gain.linearRampToValueAtTime(0.055, ctx.currentTime + 2.5);
        rain.start();
        this.voices.push({
          stop: () => {
            const t = audio.currentTime;
            rg.gain.linearRampToValueAtTime(0, t + 1.2);
            try { rain.stop(t + 1.4); } catch { /* already stopped */ }
          },
        });
      }
    }
  }

  stop(): void {
    for (const v of this.voices) v.stop();
    this.voices = [];
    this.current = null;
  }
}

export const ambience = new AmbienceDirector();
