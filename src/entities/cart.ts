import type Phaser from 'phaser';
import type { WorldRenderer } from '@/world/renderer';
import { propMeta, propsKey } from '@/systems/assets';
import type { Season } from '@/types';
import {
  newCartState, stepCart, damageCart, patchCart, resetCart,
  type CartState, type CartStep, type Blocked,
} from '@/systems/escort';

/**
 * The escort cart's sprite. All of its behaviour lives in `systems/escort`, so
 * this is only the part that has to know about Phaser.
 */
export class EscortCart {
  readonly radius = 22;
  readonly state: CartState;
  private sprite: Phaser.GameObjects.Image;
  private world: WorldRenderer;

  constructor(scene: Phaser.Scene, world: WorldRenderer, season: Season, x: number, y: number, maxHealth: number, speed = 74) {
    this.world = world;
    this.state = newCartState(x, y, maxHealth, speed);
    const key = propsKey(season);
    const meta = propMeta(season, 'cart');
    const p = world.screenFor(x, y);
    this.sprite = scene.add.image(p.x, p.y, key, 'cart_0');
    this.sprite.setOrigin(meta?.anchorX ?? 0.5, meta?.anchorY ?? 0.86);
  }

  get x(): number { return this.state.x; }
  get y(): number { return this.state.y; }
  get health(): number { return this.state.health; }
  get maxHealth(): number { return this.state.maxHealth; }
  get broken(): boolean { return this.state.broken; }
  get moving(): boolean { return this.state.moving; }
  set repairIn(v: number) { this.state.repairIn = v; }

  step(dt: number, stop: { x: number; y: number } | null, player: { x: number; y: number }, blocked: Blocked): CartStep {
    const out = stepCart(this.state, dt, stop, player, blocked);
    if (out.repaired) this.sprite.setAlpha(1);
    return out;
  }

  takeDamage(amount: number): number {
    const dealt = damageCart(this.state, amount);
    if (this.state.broken) this.sprite.setAlpha(0.45);
    return dealt;
  }

  repairAtStop(): void { patchCart(this.state); }

  reset(x: number, y: number): void {
    resetCart(this.state, x, y);
    this.sprite.setAlpha(1);
  }

  render(): void {
    const { x, y, moving } = this.state;
    const p = this.world.screenFor(x, y);
    this.sprite.setPosition(p.x, p.y);
    this.sprite.setDepth(this.world.depthFor(x, y, 2));
    this.sprite.setFrame(moving && Math.floor(performance.now() / 160) % 2 === 0 ? 'cart_1' : 'cart_0');
  }

  destroy(): void { this.sprite.destroy(); }
}
