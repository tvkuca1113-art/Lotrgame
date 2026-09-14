import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { MapScene } from './scenes/MapScene';
import { HomeScene } from './scenes/HomeScene';
import { StageScene } from './scenes/StageScene';
import { UIScene } from './scenes/UIScene';
import { MenuScene } from './scenes/MenuScene';
import { ResultScene } from './scenes/ResultScene';
import { EndingScene } from './scenes/EndingScene';
import { audio } from './audio/engine';
import { getState } from './systems/state';
import { saveGame } from './systems/save';

/**
 * THE LAST HEARTH: RINGS OF THE NORTH
 *
 * An unofficial, non-commercial fan project. Entry point: configure Phaser,
 * register the scenes, and wire up the browser-level concerns (visibility,
 * resize, and a best-effort save on hide).
 */

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-root',
  backgroundColor: '#171C1B',
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: '100%',
    height: '100%',
  },
  render: {
    pixelArt: false,
    antialias: true,
    roundPixels: true,
    powerPreference: 'high-performance',
  },
  fps: {
    target: 60,
    min: 30,
    forceSetTimeOut: false,
  },
  // Visibility handling is explicit: the game pauses when the tab is hidden and
  // clears any stuck input rather than replaying a huge delta on return.
  autoFocus: true,
  disableContextMenu: true,
  input: {
    activePointers: 4,
    touch: { capture: true },
  },
  scene: [BootScene, TitleScene, MapScene, HomeScene, StageScene, UIScene, MenuScene, ResultScene, EndingScene],
};

const game = new Phaser.Game(config);

// ---------------------------------------------------------------- browser

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    audio.suspend();
    // Best-effort save; the game never relies on this alone.
    void saveGame(getState());
  } else {
    audio.resume();
  }
});

window.addEventListener('pagehide', () => {
  void saveGame(getState());
});

// Keep the canvas sized to the viewport across orientation changes.
window.addEventListener('orientationchange', () => {
  window.setTimeout(() => game.scale.refresh(), 220);
});

// Surface a fatal error instead of leaving a black canvas.
window.addEventListener('error', (e) => {
  const veil = document.getElementById('boot-veil');
  const err = document.getElementById('boot-error');
  if (veil && err && !veil.classList.contains('hidden')) {
    err.style.display = 'block';
    err.textContent = String(e.message ?? e);
  }
});

/**
 * Verification handle.
 *
 * Exposed in development, and in any build when the page is opened with
 * `?qa=1`. That lets the automated browser checks in tools/qa drive the real
 * production bundle instead of a separate debug build, without leaving a
 * scripting surface attached for ordinary players.
 */
const qaRequested = typeof location !== 'undefined' && new URLSearchParams(location.search).has('qa');
if (import.meta.env.DEV || qaRequested) {
  (globalThis as unknown as { __hearth?: unknown }).__hearth = {
    game,
    getState,
    saveGame,
    scene: (key: string) => game.scene.getScene(key),
    activeScenes: () => game.scene.getScenes(true).map((s) => s.scene.key),
    /** Capture the rendered frame; WebGL canvases cannot be read with toDataURL. */
    snapshot: () => new Promise<string>((resolve) => {
      game.renderer.snapshot((image) => {
        resolve(image instanceof HTMLImageElement ? image.src : '');
      });
    }),
  };
}

export default game;
