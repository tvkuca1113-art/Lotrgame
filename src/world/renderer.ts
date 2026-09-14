import Phaser from 'phaser';
import type { RegionKey, Season } from '@/types';
import { TILE, worldToScreen, depthFor } from '@/systems/iso';
import { tilesKey, propsKey, propMeta } from '@/systems/assets';
import { TILE_KINDS, type StageMap } from './stagegen';

/**
 * Isometric world rendering.
 *
 * Ground is drawn once into a RenderTexture (the whole map is small enough that
 * this is cheaper than thousands of live sprites), and only props and actors
 * are depth-sorted every frame.
 */

export const DEPTH = {
  ground: 0,
  groundDecal: 5,
  telegraph: 8,
  shadow: 9,
  actors: 10,          // actors add their own depth on top
  overhead: 100000,
  weather: 100500,
  hud: 200000,
} as const;

export interface RenderedProp {
  sprite: Phaser.GameObjects.Image;
  x: number;
  y: number;
  id: string;
  blocking: boolean;
  interact?: string;
  burnt?: boolean;
}

export class WorldRenderer {
  private scene: Phaser.Scene;
  private ground: Phaser.GameObjects.RenderTexture | null = null;
  readonly props: RenderedProp[] = [];
  private season: Season;
  private region: RegionKey | 'home';
  private originX = 0;
  private originY = 0;

  constructor(scene: Phaser.Scene, region: RegionKey | 'home', season: Season) {
    this.scene = scene;
    this.region = region;
    this.season = season;
  }

  /** Screen offset so the whole diamond sits in positive coordinates. */
  get offsetX(): number { return this.originX; }
  get offsetY(): number { return this.originY; }

  screenFor(wx: number, wy: number, h = 0): { x: number; y: number } {
    const p = worldToScreen(wx, wy, h);
    return { x: p.x + this.originX, y: p.y + this.originY };
  }

  depthFor(wx: number, wy: number, bias = 0): number {
    return DEPTH.actors + depthFor(wx, wy, bias);
  }

  /** Paint the ground layer. Returns the pixel bounds of the drawn world. */
  drawGround(map: StageMap): Phaser.Geom.Rectangle {
    const key = tilesKey(this.region, this.season);
    const corners = [
      worldToScreen(0, 0), worldToScreen(map.worldW, 0),
      worldToScreen(map.worldW, map.worldH), worldToScreen(0, map.worldH),
    ];
    const minX = Math.min(...corners.map((c) => c.x)) - TILE;
    const maxX = Math.max(...corners.map((c) => c.x)) + TILE;
    const minY = Math.min(...corners.map((c) => c.y)) - TILE;
    const maxY = Math.max(...corners.map((c) => c.y)) + TILE * 2;
    this.originX = -minX;
    this.originY = -minY;

    const w = Math.ceil(maxX - minX);
    const h = Math.ceil(maxY - minY);
    const rt = this.scene.add.renderTexture(0, 0, w, h).setOrigin(0, 0).setDepth(DEPTH.ground);
    rt.setScrollFactor(1);

    if (this.scene.textures.exists(key)) {
      const frames = new Set(this.scene.textures.get(key).getFrameNames());
      const fallback = this.scene.textures.get(key).getFrameNames()[0]!;
      // One batched pass: thousands of individual drawFrame calls are far too
      // slow on software renderers and on low-end mobile GPUs.
      rt.beginDraw();
      for (let ty = 0; ty < map.h; ty++) {
        for (let tx = 0; tx < map.w; tx++) {
          const kind = TILE_KINDS[map.tiles[ty * map.w + tx]!] ?? 'ground';
          const variant = (tx * 7 + ty * 13) % 3;
          let frame = `${kind}_${variant}`;
          if (!frames.has(frame)) frame = fallback;
          const p = this.screenFor(tx * TILE + TILE / 2, ty * TILE + TILE / 2);
          rt.batchDrawFrame(key, frame, p.x - TILE / 2, p.y - TILE / 4);
        }
      }
      rt.endDraw();
    }
    this.ground = rt;
    return new Phaser.Geom.Rectangle(0, 0, w, h);
  }

  addProps(map: StageMap): void {
    const key = propsKey(this.season);
    if (!this.scene.textures.exists(key)) return;
    const frames = new Set(this.scene.textures.get(key).getFrameNames());
    for (const p of map.props) {
      const meta = propMeta(this.season, p.id);
      const variants = meta?.variants ?? 1;
      const v = p.variant % variants;
      const frame = `${p.id}_${v}`;
      if (!frames.has(frame)) continue;
      const s = this.screenFor(p.x, p.y);
      const img = this.scene.add.image(s.x, s.y, key, frame);
      img.setOrigin(meta?.anchorX ?? 0.5, meta?.anchorY ?? 0.9);
      img.setDepth(this.depthFor(p.x, p.y, -2));
      this.props.push({ sprite: img, x: p.x, y: p.y, id: p.id, blocking: p.blocking, interact: p.interact });
    }
  }

  /** Burn away a marked prop (Ember, or a lit brazier), returning true if it burned. */
  burnProp(prop: RenderedProp): boolean {
    if (prop.burnt || prop.interact !== 'burnable') return false;
    prop.burnt = true;
    this.scene.tweens.add({
      targets: prop.sprite,
      alpha: 0,
      scaleY: 0.4,
      duration: 420,
      onComplete: () => prop.sprite.destroy(),
    });
    return true;
  }

  propsNear(x: number, y: number, radius: number): RenderedProp[] {
    return this.props.filter((p) => !p.burnt && Math.hypot(p.x - x, p.y - y) <= radius);
  }

  setSeason(season: Season): void { this.season = season; }

  destroy(): void {
    this.ground?.destroy();
    this.ground = null;
    for (const p of this.props) p.sprite.destroy();
    this.props.length = 0;
  }
}

/**
 * Weather overlay. Scales down on slower devices and sits behind nothing that
 * matters: it is drawn above the world but below every combat indicator.
 */
export class WeatherLayer {
  private scene: Phaser.Scene;
  private tiles: Phaser.GameObjects.TileSprite[] = [];
  private quality: number;

  constructor(scene: Phaser.Scene, quality: number) {
    this.scene = scene;
    this.quality = quality;
  }

  set(kind: string | null, alpha = 0.5): void {
    this.clear();
    if (!kind || this.quality === 0) return;
    if (!this.scene.textures.exists('vfx')) return;
    const layers = this.quality >= 2 ? 2 : 1;
    const cam = this.scene.cameras.main;
    for (let i = 0; i < layers; i++) {
      const t = this.scene.add.tileSprite(0, 0, cam.width, cam.height, 'vfx', `${kind}_${i}`);
      t.setOrigin(0, 0);
      t.setScrollFactor(0);
      t.setDepth(DEPTH.weather + i);
      t.setAlpha(alpha * (i === 0 ? 1 : 0.6));
      t.setTileScale(1 + i * 0.4);
      this.tiles.push(t);
    }
  }

  update(dt: number, windX = 18, windY = 90): void {
    for (let i = 0; i < this.tiles.length; i++) {
      const t = this.tiles[i]!;
      const k = 1 + i * 0.45;
      t.tilePositionX += windX * dt * k;
      t.tilePositionY += windY * dt * k;
    }
  }

  resize(w: number, h: number): void {
    for (const t of this.tiles) t.setSize(w, h);
  }

  clear(): void {
    for (const t of this.tiles) t.destroy();
    this.tiles.length = 0;
  }
}
