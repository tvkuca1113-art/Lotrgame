/**
 * Fixture walk: open every one of the thirty boss arenas in the real build,
 * trigger the fight, drive it through all of its phases and confirm the arena,
 * telegraphs, phase transitions and defeat path all work. Reports console
 * errors and missing assets per stage.
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, stat, mkdir, writeFile } from 'node:fs/promises';
import { join, extname } from 'node:path';

const ROOT = new URL('../../dist/', import.meta.url).pathname;
const SHOTS = new URL('../../qa-shots/', import.meta.url).pathname;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.css': 'text/css' };

const server = await new Promise((resolve) => {
  const s = createServer(async (req, res) => {
    const url = decodeURIComponent((req.url ?? '/').split('?')[0]);
    let file = join(ROOT, url === '/' ? 'index.html' : url);
    try {
      const st = await stat(file);
      if (st.isDirectory()) file = join(file, 'index.html');
      const data = await readFile(file);
      res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(data);
    } catch { res.writeHead(404); res.end('nf'); }
  });
  s.listen(4181, () => resolve(s));
});
await mkdir(SHOTS, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium',
  args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'],
});
const context = await browser.newContext({ viewport: { width: 960, height: 600 } });
const page = await context.newPage();
page.setDefaultTimeout(45000);

const rows = [];
const allErrors = [];
page.on('console', (m) => { if (m.type() === 'error') allErrors.push(m.text()); });
page.on('pageerror', (e) => allErrors.push(`pageerror: ${e.message}`));
page.on('response', (r) => { if (r.status() >= 400) allErrors.push(`${r.status()} ${r.url()}`); });

const only = process.argv[2] ? [Number(process.argv[2])] : Array.from({ length: 30 }, (_, i) => i + 1);

for (const stage of only) {
  const before = allErrors.length;
  const row = { stage, ok: false, note: '' };
  try {
    await page.goto(`http://127.0.0.1:4181/?qa=1&fixture=${stage}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => {
      const s = window.__hearth?.scene('Stage');
      return !!s && !!s.player && !!s.map;
    }, undefined, { timeout: 45000, polling: 150 });

    // Walk into the boss door, then run the fight to completion.
    const result = await page.evaluate(async () => {
      const s = window.__hearth.scene('Stage');
      const door = s.nodes.find((n) => n.kind === 'bossdoor');
      if (!door) return { error: 'no boss door' };
      s.player.x = door.x;
      s.player.y = door.y;
      const frame = () => new Promise((r) => requestAnimationFrame(r));

      // Wait for the trigger, then for the intro to hand over to the fight.
      for (let i = 0; i < 300 && !s.boss; i++) await frame();
      if (!s.boss) return { error: 'boss did not spawn' };
      for (let i = 0; i < 900 && !s.inBossFight; i++) await frame();
      if (!s.inBossFight) return { error: 'fight never started' };

      const def = s.boss.def;
      const info = {
        id: def.id, arena: def.arena, maxHealth: s.boss.maxHealth,
        phases: def.phases.length, attacks: def.attacks.length,
        phasesEntered: [], telegraphsSeen: 0, hitsRequested: 0,
        attacksUsed: [], defeated: false, finalPhase: 0,
      };
      s.boss.onPhaseChange = (p, i) => info.phasesEntered.push(`${i}:${p.id}`);

      // Stand in melee range so the boss actually commits to its attacks.
      const chunk = s.boss.maxHealth / 300;
      for (let i = 0; i < 1400; i++) {
        await frame();
        if (!s.boss) break;
        s.player.invulnerable = 9999;
        s.player.health = s.player.maxHealth;
        const b = s.boss;
        // Follow the boss so it never falls out of its attack bands.
        const dx = b.x - s.player.x, dy = b.y - s.player.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d > 90) { s.player.x = b.x - dx / d * 80; s.player.y = b.y - dy / d * 80; }
        if (b.state === 'telegraph') info.telegraphsSeen++;
        if (b.hitRequest) info.hitsRequested++;
        if (b.state === "telegraph" && b.currentAttack && !info.attacksUsed.includes(b.currentAttack.id)) info.attacksUsed.push(b.currentAttack.id);
        // Damage through the real path so the death and phase logic runs.
        b.takeDamage({ amount: chunk, source: 'weapon', fromX: s.player.x, fromY: s.player.y, poise: 0 });
        if (!b.alive) { info.defeated = true; info.finalPhase = b.phaseIndex; break; }
      }
      if (s.boss && !info.defeated) info.finalPhase = s.boss.phaseIndex;
      return info;
    });

    if (result.error) { row.note = result.error; }
    else {
      const expectedPhases = result.phases - 1;
      row.ok = result.defeated && result.phasesEntered.length >= expectedPhases && result.telegraphsSeen > 0;
      row.note = `${result.id} arena=${result.arena} hp=${result.maxHealth} phases=${result.phases}/${result.phasesEntered.length + 1}`
        + ` attacks=${result.attacksUsed.length}/${result.attacks} telegraphs=${result.telegraphsSeen}`
        + ` hits=${result.hitsRequested} defeated=${result.defeated}`;
    }
    if (stage === 1 || stage % 10 === 0 || stage === 25) {
      try {
        const data = await page.evaluate(() => window.__hearth.snapshot());
        if (data) await writeFile(join(SHOTS, `boss-${stage}.png`), Buffer.from(data.split(',')[1], 'base64'));
      } catch { /* diagnostic only */ }
    }
  } catch (e) {
    row.note = e.message.split('\n')[0];
  }
  row.errors = allErrors.length - before;
  rows.push(row);
  console.log(`${row.ok ? 'PASS' : 'FAIL'}  stage ${String(stage).padStart(2)}  ${row.note}${row.errors ? `  [${row.errors} errors]` : ''}`);
}

const passed = rows.filter((r) => r.ok).length;
console.log(`\n${passed}/${rows.length} boss arenas verified`);
console.log(`console errors / failed requests: ${allErrors.length}`);
allErrors.slice(0, 15).forEach((e) => console.log('  ' + e));
await writeFile(join(SHOTS, 'bosswalk-report.txt'),
  rows.map((r) => `${r.ok ? 'PASS' : 'FAIL'} stage ${r.stage}: ${r.note}`).join('\n')
  + `\n\n${passed}/${rows.length} verified\nerrors: ${allErrors.length}\n` + allErrors.slice(0, 40).join('\n'));

await browser.close();
server.close();
process.exit(passed === rows.length && allErrors.length === 0 ? 0 : 1);
