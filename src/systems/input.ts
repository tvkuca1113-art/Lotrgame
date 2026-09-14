import Phaser from 'phaser';
import { screenToWorld, normalise } from './iso';
import type { SettingsState } from './state';

/**
 * One input surface for keyboard + pointer and for touch.
 *
 * Actions are edge-triggered (`justPressed`) or level-triggered (`held`), and
 * every source writes into the same frame state, so gameplay code never asks
 * which device it is running on. Blur, pointer cancellation and orientation
 * changes all clear stuck inputs.
 */

export type Action =
  | 'attack' | 'secondary' | 'dodge' | 'ring1' | 'ring2' | 'heal'
  | 'interact' | 'inventory' | 'map' | 'pause' | 'build' | 'confirm' | 'cancel';

export const ACTIONS: Action[] = [
  'attack', 'secondary', 'dodge', 'ring1', 'ring2', 'heal',
  'interact', 'inventory', 'map', 'pause', 'build', 'confirm', 'cancel',
];

export interface AimState {
  /** Unit vector in world space. */
  x: number;
  y: number;
  /** Where the pointer is in world space, when there is one. */
  worldX: number;
  worldY: number;
  hasPointer: boolean;
}

export interface MoveState { x: number; y: number; magnitude: number }

const KEY_ALIASES: Record<string, number> = {
  SPACE: Phaser.Input.Keyboard.KeyCodes.SPACE,
  ESC: Phaser.Input.Keyboard.KeyCodes.ESC,
  ESCAPE: Phaser.Input.Keyboard.KeyCodes.ESC,
  SHIFT: Phaser.Input.Keyboard.KeyCodes.SHIFT,
  CTRL: Phaser.Input.Keyboard.KeyCodes.CTRL,
  TAB: Phaser.Input.Keyboard.KeyCodes.TAB,
  ENTER: Phaser.Input.Keyboard.KeyCodes.ENTER,
  UP: Phaser.Input.Keyboard.KeyCodes.UP,
  DOWN: Phaser.Input.Keyboard.KeyCodes.DOWN,
  LEFT: Phaser.Input.Keyboard.KeyCodes.LEFT,
  RIGHT: Phaser.Input.Keyboard.KeyCodes.RIGHT,
};

function keyCodeFor(binding: string): number | null {
  const b = binding.toUpperCase();
  if (b.startsWith('MOUSE')) return null;
  if (KEY_ALIASES[b] !== undefined) return KEY_ALIASES[b]!;
  const code = (Phaser.Input.Keyboard.KeyCodes as unknown as Record<string, number>)[b];
  return typeof code === 'number' ? code : null;
}

export class InputManager {
  private scene: Phaser.Scene;
  private keys = new Map<string, Phaser.Input.Keyboard.Key>();
  private held = new Set<Action>();
  private pressedThisFrame = new Set<Action>();
  private releasedThisFrame = new Set<Action>();
  private moveKeys: Record<'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key[]> = { up: [], down: [], left: [], right: [] };
  private touchMove: MoveState = { x: 0, y: 0, magnitude: 0 };
  private touchAim: { x: number; y: number } | null = null;
  private pointerWorld = { x: 0, y: 0, valid: false };
  private mouseButtons = new Set<number>();
  private settings: SettingsState;
  private lastFacing = { x: 1, y: 0 };
  private disposed = false;
  /** True while a menu owns input, so gameplay ignores everything. */
  public suspended = false;

  constructor(scene: Phaser.Scene, settings: SettingsState) {
    this.scene = scene;
    this.settings = settings;
    this.bind();
  }

  setSettings(s: SettingsState): void {
    this.settings = s;
    this.rebindKeys();
  }

  private bind(): void {
    const kb = this.scene.input.keyboard;
    if (kb) {
      kb.addCapture([
        Phaser.Input.Keyboard.KeyCodes.SPACE, Phaser.Input.Keyboard.KeyCodes.UP,
        Phaser.Input.Keyboard.KeyCodes.DOWN, Phaser.Input.Keyboard.KeyCodes.LEFT,
        Phaser.Input.Keyboard.KeyCodes.RIGHT, Phaser.Input.Keyboard.KeyCodes.TAB,
      ]);
    }
    this.rebindKeys();

    this.scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
    this.scene.input.on(Phaser.Input.Events.POINTER_UP, this.onPointerUp, this);
    this.scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.onPointerMove, this);
    this.scene.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onPointerUp, this);
    this.scene.input.on('pointercancel', this.clearAll, this);

    this.scene.game.events.on(Phaser.Core.Events.BLUR, this.clearAll, this);
    this.scene.game.events.on(Phaser.Core.Events.HIDDEN, this.clearAll, this);
    if (typeof window !== 'undefined') {
      window.addEventListener('blur', this.clearAll);
      window.addEventListener('orientationchange', this.clearAll);
      window.addEventListener('contextmenu', this.preventContext);
    }
  }

  private preventContext = (e: Event) => { e.preventDefault(); };

  private rebindKeys(): void {
    const kb = this.scene.input.keyboard;
    if (!kb) return;
    this.keys.clear();
    for (const [action, binding] of Object.entries(this.settings.keybinds)) {
      if (['up', 'down', 'left', 'right'].includes(action)) continue;
      const code = keyCodeFor(binding);
      if (code === null) continue;
      this.keys.set(action, kb.addKey(code, false, false));
    }
    const dirs: Record<'up' | 'down' | 'left' | 'right', string[]> = {
      up: [this.settings.keybinds.up ?? 'W', 'UP'],
      down: [this.settings.keybinds.down ?? 'S', 'DOWN'],
      left: [this.settings.keybinds.left ?? 'A', 'LEFT'],
      right: [this.settings.keybinds.right ?? 'D', 'RIGHT'],
    };
    for (const d of ['up', 'down', 'left', 'right'] as const) {
      this.moveKeys[d] = dirs[d]
        .map(keyCodeFor)
        .filter((c): c is number => c !== null)
        .map((c) => kb.addKey(c, false, false));
    }
  }

  private mouseActionFor(button: number): Action | null {
    const want = `MOUSE${button}`;
    for (const [action, binding] of Object.entries(this.settings.keybinds)) {
      if (binding.toUpperCase() === want) return action as Action;
    }
    return null;
  }

  private onPointerDown = (p: Phaser.Input.Pointer): void => {
    this.mouseButtons.add(p.button);
    const action = this.mouseActionFor(p.button);
    if (action) this.pressAction(action);
    this.updatePointerWorld(p);
  };

  private onPointerUp = (p: Phaser.Input.Pointer): void => {
    this.mouseButtons.delete(p.button);
    const action = this.mouseActionFor(p.button);
    if (action) this.releaseAction(action);
  };

  private onPointerMove = (p: Phaser.Input.Pointer): void => {
    this.updatePointerWorld(p);
  };

  private updatePointerWorld(p: Phaser.Input.Pointer): void {
    const cam = this.scene.cameras.main;
    if (!cam) return;
    const wx = p.worldX !== undefined ? p.worldX : p.x + cam.scrollX;
    const wy = p.worldY !== undefined ? p.worldY : p.y + cam.scrollY;
    const w = screenToWorld(wx, wy);
    this.pointerWorld = { x: w.x, y: w.y, valid: !p.wasTouch };
  }

  pressAction(a: Action): void {
    if (!this.held.has(a)) this.pressedThisFrame.add(a);
    this.held.add(a);
  }

  releaseAction(a: Action): void {
    if (this.held.has(a)) this.releasedThisFrame.add(a);
    this.held.delete(a);
  }

  /** Virtual stick from the touch layer, already normalised. */
  setTouchMove(x: number, y: number, magnitude: number): void {
    this.touchMove = { x, y, magnitude };
  }

  setTouchAim(x: number | null, y = 0): void {
    this.touchAim = x === null ? null : { x, y };
  }

  clearAll = (): void => {
    this.held.clear();
    this.pressedThisFrame.clear();
    this.releasedThisFrame.clear();
    this.mouseButtons.clear();
    this.touchMove = { x: 0, y: 0, magnitude: 0 };
    this.touchAim = null;
  };

  /** Call once per frame, before gameplay reads input. */
  update(): void {
    if (this.disposed) return;
    for (const [action, key] of this.keys) {
      const a = action as Action;
      if (!ACTIONS.includes(a)) continue;
      if (key.isDown) this.pressAction(a);
      else this.releaseAction(a);
    }
  }

  /** Call at the very end of the frame. */
  endFrame(): void {
    this.pressedThisFrame.clear();
    this.releasedThisFrame.clear();
  }

  isDown(a: Action): boolean { return !this.suspended && this.held.has(a); }
  justPressed(a: Action): boolean { return !this.suspended && this.pressedThisFrame.has(a); }
  justReleased(a: Action): boolean { return !this.suspended && this.releasedThisFrame.has(a); }

  /** Raw press that ignores suspension - used by menus. */
  menuPressed(a: Action): boolean { return this.pressedThisFrame.has(a); }

  move(): MoveState {
    if (this.suspended) return { x: 0, y: 0, magnitude: 0 };
    if (this.touchMove.magnitude > 0.06) return this.touchMove;
    let sx = 0, sy = 0;
    if (this.moveKeys.up.some((k) => k.isDown)) sy -= 1;
    if (this.moveKeys.down.some((k) => k.isDown)) sy += 1;
    if (this.moveKeys.left.some((k) => k.isDown)) sx -= 1;
    if (this.moveKeys.right.some((k) => k.isDown)) sx += 1;
    if (sx === 0 && sy === 0) return { x: 0, y: 0, magnitude: 0 };
    // Screen-relative input converted to world axes, so "up" is up on screen.
    const wx = sy + sx;
    const wy = sy - sx;
    const n = normalise(wx, wy);
    return { x: n.x, y: n.y, magnitude: 1 };
  }

  /**
   * Aim direction. Pointer aiming when a mouse is present, the touch aim vector
   * on a touchscreen, and movement-direction aiming for the keyboard-only
   * alternative.
   */
  aim(fromX: number, fromY: number): AimState {
    const mv = this.move();
    if (this.touchAim) {
      const n = normalise(this.touchAim.x, this.touchAim.y);
      if (n.x || n.y) this.lastFacing = n;
      return { x: n.x, y: n.y, worldX: fromX + n.x * 100, worldY: fromY + n.y * 100, hasPointer: false };
    }
    if (!this.settings.keyboardAim && this.pointerWorld.valid) {
      const n = normalise(this.pointerWorld.x - fromX, this.pointerWorld.y - fromY);
      if (n.x || n.y) this.lastFacing = n;
      return { x: this.lastFacing.x, y: this.lastFacing.y, worldX: this.pointerWorld.x, worldY: this.pointerWorld.y, hasPointer: true };
    }
    if (mv.magnitude > 0) {
      this.lastFacing = { x: mv.x, y: mv.y };
    }
    return {
      x: this.lastFacing.x, y: this.lastFacing.y,
      worldX: fromX + this.lastFacing.x * 100, worldY: fromY + this.lastFacing.y * 100,
      hasPointer: false,
    };
  }

  destroy(): void {
    this.disposed = true;
    this.scene.input.off(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_UP, this.onPointerUp, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_MOVE, this.onPointerMove, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onPointerUp, this);
    this.scene.input.off('pointercancel', this.clearAll, this);
    this.scene.game.events.off(Phaser.Core.Events.BLUR, this.clearAll, this);
    this.scene.game.events.off(Phaser.Core.Events.HIDDEN, this.clearAll, this);
    if (typeof window !== 'undefined') {
      window.removeEventListener('blur', this.clearAll);
      window.removeEventListener('orientationchange', this.clearAll);
      window.removeEventListener('contextmenu', this.preventContext);
    }
    this.clearAll();
    this.keys.clear();
  }
}

export function isTouchDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (navigator.maxTouchPoints ?? 0) > 0 || 'ontouchstart' in globalThis;
}
