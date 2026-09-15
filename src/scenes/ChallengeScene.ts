import Phaser from 'phaser';
import { t } from '@/content/locale';
import { getState, update as updateState, type GameState } from '@/systems/state';
import { saveGame } from '@/systems/save';
import { campaignComplete } from '@/systems/campaign';
import {
  bossBoard, hardStages, gauntletEntry, collectionGoals, cosmetics,
  startGauntlet, unlockedCloaks, CLOAK_TINTS, GAUNTLET_STAGES,
  type ChallengeEntry,
} from '@/systems/replay';
import { DEFENCE_CHALLENGE } from '@/content/buildings';
import { renderStrongholdCard, downloadCard } from '@/systems/strongholdcard';
import { Button, HEX, FONT_BODY, FONT_TITLE, PALETTE, Panel, ScrollList, Toaster, formatTime } from '@/ui/kit';
import { play } from '@/audio/library';
import { music } from '@/audio/music';
import { phase } from '@/systems/gamestate';

type Tab = 'board' | 'hard' | 'gauntlet' | 'collection' | 'stronghold';

/**
 * The replay hub, reachable from the settlement once the campaign is over.
 *
 * Everything here is optional and repeatable: no entry fee, no timer, no
 * expiry. Repeat clears pay a reduced share so a challenge stays worth doing
 * without becoming the only sensible way to earn.
 */
export class ChallengeScene extends Phaser.Scene {
  private tab: Tab = 'board';
  private panel!: Panel;
  private toaster!: Toaster;
  private content: Phaser.GameObjects.GameObject[] = [];
  private buttons: Button[] = [];
  private tabButtons: Button[] = [];
  private list: ScrollList | null = null;
  private cardImage: Phaser.GameObjects.Image | null = null;

  constructor() { super('Challenge'); }

  create(data: { tab?: Tab } = {}): void {
    // Phaser reuses the scene instance across restarts, so every per-run
    // collection is cleared here rather than at its field declaration -
    // otherwise a second visit would keep the previous run's destroyed
    // objects and lay new ones on top of them.
    this.content = [];
    this.buttons = [];
    this.tabButtons = [];
    this.list = null;
    this.cardImage = null;
    phase.set('HOME');
    this.tab = data.tab ?? 'board';
    this.cameras.main.setBackgroundColor(PALETTE.charcoal);
    this.toaster = new Toaster(this);
    if (this.textures.exists('title_sky')) {
      const cam = this.cameras.main;
      const img = this.add.image(cam.width / 2, cam.height / 2, 'title_sky').setAlpha(0.35).setName('bg');
      img.setScale(Math.max(cam.width / 960, cam.height / 540));
    }
    this.panel = new Panel(this, 0, 0, 100, 100, 'parchment').setDepth(1);
    this.buildTabs();
    this.render();
    this.input.keyboard?.on('keydown-ESC', () => this.back());
    this.scale.on(Phaser.Scale.Events.RESIZE, this.render, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.render, this);
      this.disposeCard();
    });
    music.play('home');
    play('ui_open');
  }

  private buildTabs(): void {
    const tabs: { id: Tab; label: string; icon: string }[] = [
      { id: 'board', label: t('replay.tab_board'), icon: 'skull' },
      { id: 'hard', label: t('replay.tab_hard'), icon: 'sword' },
      { id: 'gauntlet', label: t('replay.gauntlet'), icon: 'guardian' },
      { id: 'collection', label: t('replay.collection'), icon: 'ring' },
      { id: 'stronghold', label: t('replay.stronghold'), icon: 'home' },
    ];
    for (const d of tabs) {
      const b = new Button(this, 0, 0, d.label, () => { this.tab = d.id; play('ui_click'); this.render(); }, {
        width: 150, height: 44, fontSize: 12, icon: this.glyph(d.icon),
      });
      b.setDepth(3);
      this.tabButtons.push(b);
    }
  }

  /** Falls back to a glyph that certainly exists if the named one is absent. */
  private glyph(name: string): string {
    if (!this.textures.exists('glyphs')) return 'star';
    return this.textures.get('glyphs').has(name) ? name : 'star';
  }

  private clear(): void {
    for (const c of this.content) c.destroy();
    this.content = [];
    for (const b of this.buttons) b.destroy();
    this.buttons = [];
    this.list?.destroy();
    this.list = null;
    this.disposeCard();
  }

  private disposeCard(): void {
    this.cardImage?.destroy();
    this.cardImage = null;
    if (this.textures.exists('__stronghold_card')) this.textures.remove('__stronghold_card');
  }

  private render(): void {
    this.clear();
    const cam = this.cameras.main;
    const bg = this.children.getByName('bg') as Phaser.GameObjects.Image | null;
    bg?.setPosition(cam.width / 2, cam.height / 2).setScale(Math.max(cam.width / 960, cam.height / 540));

    const w = Math.min(820, cam.width - 28);
    const h = Math.min(520, cam.height - 150);
    const x = (cam.width - w) / 2;
    const y = Math.max(76, (cam.height - h) / 2);
    this.panel.setPosition(x, y);
    this.panel.resize(w, h);

    const compact = cam.width < 780;
    const bw = compact ? Math.max(84, (w - 24) / this.tabButtons.length - 6) : 150;
    this.tabButtons.forEach((b, i) => {
      b.container.setScale(bw / 150, compact ? 0.84 : 1);
      b.setPosition(x + 10 + bw / 2 + i * (bw + 6), y - 26);
      b.setEnabled(this.tabIndex() !== i);
    });

    const title = this.add.text(x + 20, y + 14, t('replay.title'), {
      fontFamily: FONT_TITLE, fontSize: '21px', color: HEX.gold,
    }).setDepth(4);
    this.content.push(title);

    switch (this.tab) {
      case 'board': this.renderBoard(x, y, w, h); break;
      case 'hard': this.renderHard(x, y, w, h); break;
      case 'gauntlet': this.renderGauntlet(x, y, w, h); break;
      case 'collection': this.renderCollection(x, y, w, h); break;
      case 'stronghold': this.renderStronghold(x, y, w, h); break;
    }

    const back = new Button(this, x + 74, y + h + 34, t('menu.back'), () => this.back(), { width: 130, icon: 'chevron' });
    back.setDepth(6);
    this.buttons.push(back);
  }

  private tabIndex(): number {
    return (['board', 'hard', 'gauntlet', 'collection', 'stronghold'] as Tab[]).indexOf(this.tab);
  }

  private note(x: number, y: number, text: string, colour: string = HEX.muted): number {
    const txt = this.add.text(x + 20, y + 44, text, {
      fontFamily: FONT_BODY, fontSize: '13px', color: colour, wordWrap: { width: 700 },
    }).setDepth(4);
    this.content.push(txt);
    return txt.height + 8;
  }

  // ------------------------------------------------------------- listings

  private entryRow(entry: ChallengeEntry, w: number, onStart: (e: ChallengeEntry) => void): Phaser.GameObjects.Container {
    const c = this.add.container(0, 0);
    const rowW = w - 56;
    const bg = this.add.nineslice(0, 0, 'frames', entry.cleared ? 'slot_filled' : 'slot_empty', rowW, 56, 10, 10, 10, 10).setOrigin(0, 0);
    const name = this.add.text(12, 8, `${entry.stage}. ${t(entry.nameKey)}`, {
      fontFamily: FONT_TITLE, fontSize: '15px', color: entry.unlocked ? HEX.parchment : HEX.muted,
    });
    const best = entry.best !== null ? `${t('replay.best')} ${formatTime(entry.best)}` : t('replay.no_best');
    const reward = `+${entry.reward.gold ?? 0} ${t('resource.gold')}  +${entry.reward.shards ?? 0} ${t('resource.shards')}`;
    const sub = this.add.text(12, 29, `${best}   ·   ${reward}${entry.cleared ? `   ·   ${t('replay.reward_reduced')}` : ''}`, {
      fontFamily: FONT_BODY, fontSize: '11px', color: HEX.muted,
    });
    c.add([bg, name, sub]);
    const btn = new Button(this, rowW - 70, 28, t('replay.begin'), () => onStart(entry), {
      width: 118, height: 38, fontSize: 12, enabled: entry.unlocked,
    });
    c.add(btn.container);
    return c;
  }

  private renderBoard(x: number, y: number, w: number, h: number): void {
    const state = getState();
    const off = this.note(x, y, t('replay.board_note'));
    const entries = bossBoard(state);
    const listY = y + 44 + off;
    this.list = new ScrollList(this, x + 20, listY, w - 40, y + h - listY - 16);
    this.list.setDepth(4);
    this.list.setRows(entries.map((e) => this.entryRow(e, w, (entry) => this.startChallenge(entry))), 62);
  }

  private renderHard(x: number, y: number, w: number, h: number): void {
    const state = getState();
    if (!campaignComplete(state)) {
      this.note(x, y, t('replay.locked'), HEX.winter);
      return;
    }
    const off = this.note(x, y, t('replay.hard_note'));
    const entries = hardStages(state);
    const listY = y + 44 + off;
    this.list = new ScrollList(this, x + 20, listY, w - 40, y + h - listY - 16);
    this.list.setDepth(4);
    this.list.setRows(entries.map((e) => this.entryRow(e, w, (entry) => this.startChallenge(entry))), 62);
  }

  private renderGauntlet(x: number, y: number, w: number, h: number): void {
    const state = getState();
    const entry = gauntletEntry(state);
    let cy = y + 48;
    const add = (text: string, colour: string, size = 14, font = FONT_BODY): void => {
      const txt = this.add.text(x + 22, cy, text, { fontFamily: font, fontSize: `${size}px`, color: colour, wordWrap: { width: w - 60 } }).setDepth(4);
      this.content.push(txt);
      cy += txt.height + 9;
    };
    add(t('replay.gauntlet'), HEX.gold, 20, FONT_TITLE);
    add(t('replay.gauntlet_note'), HEX.parchment);
    add(t('replay.gauntlet_carry'), HEX.muted, 12);
    cy += 4;
    const names = GAUNTLET_STAGES.map((s, i) => `${i + 1}. ${t('common.stage')} ${s}`).join('    ');
    add(names, HEX.winter, 13);
    cy += 4;
    add(entry.best !== null ? `${t('replay.best')}: ${formatTime(entry.best)}` : t('replay.no_best'), entry.best !== null ? HEX.gold : HEX.muted);
    if (entry.cleared) add(t('replay.gauntlet_done'), HEX.good);
    if (!entry.unlocked) add(t('replay.locked'), HEX.winter);

    const btn = new Button(this, x + w / 2, y + h - 52, t('replay.begin'), () => {
      const run = startGauntlet(getState());
      play('ui_confirm');
      this.scene.start('Stage', {
        stage: GAUNTLET_STAGES[0]!,
        challenge: { id: entry.id, kind: 'gauntlet' as const, run },
      });
    }, { width: 220, enabled: entry.unlocked });
    btn.setDepth(6);
    this.buttons.push(btn);

    // The settlement defence sits here too: it is the other optional, capped,
    // manually started mode, and it never risks anything the player has built.
    const def = new Button(this, x + w / 2, y + h - 104, t('replay.defence_start'), () => {
      play('ui_confirm');
      // The defence runs in the stage scene on the settlement map; stage 30 is
      // only a carrier id so the shared HUD and result screen have a name.
      this.scene.start('Stage', { stage: 30, defence: true });
    }, { width: 220, enabled: campaignComplete(state) || state.campaign.cleared.length >= DEFENCE_CHALLENGE.unlockStage });
    def.setDepth(6);
    this.buttons.push(def);
    const dnote = this.add.text(x + 22, y + h - 140, `${t('replay.defence')} — ${t('replay.defence_note')}`, {
      fontFamily: FONT_BODY, fontSize: '12px', color: HEX.muted, wordWrap: { width: w - 60 },
    }).setDepth(4);
    this.content.push(dnote);
  }

  private renderCollection(x: number, y: number, w: number, h: number): void {
    const state = getState();
    const off = this.note(x, y, t('replay.collection_note'));
    const listY = y + 44 + off;
    this.list = new ScrollList(this, x + 20, listY, w - 40, y + h - listY - 16);
    this.list.setDepth(4);
    const rows: Phaser.GameObjects.Container[] = [];
    const rowW = w - 56;

    for (const g of collectionGoals(state)) {
      const c = this.add.container(0, 0);
      const done = g.have >= g.need;
      const bg = this.add.nineslice(0, 0, 'frames', done ? 'slot_filled' : 'slot_empty', rowW, 40, 10, 10, 10, 10).setOrigin(0, 0);
      const label = this.add.text(12, 11, t(g.key), { fontFamily: FONT_BODY, fontSize: '13px', color: done ? HEX.good : HEX.parchment });
      const count = this.add.text(rowW - 14, 11, `${g.have} / ${g.need}`, { fontFamily: FONT_BODY, fontSize: '13px', color: done ? HEX.good : HEX.muted }).setOrigin(1, 0);
      const track = this.add.rectangle(12, 32, rowW - 26, 4, PALETTE.ink, 0.6).setOrigin(0, 0);
      const fill = this.add.rectangle(12, 32, (rowW - 26) * Math.min(1, g.have / Math.max(1, g.need)), 4, done ? PALETTE.forest : PALETTE.gold).setOrigin(0, 0);
      c.add([bg, label, count, track, fill]);
      rows.push(c);
    }

    const header = this.add.container(0, 0);
    header.add(this.add.text(12, 12, t('replay.cosmetics').toUpperCase(), { fontFamily: FONT_TITLE, fontSize: '13px', color: HEX.gold }));
    rows.push(header);

    for (const cos of cosmetics(state)) {
      const c = this.add.container(0, 0);
      const bg = this.add.nineslice(0, 0, 'frames', cos.earned ? 'slot_filled' : 'slot_empty', rowW, 40, 10, 10, 10, 10).setOrigin(0, 0);
      const label = this.add.text(12, 12, `${t(cos.nameKey)} — ${cos.id.split(':')[1]}`, {
        fontFamily: FONT_BODY, fontSize: '13px', color: cos.earned ? HEX.parchment : HEX.muted,
      });
      const status = this.add.text(rowW - 14, 12, cos.earned ? t('replay.earned') : `${t('replay.locked_hint')}: ${cos.hint}`, {
        fontFamily: FONT_BODY, fontSize: '11px', color: cos.earned ? HEX.good : HEX.muted,
      }).setOrigin(1, 0);
      c.add([bg, label, status]);
      rows.push(c);
    }

    // Cloak colours the player has earned, worn purely for looks.
    const cloaks = unlockedCloaks(state);
    const swatchRow = this.add.container(0, 0);
    swatchRow.add(this.add.text(12, 4, t('replay.cloak'), { fontFamily: FONT_BODY, fontSize: '12px', color: HEX.gold }));
    cloaks.forEach((colour, i) => {
      const sx = 150 + i * 46;
      const sw = this.add.rectangle(sx, 18, 34, 22, CLOAK_TINTS[colour]).setOrigin(0, 0.5);
      sw.setStrokeStyle(2, state.replay.cloak === colour ? PALETTE.gold : PALETTE.ink);
      sw.setInteractive({ useHandCursor: true });
      sw.on('pointerup', () => {
        updateState((st: GameState) => { st.replay.cloak = colour; });
        play('ui_confirm');
        void saveGame(getState());
        this.toaster.show(`${t('replay.cloak_worn')}: ${colour}`, { colour: HEX.good });
        this.render();
      });
      swatchRow.add(sw);
    });
    rows.push(swatchRow);

    this.list.setRows(rows, 46);
  }

  private renderStronghold(x: number, y: number, w: number, h: number): void {
    const state = getState();
    this.note(x, y, t('replay.export_hint'));
    let canvas: HTMLCanvasElement;
    try {
      canvas = renderStrongholdCard(this, state);
    } catch (err) {
      console.error('[card]', err);
      this.note(x, y + 24, t('replay.export_failed'), HEX.danger);
      return;
    }
    this.textures.addCanvas('__stronghold_card', canvas);
    const maxW = w - 60;
    const maxH = h - 170;
    const scale = Math.min(maxW / canvas.width, maxH / canvas.height, 1);
    this.cardImage = this.add.image(x + w / 2, y + 78 + (canvas.height * scale) / 2, '__stronghold_card')
      .setScale(scale).setDepth(5);

    const btn = new Button(this, x + w / 2, y + h - 40, t('replay.export_image'), () => {
      const ok = downloadCard(canvas, `last-hearth-stronghold-${Date.now()}.png`);
      this.toaster.show(ok ? t('replay.export_saved') : t('replay.export_failed'), {
        colour: ok ? HEX.good : HEX.danger, duration: ok ? 2600 : 5200,
      });
    }, { width: 300 });
    btn.setDepth(6);
    this.buttons.push(btn);
  }

  // ---------------------------------------------------------------- flow

  private startChallenge(entry: ChallengeEntry): void {
    if (!entry.unlocked) { play('ui_deny'); return; }
    play('ui_confirm');
    this.scene.start('Stage', {
      stage: entry.stage,
      hard: entry.kind === 'hard',
      challenge: { id: entry.id, kind: entry.kind },
    });
  }

  private back(): void {
    play('ui_close');
    this.scene.start('Home', {});
  }
}
