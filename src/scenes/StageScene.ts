import Phaser from 'phaser';
import type { ResourceBundle, RingSlot, Season } from '@/types';
import { stageById } from '@/content/stages';
import { bossByStage } from '@/content/bosses';
import { enemyById, scaleEnemy, PROJECTILES } from '@/content/enemies';
import { equipmentById } from '@/content/equipment';
import { t } from '@/content/locale';
import { getState, update as updateState } from '@/systems/state';
import { deriveStats, difficultyOf, weaponFamilyOf } from '@/systems/progression';
import { supportBonuses, ringPower, ACTIVE_SLOTS } from '@/systems/rings';
import { castRing, createRuntime, tickRuntime, type CombatWorld, type CombatTarget, type RingRuntime } from '@/systems/ringcast';
import { shapeHits, type AttackShape, type Status } from '@/systems/combat';
import { seasonProfile, seasonDamageModifier } from '@/systems/seasons';
import { InputManager } from '@/systems/input';
import { phase, FixedStep } from '@/systems/gamestate';
import { REGION_BUNDLE, loadBundle, playerSheet, gearBundle, registerAnimations } from '@/systems/assets';
import { generateStage, isBlockedAt, type StageMap, type NodeSpawn } from '@/world/stagegen';
import { generateHome, type HomeMap } from '@/world/homegen';
import { DEFENCE_CHALLENGE } from '@/content/buildings';
import { WorldRenderer, WeatherLayer, DEPTH } from '@/world/renderer';
import { EffectPool, FloatingText } from '@/entities/effects';
import { Player } from '@/entities/player';
import { Enemy } from '@/entities/enemy';
import { Boss } from '@/entities/boss';
import { EscortCart } from '@/entities/cart';
import { ProjectilePool } from '@/entities/projectile';
import { play, panFor } from '@/audio/library';
import { music, ambience } from '@/audio/music';
import { TILE, normalise } from '@/systems/iso';
import { completeStage, setCheckpoint, claimExploration, recordBestiary, type CompletionResult } from '@/systems/campaign';
import { grant } from '@/systems/economy';
import {
  completeChallenge, advanceGauntlet, bossBoard, hardStages, gauntletEntry,
  GAUNTLET_STAGES, type GauntletRun, type ChallengeEntry,
} from '@/systems/replay';
import { saveGame } from '@/systems/save';
import { claimRunReward, rewardId } from '@/systems/economy';
import { discoverRing } from '@/systems/rings';

export interface StageSceneData {
  stage: number;
  tutorial?: boolean;
  resume?: boolean;
  hard?: boolean;
  fresh?: boolean;
  /** Replay challenge: this run scores against the challenge board, not the campaign. */
  challenge?: ChallengeRun;
  /** Settlement defence: capped waves at home, nothing at stake. */
  defence?: boolean;
  /** Development fixture: skip the approach and open at the boss door. */
  fixture?: { stage: number; atBoss: boolean };
}

/** A replay run in progress. The gauntlet carries its state between fights. */
export interface ChallengeRun {
  id: string;
  kind: 'boss' | 'hard' | 'gauntlet';
  run?: GauntletRun;
}

/**
 * The settlement defence: a fixed number of waves, started deliberately from
 * the challenge board. Failing costs nothing - no structure is damaged, no
 * resource is lost - so it can never become a thing the player must defend
 * against on a schedule.
 */
interface DefenceState {
  wave: number;
  waves: number;
  spawnedThisWave: number;
  restUntil: number;
  lost: boolean;
}

interface GroundHazard {
  kind: string;
  x: number; y: number; radius: number;
  time: number; damage: number;
  tickTimer: number;
  sprite: Phaser.GameObjects.Sprite | null;
  armed: boolean;
  /** For rotating sector mechanics. */
  sector?: number;
}

interface RootPatch { x: number; y: number; radius: number; time: number; power: number; sprite: Phaser.GameObjects.Sprite | null }
interface ShadowDecoy { x: number; y: number; time: number; sprite: Phaser.GameObjects.Sprite | null }

type StageNode = NodeSpawn & {
  done: boolean;
  sprite: Phaser.GameObjects.Sprite | null;
  prompt: Phaser.GameObjects.Text | null;
};

/** The action scene: exploration, encounters, the objective and the boss. */
export class StageScene extends Phaser.Scene {
  private stageId = 1;
  private tutorial = false;
  private hardMode = false;
  private season: Season = 'spring';
  private map!: StageMap;
  private world!: WorldRenderer;
  private effects!: EffectPool;
  private floaters!: FloatingText;
  private weather!: WeatherLayer;
  private input2!: InputManager;
  private stepper = new FixedStep(60);
  private player!: Player;
  private enemies: Enemy[] = [];
  private boss: Boss | null = null;
  private projectiles!: ProjectilePool;
  private hazards: GroundHazard[] = [];
  private roots: RootPatch[] = [];
  private decoys: ShadowDecoy[] = [];
  private ringRuntimes: Record<RingSlot, RingRuntime | null> = { active1: null, active2: null, support1: null, support2: null };
  private nodes: StageNode[] = [];
  private objectiveDone = 0;
  private objectiveTotal = 1;
  private bossSpawned = false;
  private bossDefeated = false;
  private inBossFight = false;
  private runBanked: string[] = [];
  private elapsedMs = 0;
  private startFlask = 3;
  private hitStopUntil = 0;
  private silencedUntil = 0;
  private tutorialStep = 0;
  private interactTarget: { node?: StageNode; prop?: { id: string; x: number; y: number }; kind: string } | null = null;
  private groundLayer!: Phaser.GameObjects.Graphics;
  private exitArmed = false;
  private pendingComplete = false;
  private lastSaveAt = 0;
  private fixture: { stage: number; atBoss: boolean } | null = null;
  private challenge: ChallengeRun | null = null;
  private defence: DefenceState | null = null;
  private cart: EscortCart | null = null;
  /**
   * Diagnostics for the verification scripts: how many boss attack shapes were
   * resolved, and how much damage the player actually took during the run from
   * any enemy source - melee shapes, projectiles and ground hazards alike.
   */
  bossHitsResolved = 0;
  bossDamageTaken = 0;

  constructor() { super('Stage'); }

  init(data: StageSceneData): void {
    this.stageId = data.stage ?? 1;
    this.tutorial = data.tutorial ?? false;
    this.challenge = data.challenge ?? null;
    this.hardMode = data.hard ?? this.challenge?.kind === 'hard';
    this.enemies = [];
    this.boss = null;
    this.hazards = [];
    this.roots = [];
    this.decoys = [];
    this.nodes = [];
    this.objectiveDone = 0;
    this.bossSpawned = false;
    this.bossDefeated = false;
    this.inBossFight = false;
    this.runBanked = [];
    this.elapsedMs = 0;
    this.pendingComplete = false;
    this.exitArmed = false;
    this.tutorialStep = 0;
    this.fixture = data.fixture ?? null;
    this.defence = data.defence
      ? { wave: 0, waves: DEFENCE_CHALLENGE.waves, spawnedThisWave: 0, restUntil: 2.5, lost: false }
      : null;
    this.cart = null;
  }

  async create(): Promise<void> {
    const state = getState();
    const def = stageById(this.stageId);
    if (!def) { this.scene.start('Title', {}); return; }
    this.season = state.calendar.season;

    // Region and gear bundles load on demand. The defence draws its raiders
    // from the borderland set, which is not part of the core bundle.
    const bundles = [this.defence ? REGION_BUNDLE.borderland : REGION_BUNDLE[def.region]];
    const weaponDef = equipmentById(state.player.equipment.weapon);
    const gb = gearBundle(weaponDef?.gearTier ?? 0);
    if (gb) bundles.push(gb);
    for (const b of bundles) {
      try {
        await loadBundle(this, b, (p) => this.events.emit('loadprogress', p));
      } catch (err) {
        console.error('[assets]', err);
      }
    }
    registerAnimations(this);

    this.map = this.defence ? generateHome(state, this.season) : generateStage(def, this.season);
    this.world = new WorldRenderer(this, this.defence ? 'home' : def.region, this.season);
    this.world.drawGround(this.map);
    this.effects = new EffectPool(this, this.world, state.settings.particleQuality);
    this.floaters = new FloatingText(this, this.world);
    this.groundLayer = this.add.graphics().setDepth(DEPTH.groundDecal);
    this.world.addProps(this.map);
    this.projectiles = new ProjectilePool(this, this.world);
    this.weather = new WeatherLayer(this, state.settings.seasonalEffects);
    const prof = seasonProfile(this.season);
    if (state.settings.seasonalEffects > 0 && prof.weather) {
      this.weather.set(prof.weather, prof.ambientAlpha + 0.18);
    }

    this.input2 = new InputManager(this, state.settings);
    this.spawnPlayer();
    this.spawnWorld();
    this.setupRings();

    this.objectiveTotal = this.defence ? this.defence.waves : def.objective.count;
    if (!this.defence && def.objective.kind === 'escort') this.spawnCart();
    this.startFlask = state.player.flaskCharges;

    const cam = this.cameras.main;
    cam.setBackgroundColor(0x141a18);
    cam.startFollow(this.player.sprite, true, 0.12, 0.12);
    cam.setZoom(this.computeZoom());
    cam.setDeadzone(60, 40);

    phase.set('EXPLORING');
    this.scene.launch('UI', { stage: this.stageId });
    music.play(def.region);
    ambience.play(this.season);

    this.events.on('ui:ring', (slot: RingSlot) => this.castSlot(slot));
    this.events.on('ui:heal', () => this.player.drinkFlask());
    this.events.on('ui:interact', () => this.tryInteract());
    this.events.on('ui:pause', () => this.openPause());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.game.events.on(Phaser.Core.Events.HIDDEN, this.onHidden, this);
    this.game.events.on(Phaser.Core.Events.VISIBLE, this.onVisible, this);

    if (this.defence) this.events.emit('toast', t('replay.defence_note'), 'shield', 5200);
    if (this.fixture) this.applyFixture();
    else if (this.challenge && this.challenge.kind !== 'hard') this.openAtBoss();
    if (this.challenge?.run) this.applyGauntletCarry(this.challenge.run);
    if (this.tutorial) this.events.emit('tutorial', 'tutorial.move');
    this.events.emit('stage:ready', {
      stage: this.stageId, objective: def.objective, season: this.season,
      objectiveDone: 0, objectiveTotal: this.objectiveTotal,
    });
  }

  /**
   * Development fixture: complete the objective, drop the player at the boss
   * door and clear the approach so the arena can be inspected immediately.
   */
  private applyFixture(): void {
    this.openAtBoss();
    this.events.emit('toast', `fixture: stage ${this.stageId}`, 'skull', 3200);
  }

  /**
   * Clears the approach and puts the player at the boss door. Used by the
   * development fixtures and by boss-board and gauntlet challenge runs, where
   * the point is the fight, not the walk to it.
   */
  private openAtBoss(): void {
    for (const node of this.nodes) {
      if (node.kind === 'objective' || node.kind === 'escortStop') {
        node.done = true;
        node.sprite?.destroy();
        this.objectiveDone++;
      }
    }
    this.exitArmed = true;
    if (this.fixture && !this.fixture.atBoss) return;
    for (const e of this.enemies) e.destroy();
    this.enemies.length = 0;
    const door = this.nodes.find((n) => n.kind === 'bossdoor');
    if (door) {
      this.player.x = door.x - TILE;
      this.player.y = door.y;
    }
  }

  // ---------------------------------------------------------------- escort

  /**
   * Puts the cart at the stage entrance. Its health scales with the stage so
   * it is a real thing to protect without being a timer in disguise.
   */
  private spawnCart(): void {
    const stops = this.nodes.filter((n) => n.kind === 'escortStop');
    if (stops.length === 0) return;
    this.cart = new EscortCart(
      this, this.world, this.season,
      this.map.entrance.x * TILE + TILE, this.map.entrance.y * TILE,
      420 + this.stageId * 26,
    );
    this.events.emit('toast', t('escort.start'), 'move', 5200);
  }

  /**
   * Rolls the cart toward its next stop and reports arrivals. A broken cart
   * stops where it stands and repairs itself, so a failed defence costs time,
   * never progress.
   */
  private stepCart(dt: number): void {
    const cart = this.cart;
    if (!cart) return;
    const stops = this.nodes.filter((n) => n.kind === 'escortStop');
    const next = stops.find((n) => !n.done) ?? null;
    const moved = cart.step(dt, next, this.player, (x, y) => isBlockedAt(this.map, x, y));
    if (moved.repaired) {
      this.events.emit('toast', t('escort.repaired'), 'check', 3600);
      play('checkpoint');
    }
    if (moved.arrived && next) {
      cart.repairAtStop();
      this.completeNode(next);
      this.events.emit('toast', t('escort.stop_reached'), 'check', 3200);
    }
    // Raiders that reach the cart batter it instead of chasing past it.
    for (const e of this.enemies) {
      if (!e.alive || cart.broken) continue;
      const d = Math.hypot(e.x - cart.x, e.y - cart.y);
      if (d < cart.radius + e.radius + 6) {
        const dealt = cart.takeDamage(e.def.damage * dt * 0.7);
        if (dealt > 0 && cart.broken) {
          this.events.emit('toast', t('escort.broken'), 'skull', 4200);
          play('player_die', { volume: 0.4 });
        }
      }
    }
    this.events.emit('escort', {
      health: cart.health, maxHealth: cart.maxHealth,
      broken: cart.broken, moving: cart.moving,
      done: this.objectiveDone, total: this.objectiveTotal,
    });
  }

  // ------------------------------------------------------- settlement defence

  /**
   * Runs the wave clock. Raiders walk in from the edge of the plot and head for
   * the player; a wave ends when every raider in it is down, and the run ends
   * after a fixed number of waves. There is no fail state beyond the player
   * falling, and nothing in the settlement can be damaged.
   */
  private stepDefence(dt: number): void {
    const d = this.defence!;
    if (this.pendingComplete) return;
    if (d.restUntil > 0) {
      d.restUntil -= dt;
      if (d.restUntil <= 0) this.startDefenceWave();
      return;
    }
    if (this.enemies.length > 0) return;
    // Wave cleared.
    if (d.wave >= d.waves) { this.finishStage(); return; }
    d.restUntil = 6;
    this.events.emit('toast', t('hud.wave_clear'), 'check', 2600);
    play('checkpoint');
  }

  private startDefenceWave(): void {
    const d = this.defence!;
    d.wave += 1;
    const state = getState();
    const diff = difficultyOf(state);
    const level = Math.min(30, 16 + d.wave * 2);
    const pool = DEFENCE_CHALLENGE.waveEnemies.slice(0, Math.min(DEFENCE_CHALLENGE.waveEnemies.length, 2 + d.wave));
    const count = 3 + Math.floor(d.wave * 1.4);
    const home = this.map as HomeMap;
    const centre = { x: home.homeAnchor.x, y: home.homeAnchor.y };
    for (let i = 0; i < count; i++) {
      const id = pool[(i + d.wave) % pool.length]!;
      const base = enemyById(id);
      if (!base) continue;
      const ang = (i / count) * Math.PI * 2 + d.wave * 0.7;
      const radius = TILE * 9;
      let x = centre.x + Math.cos(ang) * radius;
      let y = centre.y + Math.sin(ang) * radius;
      // Nudge off any blocked tile so nothing spawns inside scenery.
      for (let tries = 0; tries < 8 && isBlockedAt(this.map, x, y); tries++) {
        x = centre.x + Math.cos(ang) * (radius - tries * TILE * 0.7);
        y = centre.y + Math.sin(ang) * (radius - tries * TILE * 0.7);
      }
      const scaled = scaleEnemy(base, level);
      const elite = d.wave >= d.waves && i === 0;
      const enemy = new Enemy(
        this, this.world, this.effects, this.map,
        { ...scaled, health: Math.round(scaled.health * diff.enemyHealth) },
        x, y, d.wave, elite, diff.telegraphScale,
      );
      this.enemies.push(enemy);
    }
    d.spawnedThisWave = count;
    this.objectiveDone = d.wave - 1;
    this.events.emit('objective', {
      done: this.objectiveDone, total: this.objectiveTotal, key: 'replay.defence',
    });
    this.events.emit('toast', t('replay.defence_wave', d.wave, d.waves), 'skull', 3200);
    play('boss_intro', { volume: 0.5 });
    music.setIntensity(0.5 + d.wave / d.waves * 0.5);
  }

  /**
   * The defence pays cosmetic banners and a modest purse, and records nothing
   * that could be lost. A defeat here ends the run without a campaign death.
   */
  private finishDefence(survived: boolean): void {
    const state = getState();
    const d = this.defence!;
    state.player.flaskCharges = state.player.flaskMax;
    let granted: ResourceBundle = {};
    if (survived) {
      if (!state.replay.banners.includes('watch')) state.replay.banners.push('watch');
      granted = grant(state, { gold: 600 + 90 * d.waves, shards: 20 });
    }
    updateState(() => { /* notify listeners */ });
    void saveGame(state);
    this.scene.stop('UI');
    this.scene.start('Result', {
      stage: this.stageId,
      result: {
        granted, xp: 0, levels: 0, ringDiscovered: null, duplicateShards: 0,
        slotUnlocked: null, residentRescued: null, monumentUnlocked: false,
        seasonChanged: false, firstClear: false, trophy: null,
      } satisfies CompletionResult,
      explore: {},
      elapsedMs: this.elapsedMs,
      bossDefeated: survived,
      defence: { survived, waves: survived ? d.waves : d.wave, total: d.waves },
    });
  }

  /** The gauntlet carries health and flask charges from the previous fight. */
  private applyGauntletCarry(run: GauntletRun): void {
    this.player.health = Math.max(1, Math.round(this.player.maxHealth * Phaser.Math.Clamp(run.carryHealth, 0.15, 1)));
    this.player.flask = Math.max(0, Math.min(this.player.flaskMax, run.flask));
    this.events.emit('toast', t('replay.gauntlet_progress', run.index + 1, GAUNTLET_STAGES.length), 'guardian', 3600);
  }

  // --------------------------------------------------------------- setup

  private computeZoom(): number {
    const cam = this.cameras.main;
    const base = Math.min(cam.width / 900, cam.height / 560);
    return Phaser.Math.Clamp(base * 1.55, 0.85, 1.85);
  }

  private spawnPlayer(): void {
    const state = getState();
    const support = supportBonuses(state, deriveStats(state).supportPower);
    const stats = deriveStats(state, support);
    const family = weaponFamilyOf(state);
    const weaponDef = equipmentById(state.player.equipment.weapon);
    const sheet = playerSheet(family, weaponDef?.gearTier ?? 0);
    const finalSheet = this.textures.exists(sheet) ? sheet : playerSheet(family, 0);
    this.player = new Player(
      this, this.world, this.effects, this.map,
      { sheet: finalSheet, x: this.map.entrance.x * TILE, y: this.map.entrance.y * TILE, radius: 16, maxHealth: stats.maxHealth, speed: stats.moveSpeed, team: 'player', anchorY: 0.88 },
      stats, family, state.player.flaskCharges + difficultyOf(state).flaskBonus, state.player.flaskMax + difficultyOf(state).flaskBonus,
    );
    this.player.playAnim('idle', 0, true);
  }

  private spawnWorld(): void {
    const def = stageById(this.stageId)!;
    const state = getState();
    const diff = difficultyOf(state);
    // The defence field starts clear; everything arrives in waves.
    if (this.defence) return;
    for (const e of this.map.enemies) {
      const base = enemyById(e.id);
      if (!base) continue;
      const scaled = scaleEnemy(base, this.hardMode ? this.stageId + 6 : this.stageId);
      const enemy = new Enemy(
        this, this.world, this.effects, this.map,
        { ...scaled, health: Math.round(scaled.health * diff.enemyHealth) },
        e.x, e.y, e.group, e.elite, diff.telegraphScale,
      );
      this.enemies.push(enemy);
      recordBestiary(state, e.id);
    }
    for (const n of this.map.nodes) {
      const entry = { ...n, done: false, sprite: null as Phaser.GameObjects.Sprite | null, prompt: null as Phaser.GameObjects.Text | null };
      if (n.kind === 'objective' || n.kind === 'cache' || n.kind === 'escortStop' || n.kind === 'ringsight') {
        const p = this.world.screenFor(n.x, n.y);
        const frame = n.kind === 'cache' ? 'mat_pickup_0' : n.kind === 'ringsight' ? 'ringsight_glint_0' : 'interact_ping_0';
        const spr = this.add.sprite(p.x, p.y, 'vfx', frame);
        spr.setDepth(this.world.depthFor(n.x, n.y, 4));
        if (this.anims.exists(`vfx:${frame.replace(/_\d+$/, '')}`)) {
          spr.play({ key: `vfx:${frame.replace(/_\d+$/, '')}`, repeat: -1 });
        }
        if (n.kind === 'ringsight') {
          const need = n.data ?? '';
          const held = ACTIVE_SLOTS.some((s) => state.ringSlots[s] === need)
            || state.ringSlots.support1 === need || state.ringSlots.support2 === need;
          spr.setVisible(held);
        }
        entry.sprite = spr;
      }
      this.nodes.push(entry);
    }
    // The first ring is guaranteed within the first couple of minutes.
    const def1 = def.firstClear.ringId;
    if (def1 && !getState().rings[def1]?.discovered) {
      const anchor = this.nodes.find((n) => n.kind === 'objective') ?? this.nodes[0]!;
      const p = this.world.screenFor(anchor.x + TILE * 1.4, anchor.y);
      const spr = this.add.sprite(p.x, p.y, 'vfx', 'ring_pickup_0');
      if (this.anims.exists('vfx:ring_pickup')) spr.play({ key: 'vfx:ring_pickup', repeat: -1 });
      spr.setDepth(this.world.depthFor(anchor.x + TILE * 1.4, anchor.y, 6));
      this.nodes.push({
        kind: 'objective', id: `ring:${this.stageId}`, x: anchor.x + TILE * 1.4, y: anchor.y,
        data: `ring:${def1}`, done: false, sprite: spr, prompt: null,
      });
    }
  }

  private setupRings(): void {
    const state = getState();
    for (const slot of ACTIVE_SLOTS) {
      const id = state.ringSlots[slot];
      this.ringRuntimes[slot] = id ? createRuntime(id) : null;
    }
  }

  // ------------------------------------------------------------ main loop

  override update(time: number, delta: number): void {
    if (!this.player) return;
    if (phase.isPaused) return;
    if (time < this.hitStopUntil) { this.renderAll(); return; }

    this.input2.update();
    const steps = this.stepper.advance(delta);
    for (let i = 0; i < steps; i++) this.fixedStep(this.stepper.step);
    this.elapsedMs += delta;
    this.renderAll();
    this.input2.endFrame();

    if (time - this.lastSaveAt > 30000 && !this.inBossFight) {
      this.lastSaveAt = time;
      void saveGame(getState());
    }
  }

  private fixedStep(dt: number): void {
    const state = getState();
    if (this.silencedUntil > 0) this.silencedUntil = Math.max(0, this.silencedUntil - dt);

    // ------------------------------------------------------------- player
    const p = this.player;
    if (p.alive) {
      const mv = this.input2.move();
      const aim = this.input2.aim(p.x, p.y);
      p.aimAt(aim.worldX, aim.worldY);
      p.moveInput(mv.x, mv.y, dt);
      p.separateFrom([...this.enemies, ...(this.boss ? [this.boss] : [])]);

      if (this.input2.justPressed('attack')) this.playerAttack();
      if (this.input2.justPressed('secondary')) p.startSecondary();
      if (this.input2.justReleased('secondary')) this.releaseSecondary();
      if (this.input2.justPressed('dodge')) {
        if (p.tryDodge()) this.effects.play('dash_trail', p.x, p.y, { angle: Math.atan2(p.facing.y, p.facing.x) });
      }
      if (this.input2.justPressed('ring1')) this.castSlot('active1');
      if (this.input2.justPressed('ring2')) this.castSlot('active2');
      if (this.input2.justPressed('heal')) p.drinkFlask();
      if (this.input2.justPressed('interact')) this.tryInteract();
      if (this.input2.justPressed('pause')) this.openPause();
      if (this.input2.justPressed('inventory')) this.openMenu('inventory');
      if (this.input2.justPressed('map')) this.openMenu('journal');

      p.updateAnim(mv.magnitude > 0.05, mv.magnitude > 0.85 && p.phase === 'move');
      if (p.pendingHit) this.resolvePlayerHit();
    }
    p.step(dt);
    if (!p.alive && phase.current !== 'DEFEATED') this.onPlayerDeath();

    for (const slot of ACTIVE_SLOTS) {
      const rt = this.ringRuntimes[slot];
      if (rt) tickRuntime(rt, dt);
    }

    // ------------------------------------------------------------ enemies
    const blocked = (x: number, y: number) => isBlockedAt(this.map, x, y);
    const lure = this.decoys.length ? this.decoys[0]! : null;
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i]!;
      e.step(dt);
      if (!e.alive) {
        if (e.sprite.anims.getProgress() >= 0.98 || !e.sprite.anims.isPlaying) {
          this.onEnemyDeath(e);
          this.enemies.splice(i, 1);
        }
        continue;
      }
      const targetPos = lure ? { x: lure.x, y: lure.y, alive: true } : { x: p.x, y: p.y, alive: p.alive };
      e.think(dt, targetPos, blocked);
      e.separateFrom(this.enemies);
      if (e.attackRequest) {
        this.applyEnemyAttack(e.attackRequest.shape, e.attackRequest.damage, e.attackRequest.poise);
        e.attackRequest = null;
      }
      if (e.projectileRequest) {
        const r = e.projectileRequest;
        this.projectiles.spawn({ kind: r.kind, x: r.x, y: r.y, dx: r.dx, dy: r.dy, damage: r.damage, team: 'enemy', source: 'weapon' });
        e.projectileRequest = null;
      }
    }

    // --------------------------------------------------------------- boss
    if (this.boss) this.stepBoss(dt);

    // -------------------------------------------------------- projectiles
    this.projectiles.step(dt, this.map);
    this.resolveProjectiles();

    // ----------------------------------------------------------- hazards
    this.stepHazards(dt);
    this.stepRoots(dt);
    this.stepDecoys(dt);

    // ---------------------------------------------------------- triggers
    if (this.cart) this.stepCart(dt);
    if (this.defence) this.stepDefence(dt);
    this.checkTriggers();
    void state;
  }

  private renderAll(): void {
    this.player.render();
    this.cart?.render();
    for (const e of this.enemies) e.render();
    this.boss?.render();
    this.projectiles.render();
    this.weather.update(this.game.loop.delta / 1000);
    this.drawGroundDecals();
    this.events.emit('hud', this.hudSnapshot());
  }

  // ------------------------------------------------------------- combat

  private playerAttack(): void {
    const p = this.player;
    if (p.weapon.family === 'bow') {
      if (!p.canAct) return;
      p.tryAttack();
      const n = p.facing;
      const dmg = Math.round(p.stats.attack * (1 + p.stats.weaponDamage));
      this.projectiles.spawn({ kind: 'player_arrow', x: p.x, y: p.y, dx: n.x, dy: n.y, damage: dmg, team: 'player', source: 'weapon' });
      return;
    }
    p.tryAttack();
  }

  private releaseSecondary(): void {
    const res = this.player.releaseSecondary();
    if (!res) return;
    const p = this.player;
    const n = p.facing;
    const dmg = Math.round(p.stats.attack * (1 + p.stats.weaponDamage) * (1 + res.charged * (0.7 + p.stats.chargedShot)));
    this.projectiles.spawn({ kind: 'player_arrow', x: p.x, y: p.y, dx: n.x, dy: n.y, damage: dmg, team: 'player', source: 'weapon' });
    play('bow_release', { volume: 0.9 });
  }

  /** Resolve a live player swing against everything in range. */
  private resolvePlayerHit(): void {
    const p = this.player;
    const hit = p.pendingHit;
    if (!hit) return;
    p.pendingHit = null;
    const shape: AttackShape = { ...hit.shape, x: p.x, y: p.y, angle: Math.atan2(p.facing.y, p.facing.x) };
    const damage = Math.round(p.stats.attack * hit.damage * (1 + p.stats.weaponDamage));
    let connected = false;
    const targets: (Enemy | Boss)[] = [...this.enemies, ...(this.boss ? [this.boss] : [])];
    for (const target of targets) {
      if (!target.alive || !shapeHits(shape, target)) continue;
      connected = true;
      const reduction = target instanceof Enemy ? target.damageReduction(p.x, p.y) : (target as Boss).damageReduction(p.x, p.y);
      const behindBonus = this.isBehind(target) ? 1 + p.stats.backstabDamage : 1;
      const weak = target instanceof Boss ? target.weakPointMultiplier() : 1;
      const dealt = target.takeDamage({
        amount: Math.round(damage * behindBonus * weak),
        source: 'weapon', fromX: p.x, fromY: p.y,
        poise: hit.poise * p.stats.staggerPower,
      }, reduction);
      if (dealt > 0) {
        this.floaters.show(target.x, target.y, String(dealt), weak > 1 ? '#FFD9A0' : '#E4D8BC', weak > 1 ? 18 : 15);
        this.effects.play('impact', target.x, target.y);
        this.effects.play('hit_spark', target.x, target.y);
        play(reduction > 0.4 ? 'hit_shield' : 'hit_flesh', { pan: panFor(target.screenX - this.cameras.main.scrollX, this.cameras.main.width) });
        // Ringkeeper "struck sparks": weapon hits shorten ring cooldowns.
        if (p.stats.ringOnHitCdr > 0) {
          for (const slot of ACTIVE_SLOTS) this.ringRuntimes[slot]?.cooldown.reduce(p.stats.ringOnHitCdr);
        }
      } else if (reduction > 0.4) {
        play('hit_shield');
        this.floaters.show(target.x, target.y, t('hud.guarded'), '#95B6C6', 13);
      }
    }
    this.effects.play(p.weapon.family === 'axe' ? 'slash_heavy' : 'slash_light', p.x, p.y, { angle: shape.angle });
    if (connected) this.applyHitStop(38);

    // Echo repeats the next weapon attack once, at reduced power, and can
    // never itself trigger another echo or a synergy.
    if (p.echo && connected) {
      const power = p.echo.power;
      p.echo = null;
      this.time.delayedCall(180, () => {
        if (!this.player?.alive) return;
        for (const target of targets) {
          if (!target.alive || !shapeHits(shape, target)) continue;
          const dealt = target.takeDamage({ amount: Math.round(damage * power), source: 'echo', fromX: p.x, fromY: p.y, poise: 4 });
          if (dealt > 0) this.floaters.show(target.x, target.y, String(dealt), '#B9A8CE', 13);
        }
        this.effects.play('echo_ghost', p.x, p.y, { angle: shape.angle });
        play('ring_echo', { volume: 0.7 });
      });
    }
  }

  private isBehind(target: { x: number; y: number; facing: { x: number; y: number } }): boolean {
    const n = normalise(target.x - this.player.x, target.y - this.player.y);
    return n.x * target.facing.x + n.y * target.facing.y > 0.45;
  }

  private applyEnemyAttack(shape: AttackShape, damage: number, poise: number): void {
    const p = this.player;
    if (!p.alive || !shapeHits(shape, p)) return;
    const diff = difficultyOf(getState());
    const dealt = p.takeDamage({
      amount: Math.round(damage * diff.incomingDamage), source: 'weapon',
      fromX: shape.x, fromY: shape.y, poise,
    });
    if (dealt > 0) {
      this.bossDamageTaken += dealt;
      this.floaters.show(p.x, p.y, `-${dealt}`, '#E08B72', 16);
      this.effects.play('blood_spray', p.x, p.y);
      this.shakeCamera(0.006, 120);
    }
    // A guard that blocks an attack while Iron Oath is up staggers the attacker.
    if (p.guard.time > 0 || p.phase === 'guard') {
      for (const e of this.enemies) {
        if (Math.hypot(e.x - p.x, e.y - p.y) < 90) {
          e.poise.staggered = Math.max(e.poise.staggered, 0.6 * p.guard.staggerPower || 0.5);
        }
      }
    }
  }

  private resolveProjectiles(): void {
    const p = this.player;
    for (const proj of this.projectiles.all) {
      if (!proj.alive) continue;
      if (proj.team === 'enemy') {
        // The Last Hearth shelter intercepts a limited number of projectiles.
        if (p.interceptProjectile(proj.x, proj.y)) {
          this.effects.play('impact', proj.x, proj.y);
          proj.destroy();
          continue;
        }
        if (p.alive && Math.hypot(p.x - proj.x, p.y - proj.y) < p.radius + proj.radius) {
          const diff = difficultyOf(getState());
          const dealt = p.takeDamage({ amount: Math.round(proj.damage * diff.incomingDamage), source: 'weapon', fromX: proj.x, fromY: proj.y, poise: 6 });
          if (dealt > 0) {
            this.bossDamageTaken += dealt;
            this.floaters.show(p.x, p.y, `-${dealt}`, '#E08B72', 16);
          }
          proj.impact(this.effects);
          continue;
        }
      } else {
        const targets: (Enemy | Boss)[] = [...this.enemies, ...(this.boss ? [this.boss] : [])];
        for (const target of targets) {
          if (!target.alive) continue;
          if (Math.hypot(target.x - proj.x, target.y - proj.y) > target.radius + proj.radius) continue;
          const mod = 1 + seasonDamageModifier(this.season, proj.tags);
          const dealt = target.takeDamage({ amount: Math.round(proj.damage * mod), source: proj.source, fromX: proj.x, fromY: proj.y, poise: 6 });
          if (dealt > 0) {
            this.floaters.show(target.x, target.y, String(dealt), '#E4D8BC', 14);
            if (proj.tags.includes('poison')) {
              target.applyStatus({ kind: 'poison', time: 4, stacks: 1, dps: proj.damage * 0.14, power: 1 });
            }
          }
          proj.impact(this.effects);
          break;
        }
      }
    }
  }

  private applyHitStop(ms: number): void {
    if (!getState().settings.hitStop) return;
    this.hitStopUntil = this.time.now + ms;
  }

  private shakeCamera(intensity: number, duration: number): void {
    if (!getState().settings.cameraShake) return;
    this.cameras.main.shake(duration, intensity);
  }

  // --------------------------------------------------------------- rings

  private castSlot(slot: RingSlot): void {
    const rt = this.ringRuntimes[slot as 'active1' | 'active2'];
    if (!rt) { play('ring_fail'); return; }
    const state = getState();
    const stats = this.player.stats;
    const aim = this.input2.aim(this.player.x, this.player.y);
    const world = this.combatWorld(aim.worldX, aim.worldY);
    const res = castRing({ state, stats, world }, rt, this.silencedUntil > 0);
    if (!res.cast) {
      play(res.reason === 'silenced' ? 'ring_fail' : 'ui_deny');
      if (res.reason === 'silenced') this.events.emit('toast', t('hud.silenced'));
      return;
    }
    this.player.playAnim('cast', 420, true);
  }

  private combatWorld(aimX: number, aimY: number): CombatWorld {
    const scene = this;
    const targets = (): CombatTarget[] => {
      const list: CombatTarget[] = [];
      const push = (a: Enemy | Boss) => {
        list.push({
          x: a.x, y: a.y, radius: a.radius, alive: a.alive,
          applyDamage: (amount, source, tags, poise) => {
            const mod = 1 + seasonDamageModifier(scene.season, tags);
            const reduction = a instanceof Enemy ? a.damageReduction(scene.player.x, scene.player.y) : (a as Boss).damageReduction(scene.player.x, scene.player.y);
            const dealt = a.takeDamage({ amount: Math.round(amount * mod), source, fromX: scene.player.x, fromY: scene.player.y, poise }, reduction);
            if (dealt > 0) scene.floaters.show(a.x, a.y, String(dealt), '#F0DCA0', 15);
            return dealt;
          },
          applyStatus: (s: Status) => a.applyStatus(s),
          push: (dx, dy) => a.moveBy(dx, dy),
        });
      };
      for (const e of scene.enemies) if (e.alive) push(e);
      if (scene.boss?.alive) push(scene.boss);
      return list;
    };

    return {
      season: this.season,
      playerX: this.player.x,
      playerY: this.player.y,
      aimX, aimY,
      enemies: targets,
      vfx: (id, x, y, opts) => this.effects.play(id, x, y, opts),
      sound: (id, x, y) => { void x; void y; play(id as never, { volume: 0.9 }); },
      igniteProps: (x, y, radius) => {
        let n = 0;
        for (const prop of this.world.propsNear(x, y, radius)) {
          if (this.world.burnProp(prop)) {
            n++;
            this.unblockTile(prop.x, prop.y);
            this.effects.play('burn_tick', prop.x, prop.y);
          }
        }
        if (n > 0) {
          play('fire');
          this.events.emit('toast', t('hud.path_cleared'));
          if (this.tutorial && this.tutorialStep === 4) this.advanceTutorial();
        }
        return n;
      },
      freezeWater: (x, y, radius) => {
        let n = 0;
        for (let ty = 0; ty < this.map.h; ty++) {
          for (let tx = 0; tx < this.map.w; tx++) {
            const wx = tx * TILE + TILE / 2, wy = ty * TILE + TILE / 2;
            if (Math.hypot(wx - x, wy - y) > radius) continue;
            const i = ty * this.map.w + tx;
            if (this.map.blocked[i] === 1 && this.map.tiles[i] === 3) {
              this.map.blocked[i] = 0;
              this.map.tiles[i] = 8;
              n++;
            }
          }
        }
        if (n > 0) this.events.emit('toast', t('season.winter.desc'));
        return n;
      },
      disruptWards: (x, y, radius) => {
        let n = 0;
        for (const hz of this.hazards) {
          if (hz.kind !== 'sectors' && hz.kind !== 'mirrors' && hz.kind !== 'weave') continue;
          if (Math.hypot(hz.x - x, hz.y - y) > radius) continue;
          hz.time = 0;
          n++;
        }
        for (const node of this.nodes) {
          if (node.kind !== 'objective' || node.done) continue;
          if (node.data?.startsWith('ward') && Math.hypot(node.x - x, node.y - y) <= radius) {
            this.completeNode(node);
            n++;
          }
        }
        return n;
      },
      movePlayer: (dx, dy) => this.player.moveBy(dx, dy),
      shieldPlayer: (amount, seconds) => { this.player.shield = { amount, time: seconds }; },
      grantIFrames: (seconds) => { this.player.invulnerable = Math.max(this.player.invulnerable, seconds); this.player.ethereal = Math.max(this.player.ethereal, seconds); },
      queueEcho: (power, seconds) => { this.player.echo = { power, time: seconds }; },
      raiseGuard: (seconds, staggerPower) => { this.player.guard = { time: seconds, staggerPower, perfectWindow: seconds * 0.4 }; },
      raiseShelter: (x, y, radius, intercepts, seconds) => { this.player.shelter = { x, y, radius, intercepts, time: seconds }; },
      spawnShadow: (x, y, seconds) => this.spawnDecoy(x, y, seconds),
      spawnRoots: (x, y, radius, seconds, power) => this.spawnRoots(x, y, radius, seconds, power),
      fireProjectile: (kind, x, y, dx, dy, damage, tags) => {
        this.projectiles.spawn({ kind: PROJECTILES[kind] ? kind : 'venom', x, y, dx, dy, damage, team: 'player', tags, source: 'ring' });
      },
      onSynergy: (id) => this.events.emit('toast', t(`synergy.${id}.name`)),
      notify: (key, ...args) => this.events.emit('toast', t(key, ...args)),
    };
  }

  private unblockTile(wx: number, wy: number): void {
    const tx = Math.floor(wx / TILE);
    const ty = Math.floor(wy / TILE);
    if (tx < 0 || ty < 0 || tx >= this.map.w || ty >= this.map.h) return;
    this.map.blocked[ty * this.map.w + tx] = 0;
  }

  private spawnRoots(x: number, y: number, radius: number, seconds: number, power: number): void {
    const p = this.world.screenFor(x, y);
    const spr = this.add.sprite(p.x, p.y, 'vfx', 'root_patch_0');
    spr.setDepth(DEPTH.groundDecal + 1).setScale(radius / 64);
    if (this.anims.exists('vfx:root_patch')) spr.play({ key: 'vfx:root_patch', repeat: 0 });
    this.roots.push({ x, y, radius, time: seconds, power, sprite: spr });
  }

  private spawnDecoy(x: number, y: number, seconds: number): void {
    const p = this.world.screenFor(x, y);
    const spr = this.add.sprite(p.x, p.y, 'vfx', 'shadow_double_0');
    spr.setDepth(this.world.depthFor(x, y, 2));
    if (this.anims.exists('vfx:shadow_double')) spr.play({ key: 'vfx:shadow_double', repeat: -1 });
    this.decoys.push({ x, y, time: seconds, sprite: spr });
  }

  private stepRoots(dt: number): void {
    for (let i = this.roots.length - 1; i >= 0; i--) {
      const r = this.roots[i]!;
      r.time -= dt;
      for (const e of this.enemies) {
        if (!e.alive) continue;
        if (Math.hypot(e.x - r.x, e.y - r.y) <= r.radius) {
          e.applyStatus({ kind: 'root', time: 0.3, stacks: 1, dps: 0, power: r.power });
        }
      }
      if (r.time <= 0) {
        r.sprite?.destroy();
        this.roots.splice(i, 1);
      }
    }
  }

  private stepDecoys(dt: number): void {
    for (let i = this.decoys.length - 1; i >= 0; i--) {
      const d = this.decoys[i]!;
      d.time -= dt;
      if (d.time <= 0) {
        d.sprite?.destroy();
        this.decoys.splice(i, 1);
      }
    }
  }

  // ---------------------------------------------------------------- boss

  private stepBoss(dt: number): void {
    const boss = this.boss!;
    boss.step(dt);
    if (!boss.alive) {
      if (!this.bossDefeated) this.onBossDefeated();
      return;
    }
    if (boss.state === 'intro') return;
    boss.think(dt, { x: this.player.x, y: this.player.y, alive: this.player.alive });
    boss.separateFrom(this.enemies);

    if (boss.hitRequest) {
      const req = boss.hitRequest;
      boss.hitRequest = null;
      this.bossHitsResolved++;
      this.applyEnemyAttack(req.shape, req.damage, req.poise);
      if (req.attack.vfx) this.effects.play(req.attack.vfx, req.shape.x, req.shape.y, { angle: req.shape.angle });
      if (req.attack.shape === 'circle' || req.attack.shape === 'ring') this.shakeCamera(0.01, 220);
    }
    if (boss.projectileRequest) {
      const r = boss.projectileRequest;
      boss.projectileRequest = null;
      this.projectiles.spawn({ kind: r.kind, x: r.x, y: r.y, dx: r.dx, dy: r.dy, damage: r.damage, team: 'enemy', source: 'weapon', redirectable: r.redirectable });
    }
    if (boss.spawnRequest) {
      const r = boss.spawnRequest;
      boss.spawnRequest = null;
      this.spawnBossAdds(r.kind, r.count, r.x, r.y);
    }
    if (boss.groundRequest) {
      const r = boss.groundRequest;
      boss.groundRequest = null;
      this.spawnHazard(r.kind, r.x, r.y, r.radius, r.duration, r.damage);
    }
    // Show the telegraph while the boss winds up.
    if (boss.state === 'telegraph' && boss.currentAttack && !boss.telegraphSprite) {
      const a = boss.currentAttack;
      const id = a.vfx && a.vfx.startsWith('tele_') ? a.vfx
        : a.shape === 'cone' ? 'tele_cone'
          : a.shape === 'line' ? 'tele_line'
            : a.shape === 'ring' ? 'tele_ring' : 'tele_circle';
      const angle = Math.atan2(this.player.y - boss.y, this.player.x - boss.x);
      boss.telegraphSprite = this.effects.telegraph(id, boss.x, boss.y, a.telegraph, {
        angle,
        scale: a.range / 140,
        highContrast: getState().settings.highContrast,
      });
    }
    if (boss.state !== 'telegraph' && boss.telegraphSprite) {
      this.effects.cancel(boss.telegraphSprite);
      boss.clearTelegraph();
    }

    // The Hush-Caller silences rings while the player stands in its zone.
    for (const hz of this.hazards) {
      if (hz.kind === 'sectors' && Math.hypot(this.player.x - hz.x, this.player.y - hz.y) < hz.radius * 0.5) {
        this.silencedUntil = 0.5;
      }
    }
  }

  private spawnBossAdds(kind: string, count: number, x: number, y: number): void {
    const def = stageById(this.stageId)!;
    const pool = kind === 'brood' ? ['spider_broodling'] : def.enemies;
    const diff = difficultyOf(getState());
    for (let i = 0; i < count; i++) {
      const base = enemyById(pool[i % pool.length]!);
      if (!base) continue;
      const scaled = scaleEnemy(base, this.stageId);
      const ang = (i / count) * Math.PI * 2;
      const ex = x + Math.cos(ang) * 110;
      const ey = y + Math.sin(ang) * 110;
      const e = new Enemy(this, this.world, this.effects, this.map,
        { ...scaled, health: Math.round(scaled.health * 0.7 * diff.enemyHealth) },
        ex, ey, 99, false, diff.telegraphScale);
      this.enemies.push(e);
      this.effects.play('dusk_blink', ex, ey);
    }
  }

  private spawnHazard(kind: string, x: number, y: number, radius: number, duration: number, damage: number): void {
    const arm = kind === 'mines' || kind === 'charges';
    const p = this.world.screenFor(x, y);
    const spr = this.add.sprite(p.x, p.y, 'vfx', 'tele_circle_0');
    spr.setDepth(DEPTH.telegraph).setScale(radius / 80).setAlpha(0.85);
    if (this.anims.exists('vfx:tele_circle')) spr.play({ key: 'vfx:tele_circle', repeat: -1 });
    this.hazards.push({
      kind, x, y, radius,
      time: arm ? duration + 1.6 : duration + 0.6,
      damage, tickTimer: 0, sprite: spr, armed: !arm,
      sector: kind === 'sectors' ? Math.floor(Math.random() * 4) : undefined,
    });
    if (kind === 'season') this.events.emit('toast', t('season.changed'));
  }

  private stepHazards(dt: number): void {
    const diff = difficultyOf(getState());
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const h = this.hazards[i]!;
      h.time -= dt;
      if (!h.armed && h.time < 1.2) {
        h.armed = true;
        h.sprite?.setTint(0xe8875e);
      }
      if (h.kind === 'sectors') h.sector = Math.floor((this.time.now / 1400) % 4);
      h.tickTimer -= dt;
      if (h.armed && h.tickTimer <= 0) {
        h.tickTimer = 0.55;
        const inside = Math.hypot(this.player.x - h.x, this.player.y - h.y) <= h.radius;
        let hits = inside;
        if (h.kind === 'sectors' && inside) {
          const ang = Math.atan2(this.player.y - h.y, this.player.x - h.x);
          const sector = Math.floor((((ang + Math.PI) / (Math.PI * 2)) * 4)) % 4;
          hits = sector !== h.sector; // one safe sector rotates
        }
        if (h.kind === 'fissures' && inside) {
          hits = ((Math.floor(this.time.now / 1500) + Math.floor(this.player.x / 120)) % 2) === 0;
        }
        if (hits && this.player.alive) {
          const dealt = this.player.takeDamage({
            amount: Math.round(h.damage * 0.4 * diff.incomingDamage), source: 'environment',
            fromX: h.x, fromY: h.y,
          });
          if (dealt > 0) this.floaters.show(this.player.x, this.player.y, `-${dealt}`, '#E08B72', 14);
        }
      }
      if (h.time <= 0) {
        if (h.kind === 'mines' || h.kind === 'charges' || h.kind === 'siege') {
          this.effects.play('impact', h.x, h.y, { scale: h.radius / 60 });
          this.shakeCamera(0.012, 260);
          play('boss_slam', { volume: 0.9 });
        }
        h.sprite?.destroy();
        this.hazards.splice(i, 1);
      }
    }
  }

  private onBossDefeated(): void {
    this.bossDefeated = true;
    this.inBossFight = false;
    phase.set('STAGE_COMPLETE');
    this.hazards.forEach((h) => h.sprite?.destroy());
    this.hazards.length = 0;
    this.projectiles.clear();
    play('stage_clear');
    this.events.emit('boss:defeated', { nameKey: this.boss!.def.nameKey, defeatKey: this.boss!.def.defeatKey });
    this.time.delayedCall(1600, () => this.finishStage());
  }

  // ---------------------------------------------------------- objectives

  private checkTriggers(): void {
    const p = this.player;
    if (this.defence) { this.interactTarget = null; this.events.emit('prompt', null); return; }
    // Interaction prompt.
    this.interactTarget = null;
    let bestDist = 90;
    for (const node of this.nodes) {
      if (node.done) continue;
      if (node.kind === 'entrance') continue;
      const d = Math.hypot(node.x - p.x, node.y - p.y);
      if (d < bestDist) {
        if (node.kind === 'exit' && !this.exitArmed) continue;
        // With a cart on the route, a stop counts when the cart arrives.
        if (node.kind === 'escortStop' && this.cart) continue;
        if (node.kind === 'ringsight' && !this.ringSightHeld(node.data ?? '')) continue;
        bestDist = d;
        this.interactTarget = { node, kind: node.kind };
      }
    }
    if (!this.interactTarget) {
      for (const prop of this.world.propsNear(p.x, p.y, 76)) {
        if (prop.interact === 'inspect') {
          this.interactTarget = { prop: { id: prop.id, x: prop.x, y: prop.y }, kind: 'inspect' };
          break;
        }
      }
    }
    this.events.emit('prompt', this.interactTarget ? this.promptFor(this.interactTarget.kind) : null);

    // Checkpoint is automatic, boss door needs a deliberate step in.
    for (const node of this.nodes) {
      if (node.done) continue;
      const d = Math.hypot(node.x - p.x, node.y - p.y);
      if (node.kind === 'checkpoint' && d < 80) {
        node.done = true;
        this.saveCheckpoint('boss');
        play('checkpoint');
        this.events.emit('toast', t('hud.checkpoint'), 'check');
      }
      if (node.kind === 'bossdoor' && d < 70 && !this.bossSpawned) {
        if (this.objectiveDone < this.objectiveTotal) {
          this.events.emit('toast', t(stageById(this.stageId)!.objectiveKey));
          continue;
        }
        node.done = true;
        this.startBossIntro();
      }
    }
  }

  private promptFor(kind: string): string {
    switch (kind) {
      case 'objective': return t('prompt.take');
      case 'escortStop': return t('prompt.interact');
      case 'cache': return t('prompt.open');
      case 'ringsight': return t('prompt.read');
      case 'exit': return t('prompt.depart');
      case 'inspect': return t('prompt.read');
      default: return t('prompt.interact');
    }
  }

  private ringSightHeld(ring: string): boolean {
    const s = getState();
    return (['active1', 'active2', 'support1', 'support2'] as RingSlot[]).some((k) => s.ringSlots[k] === ring);
  }

  private tryInteract(): void {
    const target = this.interactTarget;
    if (!target) return;
    if (target.prop) {
      this.events.emit('toast', t(stageById(this.stageId)!.loreKey), 'map');
      play('ui_open');
      return;
    }
    const node = target.node!;
    switch (node.kind) {
      case 'objective':
      case 'escortStop':
        this.completeNode(node);
        break;
      case 'cache': {
        node.done = true;
        node.sprite?.destroy();
        const bundle = claimRunReward(getState(), this.runBanked, rewardId('cache', this.stageId, node.id), {
          gold: 12 + this.stageId * 4, wood: 2, stone: this.stageId > 3 ? 2 : 0, shards: this.stageId > 5 ? 1 : 0,
        });
        play('pickup_mat');
        this.effects.play('coin_pickup', node.x, node.y);
        if (bundle.granted) this.events.emit('toast', `+${bundle.bundle.gold ?? 0} ${t('resource.gold')}`, 'gold');
        break;
      }
      case 'ringsight': {
        node.done = true;
        node.sprite?.destroy();
        const def = stageById(this.stageId)!;
        const s = getState();
        if (def.ringSight && !s.journal.ringSightFound.includes(def.ringSight.noteKey)) {
          s.journal.ringSightFound.push(def.ringSight.noteKey);
        }
        this.events.emit('toast', t(def.ringSight?.noteKey ?? 'ring.clue'), 'ring');
        play('ring_found', { volume: 0.7 });
        break;
      }
      case 'exit':
        this.finishStage();
        break;
      default:
        break;
    }
  }

  private completeNode(node: StageNode): void {
    if (node.done) return;
    node.done = true;
    node.sprite?.destroy();
    // The guaranteed first ring.
    if (node.data?.startsWith('ring:')) {
      const ringId = node.data.slice(5);
      const state = getState();
      const res = discoverRing(state, ringId);
      if (res.firstTime) {
        this.setupRings();
        this.events.emit('ring:found', ringId);
        this.events.emit('toast', t('story.ring_first'), 'ring', 6000);
        play('ring_found');
        if (this.tutorial) this.advanceTutorial();
      } else {
        this.events.emit('toast', t('ring.duplicate', t(`ring.${ringId}.name`), res.shards), 'shard');
      }
      void saveGame(state);
      return;
    }
    this.objectiveDone++;
    play('ui_confirm');
    this.effects.play('interact_ping', node.x, node.y);
    const def = stageById(this.stageId)!;
    this.events.emit('objective', { done: this.objectiveDone, total: this.objectiveTotal, key: def.objectiveKey });
    if (this.objectiveDone >= this.objectiveTotal) {
      this.exitArmed = true;
      this.events.emit('toast', t(def.bossTestKey), 'skull', 5200);
      if (this.tutorial && this.tutorialStep < 6) this.advanceTutorial();
    }
  }

  // --------------------------------------------------------------- flow

  private startBossIntro(): void {
    const def = stageById(this.stageId)!;
    const bossDef = bossByStage(this.stageId);
    if (!bossDef) { this.finishStage(); return; }
    this.bossSpawned = true;
    phase.set('BOSS_INTRO');
    this.saveCheckpoint('boss');
    const diff = difficultyOf(getState());
    this.boss = new Boss(
      this, this.world, this.effects, this.map, bossDef,
      this.map.bossArena.x * TILE, this.map.bossArena.y * TILE,
      { telegraphScale: diff.telegraphScale, damageScale: diff.incomingDamage, healthScale: this.hardMode ? 1.5 : 1 },
    );
    this.boss.onPhaseChange = (p, i) => {
      this.events.emit('boss:phase', { index: i, introKey: p.introKey });
      this.shakeCamera(0.01, 320);
    };
    this.boss.playAnim('idle', 0, true);
    music.play('boss');
    music.setIntensity(0.8);
    play('boss_intro');
    this.events.emit('boss:intro', {
      nameKey: bossDef.nameKey, titleKey: bossDef.titleKey,
      introKey: bossDef.introKey, tipKey: bossDef.tipKey,
      health: this.boss.maxHealth, phases: this.boss.phaseCount,
    });
    this.cameras.main.zoomTo(this.computeZoom() * 0.9, 900);
    this.time.delayedCall(2600, () => {
      if (!this.boss) return;
      phase.set('BOSS_FIGHT');
      this.inBossFight = true;
      this.boss.beginFight();
      this.cameras.main.zoomTo(this.computeZoom(), 600);
      this.events.emit('boss:start');
    });
    void def;
  }

  private saveCheckpoint(at: 'entrance' | 'boss'): void {
    const state = getState();
    setCheckpoint(state, this.stageId, at, this.runBanked, this.player.flask, this.elapsedMs);
    void saveGame(state);
    this.events.emit('toast', t('hud.autosaved'), 'check', 1600);
  }

  private onPlayerDeath(): void {
    if (this.defence && !this.pendingComplete) {
      this.defence.lost = true;
      this.pendingComplete = true;
      phase.set('STAGE_COMPLETE');
      this.time.delayedCall(1400, () => this.finishDefence(false));
      return;
    }
    phase.set('DEFEATED');
    play('player_die');
    music.setIntensity(0);
    this.time.delayedCall(1200, () => {
      this.scene.launch('Menu', { tab: 'defeat', from: 'Stage', stage: this.stageId });
      this.scene.pause();
    });
  }

  /** Retry from the checkpoint: the arena resets, the flask refills, loot is kept. */
  retryFromCheckpoint(): void {
    const state = getState();
    const cp = state.campaign.checkpoint;
    this.scene.stop('Menu');
    this.hazards.forEach((h) => h.sprite?.destroy());
    this.hazards.length = 0;
    this.roots.forEach((r) => r.sprite?.destroy());
    this.roots.length = 0;
    this.decoys.forEach((d) => d.sprite?.destroy());
    this.decoys.length = 0;
    this.projectiles.clear();
    for (const e of this.enemies) e.destroy();
    this.enemies.length = 0;
    this.silencedUntil = 0;

    const stats = this.player.stats;
    this.player.health = stats.maxHealth;
    this.player.stamina.value = stats.maxStamina;
    this.player.alive = true;
    this.player.phase = 'idle';
    this.player.statuses.length = 0;
    this.player.lastStandUsed = false;
    this.player.shield = { amount: 0, time: 0 };
    this.player.flask = cp?.flaskCharges ?? this.startFlask;
    this.player.sprite.setAlpha(1);
    this.player.shadow.setAlpha(0.8);
    this.player.playAnim('idle', 0, true);

    if (this.boss && cp?.at === 'boss') {
      const bx = this.map.bossArena.x * TILE;
      const by = this.map.bossArena.y * TILE;
      this.boss.reset(bx, by);
      this.player.x = bx - (this.map.bossArena.radius - 1) * TILE;
      this.player.y = by;
      phase.set('BOSS_INTRO');
      this.time.delayedCall(700, () => {
        if (!this.boss) return;
        phase.set('BOSS_FIGHT');
        this.boss.beginFight();
      });
    } else {
      this.player.x = this.map.entrance.x * TILE;
      this.player.y = this.map.entrance.y * TILE;
      // The cart waits at the last stop it reached; stops already made stand.
      if (this.cart) {
        const reached = this.nodes.filter((n) => n.kind === 'escortStop' && n.done).at(-1);
        this.cart.reset(reached?.x ?? this.map.entrance.x * TILE + TILE, reached?.y ?? this.map.entrance.y * TILE);
      }
      // Re-spawn the approach encounters; already-collected loot stays collected.
      this.spawnWorld();
      phase.set('EXPLORING');
    }
    this.cameras.main.fadeIn(400);
    this.events.emit('retry');
  }

  private onEnemyDeath(e: Enemy): void {
    const state = getState();
    const gold = Math.round(Phaser.Math.Between(e.def.gold[0], e.def.gold[1]));
    state.resources.gold += gold;
    this.effects.play('coin_pickup', e.x, e.y);
    play('pickup_coin', { volume: 0.5 });
    // Enemy experience counts toward the tuned stage totals.
    this.events.emit('xp', e.def.xp);
    e.destroy();
  }

  private finishStage(): void {
    if (this.pendingComplete) return;
    this.pendingComplete = true;
    phase.set('STAGE_COMPLETE');
    if (this.defence) { this.finishDefence(!this.defence.lost); return; }
    if (this.challenge) { this.finishChallenge(); return; }
    const state = getState();
    const fraction = Math.min(1, 0.4 + this.objectiveDone / Math.max(1, this.objectiveTotal) * 0.6);
    const explore = claimExploration(state, this.stageId, fraction);
    const result = completeStage(state, this.stageId, this.elapsedMs);
    state.player.flaskCharges = state.player.flaskMax;
    updateState(() => { /* notify listeners */ });
    void saveGame(state);
    this.scene.stop('UI');
    this.scene.start('Result', {
      stage: this.stageId, result, explore, elapsedMs: this.elapsedMs,
      bossDefeated: this.bossDefeated,
    });
  }

  /**
   * Challenge runs never touch campaign progress: no stage is marked cleared,
   * no story beat fires, no season advances. They pay their own reward and
   * record a personal best, in one persisted transaction like every other
   * grant.
   */
  private finishChallenge(): void {
    const ch = this.challenge!;
    const state = getState();
    const entry = this.challengeEntry(ch);
    state.player.flaskCharges = state.player.flaskMax;

    if (ch.kind === 'gauntlet' && ch.run) {
      ch.run.carryHealth = this.player.health / Math.max(1, this.player.maxHealth);
      ch.run.flask = this.player.flask;
      const step = advanceGauntlet(state, ch.run, this.elapsedMs);
      if (!step.done && step.nextStage !== null) {
        updateState(() => { /* notify listeners */ });
        void saveGame(state);
        this.scene.stop('UI');
        this.scene.start('Stage', { stage: step.nextStage, challenge: ch });
        return;
      }
    }

    const granted = completeChallenge(state, entry, ch.kind === 'gauntlet' && ch.run ? ch.run.elapsedMs : this.elapsedMs);
    updateState(() => { /* notify listeners */ });
    void saveGame(state);
    this.scene.stop('UI');
    this.scene.start('Result', {
      stage: this.stageId,
      result: {
        granted, xp: 0, levels: 0, ringDiscovered: null, duplicateShards: 0,
        slotUnlocked: null, residentRescued: null, monumentUnlocked: false,
        seasonChanged: false, firstClear: false, trophy: null,
      } satisfies CompletionResult,
      explore: {},
      elapsedMs: ch.kind === 'gauntlet' && ch.run ? ch.run.elapsedMs : this.elapsedMs,
      bossDefeated: this.bossDefeated,
      challenge: { id: ch.id, kind: ch.kind },
    });
  }

  private challengeEntry(ch: ChallengeRun): ChallengeEntry {
    const state = getState();
    if (ch.kind === 'gauntlet') return gauntletEntry(state);
    const pool = ch.kind === 'hard' ? hardStages(state) : bossBoard(state);
    const found = pool.find((e) => e.id === ch.id);
    if (found) return found;
    // The board filters by unlock state; a run already in progress still needs
    // an entry to pay out against.
    return {
      id: ch.id, kind: ch.kind, stage: this.stageId,
      nameKey: 'common.stage', descKey: 'common.stage',
      unlocked: true, cleared: false, best: null,
      reward: { gold: Math.round((80 + 35 * this.stageId) * 0.5), shards: Math.max(1, Math.round(this.stageId * 0.5)) },
    };
  }

  // ------------------------------------------------------------ tutorial

  private advanceTutorial(): void {
    const steps = [
      'tutorial.move', 'tutorial.approach', 'tutorial.attack', 'tutorial.dodge',
      'tutorial.ring', 'tutorial.ring_use', 'tutorial.ring_burn', 'tutorial.boss', 'tutorial.done',
    ];
    this.tutorialStep = Math.min(steps.length - 1, this.tutorialStep + 1);
    this.events.emit('tutorial', steps[this.tutorialStep]!);
    if (this.tutorialStep >= steps.length - 1) {
      getState().tutorial.done = true;
    }
  }

  // --------------------------------------------------------------- misc

  private drawGroundDecals(): void {
    this.groundLayer.clear();
    if (this.player.shelter) {
      const s = this.player.shelter;
      const p = this.world.screenFor(s.x, s.y);
      this.groundLayer.lineStyle(3, 0xf2c87a, 0.85);
      this.groundLayer.strokeEllipse(p.x, p.y, s.radius * 1.9, s.radius * 0.95);
    }
    if (this.player.shield.amount > 0) {
      const p = this.world.screenFor(this.player.x, this.player.y);
      this.groundLayer.lineStyle(2, 0x95b6c6, 0.7);
      this.groundLayer.strokeEllipse(p.x, p.y, 64, 32);
    }
  }

  private hudSnapshot() {
    const p = this.player;
    const state = getState();
    const rings = ACTIVE_SLOTS.map((slot) => {
      const rt = this.ringRuntimes[slot];
      if (!rt) return null;
      const view = ringPower(state, rt.id, p.stats);
      return { slot, id: rt.id, ratio: rt.cooldown.ratio, ready: rt.cooldown.ready, rank: view?.rank ?? 1 };
    });
    return {
      health: p.health, maxHealth: p.maxHealth,
      stamina: p.stamina.value, maxStamina: p.stamina.max,
      flask: p.flask, flaskMax: p.flaskMax,
      shield: p.shield.amount,
      rings,
      boss: this.boss && this.boss.alive && this.inBossFight
        ? { name: this.boss.def.nameKey, health: this.boss.health, max: this.boss.maxHealth, phase: this.boss.phaseIndex + 1, phases: this.boss.phaseCount }
        : null,
      enemiesLeft: this.enemies.filter((e) => e.alive).length,
      elapsedMs: this.elapsedMs,
      silenced: this.silencedUntil > 0,
    };
  }

  private openPause(): void {
    if (phase.isPaused) return;
    phase.set('PAUSED');
    this.scene.launch('Menu', { tab: 'pause', from: 'Stage', stage: this.stageId });
    this.scene.pause();
  }

  private openMenu(tab: string): void {
    phase.set('PAUSED');
    this.scene.launch('Menu', { tab, from: 'Stage', stage: this.stageId });
    this.scene.pause();
  }

  private onResize(): void {
    this.cameras.main.setZoom(this.computeZoom());
    this.weather.resize(this.cameras.main.width, this.cameras.main.height);
  }

  private onHidden = (): void => { this.input2?.clearAll(); };
  private onVisible = (): void => { this.stepper.reset(); };

  private cleanup(): void {
    this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.game.events.off(Phaser.Core.Events.HIDDEN, this.onHidden, this);
    this.game.events.off(Phaser.Core.Events.VISIBLE, this.onVisible, this);
    this.input2?.destroy();
    this.projectiles?.clear();
    this.effects?.destroy();
    this.floaters?.destroy();
    this.weather?.clear();
    for (const e of this.enemies) e.destroy();
    this.enemies.length = 0;
    this.boss?.destroy();
    this.boss = null;
    for (const h of this.hazards) h.sprite?.destroy();
    this.hazards.length = 0;
    for (const r of this.roots) r.sprite?.destroy();
    this.roots.length = 0;
    for (const d of this.decoys) d.sprite?.destroy();
    this.decoys.length = 0;
    this.cart?.destroy();
    this.cart = null;
    this.world?.destroy();
    this.events.removeAllListeners();
  }
}
