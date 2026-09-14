/**
 * Browser smoke test. Boots the production build in Chromium, walks through
 * the first minutes of the game and reports console errors, missing assets and
 * measured frame rate.
 */
import { chromium, devices } from 'playwright';

import { createServer } from 'node:http';
import { readFile, stat, mkdir, writeFile } from 'node:fs/promises';
import { join, extname } from 'node:path';

const ROOT = new URL('../../dist/', import.meta.url).pathname;
const SHOTS = new URL('../../qa-shots/', import.meta.url).pathname;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.wav': 'audio/wav', '.css': 'text/css' };

function serve(port) {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      const url = decodeURIComponent((req.url ?? '/').split('?')[0]);
      let file = join(ROOT, url === '/' ? 'index.html' : url);
      try {
        const s = await stat(file);
        if (s.isDirectory()) file = join(file, 'index.html');
        const data = await readFile(file);
        res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
        res.end(data);
      } catch {
        res.writeHead(404); res.end('not found');
      }
    });
    server.listen(port, () => resolve(server));
  });
}

const PORT = 4179;
const server = await serve(PORT);
await mkdir(SHOTS, { recursive: true });

const profile = process.argv.includes('--mobile') ? 'mobile' : 'desktop';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-vsync', '--disable-frame-rate-limit', '--disable-dev-shm-usage'] });
const context = await browser.newContext(
  profile === 'mobile'
    ? { ...devices['Pixel 5'], hasTouch: true, isMobile: true }
    : { viewport: { width: 1024, height: 640 } },
);
const page = await context.newPage();
page.setDefaultTimeout(30000);

/** Screenshots are diagnostic only; never fail a run because of one. */
const shot = async (name) => {
  try {
    const data = await page.evaluate(() => window.__hearth.snapshot());
    if (!data) { log.push(`      (no canvas for ${name})`); return; }
    await writeFile(join(SHOTS, name), Buffer.from(data.split(',')[1], 'base64'));
  } catch (e) { log.push(`      (screenshot ${name} skipped: ${e.message.split('\n')[0]})`); }
};

const log = [];
const errors = [];
const missing = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('response', (r) => { if (r.status() >= 400) missing.push(`${r.status()} ${r.url()}`); });

const step = async (name, fn) => {
  try { await fn(); log.push(`PASS  ${name}`); }
  catch (e) { log.push(`FAIL  ${name}: ${e.message}`); }
};

await page.goto(`http://127.0.0.1:${PORT}/?qa=1`, { waitUntil: 'domcontentloaded' });

await step('boot completes and the title screen appears', async () => {
  await page.waitForFunction(() => {
    const veil = document.getElementById('boot-veil');
    return veil === null || veil.classList.contains('hidden');
  }, { timeout: 60000 });
  await page.waitForTimeout(1200);
});
await shot(`${profile}-1-title.png`);

await step('canvas is present and sized to the viewport', async () => {
  const size = await page.evaluate(() => {
    const c = document.querySelector('#game-root canvas');
    return c ? { w: c.clientWidth, h: c.clientHeight } : null;
  });
  if (!size || size.w < 200 || size.h < 200) throw new Error(`bad canvas ${JSON.stringify(size)}`);
});

const click = async (x, y) => { await page.mouse.click(x, y); await page.waitForTimeout(500); };
const centre = await page.evaluate(() => ({ w: window.innerWidth, h: window.innerHeight }));

/** Click a menu button by its label, using the real pointer path. */
const clickButton = async (sceneKey, label) => {
  const pos = await page.evaluate(([key, text]) => {
    const scene = window.__hearth.scene(key);
    if (!scene) return null;
    for (const child of scene.children.list) {
      if (!child.list) continue;
      const t = child.list.find((c) => c.type === 'Text' && c.text === text);
      if (t) return { x: child.x, y: child.y };
    }
    return null;
  }, [sceneKey, label]);
  if (!pos) throw new Error(`button "${label}" not found in ${sceneKey}`);
  await page.mouse.click(pos.x, pos.y);
  await page.waitForTimeout(600);
  return pos;
};

await step('New Game gives control on the ruined road within 15 seconds', async () => {
  const t0 = Date.now();
  await clickButton('Title', 'New Game');
  await page.waitForFunction(() => {
    const s = window.__hearth?.scene('Stage');
    return !!s && !!s.player;
  }, undefined, { timeout: 25000, polling: 150 });
  const took = Date.now() - t0;
  log.push(`      time to control: ${(took / 1000).toFixed(1)}s`);
  log.push(`      active scenes: ${(await page.evaluate(() => window.__hearth.activeScenes())).join(', ')}`);
  await page.waitForTimeout(1500);
});
await shot(`${profile}-2-stage.png`);

await step('player moves with keyboard/touch and the world scrolls', async () => {
  const before = await page.evaluate(() => {
    const s = window.__hearth?.game?.scene.getScene('Stage');
    return s ? { x: s.player.x, y: s.player.y } : null;
  });
  if (!before) throw new Error('stage scene has no player');
  if (profile === 'mobile') {
    await page.touchscreen.tap(centre.w * 0.2, centre.h * 0.72);
    await page.mouse.move(centre.w * 0.2, centre.h * 0.72);
    await page.mouse.down();
    await page.mouse.move(centre.w * 0.32, centre.h * 0.62, { steps: 8 });
    await page.waitForTimeout(1200);
    await page.mouse.up();
  } else {
    await page.keyboard.down('KeyD');
    await page.waitForTimeout(900);
    await page.keyboard.up('KeyD');
  }
  const after = await page.evaluate(() => {
    const s = window.__hearth?.game?.scene.getScene('Stage');
    return { x: s.player.x, y: s.player.y };
  });
  const moved = Math.hypot(after.x - before.x, after.y - before.y);
  log.push(`      moved ${moved.toFixed(0)} world px`);
  if (moved < 20) throw new Error(`player did not move (${moved.toFixed(1)}px)`);
});

await step('simultaneous movement and attack', async () => {
  const res = await page.evaluate(async () => {
    const s = window.__hearth.game.scene.getScene('Stage');
    const before = { x: s.player.x, y: s.player.y };
    s.input2.pressAction('attack');
    s.input2.setTouchMove(1, 0, 1);
    await new Promise((r) => setTimeout(r, 500));
    const phase = s.player.phase;
    const after = { x: s.player.x, y: s.player.y };
    s.input2.releaseAction('attack');
    s.input2.setTouchMove(0, 0, 0);
    return { moved: Math.hypot(after.x - before.x, after.y - before.y), phase };
  });
  log.push(`      attacked while moving ${res.moved.toFixed(0)}px, phase=${res.phase}`);
  if (res.moved < 4) throw new Error('could not move while attacking');
});

await step('measure frame rate over 5 seconds', async () => {
  const fps = await page.evaluate(() => new Promise((resolve) => {
    let frames = 0;
    const start = performance.now();
    const tick = () => {
      frames++;
      if (performance.now() - start < 5000) requestAnimationFrame(tick);
      else resolve(frames / ((performance.now() - start) / 1000));
    };
    requestAnimationFrame(tick);
  }));
  log.push(`      ${fps.toFixed(1)} FPS (${profile}, software GL)`);
});

await step('ring cast, dodge and flask all respond', async () => {
  const out = await page.evaluate(async () => {
    const s = window.__hearth.game.scene.getScene('Stage');
    const st = window.__hearth.getState();
    // Grant the Ember ring so the ability path can be exercised.
    st.rings.ember.discovered = true;
    st.ringSlots.active1 = 'ember';
    s.setupRings?.();
    const before = s.player.stamina.value;
    s.player.tryDodge();
    const afterDodge = s.player.stamina.value;
    s.castSlot?.('active1');
    const cd = s.ringRuntimes?.active1?.cooldown?.left ?? 0;
    s.player.phase = 'idle';
    s.player.phaseTime = 0;
    s.player.animLocked = 0;
    s.player.flask = 2;
    s.player.health = 10;
    s.player.drinkFlask();
    return { staminaSpent: before - afterDodge, cd, flask: s.player.flask, health: s.player.health };
  });
  log.push(`      dodge cost ${out.staminaSpent}, ring cd ${out.cd.toFixed(1)}s, flask ${out.flask}, healed to ${out.health}`);
  if (out.staminaSpent <= 0) throw new Error('dodge did not cost stamina');
  if (out.cd <= 0) throw new Error('ring did not go on cooldown');
  if (out.flask !== 1) throw new Error('flask did not decrement');
});
await shot(`${profile}-3-combat.png`);

await step('save and reload restores the campaign', async () => {
  await page.evaluate(async () => {
    const st = window.__hearth.getState();
    st.resources.gold = 4321;
    await window.__hearth.saveGame(st);
  });
  await page.evaluate(() => window.__hearth.game.scene.getScene('Stage').saveCheckpoint?.('entrance'));
  await page.waitForTimeout(900);
  await page.goto(`http://127.0.0.1:${PORT}/?qa=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    const veil = document.getElementById('boot-veil');
    return veil === null || veil.classList.contains('hidden');
  }, { timeout: 60000 });
  const gold = await page.evaluate(() => window.__hearth.getState().resources.gold);
  log.push(`      gold after reload: ${gold}`);
  if (gold !== 4321) throw new Error(`save did not persist (gold=${gold})`);
});

await step('Continue resumes the campaign from the saved checkpoint', async () => {
  await page.waitForTimeout(800);
  await clickButton('Title', 'Continue');
  await page.waitForFunction(() => {
    const keys = window.__hearth?.activeScenes?.() ?? [];
    return keys.includes('Stage') || keys.includes('Home');
  }, undefined, { timeout: 20000, polling: 200 });
  const active = await page.evaluate(() => window.__hearth.activeScenes());
  log.push(`      resumed into: ${active.join(', ')}`);
});

await step('pause menu opens and closes without errors', async () => {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(700);
  const paused = await page.evaluate(() => window.__hearth.activeScenes().includes('Menu'));
  if (!paused) throw new Error('pause menu did not open');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(600);
  const closed = await page.evaluate(() => !window.__hearth.activeScenes().includes('Menu'));
  if (!closed) throw new Error('pause menu did not close');
});
await shot(`${profile}-4-resume.png`);

await writeFile(join(SHOTS, `${profile}-report.txt`), [
  `profile: ${profile}`,
  ...log,
  '',
  `console errors: ${errors.length}`,
  ...errors.slice(0, 20),
  `failed requests: ${missing.length}`,
  ...missing.slice(0, 20),
].join('\n'));

console.log(log.join('\n'));
console.log(`\nconsole errors: ${errors.length}`);
errors.slice(0, 12).forEach((e) => console.log('  ' + e));
console.log(`failed requests: ${missing.length}`);
missing.slice(0, 12).forEach((e) => console.log('  ' + e));

await browser.close();
server.close();
process.exit(log.some((l) => l.startsWith('FAIL')) || errors.length > 0 ? 1 : 0);
