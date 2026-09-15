import Phaser from 'phaser';
import type { Season } from '@/types';
import { t } from '@/content/locale';
import { getState } from '@/systems/state';
import { saveGame } from '@/systems/save';
import { phase, FixedStep } from '@/systems/gamestate';
import { InputManager } from '@/systems/input';
import { WorldRenderer, WeatherLayer, DEPTH } from '@/world/renderer';
import { EffectPool } from '@/entities/effects';
import { Player } from '@/entities/player';
import { generateHome, type HomeMap } from '@/world/homegen';
import { deriveStats, weaponFamilyOf } from '@/systems/progression';
import { supportBonuses } from '@/systems/rings';
import { equipmentById } from '@/content/equipment';
import { playerSheet, buildingsKey, buildingMeta, registerAnimations, loadBundle, gearBundle } from '@/systems/assets';
import { RESIDENTS, buildingById, HOME_TIERS, DEFENCE_CHALLENGE } from '@/content/buildings';
import { homeEffects } from '@/systems/rings';
import { nextHomeTier, suggestImprovements, validatePlacement, placeBuilding, moveBuilding, removeBuilding, BuildHistory, plotSize, footprintOf } from '@/systems/building';
import { advanceDay, calendarView, seasonProfile, SEASON_LABEL } from '@/systems/seasons';
import { campaignComplete } from '@/systems/campaign';
import { Button, HEX, FONT_BODY, FONT_TITLE, Toaster, PALETTE, bodyText } from '@/ui/kit';
import { play } from '@/audio/library';
import { music, ambience } from '@/audio/music';
import { TILE, worldToScreen } from '@/systems/iso';

type BuildMode = { active: boolean; id: string | null; rotation: 0 | 1 | 2 | 3; movingUid: string | null };

/**
 * The settlement.
 *
 * An explorable space, not a menu: the player walks between structures, talks
 * to the residents they rescued, uses the forge and the ring workbench, and
 * lays out buildings on a grid with preview, rotation, move, dismantle and undo.
 */
export class HomeScene extends Phaser.Scene {
  private world!: WorldRenderer;
  private effects!: EffectPool;
  private weather!: WeatherLayer;
  private input2!: InputManager;
  private stepper = new FixedStep(60);
  private player!: Player;
  private map!: HomeMap;
  private season: Season = 'spring';
  private buildingSprites = new Map<string, Phaser.GameObjects.Image>();
  private residentSprites: { id: string; sprite: Phaser.GameObjects.Sprite; x: number; y: number; t: number }[] = [];
  private build: BuildMode = { active: false, id: null, rotation: 0, movingUid: null };
  private ghost: Phaser.GameObjects.Image | null = null;
  private gridGfx!: Phaser.GameObjects.Graphics;
  private history = new BuildHistory();
  private toaster!: Toaster;
  private promptText!: Phaser.GameObjects.Text;
  private goalText!: Phaser.GameObjects.Text;
  private buttons: Button[] = [];
  private interact: { kind: string; x: number; y: number; id?: string } | null = null;
  private buildPalette: Phaser.GameObjects.Container | null = null;

  constructor() { super('Home'); }

  async create(): Promise<void> {
    const state = getState();
    this.season = state.calendar.season;
    if (state.home.tier < 0) state.home.tier = 0;

    const weaponDef = equipmentById(state.player.equipment.weapon);
    const gb = gearBundle(weaponDef?.gearTier ?? 0);
    if (gb) { try { await loadBundle(this, gb); } catch { /* fall back to tier 0 art */ } }
    registerAnimations(this);

    this.map = generateHome(state, this.season);
    this.world = new WorldRenderer(this, 'home', this.season);
    this.world.drawGround(this.map);
    this.effects = new EffectPool(this, this.world, state.settings.particleQuality);
    this.world.addProps(this.map);
    this.gridGfx = this.add.graphics().setDepth(DEPTH.groundDecal);
    this.weather = new WeatherLayer(this, state.settings.seasonalEffects);
    const prof = seasonProfile(this.season);
    if (state.settings.seasonalEffects > 0 && prof.weather) this.weather.set(prof.weather, prof.ambientAlpha + 0.14);

    this.toaster = new Toaster(this);
    this.input2 = new InputManager(this, state.settings);
    this.spawnPlayer();
    this.refreshBuildings();
    this.spawnResidents();
    this.buildHud();

    const cam = this.cameras.main;
    cam.setBackgroundColor(0x161d19);
    cam.startFollow(this.player.sprite, true, 0.12, 0.12);
    cam.setZoom(this.computeZoom());

    phase.set('HOME');
    music.play('home');
    ambience.play(this.season);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
    this.events.on(Phaser.Scenes.Events.WAKE, () => this.onWake());
    this.events.on(Phaser.Scenes.Events.RESUME, () => this.onWake());
    void saveGame(state);
  }

  private onWake(): void {
    phase.set('HOME');
    this.refreshBuildings();
    this.updateGoals();
    const state = getState();
    const stats = deriveStats(state, supportBonuses(state, deriveStats(state).supportPower));
    this.player.setStats(stats, weaponFamilyOf(state));
  }

  private computeZoom(): number {
    const cam = this.cameras.main;
    return Phaser.Math.Clamp(Math.min(cam.width / 900, cam.height / 560) * 1.5, 0.8, 1.8);
  }

  private spawnPlayer(): void {
    const state = getState();
    const stats = deriveStats(state, supportBonuses(state, deriveStats(state).supportPower));
    const family = weaponFamilyOf(state);
    const weaponDef = equipmentById(state.player.equipment.weapon);
    const sheet = playerSheet(family, weaponDef?.gearTier ?? 0);
    const finalSheet = this.textures.exists(sheet) ? sheet : playerSheet(family, 0);
    this.player = new Player(
      this, this.world, this.effects, null,
      { sheet: finalSheet, x: this.map.spawn.x, y: this.map.spawn.y, radius: 16, maxHealth: stats.maxHealth, speed: stats.moveSpeed, team: 'player', anchorY: 0.88 },
      stats, family, state.player.flaskCharges, state.player.flaskMax,
    );
    this.player.playAnim('idle', 0, true);
  }

  /** Redraw the settlement from the save: the home tier plus every structure. */
  private refreshBuildings(): void {
    for (const s of this.buildingSprites.values()) s.destroy();
    this.buildingSprites.clear();
    const state = getState();
    const key = buildingsKey(this.season);
    if (!this.textures.exists(key)) return;
    const frames = new Set(this.textures.get(key).getFrameNames());
    const lit = true;

    const tier = HOME_TIERS[Math.max(0, state.home.tier)]!;
    const tierMeta = buildingMeta(this.season, tier.art);
    const tierFrame = `${tier.art}_0_${lit ? 'lit' : 'dark'}`;
    if (frames.has(tierFrame)) {
      const wx = this.map.homeAnchor.x;
      const wy = this.map.homeAnchor.y;
      const p = this.world.screenFor(wx, wy);
      const img = this.add.image(p.x, p.y, key, tierFrame);
      img.setOrigin(tierMeta?.anchorX ?? 0.5, tierMeta?.anchorY ?? 0.9);
      img.setDepth(this.world.depthFor(wx, wy, 4));
      this.buildingSprites.set('__home', img);
    }

    for (const b of state.home.buildings) {
      const def = buildingById(b.id);
      if (!def) continue;
      const meta = buildingMeta(this.season, def.art);
      const variants = meta?.variants ?? 1;
      const frame = `${def.art}_${b.variant % variants}_${lit ? 'lit' : 'dark'}`;
      if (!frames.has(frame)) continue;
      const f = footprintOf(b);
      const wx = (this.map.plotOrigin.x + f.gx + f.w / 2) * TILE;
      const wy = (this.map.plotOrigin.y + f.gy + f.d / 2) * TILE;
      const p = this.world.screenFor(wx, wy);
      const img = this.add.image(p.x, p.y, key, frame);
      img.setOrigin(meta?.anchorX ?? 0.5, meta?.anchorY ?? 0.9);
      img.setDepth(this.world.depthFor(wx, wy, 2));
      this.buildingSprites.set(b.uid, img);
    }
  }

  private spawnResidents(): void {
    for (const r of this.residentSprites) r.sprite.destroy();
    this.residentSprites = [];
    const state = getState();
    state.home.residents.forEach((id, i) => {
      const def = RESIDENTS.find((r) => r.id === id);
      if (!def || !this.textures.exists(def.art)) return;
      const ang = (i / Math.max(1, state.home.residents.length)) * Math.PI * 2;
      const wx = this.map.homeAnchor.x + Math.cos(ang) * TILE * 3.2;
      const wy = this.map.homeAnchor.y + Math.sin(ang) * TILE * 3.2;
      const p = this.world.screenFor(wx, wy);
      const spr = this.add.sprite(p.x, p.y, def.art);
      spr.setOrigin(0.5, 0.88);
      spr.setDepth(this.world.depthFor(wx, wy));
      if (this.anims.exists(`${def.art}:idle_s`)) spr.play(`${def.art}:idle_s`);
      this.residentSprites.push({ id, sprite: spr, x: wx, y: wy, t: Math.random() * 6 });
    });
  }

  private buildHud(): void {
    this.promptText = this.add.text(0, 0, '', { fontFamily: FONT_BODY, fontSize: '15px', color: HEX.gold })
      .setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(DEPTH.hud).setVisible(false);
    this.promptText.setStroke(HEX.ink, 5);
    this.goalText = bodyText(this, 0, 0, '', 13, HEX.parchment).setScrollFactor(0).setDepth(DEPTH.hud);
    this.goalText.setStroke(HEX.ink, 4);

    this.buttons = [
      new Button(this, 0, 0, t('home.build'), () => this.toggleBuildPalette(), { width: 150, icon: 'plus' }),
      new Button(this, 0, 0, t('map.title'), () => this.openMap(), { width: 150, icon: 'map' }),
      new Button(this, 0, 0, t('home.rest'), () => this.rest(), { width: 150, icon: 'home' }),
      new Button(this, 0, 0, t('action.pause'), () => this.openMenu('pause'), { width: 56, height: 48, icon: 'pause' }),
    ];
    // The replay hub appears once there is replay content to reach.
    if (campaignComplete(getState()) || getState().campaign.cleared.length >= DEFENCE_CHALLENGE.unlockStage) {
      this.buttons.splice(2, 0, new Button(this, 0, 0, t('replay.title'), () => {
        play('ui_confirm');
        this.scene.start('Challenge', {});
      }, { width: 150, icon: 'star' }));
    }
    for (const b of this.buttons) b.setDepth(DEPTH.hud).container.setScrollFactor(0);
    this.updateGoals();
    this.layout();
  }

  private updateGoals(): void {
    const state = getState();
    const next = nextHomeTier(state);
    const improvements = suggestImprovements(state);
    const lines: string[] = [];
    const cal = calendarView(state);
    lines.push(`${t(SEASON_LABEL[cal.season])} · ${t('hud.day')} ${cal.day}/4 · ${t('season.next')}: ${t(SEASON_LABEL[cal.next])}`);
    lines.push(`${t('resource.gold')} ${state.resources.gold}   ${t('resource.wood')} ${state.resources.wood}   ${t('resource.stone')} ${state.resources.stone}   ${t('resource.iron')} ${state.resources.iron}   ${t('resource.shards')} ${state.resources.shards}`);
    if (next) lines.push(`${t('home.next_goal')}: ${t(next.nameKey)} — ${this.costLine(next.cost)}`);
    if (improvements.length) {
      lines.push(`${t('home.improvements')}: ${improvements.map((i) => i.kind === 'home' ? t(`home.tier.${i.id.replace('home_', '')}`) : t(`build.${i.id.replace('_segment', '').replace('storage_chest', 'storage').replace('ring_workbench', 'ringbench').replace('practice_dummy', 'dummy').replace('lantern_post', 'lantern').replace('banner_wall', 'banner').replace('path_stone', 'path').replace('trophy_display', 'trophy')}.name`)).join(', ')}`);
    }
    const effects = homeEffects(state);
    if (Object.keys(effects).length) {
      lines.push(`${t('ring.home_effect')}: ${Object.entries(effects).map(([k, v]) => `${k} +${Math.round(v * 100)}%`).join(', ')}`);
    }
    this.goalText.setText(lines.join('\n'));
  }

  private costLine(cost: Partial<Record<'gold' | 'wood' | 'stone' | 'iron' | 'shards', number>>): string {
    return (['gold', 'wood', 'stone', 'iron'] as const)
      .filter((k) => (cost[k] ?? 0) > 0)
      .map((k) => `${cost[k]} ${t(`resource.${k}`)}`)
      .join('  ');
  }

  private layout(): void {
    const cam = this.cameras.main;
    const w = cam.width, h = cam.height;
    this.goalText.setPosition(16, 14);
    this.promptText.setPosition(w / 2, h * 0.72);
    const compact = w < 720;
    this.buttons[0]?.setPosition(w / 2 - (compact ? 80 : 170), h - 40);
    this.buttons[1]?.setPosition(w / 2, h - 40);
    this.buttons[2]?.setPosition(w / 2 + (compact ? 80 : 170), h - 40);
    this.buttons[3]?.setPosition(w - 40, 34);
    this.buildPalette?.setPosition(w - 250, 90);
  }

  // ---------------------------------------------------------- build mode

  private toggleBuildPalette(): void {
    if (this.buildPalette) { this.closeBuildPalette(); return; }
    const state = getState();
    const cam = this.cameras.main;
    const avail = [...new Set(state.home.buildings.map((b) => b.id))];
    void avail;
    const list = buildingChoices(state);
    const rows: Phaser.GameObjects.GameObject[] = [];
    const panel = this.add.nineslice(0, 0, 'frames', 'panel_parchment', 236, Math.min(420, 44 + list.length * 34), 26, 26, 26, 26).setOrigin(0, 0);
    rows.push(panel);
    const title = this.add.text(14, 12, t('home.build'), { fontFamily: FONT_TITLE, fontSize: '17px', color: HEX.gold });
    rows.push(title);
    list.forEach((item, i) => {
      const y = 40 + i * 34;
      const label = this.add.text(16, y, `${t(item.nameKey)}`, { fontFamily: FONT_BODY, fontSize: '13px', color: item.affordable ? HEX.parchment : HEX.muted });
      const cost = this.add.text(16, y + 14, this.costLine(item.cost), { fontFamily: FONT_BODY, fontSize: '11px', color: HEX.muted });
      label.setInteractive({ useHandCursor: true });
      label.on('pointerup', () => this.startPlacing(item.id));
      rows.push(label, cost);
    });
    const upgrade = nextHomeTier(state);
    if (upgrade) {
      const y = 40 + list.length * 34;
      const btn = this.add.text(16, y, `▲ ${t('home.upgrade')}: ${t(upgrade.nameKey)}`, { fontFamily: FONT_BODY, fontSize: '13px', color: HEX.gold });
      btn.setInteractive({ useHandCursor: true });
      btn.on('pointerup', () => this.doUpgrade());
      rows.push(btn);
      panel.setSize(236, y + 40);
    }
    this.buildPalette = this.add.container(cam.width - 250, 90, rows).setScrollFactor(0).setDepth(DEPTH.hud + 10);
    play('ui_open');
  }

  private closeBuildPalette(): void {
    this.buildPalette?.destroy();
    this.buildPalette = null;
    this.cancelPlacing();
  }

  private startPlacing(id: string): void {
    this.build = { active: true, id, rotation: 0, movingUid: null };
    this.makeGhost(id);
    this.toaster.show(`${t('home.place')} · ${t('home.rotate')} [R] · ${t('menu.cancel')} [Esc]`, { icon: 'move', duration: 4200 });
  }

  private makeGhost(id: string): void {
    this.ghost?.destroy();
    const def = buildingById(id);
    if (!def) return;
    const key = buildingsKey(this.season);
    const meta = buildingMeta(this.season, def.art);
    const frame = `${def.art}_0_lit`;
    if (!this.textures.exists(key) || !this.textures.get(key).has(frame)) return;
    this.ghost = this.add.image(0, 0, key, frame);
    this.ghost.setOrigin(meta?.anchorX ?? 0.5, meta?.anchorY ?? 0.9);
    this.ghost.setAlpha(0.7);
    this.ghost.setDepth(DEPTH.overhead - 10);
  }

  private cancelPlacing(): void {
    this.build = { active: false, id: null, rotation: 0, movingUid: null };
    this.ghost?.destroy();
    this.ghost = null;
    this.gridGfx.clear();
  }

  private gridUnderPlayer(): { gx: number; gy: number } {
    const plot = plotSize(getState());
    const gx = Math.round(this.player.x / TILE - this.map.plotOrigin.x - 0.5);
    const gy = Math.round(this.player.y / TILE - this.map.plotOrigin.y - 0.5);
    return {
      gx: Phaser.Math.Clamp(gx, 0, Math.max(0, plot.w - 1)),
      gy: Phaser.Math.Clamp(gy, 0, Math.max(0, plot.d - 1)),
    };
  }

  private updateGhost(): void {
    if (!this.build.active || !this.build.id || !this.ghost) return;
    const state = getState();
    const { gx, gy } = this.gridUnderPlayer();
    const problem = validatePlacement(state, { id: this.build.id, gx, gy, rotation: this.build.rotation }, { ignoreUid: this.build.movingUid ?? undefined });
    const def = buildingById(this.build.id)!;
    const f = footprintOf({ id: def.id, gx, gy, rotation: this.build.rotation });
    const wx = (this.map.plotOrigin.x + f.gx + f.w / 2) * TILE;
    const wy = (this.map.plotOrigin.y + f.gy + f.d / 2) * TILE;
    const p = this.world.screenFor(wx, wy);
    this.ghost.setPosition(p.x, p.y);
    this.ghost.setTint(problem ? 0xc25a4a : 0x9fe8a0);
    this.ghost.setDepth(this.world.depthFor(wx, wy, 8));

    // Draw the footprint on the ground so placement reads clearly.
    this.gridGfx.clear();
    this.gridGfx.lineStyle(2, problem ? 0xc25a4a : 0x9fe8a0, 0.9);
    for (let y = 0; y < f.d; y++) {
      for (let x = 0; x < f.w; x++) {
        const cx = (this.map.plotOrigin.x + f.gx + x) * TILE;
        const cy = (this.map.plotOrigin.y + f.gy + y) * TILE;
        const a = this.world.screenFor(cx, cy);
        const b = this.world.screenFor(cx + TILE, cy);
        const c = this.world.screenFor(cx + TILE, cy + TILE);
        const d = this.world.screenFor(cx, cy + TILE);
        this.gridGfx.strokePoints([a, b, c, d, a], true);
      }
    }
    this.promptText.setText(problem ? t(`home.blocked_${problem === 'overlap' ? 'overlap' : problem === 'door' ? 'door' : problem === 'unreachable' ? 'unreachable' : 'outside'}`) : `${t('home.valid')} — [F] ${t('home.place')}`);
    this.promptText.setColor(problem ? HEX.danger : HEX.good);
    this.promptText.setVisible(true);
  }

  private confirmPlacement(): void {
    if (!this.build.active || !this.build.id) return;
    const state = getState();
    const { gx, gy } = this.gridUnderPlayer();
    if (this.build.movingUid) {
      const res = moveBuilding(state, this.build.movingUid, gx, gy, this.build.rotation);
      if (!res.ok) { play('build_deny'); return; }
      this.history.push({ kind: 'move', uid: this.build.movingUid });
      play('build_place');
    } else {
      const res = placeBuilding(state, this.build.id, gx, gy, this.build.rotation, 0);
      if (!res.ok) {
        play('build_deny');
        this.toaster.show(res.reason === 'cost' ? t('inv.cannot_afford') : t('home.invalid'), { colour: HEX.danger });
        return;
      }
      this.history.push({ kind: 'place', uid: res.uid });
      play('build_place');
    }
    this.cancelPlacing();
    this.refreshBuildings();
    this.updateGoals();
    void saveGame(state);
  }

  private doUpgrade(): void {
    const state = getState();
    const next = nextHomeTier(state);
    if (!next) return;
    const highest = state.campaign.cleared.length ? Math.max(...state.campaign.cleared) : 0;
    if (next.tier > 0 && highest < next.unlockStage) {
      this.toaster.show(t('map.locked_reason', next.unlockStage), { colour: HEX.danger });
      play('ui_deny');
      return;
    }
    const before = state.home.tier;
    const res = (async () => undefined)();
    void res;
    const { upgradeHome } = requireBuilding();
    const out = upgradeHome(state);
    if (!out.ok) {
      play('ui_deny');
      this.toaster.show(out.reason === 'cost' ? t('inv.cannot_afford') : t('common.locked'), { colour: HEX.danger });
      return;
    }
    play('build_place');
    this.toaster.show(t(next.nameKey), { icon: 'home', colour: HEX.gold });
    this.effects.play('light_pulse', this.map.homeAnchor.x, this.map.homeAnchor.y, { scale: 2 });
    this.closeBuildPalette();
    this.map = generateHome(state, this.season);
    this.refreshBuildings();
    this.updateGoals();
    void before;
    void saveGame(state);
  }

  // -------------------------------------------------------- interactions

  private checkInteract(): void {
    if (this.build.active) return;
    this.interact = null;
    let best = 96;
    const state = getState();
    for (const b of state.home.buildings) {
      const def = buildingById(b.id);
      if (!def) continue;
      const f = footprintOf(b);
      const wx = (this.map.plotOrigin.x + f.gx + f.w / 2) * TILE;
      const wy = (this.map.plotOrigin.y + f.gy + f.d / 2) * TILE;
      const d = Math.hypot(wx - this.player.x, wy - this.player.y);
      if (d < best) { best = d; this.interact = { kind: def.role, x: wx, y: wy, id: b.uid }; }
    }
    for (const r of this.residentSprites) {
      const d = Math.hypot(r.x - this.player.x, r.y - this.player.y);
      if (d < best) { best = d; this.interact = { kind: 'npc', x: r.x, y: r.y, id: r.id }; }
    }
    const dHome = Math.hypot(this.map.homeAnchor.x - this.player.x, this.map.homeAnchor.y - this.player.y);
    if (dHome < best) { best = dHome; this.interact = { kind: 'house', x: this.map.homeAnchor.x, y: this.map.homeAnchor.y }; }
    const dDepart = Math.hypot(this.map.departure.x - this.player.x, this.map.departure.y - this.player.y);
    if (dDepart < best) { this.interact = { kind: 'depart', x: this.map.departure.x, y: this.map.departure.y }; }

    if (this.interact && !this.build.active) {
      this.promptText.setText(`[${state.settings.keybinds.interact}] ${this.labelFor(this.interact.kind)}`);
      this.promptText.setColor(HEX.gold);
      this.promptText.setVisible(true);
    } else if (!this.build.active) {
      this.promptText.setVisible(false);
    }
  }

  private labelFor(kind: string): string {
    switch (kind) {
      case 'forge': return t('prompt.forge');
      case 'ringbench': return t('prompt.bench');
      case 'garden': return t('prompt.garden');
      case 'storage': return t('prompt.storage');
      case 'watchtower': return t('prompt.watch');
      case 'dummy': return t('prompt.dummy');
      case 'trophy': return t('prompt.trophy');
      case 'monument': return t('prompt.monument');
      case 'rest': return t('prompt.rest');
      case 'npc': return t('prompt.talk');
      case 'house': return t('prompt.enter');
      case 'depart': return t('prompt.depart');
      default: return t('prompt.interact');
    }
  }

  private doInteract(): void {
    if (this.build.active) { this.confirmPlacement(); return; }
    const i = this.interact;
    if (!i) return;
    play('ui_click');
    switch (i.kind) {
      case 'forge': this.openMenu('forge'); break;
      case 'ringbench': this.openMenu('rings'); break;
      case 'storage': this.openMenu('inventory'); break;
      case 'garden': this.collectGarden(); break;
      case 'watchtower': this.openMap(); break;
      case 'dummy': this.openMenu('dummy'); break;
      case 'trophy':
      case 'monument': this.openMenu('journal'); break;
      case 'rest': this.rest(); break;
      case 'house': this.openMenu('talents'); break;
      case 'depart': this.openMap(); break;
      case 'npc': this.talkTo(i.id!); break;
      default: break;
    }
  }

  private talkTo(id: string): void {
    const def = RESIDENTS.find((r) => r.id === id);
    if (!def) return;
    const line = def.lines[Math.floor(Math.random() * def.lines.length)]!;
    this.toaster.show(`${t(def.nameKey)}: ${t(line)}`, { icon: 'home', duration: 5200 });
  }

  private collectGarden(): void {
    const state = getState();
    const effects = homeEffects(state);
    const bonus = 1 + (effects.gardenYield ?? 0);
    const key = `garden:${state.calendar.totalDays}`;
    if (state.campaign.claimedRewards.includes(key)) {
      this.toaster.show(t('home.rest_note'));
      return;
    }
    state.campaign.claimedRewards.push(key);
    const wood = Math.round((4 + state.home.tier * 3) * bonus);
    const stone = Math.round((2 + state.home.tier * 2) * bonus);
    state.resources.wood += wood;
    state.resources.stone += stone;
    play('pickup_mat');
    this.toaster.show(`+${wood} ${t('resource.wood')}  +${stone} ${t('resource.stone')}`, { icon: 'wood' });
    this.updateGoals();
    void saveGame(state);
  }

  private rest(): void {
    const state = getState();
    const res = advanceDay(state);
    state.player.flaskCharges = state.player.flaskMax;
    this.player.flask = state.player.flaskMax;
    play('ui_confirm');
    this.toaster.show(t('season.advance'), { icon: 'home' });
    if (res.seasonChanged) {
      this.toaster.show(t('season.changed'), { icon: SEASON_LABEL[res.to].split('.')[1] ?? 'star', colour: HEX.winter });
      this.scene.restart();
      return;
    }
    this.updateGoals();
    void saveGame(state);
  }

  private openMap(): void {
    phase.set('HOME');
    this.scene.start('Map', {});
  }

  private openMenu(tab: string): void {
    this.scene.launch('Menu', { tab, from: 'Home' });
    this.scene.pause();
  }

  // ------------------------------------------------------------- update

  override update(_time: number, delta: number): void {
    if (!this.player) return;
    if (phase.isPaused) return;
    this.input2.update();
    const steps = this.stepper.advance(delta);
    for (let i = 0; i < steps; i++) {
      const dt = this.stepper.step;
      const mv = this.input2.move();
      const aim = this.input2.aim(this.player.x, this.player.y);
      this.player.aimAt(aim.worldX, aim.worldY);
      this.player.moveInput(mv.x, mv.y, dt);
      this.player.x = Phaser.Math.Clamp(this.player.x, TILE, this.map.worldW - TILE);
      this.player.y = Phaser.Math.Clamp(this.player.y, TILE, this.map.worldH - TILE);
      this.player.step(dt);
      this.player.updateAnim(mv.magnitude > 0.05, false);

      if (this.input2.justPressed('interact')) this.doInteract();
      if (this.input2.justPressed('pause')) {
        if (this.build.active) this.cancelPlacing();
        else this.openMenu('pause');
      }
      if (this.input2.justPressed('inventory')) this.openMenu('inventory');
      if (this.input2.justPressed('map')) this.openMap();
      if (this.build.active && this.input2.justPressed('build')) this.build.rotation = ((this.build.rotation + 1) % 4) as 0 | 1 | 2 | 3;
      if (this.build.active) this.updateGhost();
      this.checkInteract();
      for (const r of this.residentSprites) r.t += dt;
    }
    this.player.render();
    this.weather.update(delta / 1000, 10, 60);
    this.input2.endFrame();
  }

  /** Rotate and undo are bound to R and Z while building. */
  private setupBuildKeys(): void {
    this.input.keyboard?.on('keydown-R', () => {
      if (this.build.active) {
        this.build.rotation = ((this.build.rotation + 1) % 4) as 0 | 1 | 2 | 3;
        play('ui_click');
      }
    });
    this.input.keyboard?.on('keydown-Z', () => {
      if (!this.history.canUndo()) return;
      this.history.undo(getState());
      this.refreshBuildings();
      this.updateGoals();
      play('ui_close');
      this.toaster.show(t('home.undo'), { icon: 'undo' });
    });
    this.input.keyboard?.on('keydown-X', () => {
      if (!this.interact?.id || this.build.active) return;
      const state = getState();
      const b = state.home.buildings.find((x) => x.uid === this.interact!.id);
      if (!b) return;
      this.history.push({ kind: 'remove', uid: b.uid, before: { ...b } });
      removeBuilding(state, b.uid);
      this.refreshBuildings();
      this.updateGoals();
      play('ui_close');
      this.toaster.show(t('home.refund'), { icon: 'trash' });
      void saveGame(state);
    });
  }

  private cleanup(): void {
    this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.input2?.destroy();
    this.effects?.destroy();
    this.weather?.clear();
    this.world?.destroy();
    for (const s of this.buildingSprites.values()) s.destroy();
    this.buildingSprites.clear();
    for (const r of this.residentSprites) r.sprite.destroy();
    this.residentSprites = [];
    this.events.removeAllListeners();
  }

  init(): void {
    this.events.once(Phaser.Scenes.Events.CREATE, () => this.setupBuildKeys());
  }
}

function buildingChoices(state: ReturnType<typeof getState>) {
  const { availableBuildings, hasBuilding } = requireBuilding();
  return availableBuildings(state)
    .filter((b) => !(b.unique && hasBuilding(state, b.id)))
    .map((b) => ({
      id: b.id,
      nameKey: b.nameKey,
      cost: b.cost,
      affordable: (['gold', 'wood', 'stone', 'iron'] as const).every((k) => state.resources[k] >= (b.cost[k] ?? 0)),
    }));
}

/** Late import indirection keeps the module graph acyclic. */
function requireBuilding() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return buildingModule;
}

import * as buildingModule from '@/systems/building';
void PALETTE;
void worldToScreen;
