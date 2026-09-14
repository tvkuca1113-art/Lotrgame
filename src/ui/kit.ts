import Phaser from 'phaser';
import { play } from '@/audio/library';

/**
 * A small widget kit built on the generated `frames` and `glyphs` atlases.
 * Everything here is scene-agnostic so the HUD, the menus and the building
 * mode share one look.
 */

export const PALETTE = {
  forest: 0x203b2d,
  charcoal: 0x171c1b,
  gold: 0xc2a264,
  parchment: 0xe4d8bc,
  ember: 0xce7144,
  winter: 0x95b6c6,
  ink: 0x0e1211,
  danger: 0xc25a4a,
  good: 0x7fbf7a,
} as const;

export const HEX = {
  parchment: '#E4D8BC',
  gold: '#C2A264',
  ember: '#CE7144',
  winter: '#95B6C6',
  muted: '#9AA79C',
  danger: '#E08B72',
  good: '#A8E8B0',
  ink: '#0E1211',
} as const;

export const FONT_TITLE = 'Iowan Old Style, Palatino Linotype, Palatino, Book Antiqua, Georgia, serif';
export const FONT_BODY = 'Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif';

export function titleText(scene: Phaser.Scene, x: number, y: number, text: string, size = 26, colour: string = HEX.gold): Phaser.GameObjects.Text {
  return scene.add.text(x, y, text, {
    fontFamily: FONT_TITLE,
    fontSize: `${size}px`,
    color: colour,
  }).setOrigin(0, 0);
}

export function bodyText(scene: Phaser.Scene, x: number, y: number, text: string, size = 14, colour: string = HEX.parchment): Phaser.GameObjects.Text {
  return scene.add.text(x, y, text, {
    fontFamily: FONT_BODY,
    fontSize: `${size}px`,
    color: colour,
    lineSpacing: 4,
  }).setOrigin(0, 0);
}

/** A nine-slice parchment panel. */
export class Panel {
  readonly container: Phaser.GameObjects.Container;
  readonly nine: Phaser.GameObjects.NineSlice;

  constructor(scene: Phaser.Scene, x: number, y: number, w: number, h: number, tone: 'parchment' | 'dark' | 'wood' = 'parchment') {
    this.container = scene.add.container(x, y);
    this.nine = scene.add.nineslice(0, 0, 'frames', `panel_${tone}`, w, h, 26, 26, 26, 26);
    this.nine.setOrigin(0, 0);
    this.container.add(this.nine);
  }

  resize(w: number, h: number): void { this.nine.setSize(w, h); }
  setPosition(x: number, y: number): this { this.container.setPosition(x, y); return this; }
  add(obj: Phaser.GameObjects.GameObject | Phaser.GameObjects.GameObject[]): this { this.container.add(obj); return this; }
  setDepth(d: number): this { this.container.setDepth(d); return this; }
  destroy(): void { this.container.destroy(); }
}

export interface ButtonOpts {
  width?: number;
  height?: number;
  fontSize?: number;
  icon?: string;
  enabled?: boolean;
  tone?: 'normal' | 'danger';
}

/** A labelled button with hover/press states and keyboard-friendly hit area. */
export class Button {
  readonly container: Phaser.GameObjects.Container;
  private bg: Phaser.GameObjects.NineSlice;
  private label: Phaser.GameObjects.Text;
  private iconImg: Phaser.GameObjects.Image | null = null;
  private enabled: boolean;
  private onClick: () => void;
  private w: number;
  private h: number;

  constructor(scene: Phaser.Scene, x: number, y: number, text: string, onClick: () => void, opts: ButtonOpts = {}) {
    this.w = opts.width ?? 200;
    this.h = Math.max(48, opts.height ?? 48);
    this.enabled = opts.enabled ?? true;
    this.onClick = onClick;
    this.container = scene.add.container(x, y);
    this.bg = scene.add.nineslice(0, 0, 'frames', this.enabled ? 'button_idle' : 'button_disabled', this.w, this.h, 14, 14, 14, 14);
    this.bg.setOrigin(0.5, 0.5);
    this.label = scene.add.text(opts.icon ? 12 : 0, 0, text, {
      fontFamily: FONT_TITLE,
      fontSize: `${opts.fontSize ?? 17}px`,
      color: this.enabled ? HEX.parchment : HEX.muted,
    }).setOrigin(opts.icon ? 0 : 0.5, 0.5);
    this.container.add([this.bg, this.label]);
    if (opts.icon) {
      this.iconImg = scene.add.image(-this.w / 2 + 26, 0, 'glyphs', opts.icon).setScale(0.62);
      this.container.add(this.iconImg);
      this.label.setX(-this.w / 2 + 48);
    }
    this.bg.setInteractive({ useHandCursor: true });
    this.bg.on('pointerover', () => { if (this.enabled) { this.bg.setTexture('frames', 'button_hover'); play('ui_hover'); } });
    this.bg.on('pointerout', () => { if (this.enabled) this.bg.setTexture('frames', 'button_idle'); });
    this.bg.on('pointerdown', () => { if (this.enabled) this.bg.setTexture('frames', 'button_down'); });
    this.bg.on('pointerup', () => {
      if (!this.enabled) { play('ui_deny'); return; }
      this.bg.setTexture('frames', 'button_hover');
      play('ui_click');
      this.onClick();
    });
  }

  setEnabled(v: boolean): this {
    this.enabled = v;
    this.bg.setTexture('frames', v ? 'button_idle' : 'button_disabled');
    this.label.setColor(v ? HEX.parchment : HEX.muted);
    return this;
  }

  setText(t: string): this { this.label.setText(t); return this; }
  setPosition(x: number, y: number): this { this.container.setPosition(x, y); return this; }
  setDepth(d: number): this { this.container.setDepth(d); return this; }
  setVisible(v: boolean): this { this.container.setVisible(v); return this; }
  get width(): number { return this.w; }
  get height(): number { return this.h; }
  destroy(): void { this.container.destroy(); }
}

/** A labelled bar: health, stamina, boss health, experience. */
export class Bar {
  readonly container: Phaser.GameObjects.Container;
  private frame: Phaser.GameObjects.NineSlice;
  private fill: Phaser.GameObjects.NineSlice;
  private ghost: Phaser.GameObjects.NineSlice;
  private text: Phaser.GameObjects.Text | null = null;
  private w: number;
  private h: number;
  private ratio = 1;
  private ghostRatio = 1;

  constructor(scene: Phaser.Scene, x: number, y: number, w: number, h: number, fillFrame: string, showText = false) {
    this.w = w; this.h = h;
    this.container = scene.add.container(x, y);
    this.frame = scene.add.nineslice(0, 0, 'frames', 'bar_frame', w, h, 4, 4, 4, 4).setOrigin(0, 0);
    this.ghost = scene.add.nineslice(2, 2, 'frames', fillFrame, w - 4, h - 4, 3, 3, 3, 3).setOrigin(0, 0);
    this.ghost.setTint(0x7a4a3a).setAlpha(0.7);
    this.fill = scene.add.nineslice(2, 2, 'frames', fillFrame, w - 4, h - 4, 3, 3, 3, 3).setOrigin(0, 0);
    this.container.add([this.frame, this.ghost, this.fill]);
    if (showText) {
      this.text = scene.add.text(w / 2, h / 2, '', {
        fontFamily: FONT_BODY, fontSize: '12px', color: HEX.parchment,
      }).setOrigin(0.5, 0.5);
      this.text.setStroke(HEX.ink, 3);
      this.container.add(this.text);
    }
  }

  set(value: number, max: number, label?: string): void {
    const r = max <= 0 ? 0 : Math.max(0, Math.min(1, value / max));
    this.ratio = r;
    if (r > this.ghostRatio) this.ghostRatio = r;
    this.fill.setSize(Math.max(0, (this.w - 4) * r), this.h - 4);
    this.ghost.setSize(Math.max(0, (this.w - 4) * this.ghostRatio), this.h - 4);
    this.fill.setVisible(r > 0.001);
    this.ghost.setVisible(this.ghostRatio > 0.001);
    if (this.text) this.text.setText(label ?? `${Math.ceil(value)} / ${Math.ceil(max)}`);
  }

  /** Called each frame so the damage ghost chases the real value. */
  tick(dt: number): void {
    if (this.ghostRatio > this.ratio) {
      this.ghostRatio = Math.max(this.ratio, this.ghostRatio - dt * 0.55);
      this.ghost.setSize(Math.max(0, (this.w - 4) * this.ghostRatio), this.h - 4);
    }
  }

  resize(w: number): void {
    this.w = w;
    this.frame.setSize(w, this.h);
    this.set(this.ratio, 1);
    if (this.text) this.text.setX(w / 2);
  }

  setPosition(x: number, y: number): this { this.container.setPosition(x, y); return this; }
  setDepth(d: number): this { this.container.setDepth(d); return this; }
  setVisible(v: boolean): this { this.container.setVisible(v); return this; }
  destroy(): void { this.container.destroy(); }
}

/** A scrollable list with fixed-height rows, used by inventory and journal. */
export class ScrollList {
  readonly container: Phaser.GameObjects.Container;
  private mask: Phaser.Display.Masks.GeometryMask;
  private content: Phaser.GameObjects.Container;
  private maskShape: Phaser.GameObjects.Graphics;
  private viewH: number;
  private contentH = 0;
  private scroll = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, w: number, h: number) {
    this.viewH = h;
    this.container = scene.add.container(x, y);
    this.content = scene.add.container(0, 0);
    this.container.add(this.content);
    this.maskShape = scene.make.graphics({});
    this.maskShape.fillStyle(0xffffff);
    this.maskShape.fillRect(x, y, w, h);
    this.mask = this.maskShape.createGeometryMask();
    this.content.setMask(this.mask);

    const zone = scene.add.zone(x, y, w, h).setOrigin(0, 0).setInteractive();
    zone.on('wheel', (_p: unknown, _dx: number, dy: number) => this.scrollBy(dy * 0.6));
    let dragging = false;
    let lastY = 0;
    zone.on('pointerdown', (p: Phaser.Input.Pointer) => { dragging = true; lastY = p.y; });
    zone.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!dragging) return;
      this.scrollBy(lastY - p.y);
      lastY = p.y;
    });
    zone.on('pointerup', () => { dragging = false; });
    zone.on('pointerout', () => { dragging = false; });
    this.container.add(zone);
  }

  setRows(rows: Phaser.GameObjects.GameObject[], rowHeight: number): void {
    this.content.removeAll(true);
    rows.forEach((r, i) => {
      (r as Phaser.GameObjects.Container).setY?.(i * rowHeight);
      this.content.add(r);
    });
    this.contentH = rows.length * rowHeight;
    this.scroll = 0;
    this.content.setY(0);
  }

  scrollBy(dy: number): void {
    const max = Math.max(0, this.contentH - this.viewH);
    this.scroll = Phaser.Math.Clamp(this.scroll + dy, 0, max);
    this.content.setY(-this.scroll);
  }

  setDepth(d: number): this { this.container.setDepth(d); return this; }
  destroy(): void {
    this.content.clearMask();
    this.maskShape.destroy();
    this.container.destroy();
  }
}

/** Horizontal slider for settings. */
export class Slider {
  readonly container: Phaser.GameObjects.Container;
  private knob: Phaser.GameObjects.Arc;
  private track: Phaser.GameObjects.Rectangle;
  private fill: Phaser.GameObjects.Rectangle;
  private value: number;
  private w: number;
  private onChange: (v: number) => void;

  constructor(scene: Phaser.Scene, x: number, y: number, w: number, value: number, onChange: (v: number) => void) {
    this.w = w;
    this.value = Phaser.Math.Clamp(value, 0, 1);
    this.onChange = onChange;
    this.container = scene.add.container(x, y);
    this.track = scene.add.rectangle(0, 0, w, 6, PALETTE.ink, 0.9).setOrigin(0, 0.5);
    this.fill = scene.add.rectangle(0, 0, w * this.value, 6, PALETTE.gold).setOrigin(0, 0.5);
    this.knob = scene.add.circle(w * this.value, 0, 11, PALETTE.parchment);
    this.knob.setStrokeStyle(2, PALETTE.ink);
    this.container.add([this.track, this.fill, this.knob]);

    const zone = scene.add.zone(-12, -24, w + 24, 48).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    const set = (p: Phaser.Input.Pointer) => {
      const local = p.x - this.container.x;
      this.set(Phaser.Math.Clamp(local / w, 0, 1));
      this.onChange(this.value);
    };
    let down = false;
    zone.on('pointerdown', (p: Phaser.Input.Pointer) => { down = true; set(p); });
    zone.on('pointermove', (p: Phaser.Input.Pointer) => { if (down) set(p); });
    zone.on('pointerup', () => { down = false; play('ui_click'); });
    zone.on('pointerout', () => { down = false; });
    this.container.add(zone);
  }

  set(v: number): void {
    this.value = Phaser.Math.Clamp(v, 0, 1);
    this.fill.width = this.w * this.value;
    this.knob.setX(this.w * this.value);
  }

  get(): number { return this.value; }
  setDepth(d: number): this { this.container.setDepth(d); return this; }
  destroy(): void { this.container.destroy(); }
}

/** A short toast in the top-centre of the screen. */
export class Toaster {
  private scene: Phaser.Scene;
  private queue: Phaser.GameObjects.Container[] = [];

  constructor(scene: Phaser.Scene) { this.scene = scene; }

  show(text: string, opts: { icon?: string; colour?: string; duration?: number } = {}): void {
    const cam = this.scene.cameras.main;
    const label = this.scene.add.text(0, 0, text, {
      fontFamily: FONT_BODY, fontSize: '15px', color: opts.colour ?? HEX.parchment,
      align: 'center', wordWrap: { width: 420 },
    }).setOrigin(0.5, 0.5);
    const w = Math.max(200, label.width + (opts.icon ? 82 : 46));
    const h = Math.max(46, label.height + 22);
    const panel = this.scene.add.nineslice(0, 0, 'frames', 'panel_dark', w, h, 22, 22, 22, 22).setOrigin(0.5, 0.5);
    const c = this.scene.add.container(cam.width / 2, 74 + this.queue.length * 56, [panel, label]);
    if (opts.icon) {
      const ic = this.scene.add.image(-w / 2 + 28, 0, 'glyphs', opts.icon).setScale(0.6);
      c.add(ic);
      label.setX(14);
    }
    c.setScrollFactor(0).setDepth(300000).setAlpha(0);
    this.queue.push(c);
    this.scene.tweens.add({ targets: c, alpha: 1, y: c.y - 8, duration: 200 });
    this.scene.time.delayedCall(opts.duration ?? 2600, () => {
      this.scene.tweens.add({
        targets: c, alpha: 0, y: c.y - 14, duration: 260,
        onComplete: () => {
          c.destroy();
          const i = this.queue.indexOf(c);
          if (i >= 0) this.queue.splice(i, 1);
          this.queue.forEach((q, k) => q.setY(66 + k * 56));
        },
      });
    });
  }

  clear(): void {
    for (const c of this.queue) c.destroy();
    this.queue.length = 0;
  }
}

/** Full-screen dim used behind modal menus. */
export function dimBackdrop(scene: Phaser.Scene, alpha = 0.72): Phaser.GameObjects.Rectangle {
  const cam = scene.cameras.main;
  const r = scene.add.rectangle(0, 0, cam.width, cam.height, PALETTE.ink, alpha).setOrigin(0, 0);
  r.setScrollFactor(0).setInteractive();
  return r;
}

export function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
