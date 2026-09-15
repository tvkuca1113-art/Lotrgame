/** Is Phaser's reported frame delta the real wall-clock frame interval? */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';
const ROOT = new URL('../../dist/', import.meta.url).pathname;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png' };
const server = await new Promise((r) => {
  const s = createServer(async (req, res) => {
    const url = decodeURIComponent((req.url ?? '/').split('?')[0]);
    let f = join(ROOT, url === '/' ? 'index.html' : url);
    try {
      if ((await stat(f)).isDirectory()) f = join(f, 'index.html');
      res.writeHead(200, { 'Content-Type': TYPES[extname(f)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(await readFile(f));
    } catch { res.writeHead(404); res.end('nf'); }
  });
  s.listen(4191, () => r(s));
});
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium',
  args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'],
});
import { devices } from 'playwright';
const mobile = process.argv.includes('--mobile');
const context = await browser.newContext(mobile
  ? { ...devices['Pixel 5'], hasTouch: true, isMobile: true }
  : { viewport: { width: 1024, height: 640 } });
const page = await context.newPage();
await page.goto('http://127.0.0.1:4191/?qa=1&fixture=1', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__hearth?.scene('Stage')?.ready === true, undefined, { timeout: 60000, polling: 200 });

console.log(JSON.stringify(await page.evaluate(async () => {
  const s = window.__hearth.scene('Stage');
  // Instrument the fixed-step accumulator itself: it is the thing that decides
  // how much simulated time a frame is worth.
  const stepper = s.stepper;
  const origAdvance = stepper.advance.bind(stepper);
  const deltas = [];
  const stepCounts = [];
  let lastWall = performance.now();
  const walls = [];
  stepper.advance = (deltaMs) => {
    const now = performance.now();
    walls.push(now - lastWall);
    lastWall = now;
    deltas.push(deltaMs);
    const n = origAdvance(deltaMs);
    stepCounts.push(n);
    return n;
  };

  const startX = s.player.x;
  const t0 = performance.now();
  s.input2.setTouchMove(1, 0, 1);
  await new Promise((r) => setTimeout(r, 2000));
  s.input2.setTouchMove(0, 0, 0);
  const elapsed = performance.now() - t0;
  const moved = Math.abs(s.player.x - startX);
  stepper.advance = origAdvance;

  const sum = (a) => a.reduce((x, y) => x + y, 0);
  const mean = (a) => sum(a) / Math.max(1, a.length);
  return {
    frames: deltas.length,
    simulatedShareOfReal: `${Math.round(sum(stepCounts) * stepper.step * 1000 / Math.max(1, elapsed) * 100)}%`,
    movedShareOfExpected: `${Math.round(moved / Math.max(1, s.player.stats.moveSpeed * elapsed / 1000) * 100)}%`,
    meanStepDelta: +mean(deltas).toFixed(1),
    meanWallDelta: +mean(walls.slice(1)).toFixed(1),
    totalStepDelta: Math.round(sum(deltas)),
    totalSteps: sum(stepCounts),
    simulatedMs: Math.round(sum(stepCounts) * stepper.step * 1000),
    elapsedMs: Math.round(elapsed),
    movedPx: Math.round(moved),
    speed: s.player.stats.moveSpeed,
    expectedPx: Math.round(s.player.stats.moveSpeed * elapsed / 1000),
  };
}), null, 1));
console.log('--- touch stick hit area ---');
console.log(JSON.stringify(await page.evaluate(() => {
  const ui = window.__hearth.scene('UI');
  if (!ui) return { error: 'no UI scene' };
  const zone = ui.children.getByName('stickzone');
  if (!zone) return { touch: false, note: 'no stick zone (not a touch profile)' };
  const hit = zone.input && zone.input.hitArea;
  return {
    touch: true,
    zone: { x: zone.x, y: zone.y, w: zone.width, h: zone.height },
    hitArea: hit ? { x: hit.x, y: hit.y, w: hit.width, h: hit.height } : null,
    viewport: { w: window.innerWidth, h: window.innerHeight },
  };
}), null, 1));

await browser.close();
server.close();
