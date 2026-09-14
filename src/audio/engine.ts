/**
 * Audio engine.
 *
 * Every sound in the game is synthesised at runtime with the Web Audio API:
 * there are no recorded samples, which keeps the audio original, keeps the
 * download small, and means the whole soundscape is authored in code alongside
 * the systems that trigger it.
 *
 * The context is created only on the first real user gesture, and the game is
 * fully playable with every bus muted.
 */

export type Bus = 'sfx' | 'music' | 'ambience';

export interface AudioSettings {
  master: number;
  music: number;
  sfx: number;
  ambience: number;
}

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private buses: Record<Bus, GainNode> | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private settings: AudioSettings = { master: 0.8, music: 0.55, sfx: 0.9, ambience: 0.7 };
  private started = false;
  private lastPlay = new Map<string, number>();
  private convolver: ConvolverNode | null = null;
  private reverbSend: GainNode | null = null;

  get isStarted(): boolean { return this.started; }
  get context(): AudioContext | null { return this.ctx; }
  get currentTime(): number { return this.ctx?.currentTime ?? 0; }

  /** Call from a pointer/key handler. Safe to call repeatedly. */
  start(): boolean {
    if (this.started) return true;
    const Ctor = (globalThis as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
      ?? (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return false;
    try {
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.settings.master;
      this.master.connect(this.ctx.destination);

      const mk = (v: number) => {
        const g = this.ctx!.createGain();
        g.gain.value = v;
        g.connect(this.master!);
        return g;
      };
      this.buses = { sfx: mk(this.settings.sfx), music: mk(this.settings.music), ambience: mk(this.settings.ambience) };

      // A short synthetic impulse response gives the valley its space.
      this.convolver = this.ctx.createConvolver();
      this.convolver.buffer = this.makeImpulse(1.6, 2.6);
      this.convolver.connect(this.buses.sfx);
      this.reverbSend = this.ctx.createGain();
      this.reverbSend.gain.value = 0.22;
      this.reverbSend.connect(this.convolver);

      this.noiseBuffer = this.makeNoise(2);
      this.started = true;
      return true;
    } catch {
      this.ctx = null;
      return false;
    }
  }

  resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  suspend(): void {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend();
  }

  applySettings(s: Partial<AudioSettings>): void {
    this.settings = { ...this.settings, ...s };
    if (!this.ctx || !this.master || !this.buses) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.settings.master, t, 0.03);
    this.buses.music.gain.setTargetAtTime(this.settings.music, t, 0.05);
    this.buses.sfx.gain.setTargetAtTime(this.settings.sfx, t, 0.03);
    this.buses.ambience.gain.setTargetAtTime(this.settings.ambience, t, 0.2);
  }

  getSettings(): AudioSettings { return { ...this.settings }; }

  busNode(bus: Bus): GainNode | null { return this.buses?.[bus] ?? null; }
  reverb(): GainNode | null { return this.reverbSend; }

  private makeNoise(seconds: number): AudioBuffer {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let s = 0x2545f491;
    for (let i = 0; i < len; i++) {
      s ^= s << 13; s >>>= 0;
      s ^= s >>> 17;
      s ^= s << 5; s >>>= 0;
      d[i] = (s / 0xffffffff) * 2 - 1;
    }
    return buf;
  }

  private makeImpulse(seconds: number, decay: number): AudioBuffer {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      let s = 0x9e3779b9 + c * 7919;
      for (let i = 0; i < len; i++) {
        s ^= s << 13; s >>>= 0;
        s ^= s >>> 17;
        s ^= s << 5; s >>>= 0;
        const n = (s / 0xffffffff) * 2 - 1;
        d[i] = n * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }

  noiseSource(): AudioBufferSourceNode | null {
    if (!this.ctx || !this.noiseBuffer) return null;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    return src;
  }

  osc(type: OscillatorType, freq: number): OscillatorNode | null {
    if (!this.ctx) return null;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    return o;
  }

  gain(value = 0): GainNode | null {
    if (!this.ctx) return null;
    const g = this.ctx.createGain();
    g.gain.value = value;
    return g;
  }

  filter(type: BiquadFilterType, freq: number, q = 1): BiquadFilterNode | null {
    if (!this.ctx) return null;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    return f;
  }

  panner(pan: number): StereoPannerNode | null {
    if (!this.ctx || typeof this.ctx.createStereoPanner !== 'function') return null;
    const p = this.ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    return p;
  }

  /** Rate-limit a sound id so a burst of hits cannot stack into noise. */
  throttle(id: string, minGapMs: number): boolean {
    const now = (this.ctx?.currentTime ?? 0) * 1000;
    const last = this.lastPlay.get(id) ?? -1e9;
    if (now - last < minGapMs) return false;
    this.lastPlay.set(id, now);
    return true;
  }
}

export const audio = new AudioEngine();
