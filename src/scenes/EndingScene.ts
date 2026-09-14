import Phaser from 'phaser';
import { t } from '@/content/locale';
import { getState } from '@/systems/state';
import { chooseEnding } from '@/systems/campaign';
import { saveGame } from '@/systems/save';
import { Button, HEX, FONT_BODY, FONT_TITLE, Panel, PALETTE } from '@/ui/kit';
import { play } from '@/audio/library';
import { phase } from '@/systems/gamestate';
import { music } from '@/audio/music';

/**
 * The ending. Both choices keep the collection, the buildings and the ability
 * to keep playing; they change the final scene, the settlement and the
 * epilogue.
 */
export class EndingScene extends Phaser.Scene {
  private chosen: 'spread' | 'concentrate' | null = null;

  constructor() { super('Ending'); }

  create(): void {
    phase.set('ENDING');
    const cam = this.cameras.main;
    this.cameras.main.setBackgroundColor(PALETTE.charcoal);
    music.play('title');
    if (this.textures.exists('title_sky')) {
      this.add.image(cam.width / 2, cam.height / 2, 'title_sky')
        .setScale(Math.max(cam.width / 960, cam.height / 540)).setAlpha(0.8);
    }
    if (this.textures.exists('title_keep')) {
      this.add.image(cam.width / 2, cam.height / 2, 'title_keep', 'keep_0')
        .setScale(Math.max(cam.width / 960, cam.height / 540)).setAlpha(0.9);
    }
    this.showChoice();
  }

  private showChoice(): void {
    const cam = this.cameras.main;
    const title = this.add.text(cam.width / 2, 70, t('story.ending.choice'), {
      fontFamily: FONT_TITLE, fontSize: '24px', color: HEX.gold, align: 'center',
      wordWrap: { width: cam.width - 80 },
    }).setOrigin(0.5, 0);
    title.setStroke(HEX.ink, 6);

    const w = Math.min(340, (cam.width - 60) / 2);
    const options: ('spread' | 'concentrate')[] = ['spread', 'concentrate'];
    options.forEach((opt, i) => {
      const x = cam.width / 2 + (i === 0 ? -w / 2 - 12 : w / 2 + 12) - w / 2;
      const panel = new Panel(this, x, 150, w, 200, 'parchment');
      const h = this.add.text(18, 18, t(`story.ending.${opt}`), {
        fontFamily: FONT_TITLE, fontSize: '18px', color: HEX.gold, wordWrap: { width: w - 36 },
      });
      const d = this.add.text(18, 18 + h.height + 10, t(`story.ending.${opt}.desc`), {
        fontFamily: FONT_BODY, fontSize: '13px', color: HEX.parchment, wordWrap: { width: w - 36 },
      });
      panel.add([h, d]);
      const btn = new Button(this, x + w / 2, 372, t('menu.confirm'), () => this.choose(opt), { width: Math.min(200, w - 20) });
      void btn;
    });
  }

  private choose(opt: 'spread' | 'concentrate'): void {
    if (this.chosen) return;
    this.chosen = opt;
    play('ui_confirm');
    const state = getState();
    chooseEnding(state, opt);
    void saveGame(state);
    this.children.removeAll(true);
    const cam = this.cameras.main;
    if (this.textures.exists('title_sky')) {
      this.add.image(cam.width / 2, cam.height / 2, 'title_sky')
        .setScale(Math.max(cam.width / 960, cam.height / 540)).setAlpha(opt === 'spread' ? 0.95 : 0.7);
    }
    if (this.textures.exists('title_keep')) {
      const keep = this.add.image(cam.width / 2, cam.height / 2, 'title_keep', 'keep_0')
        .setScale(Math.max(cam.width / 960, cam.height / 540));
      if (opt === 'concentrate') keep.setTint(0xfff0cc);
    }
    const text = this.add.text(cam.width / 2, 90, t(`story.ending.${opt}.epilogue`), {
      fontFamily: FONT_BODY, fontSize: '15px', color: HEX.parchment,
      align: 'center', wordWrap: { width: Math.min(620, cam.width - 60) }, lineSpacing: 6,
    }).setOrigin(0.5, 0).setAlpha(0);
    text.setStroke(HEX.ink, 5);
    this.tweens.add({ targets: text, alpha: 1, duration: 1400 });
    play('boss_defeat');

    this.time.delayedCall(1800, () => {
      const cont = new Button(this, cam.width / 2, cam.height - 70, t('story.ending.continue'), () => {
        play('ui_confirm');
        this.scene.start('Home', {});
      }, { width: 300 });
      void cont;
    });
  }
}
