import Phaser from 'phaser';
import { t } from '@/content/locale';
import { Button, HEX, FONT_TITLE, FONT_BODY, PALETTE, Toaster } from '@/ui/kit';
import { phase } from '@/systems/gamestate';
import { audio } from '@/audio/engine';
import { music, ambience } from '@/audio/music';
import { getState, newGameState, setState } from '@/systems/state';
import { archiveCurrentCampaign, hasSave, saveGame } from '@/systems/save';
import { play } from '@/audio/library';

/**
 * Title screen: a subtly animated view of the stronghold the player has not
 * built yet, with New Game, Continue and Settings.
 */
export class TitleScene extends Phaser.Scene {
  private layers: Phaser.GameObjects.Image[] = [];
  private keep: Phaser.GameObjects.Sprite | null = null;
  private buttons: Button[] = [];
  private toaster!: Toaster;
  private saveExists = false;
  private storageBroken = false;
  private started = false;

  constructor() { super('Title'); }

  init(data: { hasSave?: boolean; storageBroken?: boolean }): void {
    this.saveExists = data.hasSave ?? false;
    this.storageBroken = data.storageBroken ?? false;
  }

  create(): void {
    phase.set('TITLE');
    this.toaster = new Toaster(this);
    this.cameras.main.setBackgroundColor(PALETTE.charcoal);
    this.buildBackdrop();
    this.buildMenu();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
    });

    // Audio only ever starts from a real gesture.
    const startAudio = () => {
      if (this.started) return;
      this.started = true;
      if (audio.start()) {
        const s = getState().settings;
        audio.applySettings({ master: s.masterVolume, music: s.musicVolume, sfx: s.sfxVolume, ambience: s.ambienceVolume });
        music.play('title');
        ambience.play('autumn');
      }
    };
    this.input.once('pointerdown', startAudio);
    this.input.keyboard?.once('keydown', startAudio);

    if (this.storageBroken) {
      this.toaster.show(t('settings.storage_error'), { icon: 'lock', colour: HEX.danger, duration: 8000 });
    }
    void this.refreshSaveState();
  }

  private async refreshSaveState(): Promise<void> {
    this.saveExists = await hasSave();
    this.buttons[1]?.setEnabled(this.saveExists);
  }

  private buildBackdrop(): void {
    const cam = this.cameras.main;
    for (const key of ['title_sky', 'title_far', 'title_mid']) {
      if (!this.textures.exists(key)) continue;
      const img = this.add.image(cam.width / 2, cam.height / 2, key).setScrollFactor(0);
      this.layers.push(img);
    }
    if (this.textures.exists('title_keep')) {
      this.keep = this.add.sprite(cam.width / 2, cam.height / 2, 'title_keep', 'keep_0');
      if (this.anims.exists('title_keep:flicker')) this.keep.play('title_keep:flicker');
      this.layers.push(this.keep as unknown as Phaser.GameObjects.Image);
    }
    if (this.textures.exists('title_near')) {
      this.layers.push(this.add.image(cam.width / 2, cam.height / 2, 'title_near').setScrollFactor(0));
    }
    this.layout();
  }

  private buildMenu(): void {
    const cam = this.cameras.main;
    const title = this.add.text(0, 0, t('game.title').toUpperCase(), {
      fontFamily: FONT_TITLE, fontSize: '54px', color: HEX.gold,
    }).setOrigin(0.5, 0.5).setName('title');
    title.setStroke('#0E1211', 8);
    const sub = this.add.text(0, 0, t('game.subtitle'), {
      fontFamily: FONT_TITLE, fontSize: '22px', color: HEX.parchment,
    }).setOrigin(0.5, 0.5).setName('subtitle');
    sub.setAlpha(0.85);
    this.add.text(0, 0, t('game.tagline'), {
      fontFamily: FONT_BODY, fontSize: '14px', color: HEX.muted, align: 'center', wordWrap: { width: 420 },
    }).setOrigin(0.5, 0.5).setName('tagline');

    this.buttons = [
      new Button(this, 0, 0, t('menu.new'), () => void this.onNewGame(), { width: 260 }),
      new Button(this, 0, 0, t('menu.continue'), () => this.onContinue(), { width: 260, enabled: this.saveExists }),
      new Button(this, 0, 0, t('menu.settings'), () => this.openSettings(), { width: 260 }),
      new Button(this, 0, 0, t('menu.credits'), () => this.openCredits(), { width: 260 }),
    ];
    void cam;
    this.layout();
  }

  private layout(): void {
    const cam = this.cameras.main;
    const w = cam.width, h = cam.height;
    for (const l of this.layers) {
      const scale = Math.max(w / 960, h / 540);
      l.setPosition(w / 2, h / 2);
      l.setScale(scale);
    }
    const title = this.children.getByName('title') as Phaser.GameObjects.Text | null;
    const sub = this.children.getByName('subtitle') as Phaser.GameObjects.Text | null;
    const tag = this.children.getByName('tagline') as Phaser.GameObjects.Text | null;
    const compact = h < 560 || w < 620;
    title?.setPosition(w / 2, compact ? h * 0.14 : h * 0.18).setFontSize(compact ? 34 : 54);
    sub?.setPosition(w / 2, (compact ? h * 0.14 : h * 0.18) + (compact ? 30 : 46)).setFontSize(compact ? 16 : 22);
    tag?.setPosition(w / 2, (compact ? h * 0.14 : h * 0.18) + (compact ? 54 : 78)).setVisible(!compact);

    const bw = Math.min(300, w - 64);
    const startY = compact ? h * 0.38 : h * 0.46;
    this.buttons.forEach((b, i) => {
      b.setPosition(w / 2, startY + i * 60);
      b.container.setScale(bw / 260, 1);
    });
  }

  private async onNewGame(): Promise<void> {
    play('ui_confirm');
    if (this.saveExists) {
      // Never silently erase a campaign: archive it first and say so.
      await archiveCurrentCampaign();
      this.toaster.show(t('menu.newgame_slot'), { icon: 'lock', duration: 4200 });
    }
    const fresh = newGameState(getState().campaign.difficulty);
    fresh.settings = getState().settings;
    setState(fresh);
    await saveGame(fresh);
    this.scene.start('Stage', { stage: 1, tutorial: true, fresh: true });
  }

  private onContinue(): void {
    play('ui_confirm');
    const s = getState();
    const cp = s.campaign.checkpoint;
    if (cp) {
      // Reloading during a boss resumes at its entrance.
      this.scene.start('Stage', { stage: cp.stage, resume: true });
      return;
    }
    if (s.home.tier < 0 && s.campaign.cleared.length === 0) {
      this.scene.start('Stage', { stage: 1, tutorial: !s.tutorial.done });
      return;
    }
    this.scene.start('Home', {});
  }

  private openSettings(): void {
    this.scene.launch('Menu', { tab: 'settings', from: 'Title' });
    this.scene.pause();
  }

  private openCredits(): void {
    this.scene.launch('Menu', { tab: 'credits', from: 'Title' });
    this.scene.pause();
  }

  override update(_time: number, delta: number): void {
    // Gentle parallax drift so the stronghold feels alive without distracting.
    const t2 = this.time.now / 1000;
    this.layers.forEach((l, i) => {
      l.x = this.cameras.main.width / 2 + Math.sin(t2 * 0.08 + i) * (i * 1.6);
    });
    void delta;
  }
}
