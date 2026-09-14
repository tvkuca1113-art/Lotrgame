import Phaser from 'phaser';
import { vfxMeta } from '@/systems/assets';
import type { WorldRenderer } from '@/world/renderer';
import { DEPTH } from '@/world/renderer';

/**
 * Pooled one-shot effects and ground telegraphs. Everything comes from the one
 * `vfx` atlas, so a burst of impacts costs no new textures.
 */
export class EffectPool {
  private scene: Phaser.Scene;
  private renderer: WorldRenderer;
  private pool: Phaser.GameObjects.Sprite[] = [];
  private live: Phaser.GameObjects.Sprite[] = [];
  private quality: number;
  private budget: number;

  constructor(scene: Phaser.Scene, renderer: WorldRenderer, quality: number) {
    this.scene = scene;
    this.renderer = renderer;
    this.quality = quality;
    this.budget = quality === 0 ? 18 : quality === 1 ? 46 : 90;
  }

  setQuality(q: number): void {
    this.quality = q;
    this.budget = q === 0 ? 18 : q === 1 ? 46 : 90;
  }

  private obtain(): Phaser.GameObjects.Sprite | null {
    if (this.live.length >= this.budget) return null;
    const s = this.pool.pop() ?? this.scene.add.sprite(0, 0, 'vfx');
    s.setActive(true).setVisible(true).setAlpha(1).setScale(1).setAngle(0);
    this.live.push(s);
    return s;
  }

  private release(s: Phaser.GameObjects.Sprite): void {
    s.setActive(false).setVisible(false);
    const i = this.live.indexOf(s);
    if (i >= 0) this.live.splice(i, 1);
    if (this.pool.length < 120) this.pool.push(s);
    else s.destroy();
  }

  /** Play a one-shot effect at a world position. */
  play(id: string, wx: number, wy: number, opts: { angle?: number; scale?: number; depthBias?: number; tint?: number; alpha?: number; flipX?: boolean } = {}): void {
    if (!this.scene.anims.exists(`vfx:${id}`)) return;
    if (this.quality === 0 && !CRITICAL_VFX.has(id)) return;
    const s = this.obtain();
    if (!s) return;
    const p = this.renderer.screenFor(wx, wy);
    s.setPosition(p.x, p.y);
    s.setDepth(this.renderer.depthFor(wx, wy, opts.depthBias ?? 20));
    s.setAngle(Phaser.Math.RadToDeg(opts.angle ?? 0));
    s.setScale(opts.scale ?? 1);
    s.setAlpha(opts.alpha ?? 1);
    s.setFlipX(opts.flipX ?? false);
    if (opts.tint !== undefined) s.setTint(opts.tint); else s.clearTint();
    s.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => this.release(s));
    s.play(`vfx:${id}`);
  }

  /** A ground telegraph that grows over its windup and then disappears. */
  telegraph(id: string, wx: number, wy: number, durationMs: number, opts: { angle?: number; scale?: number; highContrast?: boolean } = {}): Phaser.GameObjects.Sprite | null {
    if (!this.scene.anims.exists(`vfx:${id}`)) return null;
    const s = this.obtain();
    if (!s) return null;
    const p = this.renderer.screenFor(wx, wy);
    s.setPosition(p.x, p.y);
    s.setDepth(DEPTH.telegraph);
    s.setAngle(Phaser.Math.RadToDeg(opts.angle ?? 0));
    s.setScale(opts.scale ?? 1);
    if (opts.highContrast) s.setTint(0xffe9bc);
    const meta = vfxMeta(id);
    const frames = this.scene.anims.get(`vfx:${id}`).frames.length;
    s.play({ key: `vfx:${id}`, frameRate: Math.max(1, frames / (durationMs / 1000)), repeat: 0 });
    this.scene.time.delayedCall(durationMs, () => this.release(s));
    void meta;
    return s;
  }

  /** The soft blob under every actor; kept separate so it never pools out. */
  shadow(wx: number, wy: number, scale: number): Phaser.GameObjects.Image {
    const p = this.renderer.screenFor(wx, wy);
    const img = this.scene.add.image(p.x, p.y, 'vfx', 'shadow_blob_0');
    img.setDepth(DEPTH.shadow);
    img.setScale(scale);
    img.setAlpha(0.8);
    return img;
  }

  clear(): void {
    for (const s of [...this.live]) this.release(s);
  }

  destroy(): void {
    for (const s of [...this.live, ...this.pool]) s.destroy();
    this.live.length = 0;
    this.pool.length = 0;
  }
}

/** Effects that must survive even at the lowest particle setting. */
const CRITICAL_VFX = new Set([
  'tele_circle', 'tele_cone', 'tele_line', 'tele_ring',
  'impact', 'hit_spark', 'slash_light', 'slash_heavy',
  'stone_barrier', 'hearth_circle', 'root_patch',
]);

/**
 * Floating combat text. Readable without sound and without relying on colour
 * alone: damage numbers rise, healing numbers carry a plus sign.
 */
export class FloatingText {
  private scene: Phaser.Scene;
  private renderer: WorldRenderer;
  private pool: Phaser.GameObjects.Text[] = [];

  constructor(scene: Phaser.Scene, renderer: WorldRenderer) {
    this.scene = scene;
    this.renderer = renderer;
  }

  show(wx: number, wy: number, text: string, colour = '#E4D8BC', size = 15): void {
    const p = this.renderer.screenFor(wx, wy);
    const t = this.pool.pop() ?? this.scene.add.text(0, 0, '', {
      fontFamily: 'Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif',
      fontStyle: 'bold',
    });
    t.setActive(true).setVisible(true).setAlpha(1);
    t.setText(text);
    t.setColor(colour);
    t.setFontSize(size);
    t.setStroke('#0E1211', 4);
    t.setOrigin(0.5, 1);
    t.setPosition(p.x + Phaser.Math.Between(-6, 6), p.y - 26);
    t.setDepth(DEPTH.overhead);
    this.scene.tweens.add({
      targets: t,
      y: t.y - 34,
      alpha: 0,
      duration: 780,
      ease: 'Quad.easeOut',
      onComplete: () => {
        t.setActive(false).setVisible(false);
        if (this.pool.length < 40) this.pool.push(t); else t.destroy();
      },
    });
  }

  destroy(): void {
    for (const t of this.pool) t.destroy();
    this.pool.length = 0;
  }
}
