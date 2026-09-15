import Phaser from 'phaser';
import type { RingSlot, StageObjective } from '@/types';
import { t } from '@/content/locale';
import { Bar, Button, HEX, FONT_BODY, FONT_TITLE, Toaster, PALETTE } from '@/ui/kit';
import { getState } from '@/systems/state';
import { isTouchDevice } from '@/systems/input';
import { SEASON_LABEL, calendarView } from '@/systems/seasons';
import { grantXp, levelProgress } from '@/systems/progression';
import { play } from '@/audio/library';
import { phase } from '@/systems/gamestate';

interface HudSnapshot {
  health: number; maxHealth: number;
  stamina: number; maxStamina: number;
  flask: number; flaskMax: number;
  shield: number;
  rings: ({ slot: RingSlot; id: string; ratio: number; ready: boolean; rank: number } | null)[];
  boss: { name: string; health: number; max: number; phase: number; phases: number } | null;
  enemiesLeft: number;
  elapsedMs: number;
  silenced: boolean;
}

/**
 * The HUD overlay and the touch control layer.
 *
 * Kept compact: health, stamina, level, objective, season and the action bar.
 * On a touchscreen the same scene owns the virtual stick and the action
 * buttons, all sized at 48 CSS pixels or larger and mirrorable for left-handed
 * play.
 */
export class UIScene extends Phaser.Scene {
  private stage!: Phaser.Scene;
  private healthBar!: Bar;
  private staminaBar!: Bar;
  private xpBar!: Bar;
  private bossBar!: Bar;
  private cartBar!: Bar;
  private cartText!: Phaser.GameObjects.Text;
  private bossName!: Phaser.GameObjects.Text;
  private objectiveText!: Phaser.GameObjects.Text;
  private seasonText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;
  private promptText!: Phaser.GameObjects.Text;
  private tutorialText!: Phaser.GameObjects.Text;
  private flaskText!: Phaser.GameObjects.Text;
  private ringIcons: { bg: Phaser.GameObjects.Image; icon: Phaser.GameObjects.Image; sweep: Phaser.GameObjects.Image; label: Phaser.GameObjects.Text }[] = [];
  private toaster!: Toaster;
  private touch = false;
  private stickBase?: Phaser.GameObjects.Image;
  private stickKnob?: Phaser.GameObjects.Image;
  private touchButtons: { key: string; img: Phaser.GameObjects.Image; icon: Phaser.GameObjects.Image }[] = [];
  private stickPointerId = -1;
  private stickOrigin = { x: 0, y: 0 };
  private bossIntroGroup: Phaser.GameObjects.Container | null = null;
  private pauseButton!: Button;

  constructor() { super('UI'); }

  create(data: { stage: number }): void {
    // Phaser reuses the scene instance across restarts, so every per-run
    // collection is cleared here rather than at its field declaration -
    // otherwise a second visit would keep the previous run's destroyed
    // objects and lay new ones on top of them.
    this.ringIcons = [];
    this.touchButtons = [];
    this.bossIntroGroup = null;
    this.stickPointerId = -1;
    this.stage = this.scene.get('Stage');
    this.touch = isTouchDevice();
    this.toaster = new Toaster(this);
    this.buildHud();
    if (this.touch) this.buildTouchControls();

    this.stage.events.on('hud', this.onHud, this);
    this.stage.events.on('objective', this.onObjective, this);
    this.stage.events.on('escort', this.onEscort, this);
    this.stage.events.on('toast', (msg: string, icon?: string, dur?: number) => this.toaster.show(msg, { icon, duration: dur }), this);
    this.stage.events.on('tutorial', (key: string) => this.showTutorial(key), this);
    this.stage.events.on('prompt', (text: string | null) => this.showPrompt(text), this);
    this.stage.events.on('boss:intro', this.onBossIntro, this);
    this.stage.events.on('boss:start', () => this.clearBossIntro(), this);
    this.stage.events.on('boss:phase', (d: { index: number; introKey?: string }) => {
      if (d.introKey) this.toaster.show(t(d.introKey), { icon: 'skull', duration: 3600 });
    }, this);
    this.stage.events.on('boss:defeated', (d: { defeatKey: string }) => {
      this.toaster.show(t(d.defeatKey), { icon: 'star', duration: 5000 });
    }, this);
    this.stage.events.on('xp', (amount: number) => this.onXp(amount), this);
    this.stage.events.on('ring:found', () => this.refreshRings(), this);
    this.stage.events.on('retry', () => { this.clearBossIntro(); this.toaster.clear(); }, this);
    this.stage.events.on('stage:ready', (d: { objective: StageObjective; objectiveDone: number; objectiveTotal: number }) => {
      this.onObjective({ done: d.objectiveDone, total: d.objectiveTotal, key: d.objective.labelKey });
    }, this);

    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
      this.stage.events.off('hud', this.onHud, this);
    });
    void data;
  }

  private buildHud(): void {
    const s = getState();
    this.healthBar = new Bar(this, 0, 0, 240, 20, 'bar_health', true).setDepth(10);
    this.staminaBar = new Bar(this, 0, 0, 200, 12, 'bar_stamina').setDepth(10);
    this.xpBar = new Bar(this, 0, 0, 160, 8, 'bar_xp').setDepth(10);
    this.bossBar = new Bar(this, 0, 0, 480, 22, 'bar_boss', true).setDepth(12).setVisible(false);
    this.cartBar = new Bar(this, 0, 0, 220, 14, 'bar_health').setDepth(11).setVisible(false);
    this.cartText = this.add.text(0, 0, '', { fontFamily: FONT_BODY, fontSize: '12px', color: HEX.parchment })
      .setOrigin(0.5, 1).setDepth(11).setVisible(false);
    this.cartText.setStroke(HEX.ink, 4);
    this.bossName = this.add.text(0, 0, '', { fontFamily: FONT_TITLE, fontSize: '19px', color: HEX.parchment })
      .setOrigin(0.5, 1).setDepth(12).setVisible(false);
    this.bossName.setStroke(HEX.ink, 5);

    this.levelText = this.add.text(0, 0, '', { fontFamily: FONT_BODY, fontSize: '13px', color: HEX.gold }).setDepth(10);
    this.objectiveText = this.add.text(0, 0, '', {
      fontFamily: FONT_BODY, fontSize: '14px', color: HEX.parchment, align: 'right', wordWrap: { width: 280 },
    }).setOrigin(1, 0).setDepth(10);
    this.objectiveText.setStroke(HEX.ink, 4);
    this.seasonText = this.add.text(0, 0, '', { fontFamily: FONT_BODY, fontSize: '13px', color: HEX.winter })
      .setOrigin(1, 0).setDepth(10);
    this.seasonText.setStroke(HEX.ink, 4);
    this.flaskText = this.add.text(0, 0, '', { fontFamily: FONT_BODY, fontSize: '13px', color: HEX.parchment }).setDepth(10);
    this.promptText = this.add.text(0, 0, '', { fontFamily: FONT_BODY, fontSize: '15px', color: HEX.gold })
      .setOrigin(0.5, 0.5).setDepth(11).setVisible(false);
    this.promptText.setStroke(HEX.ink, 5);
    this.tutorialText = this.add.text(0, 0, '', {
      fontFamily: FONT_BODY, fontSize: '15px', color: HEX.parchment, align: 'center', wordWrap: { width: 460 },
    }).setOrigin(0.5, 0).setDepth(11).setVisible(false);
    this.tutorialText.setStroke(HEX.ink, 5);

    for (let i = 0; i < 2; i++) {
      const bg = this.add.image(0, 0, 'frames', 'touch_idle').setScale(0.58).setDepth(10);
      const icon = this.add.image(0, 0, 'rings', 'ember_common').setScale(0.52).setDepth(11).setVisible(false);
      const sweep = this.add.image(0, 0, 'frames', 'cooldown_0').setScale(0.58).setDepth(12).setVisible(false);
      const label = this.add.text(0, 0, i === 0 ? 'Q' : 'E', { fontFamily: FONT_BODY, fontSize: '11px', color: HEX.muted })
        .setOrigin(0.5, 0.5).setDepth(13);
      this.ringIcons.push({ bg, icon, sweep, label });
    }
    this.refreshRings();

    this.pauseButton = new Button(this, 0, 0, '', () => this.stage.events.emit('ui:pause'), { width: 52, height: 48, icon: 'pause' });
    this.pauseButton.setDepth(12);

    void s;
    this.layout();
  }

  private refreshRings(): void {
    const s = getState();
    const slots: RingSlot[] = ['active1', 'active2'];
    slots.forEach((slot, i) => {
      const entry = this.ringIcons[i];
      if (!entry) return;
      const id = s.ringSlots[slot];
      if (!id) {
        entry.icon.setVisible(false);
        entry.bg.setTexture('frames', 'touch_disabled');
        return;
      }
      const rank = s.rings[id]?.rank ?? 1;
      const rarity = rank >= 10 ? 'legendary' : rank >= 7 ? 'epic' : rank >= 4 ? 'rare' : 'common';
      entry.icon.setTexture('rings', `${id}_${rarity}`).setVisible(true);
      entry.bg.setTexture('frames', 'touch_idle');
    });
  }

  private buildTouchControls(): void {
    const s = getState().settings;
    this.stickBase = this.add.image(0, 0, 'frames', 'stick_base').setAlpha(0.42).setDepth(20).setScrollFactor(0);
    this.stickKnob = this.add.image(0, 0, 'frames', 'stick_knob').setAlpha(0.7).setDepth(21).setScrollFactor(0);
    const defs: { key: string; icon: string }[] = [
      { key: 'attack', icon: 'attack' },
      { key: 'dodge', icon: 'dodge' },
      { key: 'secondary', icon: 'shield' },
      { key: 'ring1', icon: 'ring' },
      { key: 'ring2', icon: 'ring' },
      { key: 'heal', icon: 'flask' },
      { key: 'interact', icon: 'chevron' },
    ];
    for (const d of defs) {
      const img = this.add.image(0, 0, 'frames', 'touch_idle').setDepth(20).setScrollFactor(0).setAlpha(0.8);
      const icon = this.add.image(0, 0, 'glyphs', d.icon).setDepth(21).setScrollFactor(0).setScale(0.7);
      img.setInteractive({ useHandCursor: true });
      img.on('pointerdown', () => {
        img.setTexture('frames', 'touch_down');
        this.pressTouch(d.key);
      });
      const release = () => {
        img.setTexture('frames', 'touch_idle');
        this.releaseTouch(d.key);
      };
      img.on('pointerup', release);
      img.on('pointerout', release);
      img.on('pointerupoutside', release);
      this.touchButtons.push({ key: d.key, img, icon });
    }

    // The left half of the screen is the movement stick.
    const zone = this.add.zone(0, 0, 10, 10).setOrigin(0, 0).setScrollFactor(0).setDepth(19).setInteractive();
    zone.setName('stickzone');
    zone.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.stickPointerId = p.id;
      this.stickOrigin = { x: p.x, y: p.y };
      this.stickBase?.setPosition(p.x, p.y).setAlpha(0.6);
      this.stickKnob?.setPosition(p.x, p.y).setAlpha(0.9);
    });
    zone.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.id !== this.stickPointerId) return;
      this.updateStick(p.x, p.y);
    });
    const end = (p: Phaser.Input.Pointer) => {
      if (p.id !== this.stickPointerId) return;
      this.stickPointerId = -1;
      this.setMove(0, 0, 0);
      this.stickBase?.setAlpha(0.42);
      this.stickKnob?.setAlpha(0.7);
      this.stickKnob?.setPosition(this.stickBase!.x, this.stickBase!.y);
    };
    zone.on('pointerup', end);
    zone.on('pointerout', end);
    zone.on('pointerupoutside', end);
    void s;
  }

  private updateStick(x: number, y: number): void {
    const maxR = 62 * getState().settings.stickScale;
    let dx = x - this.stickOrigin.x;
    let dy = y - this.stickOrigin.y;
    const len = Math.hypot(dx, dy);
    if (len > maxR) { dx = dx / len * maxR; dy = dy / len * maxR; }
    this.stickKnob?.setPosition(this.stickOrigin.x + dx, this.stickOrigin.y + dy);
    const mag = Math.min(1, len / maxR);
    if (mag < 0.12) { this.setMove(0, 0, 0); return; }
    // Screen vector -> world axes, matching the keyboard path.
    const sx = dx / (len || 1);
    const sy = dy / (len || 1);
    const wx = sy + sx;
    const wy = sy - sx;
    const n = Math.hypot(wx, wy) || 1;
    this.setMove(wx / n, wy / n, mag);
  }

  private setMove(x: number, y: number, mag: number): void {
    const input = (this.stage as unknown as { input2?: { setTouchMove(x: number, y: number, m: number): void } }).input2;
    input?.setTouchMove(x, y, mag);
  }

  private pressTouch(key: string): void {
    play('ui_click', { volume: 0.4 });
    const input = (this.stage as unknown as { input2?: { pressAction(a: string): void } }).input2;
    if (key === 'ring1') { this.stage.events.emit('ui:ring', 'active1'); return; }
    if (key === 'ring2') { this.stage.events.emit('ui:ring', 'active2'); return; }
    if (key === 'heal') { this.stage.events.emit('ui:heal'); return; }
    if (key === 'interact') { this.stage.events.emit('ui:interact'); return; }
    input?.pressAction(key);
  }

  private releaseTouch(key: string): void {
    const input = (this.stage as unknown as { input2?: { releaseAction(a: string): void } }).input2;
    input?.releaseAction(key);
  }

  private layout(): void {
    const cam = this.cameras.main;
    const w = cam.width, h = cam.height;
    const compact = w < 760;
    const pad = compact ? 12 : 18;

    this.healthBar.setPosition(pad, pad);
    this.healthBar.resize(compact ? 180 : 240);
    this.staminaBar.setPosition(pad, pad + 26);
    this.staminaBar.resize(compact ? 150 : 200);
    this.xpBar.setPosition(pad, pad + 42);
    this.xpBar.resize(compact ? 130 : 160);
    this.levelText.setPosition(pad, pad + 54);
    this.flaskText.setPosition(pad + (compact ? 136 : 168), pad + 40);

    this.objectiveText.setPosition(w - pad, pad);
    this.objectiveText.setWordWrapWidth(compact ? 190 : 280);
    this.seasonText.setPosition(w - pad, pad + (compact ? 38 : 44));

    this.bossBar.setPosition(w / 2 - (compact ? 150 : 240), h - (this.touch ? 172 : 64));
    this.bossBar.resize(compact ? 300 : 480);
    const cartW = compact ? 170 : 220;
    this.cartBar.setPosition(w / 2 - cartW / 2, h - (this.touch ? 206 : 98));
    this.cartBar.resize(cartW);
    this.cartText.setPosition(w / 2, h - (this.touch ? 210 : 102));
    this.bossName.setPosition(w / 2, h - (this.touch ? 178 : 70));

    this.promptText.setPosition(w / 2, h * 0.68);
    this.tutorialText.setPosition(w / 2, h * 0.1);
    this.tutorialText.setWordWrapWidth(Math.min(460, w - 60));
    this.pauseButton.setPosition(w - pad - 26, pad + 24);

    const scale = getState().settings.buttonScale;
    const left = getState().settings.leftHanded;
    const ringY = h - (this.touch ? 96 : 54);
    this.ringIcons.forEach((r, i) => {
      const bx = this.touch ? 0 : (left ? w - pad - 40 - i * 58 : pad + 20 + i * 58);
      const by = this.touch ? 0 : ringY;
      r.bg.setPosition(bx, by).setVisible(!this.touch);
      r.icon.setPosition(bx, by).setVisible(!this.touch && r.icon.visible);
      r.sweep.setPosition(bx, by);
      r.label.setPosition(bx, by + 26).setVisible(!this.touch);
    });

    if (this.touch) {
      const zone = this.children.getByName('stickzone') as Phaser.GameObjects.Zone | null;
      if (zone) {
        zone.setSize(w * 0.46, h);
        zone.setPosition(left ? w * 0.54 : 0, 0);
        zone.input!.hitArea.setTo(0, 0, w * 0.46, h);
      }
      const baseX = left ? w * 0.78 : w * 0.22;
      const baseY = h * 0.72;
      this.stickBase?.setPosition(baseX, baseY).setScale(scale * 0.9);
      this.stickKnob?.setPosition(baseX, baseY).setScale(scale * 0.9);

      const originX = left ? w * 0.2 : w * 0.8;
      const originY = h * 0.74;
      const R = 74 * scale;
      const positions: Record<string, { x: number; y: number; s: number }> = {
        attack: { x: 0, y: 0, s: 1.15 },
        dodge: { x: -R * 0.95, y: R * 0.22, s: 0.92 },
        secondary: { x: -R * 0.55, y: -R * 0.78, s: 0.88 },
        ring1: { x: R * 0.18, y: -R * 1.02, s: 0.86 },
        ring2: { x: R * 0.98, y: -R * 0.6, s: 0.86 },
        heal: { x: R * 1.05, y: R * 0.22, s: 0.82 },
        interact: { x: -R * 0.2, y: R * 1.0, s: 0.82 },
      };
      for (const b of this.touchButtons) {
        const pos = positions[b.key]!;
        const px = originX + (left ? -pos.x : pos.x);
        const py = originY + pos.y;
        b.img.setPosition(px, py).setScale(pos.s * scale * 0.72);
        b.icon.setPosition(px, py).setScale(pos.s * scale * 0.55);
      }
      // Ring cooldown sweeps sit on the touch ring buttons.
      const r1 = this.touchButtons.find((b) => b.key === 'ring1');
      const r2 = this.touchButtons.find((b) => b.key === 'ring2');
      if (r1) { this.ringIcons[0]!.sweep.setPosition(r1.img.x, r1.img.y).setScale(r1.img.scale); this.ringIcons[0]!.icon.setPosition(r1.img.x, r1.img.y).setScale(r1.img.scale * 0.8).setVisible(true); }
      if (r2) { this.ringIcons[1]!.sweep.setPosition(r2.img.x, r2.img.y).setScale(r2.img.scale); this.ringIcons[1]!.icon.setPosition(r2.img.x, r2.img.y).setScale(r2.img.scale * 0.8).setVisible(true); }
    }
  }

  private onHud(s: HudSnapshot): void {
    const state = getState();
    const dt = this.game.loop.delta / 1000;
    this.healthBar.set(s.health, s.maxHealth);
    this.healthBar.tick(dt);
    this.staminaBar.set(s.stamina, s.maxStamina);
    this.staminaBar.tick(dt);
    const lp = levelProgress(state);
    this.xpBar.set(lp.current, lp.needed);
    this.levelText.setText(`${t('hud.level')} ${state.player.level}`);
    this.flaskText.setText(`${t('hud.flask')} ${s.flask}/${s.flaskMax}`);
    this.flaskText.setColor(s.flask > 0 ? HEX.parchment : HEX.muted);

    s.rings.forEach((r, i) => {
      const entry = this.ringIcons[i];
      if (!entry) return;
      if (!r) { entry.sweep.setVisible(false); return; }
      const frame = `cooldown_${Math.min(11, Math.floor((1 - r.ratio) * 12))}`;
      entry.sweep.setTexture('frames', frame).setVisible(!r.ready);
      entry.icon.setAlpha(r.ready ? 1 : 0.55);
    });

    if (s.boss) {
      this.bossBar.setVisible(true);
      this.bossName.setVisible(true);
      this.bossBar.set(s.boss.health, s.boss.max, s.boss.phases > 1 ? t('boss.phase', s.boss.phase) : undefined);
      this.bossBar.tick(dt);
      this.bossName.setText(t(s.boss.name));
    } else {
      this.bossBar.setVisible(false);
      this.bossName.setVisible(false);
    }

    const cal = calendarView(state);
    this.seasonText.setText(`${t(SEASON_LABEL[cal.season])} · ${t('hud.day')} ${cal.day}/4`);
    if (s.silenced) this.seasonText.setColor(HEX.danger); else this.seasonText.setColor(HEX.winter);
  }

  private onObjective(d: { done: number; total: number; key: string }): void {
    this.objectiveText.setText(`${t(d.key)}  ${d.done}/${d.total}`);
  }

  /** The escort cart's condition, shown only while a cart is on the route. */
  private onEscort(d: { health: number; maxHealth: number; broken: boolean; moving: boolean }): void {
    this.cartBar.setVisible(true);
    this.cartText.setVisible(true);
    this.cartBar.set(d.health, d.maxHealth);
    this.cartBar.tick(1 / 60);
    this.cartText.setText(d.broken ? t('escort.broken') : `${t('escort.cart')} ${Math.max(0, Math.round(d.health))}/${d.maxHealth}${d.moving ? '' : `  ·  ${t('escort.waiting')}`}`);
    this.cartText.setColor(d.broken ? HEX.danger : d.moving ? HEX.parchment : HEX.muted);
  }

  private onXp(amount: number): void {
    const state = getState();
    const before = state.player.level;
    const res = grantXp(state, amount);
    if (res.levels > 0 && state.player.level !== before) {
      play('level_up');
      this.toaster.show(`${t('hud.level')} ${state.player.level}`, { icon: 'star', colour: HEX.gold });
    }
  }

  private showPrompt(text: string | null): void {
    if (!text) { this.promptText.setVisible(false); return; }
    this.promptText.setText(`[ ${this.touch ? '●' : getState().settings.keybinds.interact} ]  ${text}`);
    this.promptText.setVisible(true);
  }

  private showTutorial(key: string): void {
    const touchKey = `${key}_touch`;
    const text = this.touch && t(touchKey) !== touchKey ? t(touchKey) : t(key);
    this.tutorialText.setText(text).setVisible(true).setAlpha(0);
    this.tweens.add({ targets: this.tutorialText, alpha: 1, duration: 260 });
    this.time.delayedCall(6500, () => {
      this.tweens.add({ targets: this.tutorialText, alpha: 0, duration: 400, onComplete: () => this.tutorialText.setVisible(false) });
    });
  }

  private onBossIntro(d: { nameKey: string; titleKey: string; introKey: string; tipKey: string }): void {
    this.clearBossIntro();
    const cam = this.cameras.main;
    const name = this.add.text(0, 0, t(d.nameKey), { fontFamily: FONT_TITLE, fontSize: '42px', color: HEX.gold }).setOrigin(0.5, 1);
    name.setStroke(HEX.ink, 8);
    const title = this.add.text(0, 8, t(d.titleKey), { fontFamily: FONT_TITLE, fontSize: '20px', color: HEX.parchment }).setOrigin(0.5, 0);
    title.setStroke(HEX.ink, 6);
    const intro = this.add.text(0, 44, t(d.introKey), {
      fontFamily: FONT_BODY, fontSize: '15px', color: HEX.muted, align: 'center', wordWrap: { width: Math.min(560, cam.width - 60) },
    }).setOrigin(0.5, 0);
    const tip = this.add.text(0, 44 + intro.height + 14, t(d.tipKey), {
      fontFamily: FONT_BODY, fontSize: '14px', color: HEX.winter, align: 'center', wordWrap: { width: Math.min(520, cam.width - 60) },
    }).setOrigin(0.5, 0);
    const band = this.add.rectangle(0, 24, cam.width, 220, PALETTE.ink, 0.55).setOrigin(0.5, 0.5);
    this.bossIntroGroup = this.add.container(cam.width / 2, cam.height * 0.36, [band, name, title, intro, tip]).setDepth(400);
    this.bossIntroGroup.setAlpha(0);
    this.tweens.add({ targets: this.bossIntroGroup, alpha: 1, duration: 420 });
  }

  private clearBossIntro(): void {
    if (!this.bossIntroGroup) return;
    const g = this.bossIntroGroup;
    this.bossIntroGroup = null;
    this.tweens.add({ targets: g, alpha: 0, duration: 380, onComplete: () => g.destroy() });
  }

  override update(): void {
    if (phase.isPaused) return;
  }
}
