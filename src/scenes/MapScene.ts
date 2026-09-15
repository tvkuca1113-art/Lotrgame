import Phaser from 'phaser';
import { STAGES, CHAPTERS } from '@/content/stages';
import { t } from '@/content/locale';
import { getState } from '@/systems/state';
import { stageView, isUnlocked, isCleared, highestCleared, campaignComplete } from '@/systems/campaign';
import { Button, HEX, FONT_BODY, FONT_TITLE, PALETTE, Panel, Toaster, formatTime } from '@/ui/kit';
import { calendarView, SEASON_LABEL, seasonRouteOpen } from '@/systems/seasons';
import { homeEffects } from '@/systems/rings';
import { bossByStage } from '@/content/bosses';
import { play } from '@/audio/library';
import { phase } from '@/systems/gamestate';
import { music } from '@/audio/music';

/**
 * The campaign map: six chapters of five stages, with the pre-departure
 * summary the brief asks for - equipped rings, installed rings, the season,
 * the next boss clue and the expected rewards.
 */
export class MapScene extends Phaser.Scene {
  private selected = 1;
  private nodes: { id: number; container: Phaser.GameObjects.Container }[] = [];
  private detail!: Panel;
  private detailTexts: Phaser.GameObjects.Text[] = [];
  private beginButton!: Button;
  private toaster!: Toaster;

  constructor() { super('Map'); }

  create(): void {
    // Phaser reuses the scene instance across restarts, so every per-run
    // collection is cleared here rather than at its field declaration -
    // otherwise a second visit would keep the previous run's destroyed
    // objects and lay new ones on top of them.
    this.nodes = [];
    this.detailTexts = [];
    phase.set('HOME');
    this.toaster = new Toaster(this);
    this.cameras.main.setBackgroundColor(0x141a18);
    const state = getState();
    this.selected = Math.min(30, Math.max(1, highestCleared(state) + 1));
    this.buildBackground();
    this.buildNodes();
    this.buildDetail();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this));
    this.input.keyboard?.on('keydown-ESC', () => this.back());
    music.play('home');
    this.layout();
  }

  private buildBackground(): void {
    const cam = this.cameras.main;
    if (this.textures.exists('title_sky')) {
      const img = this.add.image(cam.width / 2, cam.height / 2, 'title_sky').setAlpha(0.5).setName('bg');
      img.setScale(Math.max(cam.width / 960, cam.height / 540));
    }
    const title = this.add.text(0, 0, t('map.title'), { fontFamily: FONT_TITLE, fontSize: '30px', color: HEX.gold }).setName('title');
    title.setStroke(HEX.ink, 6);
  }

  private buildNodes(): void {
    const state = getState();
    for (const chapter of CHAPTERS) {
      const label = this.add.text(0, 0, t(chapter.nameKey), {
        fontFamily: FONT_TITLE, fontSize: '15px', color: HEX.parchment,
      }).setName(`chapter-${chapter.id}`).setAlpha(0.85);
      label.setStroke(HEX.ink, 4);
      void label;
    }
    for (const def of STAGES) {
      const c = this.add.container(0, 0);
      const unlocked = isUnlocked(state, def.id);
      const cleared = isCleared(state, def.id);
      const ring = this.add.circle(0, 0, def.chapterBoss ? 20 : 15, cleared ? PALETTE.forest : PALETTE.charcoal);
      ring.setStrokeStyle(3, cleared ? PALETTE.gold : unlocked ? PALETTE.parchment : 0x3c4340);
      const num = this.add.text(0, 0, String(def.id), {
        fontFamily: FONT_BODY, fontSize: def.chapterBoss ? '15px' : '13px',
        color: unlocked ? HEX.parchment : HEX.muted,
      }).setOrigin(0.5, 0.5);
      c.add([ring, num]);
      if (def.chapterBoss) {
        const crown = this.add.image(0, -26, 'glyphs', 'skull').setScale(0.5).setAlpha(unlocked ? 0.95 : 0.4);
        c.add(crown);
      }
      if (!unlocked) {
        const lock = this.add.image(0, 0, 'glyphs', 'lock').setScale(0.42).setAlpha(0.8);
        c.add(lock);
        num.setVisible(false);
      }
      ring.setInteractive({ useHandCursor: true });
      ring.on('pointerover', () => { if (unlocked) play('ui_hover'); });
      ring.on('pointerup', () => this.select(def.id));
      this.nodes.push({ id: def.id, container: c });
    }
  }

  private buildDetail(): void {
    this.detail = new Panel(this, 0, 0, 360, 330, 'parchment').setDepth(20);
    for (let i = 0; i < 12; i++) {
      const txt = this.add.text(0, 0, '', { fontFamily: FONT_BODY, fontSize: '13px', color: HEX.parchment, wordWrap: { width: 322 } });
      this.detailTexts.push(txt);
      this.detail.add(txt);
    }
    this.beginButton = new Button(this, 0, 0, t('map.select'), () => this.begin(), { width: 180 });
    this.beginButton.setDepth(24);
    const back = new Button(this, 0, 0, t('menu.back'), () => this.back(), { width: 120, icon: 'chevron' });
    back.setDepth(24);
    back.container.setName('back');
    this.select(this.selected);
  }

  private select(id: number): void {
    const state = getState();
    if (!isUnlocked(state, id)) {
      play('ui_deny');
      this.toaster.show(t('map.locked_reason', id - 1), { colour: HEX.danger });
      return;
    }
    this.selected = id;
    play('ui_click');
    const view = stageView(state, id);
    if (!view) return;
    const def = view.def;
    const boss = bossByStage(id);
    const cal = calendarView(state);
    const routeOpen = seasonRouteOpen(def.seasonRoute.season, cal.season);
    const effects = homeEffects(state);

    const wornRings = (['active1', 'active2', 'support1', 'support2'] as const)
      .map((s) => state.ringSlots[s])
      .filter(Boolean)
      .map((r) => `${t(`ring.${r}.name`)} (${state.rings[r!]!.rank})`);
    const installed = state.ringSockets.filter(Boolean).map((r) => t(`ring.${r}.name`));

    const rewards = view.cleared ? view.replay : view.firstClear;
    const rewardLine = (['gold', 'wood', 'stone', 'iron', 'shards'] as const)
      .filter((k) => (rewards[k] ?? 0) > 0)
      .map((k) => `${rewards[k]} ${t(`resource.${k}`)}`)
      .join('  ');
    const best = state.campaign.bestTimes[`stage${id}`];

    const lines: [string, string][] = [
      [`${t('common.stage')} ${id} — ${t(def.nameKey)}`, HEX.gold],
      [t(def.objectiveKey), HEX.parchment],
      [t(def.loreKey), HEX.muted],
      [`${t('hud.recommended')}: ${def.recommendedLevel}   ·   ${def.durationMinutes[0]}–${def.durationMinutes[1]} min`, HEX.winter],
      [`${t('map.boss_clue')}: ${t(def.bossNameKey)} — ${t(boss?.titleKey ?? '')}`, HEX.parchment],
      [`${t('boss.retry_note')}`, HEX.muted],
      [`${t('home.depart_season')}: ${t(SEASON_LABEL[cal.season])} · ${t('map.season_note')}: ${routeOpen ? t(def.seasonRoute.noteKey) : `${t(SEASON_LABEL[def.seasonRoute.season])} — ${t('common.locked')}`}`, HEX.winter],
      [`${t('home.depart_equipped')}: ${wornRings.length ? wornRings.join(', ') : t('common.none')}`, HEX.parchment],
      [`${t('home.depart_installed')}: ${installed.length ? installed.join(', ') : t('common.none')}`, HEX.parchment],
      [`${t(view.cleared ? 'map.replay' : 'map.first_clear')}: ${rewardLine}  +${rewards.xp} ${t('hud.xp')}`, HEX.gold],
      [def.firstClear.ringId && !state.rings[def.firstClear.ringId]?.discovered && !view.cleared
        ? `${t('inv.rings')}: ${t(`ring.${def.firstClear.ringId}.name`)}` : '', HEX.gold],
      [best ? `${t('common.best')}: ${formatTime(best)}` : (effects.scouting ? `${t('build.watchtower.desc')}` : ''), HEX.muted],
    ];
    this.detailTexts.forEach((txt, i) => {
      const [text, colour] = lines[i] ?? ['', HEX.parchment];
      txt.setText(text);
      txt.setColor(colour);
    });
    this.beginButton.setText(view.cleared ? t('replay.hard') !== 'replay.hard' && false ? '' : t('map.select') : t('map.select'));
    this.layout();
    for (const n of this.nodes) {
      const ring = n.container.list[0] as Phaser.GameObjects.Arc;
      ring.setStrokeStyle(n.id === id ? 4 : 3, n.id === id ? PALETTE.ember : (isCleared(getState(), n.id) ? PALETTE.gold : isUnlocked(getState(), n.id) ? PALETTE.parchment : 0x3c4340));
    }
  }

  private begin(): void {
    const state = getState();
    if (!isUnlocked(state, this.selected)) { play('ui_deny'); return; }
    play('ui_confirm');
    state.campaign.lastStage = this.selected;
    this.scene.start('Stage', { stage: this.selected, tutorial: this.selected === 1 && !state.tutorial.done });
  }

  private back(): void {
    play('ui_close');
    this.scene.start('Home', {});
  }

  private layout(): void {
    const cam = this.cameras.main;
    const w = cam.width, h = cam.height;
    const bg = this.children.getByName('bg') as Phaser.GameObjects.Image | null;
    bg?.setPosition(w / 2, h / 2).setScale(Math.max(w / 960, h / 540));
    const title = this.children.getByName('title') as Phaser.GameObjects.Text | null;
    title?.setPosition(28, 22);

    const compact = w < 860;
    const detailW = compact ? Math.min(360, w - 40) : 360;
    const mapW = compact ? w : w - detailW - 48;
    const cols = 5;
    const rowH = Math.min(78, (h - 150) / 6);
    const colW = Math.min(110, (mapW - 90) / cols);
    const startX = compact ? 60 : 56;
    const startY = 96;

    CHAPTERS.forEach((chapter, ci) => {
      const label = this.children.getByName(`chapter-${chapter.id}`) as Phaser.GameObjects.Text | null;
      label?.setPosition(startX - 34, startY + ci * rowH - 12).setVisible(!compact || w > 520);
      chapter.stages.forEach((sid, si) => {
        const node = this.nodes.find((n) => n.id === sid);
        node?.container.setPosition(startX + si * colW + 60, startY + ci * rowH + 8);
      });
    });

    const dx = compact ? (w - detailW) / 2 : w - detailW - 24;
    const dy = compact ? h - 340 : 96;
    this.detail.setPosition(dx, dy);
    this.detail.resize(detailW, Math.min(340, h - dy - 80));
    let y = 18;
    for (const txt of this.detailTexts) {
      txt.setPosition(18, y);
      txt.setWordWrapWidth(detailW - 36);
      y += txt.text ? txt.height + 7 : 0;
    }
    this.beginButton.setPosition(dx + detailW / 2, dy + Math.min(340, h - dy - 80) + 34);
    const back = this.children.getByName('back') as Phaser.GameObjects.Container | null;
    back?.setPosition(90, h - 40);
    void campaignComplete;
  }
}
