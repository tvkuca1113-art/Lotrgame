import Phaser from 'phaser';
import type { Difficulty, EquipSlot, RingSlot } from '@/types';
import { t } from '@/content/locale';
import { RINGS, SYNERGIES, RING_SLOT_UNLOCK, ringUpgradeCost } from '@/content/rings';
import { TALENTS, TALENT_PATHS, talentById } from '@/content/talents';
import { EQUIPMENT, equipmentById, salvageValue } from '@/content/equipment';
import { RESIDENTS } from '@/content/buildings';
import { STAGES } from '@/content/stages';
import { ENEMIES } from '@/content/enemies';
import { getState, setState, type GameState } from '@/systems/state';
import {
  deriveStats, weaponFamilyOf, spendTalent, canSpendTalent, respec,
  saveLoadout, loadLoadout, levelProgress, MAX_LEVEL, DIFFICULTY,
} from '@/systems/progression';
import {
  supportBonuses, effectiveRank, maxUsableRank, equipRing, installRing,
  ringPower, ringLocation, isSlotUnlocked, rarityOf,
} from '@/systems/rings';
import { socketsUnlocked } from '@/systems/building';
import { buyEquipment, equipItem, addItem, toggleLock, salvageUnlocked, sortInventory, reclaimStash, isEquipped, sellItem } from '@/systems/inventory';
import { saveGame, exportSave, importSave, storageIsBroken, loadGame, SLOT_BACKUP, SLOT_PREVIOUS } from '@/systems/save';
import { collectionProgress } from '@/systems/campaign';
import { audio } from '@/audio/engine';
import { play } from '@/audio/library';
import { Button, HEX, FONT_BODY, FONT_TITLE, Panel, ScrollList, Slider, Toaster, dimBackdrop, PALETTE, bodyText } from '@/ui/kit';
import { phase } from '@/systems/gamestate';
import { weaponSwingDamage } from '@/systems/combat';

type Tab = 'pause' | 'inventory' | 'talents' | 'rings' | 'forge' | 'journal' | 'settings' | 'defeat' | 'credits' | 'dummy';

/**
 * Every overlay menu. Combat is paused by the caller before this scene opens,
 * and closing it resumes the scene underneath.
 */
export class MenuScene extends Phaser.Scene {
  private tab: Tab = 'pause';
  private from = 'Home';
  private stage = 1;
  private panel!: Panel;
  private toaster!: Toaster;
  private content: Phaser.GameObjects.GameObject[] = [];
  private tabButtons: Button[] = [];
  private list: ScrollList | null = null;
  private selectedRing: string | null = null;
  private selectedItem: string | null = null;

  constructor() { super('Menu'); }

  create(data: { tab?: Tab; from?: string; stage?: number }): void {
    this.tab = data.tab ?? 'pause';
    this.from = data.from ?? 'Home';
    this.stage = data.stage ?? 1;
    this.toaster = new Toaster(this);
    dimBackdrop(this, this.tab === 'defeat' ? 0.82 : 0.74).setDepth(0);
    this.panel = new Panel(this, 0, 0, 100, 100, 'parchment').setDepth(1);
    this.buildTabs();
    this.render();
    this.input.keyboard?.on('keydown-ESC', () => this.close());
    this.scale.on(Phaser.Scale.Events.RESIZE, () => this.render(), this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE);
    });
    play('ui_open');
  }

  private close(): void {
    play('ui_close');
    const from = this.from;
    this.scene.stop();
    if (from === 'Title') {
      this.scene.resume('Title');
      return;
    }
    phase.resumeFromPause();
    this.scene.resume(from);
  }

  private buildTabs(): void {
    if (this.tab === 'defeat' || this.tab === 'credits') return;
    const tabs: { id: Tab; label: string; icon: string }[] = [
      { id: 'pause', label: t('action.pause'), icon: 'pause' },
      { id: 'inventory', label: t('inv.title'), icon: 'bag' },
      { id: 'talents', label: t('talent.title'), icon: 'star' },
      { id: 'rings', label: t('inv.rings'), icon: 'ring' },
      { id: 'journal', label: t('journal.title'), icon: 'map' },
      { id: 'settings', label: t('settings.title'), icon: 'settings' },
    ];
    if (this.from === 'Home') tabs.splice(4, 0, { id: 'forge', label: t('prompt.forge'), icon: 'iron' });
    for (const tabDef of tabs) {
      const b = new Button(this, 0, 0, tabDef.label, () => { this.tab = tabDef.id; this.render(); }, {
        width: 128, height: 44, fontSize: 13, icon: tabDef.icon,
      });
      b.setDepth(3);
      this.tabButtons.push(b);
    }
  }

  private clearContent(): void {
    for (const c of this.content) c.destroy();
    this.content = [];
    this.list?.destroy();
    this.list = null;
  }

  private render(): void {
    this.clearContent();
    const cam = this.cameras.main;
    const w = Math.min(760, cam.width - 32);
    const h = Math.min(560, cam.height - 40);
    const x = (cam.width - w) / 2;
    const y = (cam.height - h) / 2;
    this.panel.setPosition(x, y);
    this.panel.resize(w, h);

    const compact = cam.width < 700;
    this.tabButtons.forEach((b, i) => {
      const bw = compact ? 96 : 128;
      b.container.setScale(bw / 128, compact ? 0.86 : 1);
      b.setPosition(x + 18 + bw / 2 + i * (bw + 6), y - 26);
      b.setVisible(this.tab !== 'defeat' && this.tab !== 'credits');
      b.setEnabled(b !== this.tabButtons[this.tabIndex()]);
    });

    switch (this.tab) {
      case 'pause': this.renderPause(x, y, w, h); break;
      case 'inventory': this.renderInventory(x, y, w, h); break;
      case 'talents': this.renderTalents(x, y, w, h); break;
      case 'rings': this.renderRings(x, y, w, h); break;
      case 'forge': this.renderForge(x, y, w, h); break;
      case 'journal': this.renderJournal(x, y, w, h); break;
      case 'settings': this.renderSettings(x, y, w, h); break;
      case 'defeat': this.renderDefeat(x, y, w, h); break;
      case 'credits': this.renderCredits(x, y, w, h); break;
      case 'dummy': this.renderDummy(x, y, w, h); break;
    }
  }

  private tabIndex(): number {
    const order: Tab[] = this.from === 'Home'
      ? ['pause', 'inventory', 'talents', 'rings', 'forge', 'journal', 'settings']
      : ['pause', 'inventory', 'talents', 'rings', 'journal', 'settings'];
    return order.indexOf(this.tab);
  }

  private title(x: number, y: number, text: string): void {
    const txt = this.add.text(x + 22, y + 16, text, { fontFamily: FONT_TITLE, fontSize: '22px', color: HEX.gold }).setDepth(4);
    this.content.push(txt);
  }

  private body(x: number, y: number, text: string, colour: string = HEX.parchment, size = 13, wrap = 700): Phaser.GameObjects.Text {
    const txt = bodyText(this, x, y, text, size, colour).setDepth(4);
    txt.setWordWrapWidth(wrap);
    this.content.push(txt);
    return txt;
  }

  // ---------------------------------------------------------------- pause

  private renderPause(x: number, y: number, w: number, h: number): void {
    const state = getState();
    this.title(x, y, t('action.pause'));
    const lp = levelProgress(state);
    const stats = deriveStats(state, supportBonuses(state, deriveStats(state).supportPower));
    const lines = [
      `${t('hud.level')} ${state.player.level}${state.player.level >= MAX_LEVEL ? ' (max)' : ''} · ${t('hud.xp')} ${lp.current}/${lp.needed}`,
      `${t('hud.objective')}: ${t(STAGES[this.stage - 1]?.objectiveKey ?? '')}`,
      `${t('inv.equipment')}: ${stats.maxHealth} HP · ${stats.maxStamina} ${t('action.dodge')} · ${stats.attack} ${t('action.attack')} · ${stats.armour} ${t('equip.armour_mail')}`,
      `${t('talent.points')}: ${state.player.talentPoints}`,
    ];
    this.body(x + 22, y + 58, lines.join('\n'), HEX.parchment, 14, w - 44);

    const cx = x + w / 2;
    let by = y + h - 190;
    const buttons: [string, () => void][] = [
      [t('menu.resume'), () => this.close()],
      [t('settings.title'), () => { this.tab = 'settings'; this.render(); }],
    ];
    if (this.from === 'Stage') buttons.push([t('death.home'), () => this.abandonStage()]);
    buttons.push([t('menu.quit_to_title'), () => this.quitToTitle()]);
    for (const [label, fn] of buttons) {
      const b = new Button(this, cx, by, label, fn, { width: 260 });
      b.setDepth(4);
      this.content.push(b.container);
      by += 56;
    }
  }

  private abandonStage(): void {
    play('ui_confirm');
    const state = getState();
    state.campaign.checkpoint = null;
    void saveGame(state);
    this.scene.stop('Stage');
    this.scene.stop('UI');
    this.scene.stop();
    this.scene.start('Home', {});
  }

  private quitToTitle(): void {
    play('ui_close');
    void saveGame(getState());
    this.scene.stop('Stage');
    this.scene.stop('UI');
    this.scene.stop('Home');
    this.scene.stop();
    this.scene.start('Title', { hasSave: true });
  }

  // ------------------------------------------------------------ inventory

  private renderInventory(x: number, y: number, w: number, h: number): void {
    const state = getState();
    this.title(x, y, t('inv.title'));
    this.body(x + 22, y + 46, this.resourceLine(state), HEX.gold, 13, w - 44);

    const listW = Math.min(360, w * 0.52);
    this.list = new ScrollList(this, x + 18, y + 78, listW, h - 150).setDepth(4);
    const rows: Phaser.GameObjects.Container[] = [];
    const items = state.inventory.items;
    for (const item of items) {
      const def = equipmentById(item.defId);
      if (!def) continue;
      const equipped = isEquipped(state, item.uid);
      const row = this.add.container(0, 0);
      const bg = this.add.rectangle(0, 0, listW - 14, 40, PALETTE.forest, this.selectedItem === item.uid ? 0.5 : 0.18).setOrigin(0, 0);
      const name = this.add.text(10, 6, t(def.nameKey), { fontFamily: FONT_BODY, fontSize: '13px', color: equipped ? HEX.gold : HEX.parchment });
      const sub = this.add.text(10, 22, `${t(`inv.${def.slot === 'weapon' ? 'equipment' : 'equipment'}`)} · ${def.slot} · T${def.tier}${item.locked ? ' · ■' : ''}`, {
        fontFamily: FONT_BODY, fontSize: '11px', color: HEX.muted,
      });
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerup', () => { this.selectedItem = item.uid; this.render(); });
      row.add([bg, name, sub]);
      rows.push(row);
    }
    if (rows.length === 0) {
      const empty = this.add.container(0, 0, [this.add.text(10, 10, t('common.none'), { fontFamily: FONT_BODY, fontSize: '13px', color: HEX.muted })]);
      rows.push(empty);
    }
    this.list.setRows(rows, 44);

    // Detail and comparison.
    const dx = x + listW + 34;
    const dw = w - listW - 56;
    if (this.selectedItem) {
      const item = state.inventory.items.find((i) => i.uid === this.selectedItem);
      const def = item ? equipmentById(item.defId) : null;
      if (def && item) {
        const cur = equipmentById(state.player.equipment[def.slot]);
        this.body(dx, y + 78, t(def.nameKey), HEX.gold, 17, dw);
        const rows2 = (['attack', 'armour', 'speed', 'stamina', 'health'] as const)
          .filter((k) => (def.stats[k] ?? 0) || (cur?.stats[k] ?? 0))
          .map((k) => {
            const a = cur?.stats[k] ?? 0;
            const b = def.stats[k] ?? 0;
            const d = b - a;
            return `${k}: ${b}  (${d >= 0 ? '+' : ''}${d})`;
          });
        this.body(dx, y + 108, `${t('inv.compare')}\n${rows2.join('\n')}`, HEX.parchment, 13, dw);
        const sv = salvageValue(def);
        this.body(dx, y + 108 + 24 + rows2.length * 18, `${t('inv.salvage')}: ${sv.gold} ${t('resource.gold')}`, HEX.muted, 12, dw);

        let by = y + h - 190;
        const equipped = isEquipped(state, item.uid);
        const mk = (label: string, fn: () => void, enabled = true) => {
          const b = new Button(this, dx + dw / 2, by, label, fn, { width: Math.min(220, dw), enabled });
          b.setDepth(4);
          this.content.push(b.container);
          by += 52;
        };
        mk(t('inv.equip'), () => {
          equipItem(state, item.uid);
          void saveGame(state);
          this.toaster.show(t(def.nameKey), { icon: 'check' });
          this.render();
        }, !equipped);
        mk(item.locked ? t('inv.unlock') : t('inv.lock'), () => {
          toggleLock(state, item.uid);
          this.render();
        });
        mk(t('inv.sell'), () => {
          const res = sellItem(state, item.uid);
          if (!res.ok) { play('ui_deny'); return; }
          this.selectedItem = null;
          void saveGame(state);
          this.render();
        }, !equipped && !item.locked);
      }
    } else {
      this.body(dx, y + 78, t('inv.compare'), HEX.muted, 13, dw);
    }

    let by = y + h - 60;
    const sortBtn = new Button(this, x + 18 + 70, by, t('inv.sort'), () => { sortInventory(state, 'slot'); this.render(); }, { width: 130, height: 44, fontSize: 13 });
    const salvageBtn = new Button(this, x + 18 + 212, by, t('inv.salvage_bulk'), () => {
      const res = salvageUnlocked(state);
      this.toaster.show(`${res.count} · +${res.gained.gold ?? 0} ${t('resource.gold')}`, { icon: 'trash' });
      this.selectedItem = null;
      void saveGame(state);
      this.render();
    }, { width: 150, height: 44, fontSize: 12 });
    this.content.push(sortBtn.container, salvageBtn.container);
    if (state.inventory.stash.length > 0) {
      const stashBtn = new Button(this, x + 18 + 372, by, `${t('inv.stash')} (${state.inventory.stash.length})`, () => {
        const moved = reclaimStash(state);
        this.toaster.show(`${moved}`, { icon: 'bag' });
        this.render();
      }, { width: 160, height: 44, fontSize: 12 });
      this.content.push(stashBtn.container);
    }
    by = y + h - 60;
    const shopBtn = new Button(this, x + w - 100, by, t('inv.buy'), () => { this.tab = 'forge'; this.render(); }, { width: 140, height: 44, fontSize: 13 });
    this.content.push(shopBtn.container);
  }

  private resourceLine(state: GameState): string {
    return (['gold', 'wood', 'stone', 'iron', 'shards'] as const)
      .map((k) => `${t(`resource.${k}`)} ${state.resources[k]}`)
      .join('   ');
  }

  // -------------------------------------------------------------- talents

  private renderTalents(x: number, y: number, w: number, h: number): void {
    const state = getState();
    this.title(x, y, `${t('talent.title')} — ${t('talent.points')}: ${state.player.talentPoints}`);
    const colW = (w - 60) / 3;
    TALENT_PATHS.forEach((path, pi) => {
      const px = x + 22 + pi * colW;
      const header = this.add.text(px, y + 52, t(`talent.path.${path}`), {
        fontFamily: FONT_TITLE, fontSize: '16px', color: HEX.gold,
      }).setDepth(4);
      this.content.push(header);
      const icon = this.add.image(px - 4, y + 44, 'glyphs', path).setScale(0.4).setOrigin(0, 0).setDepth(4);
      this.content.push(icon);
      const nodes = TALENTS.filter((n) => n.path === path);
      nodes.forEach((node, ni) => {
        const ny = y + 80 + ni * 34;
        const owned = state.player.talents.includes(node.id);
        const check = canSpendTalent(state, node.id);
        const colour = owned ? HEX.good : check.ok ? HEX.parchment : HEX.muted;
        const label = this.add.text(px, ny, `${owned ? '●' : '○'} ${t(node.nameKey)}`, {
          fontFamily: FONT_BODY, fontSize: '12px', color: colour,
        }).setDepth(4).setInteractive({ useHandCursor: true });
        label.on('pointerover', () => this.toaster.show(t(node.descKey), { duration: 2000 }));
        label.on('pointerup', () => {
          if (spendTalent(state, node.id)) {
            play('ui_confirm');
            void saveGame(state);
            this.render();
          } else { play('ui_deny'); }
        });
        this.content.push(label);
      });
    });

    let by = y + h - 60;
    const respecBtn = new Button(this, x + 120, by, t('talent.respec'), () => {
      respec(state);
      play('ui_confirm');
      void saveGame(state);
      this.render();
    }, { width: 180, height: 44, fontSize: 13, enabled: this.from === 'Home' });
    this.content.push(respecBtn.container);
    for (let i = 0; i < 3; i++) {
      const save = new Button(this, x + 330 + i * 92, by - 24, `${t('talent.loadout')} ${i + 1}`, () => {
        saveLoadout(state, i);
        void saveGame(state);
        this.toaster.show(t('talent.loadout_save', i + 1), { icon: 'check' });
      }, { width: 86, height: 40, fontSize: 11 });
      const load = new Button(this, x + 330 + i * 92, by + 22, t('talent.loadout_load', i + 1), () => {
        if (loadLoadout(state, i)) { play('ui_confirm'); void saveGame(state); this.render(); }
        else play('ui_deny');
      }, { width: 86, height: 40, fontSize: 11 });
      this.content.push(save.container, load.container);
    }
    if (this.from !== 'Home') {
      this.body(x + 22, by + 44, t('talent.respec_free'), HEX.muted, 12, w - 44);
    }
  }

  // ---------------------------------------------------------------- rings

  private renderRings(x: number, y: number, w: number, h: number): void {
    const state = getState();
    const maxRank = maxUsableRank(state.player.level);
    this.title(x, y, `${t('inv.rings')} — ${t('ring.max_rank')}: ${maxRank}`);

    const gridX = x + 22;
    const gridY = y + 56;
    RINGS.forEach((ring, i) => {
      const cx = gridX + (i % 6) * 62 + 26;
      const cy = gridY + Math.floor(i / 6) * 68 + 26;
      const rs = state.rings[ring.id]!;
      const frame = rs.discovered ? `${ring.id}_${rarityOf(state, ring.id)}` : `${ring.id}_unknown`;
      const img = this.add.image(cx, cy, 'rings', frame).setScale(0.72).setDepth(4).setInteractive({ useHandCursor: true });
      img.on('pointerup', () => { this.selectedRing = ring.id; this.render(); });
      if (this.selectedRing === ring.id) {
        const ring2 = this.add.circle(cx, cy, 26).setStrokeStyle(2, PALETTE.ember).setDepth(4);
        this.content.push(ring2);
      }
      const loc = ringLocation(state, ring.id);
      if (loc) {
        const mark = this.add.text(cx + 16, cy + 14, loc.kind === 'slot' ? 'W' : 'H', {
          fontFamily: FONT_BODY, fontSize: '11px', color: HEX.gold,
        }).setDepth(5);
        this.content.push(mark);
      }
      this.content.push(img);
    });

    const dy = gridY + 150;
    const id = this.selectedRing ?? RINGS.find((r) => state.rings[r.id]!.discovered)?.id ?? null;
    if (!id) {
      this.body(gridX, dy, t('ring.undiscovered'), HEX.muted, 13, w - 44);
      return;
    }
    const ring = RINGS.find((r) => r.id === id)!;
    const rs = state.rings[id]!;
    if (!rs.discovered) {
      this.body(gridX, dy, `${t('ring.undiscovered')}\n${t('ring.clue')}: ${t('common.stage')} ${ring.source}`, HEX.muted, 13, w - 44);
      return;
    }
    const view = ringPower(state, id, deriveStats(state));
    const cost = rs.rank < 10 ? ringUpgradeCost(rs.rank) : null;
    const lines = [
      `${t(ring.nameKey)} — ${t(`ring.rarity.${rarityOf(state, id)}`)} · ${t('ring.rank')} ${rs.rank}/10 (${t('ring.max_rank')} ${Math.min(rs.rank, maxRank)})`,
      t(ring.loreKey),
      `${t('ring.active_effect')}: ${t(ring.activeKey)}`,
      `${t('ring.support_effect')}: ${t(ring.supportKey)}`,
      `${t('ring.home_effect')}: ${t(ring.homeKey)}`,
      view ? `${t('ring.cooldown_label')}: ${view.cooldown.toFixed(1)}s · ${t('action.attack')}: ${view.damage}` : '',
      `${t('ring.evolution')} 4: ${t(ring.evolutions[0].key)}`,
      `${t('ring.evolution')} 7: ${t(ring.evolutions[1].key)}`,
      cost ? `${t('ring.upgrade_cost')}: ${cost.gold} ${t('resource.gold')} · ${cost.shards} ${t('resource.shards')}` : t('ring.rarity.legendary'),
    ].filter(Boolean);
    this.body(gridX, dy, lines.join('\n'), HEX.parchment, 13, w - 44);

    const by = y + h - 56;
    const slots: RingSlot[] = ['active1', 'active2', 'support1', 'support2'];
    slots.forEach((slot, i) => {
      const unlocked = isSlotUnlocked(state, slot);
      const worn = state.ringSlots[slot] === id;
      const b = new Button(this, gridX + 90 + i * 150, by - 30, `${t(`ring.slot.${slot}`)}${worn ? ' ✓' : ''}`, () => {
        const res = equipRing(state, slot, worn ? null : id);
        if (!res.ok) {
          play('ui_deny');
          this.toaster.show(res.reason === 'installed' ? t('ring.already_placed') : t('ring.slot.locked', RING_SLOT_UNLOCK[slot]), { colour: HEX.danger });
          return;
        }
        play('ui_confirm');
        void saveGame(state);
        this.render();
      }, { width: 142, height: 42, fontSize: 11, enabled: unlocked });
      this.content.push(b.container);
    });

    if (this.from === 'Home' && socketsUnlocked(state)) {
      [0, 1].forEach((si) => {
        const installed = state.ringSockets[si as 0 | 1] === id;
        const b = new Button(this, gridX + 90 + si * 220, by + 18, `${t(si === 0 ? 'home.socket.forge' : 'home.socket.bench')}${installed ? ' ✓' : ''}`, () => {
          const res = installRing(state, si as 0 | 1, installed ? null : id);
          if (!res.ok) { play('ui_deny'); return; }
          play('build_place');
          void saveGame(state);
          this.render();
        }, { width: 210, height: 42, fontSize: 11 });
        this.content.push(b.container);
      });
      this.body(gridX + 460, by + 6, t('home.socket_note'), HEX.muted, 11, 260);
    } else if (this.from === 'Home') {
      this.body(gridX, by + 10, t('home.socket_locked'), HEX.muted, 12, w - 44);
    }
  }

  // ---------------------------------------------------------------- forge

  private renderForge(x: number, y: number, w: number, h: number): void {
    const state = getState();
    const smith = state.home.residents.includes('smith');
    this.title(x, y, `${t('prompt.forge')}${smith ? ` — ${t('npc.smith.name')}` : ''}`);
    this.body(x + 22, y + 46, this.resourceLine(state), HEX.gold, 13, w - 44);

    const listW = Math.min(380, w * 0.55);
    this.list = new ScrollList(this, x + 18, y + 78, listW, h - 200).setDepth(4);
    const rows: Phaser.GameObjects.Container[] = [];
    const highest = state.campaign.cleared.length ? Math.max(...state.campaign.cleared) : 0;
    for (const def of EQUIPMENT) {
      if (def.tier === 0 && (def.cost.gold ?? 0) === 0) continue;
      const owned = state.inventory.items.some((i) => i.defId === def.id) || state.player.equipment[def.slot as EquipSlot] === def.id;
      const locked = def.requiresStage > highest;
      const afford = (['gold', 'wood', 'stone', 'iron'] as const).every((k) => state.resources[k] >= (def.cost[k] ?? 0));
      const row = this.add.container(0, 0);
      const bg = this.add.rectangle(0, 0, listW - 14, 42, PALETTE.forest, 0.18).setOrigin(0, 0);
      const name = this.add.text(10, 5, t(def.nameKey), {
        fontFamily: FONT_BODY, fontSize: '13px', color: owned ? HEX.good : locked ? HEX.muted : afford ? HEX.parchment : HEX.danger,
      });
      const cost = this.add.text(10, 22, owned ? t('inv.owned') : locked ? t('map.locked_reason', def.requiresStage)
        : (['gold', 'wood', 'stone', 'iron'] as const).filter((k) => (def.cost[k] ?? 0) > 0).map((k) => `${def.cost[k]} ${t(`resource.${k}`)}`).join('  '), {
        fontFamily: FONT_BODY, fontSize: '11px', color: HEX.muted,
      });
      if (!owned && !locked) {
        bg.setInteractive({ useHandCursor: true });
        bg.on('pointerup', () => {
          const res = buyEquipment(state, def.id);
          if (!res.ok) {
            play('ui_deny');
            this.toaster.show(res.reason === 'cost' ? t('inv.cannot_afford') : t('common.locked'), { colour: HEX.danger });
            return;
          }
          play('forge');
          this.toaster.show(t(def.nameKey), { icon: 'check', colour: HEX.gold });
          void saveGame(state);
          this.render();
        });
      }
      row.add([bg, name, cost]);
      rows.push(row);
    }
    this.list.setRows(rows, 46);

    const dx = x + listW + 34;
    const dw = w - listW - 56;
    const stats = deriveStats(state, supportBonuses(state, deriveStats(state).supportPower));
    this.body(dx, y + 78, [
      `${t('inv.equipment')}`,
      ...(['weapon', 'armour', 'boots'] as EquipSlot[]).map((slot) => {
        const d = equipmentById(state.player.equipment[slot]);
        return `${slot}: ${d ? t(d.nameKey) : t('common.none')}`;
      }),
      '',
      `HP ${stats.maxHealth} · ${t('action.dodge')} ${stats.maxStamina}`,
      `${t('action.attack')} ${stats.attack} · ${t('equip.armour_mail')} ${stats.armour}`,
      `${t('action.attack')}/${t('common.total')} ${weaponSwingDamage(stats)}`,
    ].join('\n'), HEX.parchment, 13, dw);
    void h;
  }

  // -------------------------------------------------------------- journal

  private renderJournal(x: number, y: number, w: number, h: number): void {
    const state = getState();
    const prog = collectionProgress(state);
    this.title(x, y, `${t('journal.title')} — ${prog.ringsFound}/${prog.ringsTotal} · ${prog.synergiesFound}/${prog.synergiesTotal}`);
    this.list = new ScrollList(this, x + 18, y + 56, w - 36, h - 120).setDepth(4);
    const rows: Phaser.GameObjects.Container[] = [];
    const mk = (title: string, body: string, colour: string = HEX.parchment) => {
      const c = this.add.container(0, 0);
      const a = this.add.text(8, 2, title, { fontFamily: FONT_BODY, fontStyle: 'bold', fontSize: '13px', color: colour });
      const b = this.add.text(8, 20, body, { fontFamily: FONT_BODY, fontSize: '12px', color: HEX.muted, wordWrap: { width: w - 70 } });
      c.add([a, b]);
      rows.push(c);
    };

    mk(t('journal.synergies'), t('synergy.requires_active') + ' ' + t('synergy.no_recursion'), HEX.gold);
    for (const s of SYNERGIES) {
      const found = state.journal.synergies.includes(s.id);
      mk(found ? t(s.nameKey) : `${t('journal.synergy_locked')}`, found ? t(s.descKey) : `${t(`ring.${s.rings[0]}.name`)} + ${t(`ring.${s.rings[1]}.name`)}`, found ? HEX.good : HEX.muted);
    }
    mk(t('journal.story'), '', HEX.gold);
    for (const beat of state.journal.storyBeats.slice(-12)) mk('', t(beat));
    if (state.journal.ringSightFound.length) {
      mk(t('ring.clue'), '', HEX.gold);
      for (const k of state.journal.ringSightFound) mk('', t(k), HEX.winter);
    }
    mk(t('journal.bestiary'), `${state.journal.bestiary.length}/${ENEMIES.length}`, HEX.gold);
    for (const id of state.journal.bestiary) {
      const e = ENEMIES.find((x) => x.id === id);
      if (e) mk(t(e.nameKey), `${e.family} · ${e.behaviour}`);
    }
    mk(t('home.residents'), '', HEX.gold);
    for (const id of state.home.residents) {
      const r = RESIDENTS.find((x) => x.id === id);
      if (r) mk(t(r.nameKey), `${t(r.roleKey)} — ${t(r.serviceKey)}`);
    }
    this.list.setRows(rows, 52);
  }

  // ------------------------------------------------------------- settings

  private renderSettings(x: number, y: number, w: number, h: number): void {
    const state = getState();
    this.title(x, y, t('settings.title'));
    let sy = y + 54;
    const label = (text: string) => {
      this.body(x + 22, sy, text, HEX.parchment, 13, 300);
    };
    const slider = (value: number, onChange: (v: number) => void) => {
      const s = new Slider(this, x + 240, sy + 8, Math.min(220, w - 300), value, onChange);
      s.setDepth(4);
      this.content.push(s.container);
      sy += 34;
    };
    label(t('settings.master')); slider(state.settings.masterVolume, (v) => { state.settings.masterVolume = v; audio.applySettings({ master: v }); });
    label(t('settings.music')); slider(state.settings.musicVolume, (v) => { state.settings.musicVolume = v; audio.applySettings({ music: v }); });
    label(t('settings.sfx')); slider(state.settings.sfxVolume, (v) => { state.settings.sfxVolume = v; audio.applySettings({ sfx: v }); });
    label(t('settings.ambience')); slider(state.settings.ambienceVolume, (v) => { state.settings.ambienceVolume = v; audio.applySettings({ ambience: v }); });
    label(t('settings.aim_assist')); slider(state.settings.aimAssist, (v) => { state.settings.aimAssist = v; });
    label(t('controls.stick_size')); slider((state.settings.stickScale - 0.7) / 0.9, (v) => { state.settings.stickScale = 0.7 + v * 0.9; });
    label(t('controls.button_size')); slider((state.settings.buttonScale - 0.7) / 0.9, (v) => { state.settings.buttonScale = 0.7 + v * 0.9; });

    const toggles: [string, () => boolean, () => void][] = [
      [t('settings.shake'), () => state.settings.cameraShake, () => { state.settings.cameraShake = !state.settings.cameraShake; }],
      [t('settings.hitstop'), () => state.settings.hitStop, () => { state.settings.hitStop = !state.settings.hitStop; }],
      [t('settings.colourblind'), () => state.settings.highContrast, () => { state.settings.highContrast = !state.settings.highContrast; }],
      [t('controls.keyboard_aim'), () => state.settings.keyboardAim, () => { state.settings.keyboardAim = !state.settings.keyboardAim; }],
      [t('controls.left_handed'), () => state.settings.leftHanded, () => { state.settings.leftHanded = !state.settings.leftHanded; }],
    ];
    let tx = x + w / 2 + 20;
    let ty = y + 54;
    for (const [labelText, get, toggle] of toggles) {
      const b = new Button(this, tx + 110, ty + 16, `${labelText}: ${get() ? t('settings.on') : t('settings.off')}`, () => {
        toggle();
        void saveGame(state);
        this.render();
      }, { width: 220, height: 40, fontSize: 12 });
      this.content.push(b.container);
      ty += 46;
    }

    const quality = ['settings.low', 'settings.medium', 'settings.high'];
    const pq = new Button(this, tx + 110, ty + 16, `${t('settings.particles')}: ${t(quality[state.settings.particleQuality]!)}`, () => {
      state.settings.particleQuality = ((state.settings.particleQuality + 1) % 3) as 0 | 1 | 2;
      void saveGame(state);
      this.render();
    }, { width: 220, height: 40, fontSize: 12 });
    ty += 46;
    const we = new Button(this, tx + 110, ty + 16, `${t('settings.weather')}: ${t(quality[state.settings.seasonalEffects]!)}`, () => {
      state.settings.seasonalEffects = ((state.settings.seasonalEffects + 1) % 3) as 0 | 1 | 2;
      void saveGame(state);
      this.render();
    }, { width: 220, height: 40, fontSize: 12 });
    ty += 46;
    const diffs: Difficulty[] = ['story', 'adventurer', 'veteran'];
    const di = diffs.indexOf(state.campaign.difficulty);
    const df = new Button(this, tx + 110, ty + 16, `${t('settings.difficulty')}: ${t(`difficulty.${state.campaign.difficulty}`)}`, () => {
      state.campaign.difficulty = diffs[(di + 1) % diffs.length]!;
      void saveGame(state);
      this.render();
    }, { width: 220, height: 40, fontSize: 12 });
    this.content.push(pq.container, we.container, df.container);
    this.body(tx, ty + 44, `${t(`difficulty.${state.campaign.difficulty}.desc`)}\n${t('settings.difficulty_note')}`, HEX.muted, 11, 240);

    // Save management.
    const by = y + h - 52;
    const exportBtn = new Button(this, x + 110, by, t('settings.export'), () => this.doExport(), { width: 180, height: 44, fontSize: 12, icon: 'export' });
    const importBtn = new Button(this, x + 300, by, t('settings.import'), () => this.doImport(), { width: 180, height: 44, fontSize: 12 });
    const restoreBtn = new Button(this, x + 490, by, t('settings.restore_backup'), () => void this.restoreBackup(), { width: 190, height: 44, fontSize: 11 });
    this.content.push(exportBtn.container, importBtn.container, restoreBtn.container);
    if (storageIsBroken()) {
      this.body(x + 22, by - 40, t('settings.storage_error'), HEX.danger, 12, w - 44);
    }
    const closeBtn = new Button(this, x + w - 80, y + h - 52, t('menu.close'), () => this.close(), { width: 130, height: 44, fontSize: 13 });
    this.content.push(closeBtn.container);
  }

  private doExport(): void {
    const text = exportSave(getState());
    try {
      const blob = new Blob([text], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `last-hearth-save-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      this.toaster.show(t('settings.export'), { icon: 'check' });
    } catch {
      this.toaster.show(t('settings.import_bad'), { colour: HEX.danger });
    }
  }

  private doImport(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const text = await file.text();
      const res = importSave(text);
      if (!res.ok || !res.state) {
        play('ui_deny');
        this.toaster.show(`${t('settings.import_bad')} ${res.error ?? ''}`, { colour: HEX.danger, duration: 5000 });
        return;
      }
      // Keep a backup of the current campaign before replacing it.
      await saveGame(getState(), SLOT_PREVIOUS);
      setState(res.state);
      await saveGame(res.state);
      play('ui_confirm');
      const repaired = res.report?.repaired ?? [];
      this.toaster.show(`${t('settings.import_ok')}${repaired.length ? ` (${repaired.length})` : ''}`, { icon: 'check', duration: 4500 });
      this.render();
    };
    input.click();
  }

  private async restoreBackup(): Promise<void> {
    const backup = await loadGame(SLOT_BACKUP);
    if (!backup.state) {
      const prev = await loadGame(SLOT_PREVIOUS);
      if (!prev.state) { play('ui_deny'); this.toaster.show(t('common.none'), { colour: HEX.danger }); return; }
      setState(prev.state);
    } else {
      setState(backup.state);
    }
    await saveGame(getState());
    play('ui_confirm');
    this.toaster.show(t('settings.restore_backup'), { icon: 'check' });
    this.render();
  }

  // --------------------------------------------------------------- defeat

  private renderDefeat(x: number, y: number, w: number, h: number): void {
    this.title(x, y, t('death.title'));
    this.body(x + 22, y + 54, `${t('death.note')}\n\n${t('boss.retry_note')}`, HEX.parchment, 14, w - 44);
    const cx = x + w / 2;
    const retry = new Button(this, cx, y + h - 130, t('boss.retry'), () => {
      play('ui_confirm');
      const stage = this.scene.get('Stage') as { retryFromCheckpoint?: () => void } | null;
      this.scene.stop();
      this.scene.resume('Stage');
      phase.set('EXPLORING');
      stage?.retryFromCheckpoint?.();
    }, { width: 260 });
    const home = new Button(this, cx, y + h - 70, t('death.home'), () => this.abandonStage(), { width: 260 });
    this.content.push(retry.container, home.container);
  }

  // -------------------------------------------------------------- credits

  private renderCredits(x: number, y: number, w: number, h: number): void {
    this.title(x, y, t('credits.title'));
    const lines = [
      t('game.title') + ' — ' + t('game.subtitle'),
      '',
      t('credits.fan'),
      t('credits.fan2'),
      t('credits.fan3'),
      '',
      t('credits.original'),
      t('credits.assets'),
      t('credits.engine'),
      '',
      t('credits.thanks'),
    ];
    this.body(x + 22, y + 52, lines.join('\n'), HEX.parchment, 13, w - 44);
    const close = new Button(this, x + w / 2, y + h - 48, t('menu.close'), () => this.close(), { width: 200 });
    this.content.push(close.container);
  }

  // ---------------------------------------------------------------- dummy

  private renderDummy(x: number, y: number, w: number, h: number): void {
    const state = getState();
    const stats = deriveStats(state, supportBonuses(state, deriveStats(state).supportPower));
    this.title(x, y, t('build.dummy.name'));
    const family = weaponFamilyOf(state);
    const lines = [
      `${t('inv.equipment')}: ${t(equipmentById(state.player.equipment.weapon)?.nameKey ?? '')}`,
      `${t('action.attack')} (${family}): ${weaponSwingDamage(stats)}`,
      `${t('action.attack')} × combo: ${weaponSwingDamage(stats, 1.15)}`,
      `${t('action.secondary')}: ${weaponSwingDamage(stats, 1.9)}`,
      '',
      ...RINGS.filter((r) => state.rings[r.id]?.discovered).map((r) => {
        const v = ringPower(state, r.id, stats);
        return v ? `${t(r.nameKey)} r${v.rank}: ${v.damage} · ${v.cooldown.toFixed(1)}s · ${v.range}px` : '';
      }).filter(Boolean),
    ];
    this.body(x + 22, y + 52, lines.join('\n'), HEX.parchment, 13, w - 44);
    const close = new Button(this, x + w / 2, y + h - 48, t('menu.close'), () => this.close(), { width: 200 });
    this.content.push(close.container);
    void effectiveRank; void addItem; void DIFFICULTY; void talentById;
  }
}
