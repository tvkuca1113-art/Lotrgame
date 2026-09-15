import Phaser from 'phaser';
import { loadManifest, queueBundle, registerAnimations, markBundleLoaded } from '@/systems/assets';
import { phase } from '@/systems/gamestate';
import { validateContent } from '@/content';
import { loadGame, storageIsBroken, SLOT_MAIN } from '@/systems/save';
import { setState, getState } from '@/systems/state';
import { audio } from '@/audio/engine';
import { setLocale, type LocaleId } from '@/content/locale';
import { parseFixture, fixtureState, setFixtureMode } from '@/systems/fixtures';

/** Boot: manifest, core bundle, saved game, then the title screen. */
export class BootScene extends Phaser.Scene {
  private failed = false;

  constructor() { super('Boot'); }

  preload(): void {
    this.setStatus('Reading the manifest…');
  }

  async create(): Promise<void> {
    // The scene instance is reused if boot is ever re-entered.
    this.failed = false;
    phase.set('TITLE');
    try {
      await loadManifest();
      this.setProgress(0.15);
      this.setStatus('Kindling the hearth…');
      const queued = queueBundle(this, 'core');
      if (queued > 0) {
        await new Promise<void>((resolve, reject) => {
          this.load.once(Phaser.Loader.Events.COMPLETE, () => resolve());
          this.load.once(Phaser.Loader.Events.FILE_LOAD_ERROR, (f: Phaser.Loader.File) => reject(new Error(`missing asset: ${f.key}`)));
          this.load.on(Phaser.Loader.Events.PROGRESS, (p: number) => this.setProgress(0.15 + p * 0.78));
          this.load.start();
        });
      }
      markBundleLoaded('core');
      registerAnimations(this, 'core');
      this.setProgress(0.95);

      const issues = validateContent();
      if (issues.length && import.meta.env.DEV) {
        console.warn('[content]', issues.map((i) => `${i.where}: ${i.message}`).join('\n'));
      }

      // A development fixture bypasses the save entirely.
      const fixture = parseFixture(typeof location !== 'undefined' ? location.search : '');
      if (fixture) {
        setFixtureMode(true);
        setState(fixtureState(fixture));
        this.setProgress(1);
        this.hideVeil();
        this.scene.start('Stage', { stage: fixture.stage, fixture, hard: fixture.hard });
        return;
      }

      const loaded = await loadGame(SLOT_MAIN);
      if (loaded.state) {
        setState(loaded.state);
        setLocale((loaded.state.settings.locale as LocaleId) ?? 'en');
        audio.applySettings({
          master: loaded.state.settings.masterVolume,
          music: loaded.state.settings.musicVolume,
          sfx: loaded.state.settings.sfxVolume,
          ambience: loaded.state.settings.ambienceVolume,
        });
      }
      this.setProgress(1);
      this.hideVeil();
      this.scene.start('Title', { hasSave: !!loaded.state, storageBroken: storageIsBroken() });
    } catch (err) {
      this.failed = true;
      const message = err instanceof Error ? err.message : String(err);
      this.showError(message);
    }
  }

  private setProgress(p: number): void {
    const bar = document.querySelector<HTMLElement>('#boot-bar > i');
    if (bar) bar.style.width = `${Math.round(Math.max(4, Math.min(1, p)) * 100)}%`;
  }

  private setStatus(text: string): void {
    const el = document.getElementById('boot-status');
    if (el) el.textContent = text;
  }

  private hideVeil(): void {
    const veil = document.getElementById('boot-veil');
    if (veil && !this.failed) {
      veil.classList.add('hidden');
      window.setTimeout(() => veil.remove(), 500);
    }
  }

  private showError(message: string): void {
    this.setStatus('The hearth would not light.');
    const el = document.getElementById('boot-error');
    if (el) {
      el.style.display = 'block';
      el.textContent = `${message}\n\nRun "npm run assets" to regenerate the artwork, then reload.`;
    }
    void getState();
  }
}
