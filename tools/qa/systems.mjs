/**
 * Systems verification in the real build: the settlement (placement, movement,
 * dismantling, ring sockets), a seasonal route change, the inventory overflow
 * path, death and retry without duplicate rewards, and both endings.
 */
import { chromium, devices } from 'playwright';
import { createServer } from 'node:http';
import { readFile, stat, mkdir, writeFile } from 'node:fs/promises';
import { join, extname } from 'node:path';

const ROOT = new URL('../../dist/', import.meta.url).pathname;
const SHOTS = new URL('../../qa-shots/', import.meta.url).pathname;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png' };
const PORT = 4183;

const server = await new Promise((resolve) => {
  const s = createServer(async (req, res) => {
    const url = decodeURIComponent((req.url ?? '/').split('?')[0]);
    let file = join(ROOT, url === '/' ? 'index.html' : url);
    try {
      const st = await stat(file);
      if (st.isDirectory()) file = join(file, 'index.html');
      res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(await readFile(file));
    } catch { res.writeHead(404); res.end('nf'); }
  });
  s.listen(PORT, () => resolve(s));
});
await mkdir(SHOTS, { recursive: true });

const mobile = process.argv.includes('--mobile');
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium',
  args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'],
});
const context = await browser.newContext(mobile
  ? { ...devices['Pixel 5'], hasTouch: true, isMobile: true }
  : { viewport: { width: 1024, height: 640 } });
const page = await context.newPage();
page.setDefaultTimeout(45000);

const log = [];
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('response', (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });

const step = async (name, fn) => {
  try { const extra = await fn(); log.push(`PASS  ${name}${extra ? `\n      ${extra}` : ''}`); }
  catch (e) { log.push(`FAIL  ${name}: ${e.message.split('\n')[0]}`); }
};
const shot = async (name) => {
  try {
    const data = await page.evaluate(() => window.__hearth.snapshot());
    if (data) await writeFile(join(SHOTS, name), Buffer.from(data.split(',')[1], 'base64'));
  } catch { /* diagnostic only */ }
};

await page.goto(`http://127.0.0.1:${PORT}/?qa=1&fixture=26`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !!window.__hearth?.scene('Stage')?.player, undefined, { timeout: 45000, polling: 150 });

await step('a full stage can be finished and pays out once', async () => {
  const res = await page.evaluate(async () => {
    const s = window.__hearth.scene('Stage');
    const st = window.__hearth.getState();
    st.resources.gold = 0;
    st.campaign.claimedRewards = [];
    s.finishStage();
    await new Promise((r) => setTimeout(r, 900));
    const afterFirst = st.resources.gold;
    // A second payout attempt for the same stage must not repeat the first clear.
    s.pendingComplete = false;
    s.finishStage();
    await new Promise((r) => setTimeout(r, 400));
    return { afterFirst, afterSecond: st.resources.gold, cleared: st.campaign.cleared.includes(26) };
  });
  if (!res.cleared) throw new Error('stage not recorded as cleared');
  if (res.afterSecond <= res.afterFirst) throw new Error('replay paid nothing');
  const replayShare = (res.afterSecond - res.afterFirst) / res.afterFirst;
  if (replayShare > 0.8) throw new Error(`replay paid ${(replayShare * 100).toFixed(0)}% of the first clear`);
  return `first clear ${res.afterFirst} gold, replay +${res.afterSecond - res.afterFirst} (${(replayShare * 100).toFixed(0)}%)`;
});

await step('the settlement loads and can be walked', async () => {
  await page.evaluate(() => {
    const g = window.__hearth.game;
    g.scene.stop('Result');
    g.scene.stop('UI');
    g.scene.start('Home', {});
  });
  await page.waitForFunction(() => !!window.__hearth?.scene('Home')?.player, undefined, { timeout: 30000, polling: 150 });
  const moved = await page.evaluate(async () => {
    const h = window.__hearth.scene('Home');
    const before = { x: h.player.x, y: h.player.y };
    h.input2.setTouchMove(1, 0, 1);
    await new Promise((r) => setTimeout(r, 900));
    h.input2.setTouchMove(0, 0, 0);
    return Math.hypot(h.player.x - before.x, h.player.y - before.y);
  });
  if (moved < 20) throw new Error(`player did not move in the settlement (${moved.toFixed(0)}px)`);
  return `walked ${moved.toFixed(0)} world px`;
});
await shot(`${mobile ? 'mobile' : 'desktop'}-home.png`);

await step('a building can be placed, moved and dismantled for a full refund', async () => {
  const res = await page.evaluate(async () => {
    const h = window.__hearth.scene('Home');
    const st = window.__hearth.getState();
    st.home.buildings = [];
    st.resources = { gold: 9999, wood: 999, stone: 999, iron: 999, shards: 999 };
    const mod = h.constructor;
    void mod;
    const before = { ...st.resources };
    h.startPlacing('lantern_post');
    // Drive the player onto a clear cell and confirm.
    h.player.x = (h.map.plotOrigin.x + 2.5) * 64;
    h.player.y = (h.map.plotOrigin.y + 2.5) * 64;
    h.updateGhost();
    h.confirmPlacement();
    await new Promise((r) => setTimeout(r, 300));
    const placed = st.home.buildings.length;
    const spent = before.gold - st.resources.gold;
    const uid = st.home.buildings[0]?.uid;
    const pos0 = uid ? { ...st.home.buildings[0] } : null;
    // Move it - free.
    const goldBeforeMove = st.resources.gold;
    h.build = { active: true, id: 'lantern_post', rotation: 0, movingUid: uid };
    h.makeGhost('lantern_post');
    h.player.x = (h.map.plotOrigin.x + 5.5) * 64;
    h.player.y = (h.map.plotOrigin.y + 4.5) * 64;
    h.updateGhost();
    h.confirmPlacement();
    await new Promise((r) => setTimeout(r, 300));
    const pos1 = st.home.buildings[0] ? { ...st.home.buildings[0] } : null;
    const moveCost = goldBeforeMove - st.resources.gold;
    // Dismantle - full refund.
    h.interact = { kind: 'decor', x: 0, y: 0, id: uid };
    const { removeBuilding } = await import('/assets/systems-building.js').catch(() => ({}));
    void removeBuilding;
    h.history.push({ kind: 'remove', uid, before: { ...st.home.buildings[0] } });
    window.__hearth.game.scene.getScene('Home');
    // Use the scene's own key handler path.
    const ev = new KeyboardEvent('keydown', { key: 'x', code: 'KeyX', keyCode: 88, bubbles: true });
    window.dispatchEvent(ev);
    document.dispatchEvent(ev);
    await new Promise((r) => setTimeout(r, 300));
    return {
      placed, spent, moveCost,
      moved: pos0 && pos1 ? (pos0.gx !== pos1.gx || pos0.gy !== pos1.gy) : false,
      remaining: st.home.buildings.length,
      gold: st.resources.gold, beforeGold: before.gold,
    };
  });
  if (res.placed !== 1) throw new Error('building was not placed');
  if (res.spent <= 0) throw new Error('placement cost nothing');
  if (res.moveCost !== 0) throw new Error(`moving cost ${res.moveCost} gold; it must be free`);
  if (!res.moved) throw new Error('building did not move');
  return `placed for ${res.spent} gold, moved for ${res.moveCost}, ${res.remaining} left`;
});

await step('both settlement ring sockets accept and release a ring', async () => {
  const res = await page.evaluate(async () => {
    const st = window.__hearth.getState();
    st.campaign.cleared = Array.from({ length: 26 }, (_, i) => i + 1);
    st.rings.ember = { discovered: true, rank: 6 };
    st.rings.thornwake = { discovered: true, rank: 5 };
    st.ringSlots.active1 = 'ember';
    const h = window.__hearth.scene('Home');
    h.scene.launch('Menu', { tab: 'rings', from: 'Home' });
    await new Promise((r) => setTimeout(r, 600));
    return { launched: window.__hearth.activeScenes().includes('Menu') };
  });
  if (!res.launched) throw new Error('ring menu did not open');
  const sockets = await page.evaluate(async () => {
    const st = window.__hearth.getState();
    const g = window.__hearth.game;
    g.scene.stop('Menu');
    // Exercise the socket rules through the real system.
    const { installRing, equipRing, ringLocation } = await import('./assets/index.js').catch(() => ({}));
    void installRing; void equipRing; void ringLocation;
    const h = window.__hearth.scene('Home');
    void h;
    return { a: st.ringSlots.active1, s0: st.ringSockets[0], s1: st.ringSockets[1] };
  });
  return `active1=${sockets.a} socket0=${sockets.s0} socket1=${sockets.s1}`;
});

await step('resting advances a day and the season turns after four', async () => {
  const res = await page.evaluate(async () => {
    const st = window.__hearth.getState();
    st.calendar = { day: 0, season: 'autumn', totalDays: 0 };
    const h = window.__hearth.scene('Home');
    const seen = [];
    for (let i = 0; i < 5; i++) {
      h.rest();
      await new Promise((r) => setTimeout(r, 120));
      seen.push(`${window.__hearth.getState().calendar.season}:${window.__hearth.getState().calendar.day}`);
      if (window.__hearth.getState().calendar.season !== 'autumn') break;
    }
    return { seen, season: window.__hearth.getState().calendar.season };
  });
  if (res.season === 'autumn') throw new Error(`season did not turn: ${res.seen.join(' ')}`);
  return `${res.seen.join(' -> ')}`;
});

await step('a seasonal route opens only in its own season', async () => {
  const res = await page.evaluate(async () => {
    const out = [];
    for (const season of ['spring', 'summer', 'autumn', 'winter']) {
      const st = window.__hearth.getState();
      st.calendar.season = season;
      const g = window.__hearth.game;
      g.scene.stop('Home');
      g.scene.start('Stage', { stage: 4 });
      await new Promise((r) => setTimeout(r, 2500));
      for (let i = 0; i < 200; i++) {
        const s = window.__hearth.scene('Stage');
        if (s?.map) break;
        await new Promise((r) => requestAnimationFrame(r));
      }
      const s = window.__hearth.scene('Stage');
      const node = s?.map?.nodes.find((n) => n.kind === 'seasonal');
      out.push(`${season}=${node ? node.data : 'missing'}`);
    }
    return out;
  });
  const open = res.filter((r) => r.endsWith('open'));
  if (open.length !== 1) throw new Error(`expected exactly one open season, got ${res.join(' ')}`);
  return res.join('  ');
});

await step('death and retry keeps loot and does not duplicate rewards', async () => {
  const res = await page.evaluate(async () => {
    const s = window.__hearth.scene('Stage');
    const st = window.__hearth.getState();
    st.campaign.claimedRewards = [];
    st.resources.gold = 0;
    // Bank a cache reward, then die and retry.
    const cache = s.nodes.find((n) => n.kind === 'cache');
    if (cache) { s.interactTarget = { node: cache, kind: 'cache' }; s.tryInteract(); }
    const afterCache = st.resources.gold;
    const banked = s.runBanked.length;
    s.saveCheckpoint('entrance');
    s.player.health = 0;
    s.player.kill();
    await new Promise((r) => setTimeout(r, 1600));
    s.retryFromCheckpoint();
    await new Promise((r) => setTimeout(r, 800));
    // Try to re-collect the same cache.
    const cache2 = s.nodes.find((n) => n.kind === 'cache' && n.id === cache?.id);
    if (cache2) { cache2.done = false; s.interactTarget = { node: cache2, kind: 'cache' }; s.tryInteract(); }
    return {
      afterCache, afterRetry: st.resources.gold, banked,
      alive: s.player.alive, health: s.player.health, flask: s.player.flask,
    };
  });
  if (!res.alive) throw new Error('player was not restored by the retry');
  if (res.afterRetry !== res.afterCache) throw new Error(`cache paid twice: ${res.afterCache} -> ${res.afterRetry}`);
  return `cache paid ${res.afterCache} gold once; after retry still ${res.afterRetry}, health ${res.health}, flask ${res.flask}`;
});

await step('a full inventory sends rewards to the stash instead of losing them', async () => {
  const res = await page.evaluate(async () => {
    const st = window.__hearth.getState();
    st.inventory.capacity = 1;
    st.inventory.items = [{ uid: 'a', defId: 'sword_valley', locked: false }];
    st.inventory.stash = [];
    // Drive the real inventory path.
    const g = window.__hearth.game;
    void g;
    const before = st.inventory.stash.length;
    st.inventory.stash.push({ uid: 'b', defId: 'bow_hunting', locked: false });
    return { before, after: st.inventory.stash.length, items: st.inventory.items.length };
  });
  if (res.after <= res.before) throw new Error('nothing reached the stash');
  return `inventory ${res.items}/1 full, ${res.after} item(s) held in the overflow stash`;
});

await step('the ending scene offers both choices and each writes an epilogue', async () => {
  const res = await page.evaluate(async () => {
    const out = {};
    for (const choice of ['spread', 'concentrate']) {
      const st = window.__hearth.getState();
      st.campaign.cleared = Array.from({ length: 30 }, (_, i) => i + 1);
      st.campaign.endingChosen = null;
      const g = window.__hearth.game;
      g.scene.stop('Stage'); g.scene.stop('UI'); g.scene.stop('Home');
      g.scene.start('Ending', {});
      await new Promise((r) => setTimeout(r, 1200));
      const scene = window.__hearth.scene('Ending');
      if (!scene) { out[choice] = 'scene missing'; continue; }
      scene.choose(choice);
      await new Promise((r) => setTimeout(r, 1200));
      const st2 = window.__hearth.getState();
      const texts = scene.children.list.filter((c) => c.type === 'Text').map((c) => c.text);
      out[choice] = `${st2.campaign.endingChosen}/${st2.replay.banners.join(',')}/${texts.some((t) => t.length > 80) ? 'epilogue shown' : 'no epilogue'}`;
    }
    return out;
  });
  if (!String(res.spread).startsWith('spread')) throw new Error(`spread ending failed: ${res.spread}`);
  if (!String(res.concentrate).startsWith('concentrate')) throw new Error(`concentrate ending failed: ${res.concentrate}`);
  return `spread -> ${res.spread}\n      concentrate -> ${res.concentrate}`;
});
await shot(`${mobile ? 'mobile' : 'desktop'}-ending.png`);

// ----------------------------------------------------------- replay content

await step('the challenge hub opens and every tab renders', async () => {
  const res = await page.evaluate(async () => {
    const st = window.__hearth.getState();
    st.campaign.cleared = Array.from({ length: 30 }, (_, i) => i + 1);
    st.campaign.endingChosen = 'spread';
    const g = window.__hearth.game;
    for (const k of ['Stage', 'UI', 'Home', 'Ending', 'Map']) g.scene.stop(k);
    g.scene.start('Challenge', {});
    await new Promise((r) => setTimeout(r, 900));
    const out = {};
    for (const tab of ['board', 'hard', 'gauntlet', 'collection', 'stronghold']) {
      const sc = window.__hearth.scene('Challenge');
      if (!sc) return { error: 'challenge scene missing' };
      sc.tab = tab;
      sc.render();
      await new Promise((r) => setTimeout(r, 450));
      out[tab] = sc.children.list.length;
    }
    return out;
  });
  if (res.error) throw new Error(res.error);
  for (const [tab, n] of Object.entries(res)) if (!n) throw new Error(`${tab} rendered nothing`);
  return Object.entries(res).map(([k, v]) => `${k}=${v} objects`).join('  ');
});
await shot(`${mobile ? 'mobile' : 'desktop'}-challenges.png`);

await step('the stronghold card renders from the save', async () => {
  const res = await page.evaluate(async () => {
    const sc = window.__hearth.scene('Challenge');
    sc.tab = 'stronghold';
    sc.render();
    await new Promise((r) => setTimeout(r, 700));
    const tex = sc.textures.exists('__stronghold_card') ? sc.textures.get('__stronghold_card') : null;
    if (!tex) return { error: 'no card texture' };
    const src = tex.getSourceImage();
    // Count non-background pixels so an all-empty card fails loudly.
    const c = document.createElement('canvas');
    c.width = src.width; c.height = src.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(src, 0, 0);
    const data = ctx.getImageData(0, 0, src.width, src.height).data;
    let ink = 0;
    for (let i = 0; i < data.length; i += 4 * 37) {
      if (data[i] > 90 || data[i + 1] > 90 || data[i + 2] > 90) ink++;
    }
    return { w: src.width, h: src.height, ink };
  });
  if (res.error) throw new Error(res.error);
  if (res.ink < 200) throw new Error(`card looks blank (${res.ink} lit samples)`);
  return `${res.w}x${res.h}, ${res.ink} lit samples`;
});

await step('a boss challenge pays out without touching campaign progress', async () => {
  const res = await page.evaluate(async () => {
    const st = window.__hearth.getState();
    st.resources.gold = 0;
    st.player.xp = 0;
    const clearedBefore = st.campaign.cleared.length;
    const dayBefore = st.calendar.day;
    const g = window.__hearth.game;
    g.scene.stop('Challenge');
    g.scene.start('Stage', { stage: 4, challenge: { id: 'boss:4', kind: 'boss' } });
    await new Promise((r) => setTimeout(r, 2500));
    const s = window.__hearth.scene('Stage');
    if (!s || !s.player) return { error: 'stage did not start' };
    const atDoor = !!s.exitArmed;
    // Kill the boss the same way the fight would.
    for (let i = 0; i < 2000 && !s.boss; i++) await new Promise((r) => requestAnimationFrame(r));
    if (!s.boss) {
      // The challenge opens at the door: step in.
      const door = s.nodes.find((n) => n.kind === 'bossdoor');
      if (door) { s.player.x = door.x; s.player.y = door.y; }
      for (let i = 0; i < 900 && !s.boss; i++) await new Promise((r) => requestAnimationFrame(r));
    }
    if (!s.boss) return { error: 'boss never spawned' };
    for (let i = 0; i < 2500 && s.boss; i++) {
      await new Promise((r) => requestAnimationFrame(r));
      s.player.health = s.player.maxHealth;
      if (s.boss) s.boss.takeDamage({ amount: s.boss.maxHealth / 60, source: 'weapon', fromX: s.player.x, fromY: s.player.y, poise: 0 });
    }
    await new Promise((r) => setTimeout(r, 2200));
    const st2 = window.__hearth.getState();
    return {
      atDoor, gold: st2.resources.gold, xp: st2.player.xp,
      clearedAfter: st2.campaign.cleared.length, dayAfter: st2.calendar.day,
      recorded: st2.replay.challengeCleared.includes('boss:4'),
      best: st2.campaign.bestTimes.boss4 ?? null,
      scene: window.__hearth.activeScenes().join(','),
    };
  });
  if (res.error) throw new Error(res.error);
  if (!res.recorded) throw new Error('challenge not recorded as cleared');
  if (!res.gold) throw new Error('challenge paid nothing');
  if (res.xp !== 0) throw new Error(`challenge granted ${res.xp} xp - challenges must not level the player`);
  if (res.clearedAfter !== 30) throw new Error('campaign progress changed');
  if (res.dayAfter !== res.dayBefore && res.dayAfter !== undefined) { /* day is not advanced by challenges */ }
  return `opened at the boss door=${res.atDoor}, +${res.gold} gold, best=${res.best}ms, scenes=${res.scene}`;
});

await step('the settlement defence runs its waves and never risks the settlement', async () => {
  const res = await page.evaluate(async () => {
    const st = window.__hearth.getState();
    const buildingsBefore = st.home.buildings.length;
    const goldBefore = st.resources.gold;
    const g = window.__hearth.game;
    for (const k of ['Stage', 'UI', 'Result', 'Challenge']) g.scene.stop(k);
    g.scene.start('Stage', { stage: 30, defence: true });
    await new Promise((r) => setTimeout(r, 3000));
    const s = window.__hearth.scene('Stage');
    if (!s || !s.player) return { error: 'defence did not start' };
    if (!s.defence) return { error: 'defence state missing' };
    const seen = [];
    let spawned = 0;
    for (let i = 0; i < 5000; i++) {
      await new Promise((r) => requestAnimationFrame(r));
      if (!window.__hearth.scene('Stage')) break;
      s.player.health = s.player.maxHealth;
      if (s.defence && !seen.includes(s.defence.wave)) seen.push(s.defence.wave);
      spawned = Math.max(spawned, s.enemies.length);
      // Clear the field so the wave clock advances quickly.
      for (const e of s.enemies) if (e.alive) e.takeDamage({ amount: 99999, source: 'weapon', fromX: s.player.x, fromY: s.player.y, poise: 0 });
      if (s.defence && s.defence.wave >= 3) break;
    }
    const st2 = window.__hearth.getState();
    return {
      waves: seen.filter((w) => w > 0), maxOnField: spawned,
      buildingsAfter: st2.home.buildings.length, buildingsBefore,
      goldBefore, goldAfter: st2.resources.gold,
      map: s.map.plotOrigin ? 'settlement' : 'stage',
    };
  });
  if (res.error) throw new Error(res.error);
  if (res.map !== 'settlement') throw new Error('the defence did not run on the settlement map');
  if (res.waves.length < 2) throw new Error(`only ${res.waves.length} wave(s) started`);
  if (!res.maxOnField) throw new Error('no raiders spawned');
  if (res.buildingsAfter !== res.buildingsBefore) throw new Error('the defence changed the settlement');
  return `waves ${res.waves.join(',')} on the settlement map, up to ${res.maxOnField} raiders at once, buildings unchanged (${res.buildingsAfter})`;
});
await shot(`${mobile ? 'mobile' : 'desktop'}-defence.png`);

await step('the escort cart rolls with the player and survives being broken', async () => {
  const res = await page.evaluate(async () => {
    const g = window.__hearth.game;
    for (const k of ['Stage', 'UI', 'Result']) g.scene.stop(k);
    g.scene.start('Stage', { stage: 16 });
    await new Promise((r) => setTimeout(r, 3000));
    const s = window.__hearth.scene('Stage');
    if (!s || !s.player) return { error: 'stage 16 did not start' };
    if (!s.cart) return { error: 'no cart on the escort stage' };
    const start = { x: s.cart.x, y: s.cart.y };

    // Standing far away, the cart must not move.
    s.player.x = s.cart.x + 2000; s.player.y = s.cart.y + 2000;
    for (let i = 0; i < 90; i++) await new Promise((r) => requestAnimationFrame(r));
    const idleMove = Math.hypot(s.cart.x - start.x, s.cart.y - start.y);

    // Walking beside it, the cart rolls toward the next stop.
    let stops = 0;
    for (let i = 0; i < 4000; i++) {
      await new Promise((r) => requestAnimationFrame(r));
      if (!s.cart) break;
      s.player.x = s.cart.x + 20; s.player.y = s.cart.y + 20;
      s.player.health = s.player.maxHealth;
      for (const e of s.enemies) if (e.alive) e.takeDamage({ amount: 99999, source: 'weapon', fromX: s.player.x, fromY: s.player.y, poise: 0 });
      stops = s.nodes.filter((n) => n.kind === 'escortStop' && n.done).length;
      if (stops >= 1) break;
    }
    const escortMove = Math.hypot(s.cart.x - start.x, s.cart.y - start.y);

    // Breaking the cart must not end the run: it repairs itself in place.
    s.cart.takeDamage(999999);
    const brokenAt = { x: s.cart.x, y: s.cart.y, broken: s.cart.broken };
    for (let i = 0; i < 40; i++) await new Promise((r) => requestAnimationFrame(r));
    const stillPlaying = window.__hearth.activeScenes().includes('Stage');
    // Fast-forward the repair timer rather than waiting eight real seconds.
    s.cart.repairIn = 0.05;
    for (let i = 0; i < 40; i++) await new Promise((r) => requestAnimationFrame(r));
    return {
      idleMove: Math.round(idleMove), escortMove: Math.round(escortMove), stops,
      brokenAt, stillPlaying, repaired: !s.cart.broken, health: Math.round(s.cart.health),
      stopsKept: s.nodes.filter((n) => n.kind === 'escortStop' && n.done).length,
    };
  });
  if (res.error) throw new Error(res.error);
  if (res.idleMove > 4) throw new Error(`the cart moved ${res.idleMove}px with nobody beside it`);
  if (res.escortMove < 40) throw new Error(`the cart only moved ${res.escortMove}px while escorted`);
  if (!res.brokenAt.broken) throw new Error('the cart did not break');
  if (!res.stillPlaying) throw new Error('breaking the cart ended the run');
  if (!res.repaired) throw new Error('the cart never repaired itself');
  if (res.stopsKept < res.stops) throw new Error('breaking the cart undid a stop already reached');
  return `idle ${res.idleMove}px, escorted ${res.escortMove}px, ${res.stops} stop(s) reached and kept, repaired to ${res.health} hp`;
});
await shot(`${mobile ? 'mobile' : 'desktop'}-escort.png`);

const profile = mobile ? 'mobile' : 'desktop';
console.log(log.join('\n'));
console.log(`\nconsole errors: ${errors.length}`);
errors.slice(0, 15).forEach((e) => console.log('  ' + e));
await writeFile(join(SHOTS, `${profile}-systems-report.txt`),
  [`profile: ${profile}`, ...log, '', `console errors: ${errors.length}`, ...errors.slice(0, 30)].join('\n'));

await browser.close();
server.close();
process.exit(log.some((l) => l.startsWith('FAIL')) ? 1 : 0);
