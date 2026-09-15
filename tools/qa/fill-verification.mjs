/**
 * Substitutes the real run output into VERIFICATION.md.
 *
 * Every number in that document has to come from a log this script read, so
 * a missing log is an error rather than a section quietly left as it was.
 *
 * It consumes the <!--BOSSWALK-->, <!--SYSTEMS--> and <!--MOBILE--> markers, so
 * to refill after another run restore them first:
 *
 *   git checkout VERIFICATION.md && node tools/qa/fill-verification.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../../', import.meta.url).pathname;
const SHOTS = join(ROOT, 'qa-shots');
const DOC = join(ROOT, 'VERIFICATION.md');

const read = (name) => {
  const p = join(SHOTS, name);
  if (!existsSync(p)) throw new Error(`missing log: qa-shots/${name} - run tools/qa/run-all.sh first`);
  return readFileSync(p, 'utf8').trimEnd();
};

const fence = (s) => '```\n' + s + '\n```';

/** Pulls the pass/fail tally out of a run log. */
function tally(text) {
  const pass = (text.match(/^PASS/gm) ?? []).length;
  const fail = (text.match(/^FAIL/gm) ?? []).length;
  const errs = /console errors(?: \/ failed requests)?: (\d+)/.exec(text);
  return { pass, fail, errors: errs ? Number(errs[1]) : null };
}

const bosswalk = read('bosswalk.log');
const systems = read('systems.log');
const systemsMobile = read('systems-mobile.log');
const smoke = read('smoke.log');
const smokeMobile = read('smoke-mobile.log');

const bw = tally(bosswalk);
const sy = tally(systems);
const sm = tally(systemsMobile);
const km = tally(smokeMobile);

const sections = {
  BOSSWALK: [
    `**${bw.pass}/${bw.pass + bw.fail} arenas verified**, console errors and failed requests: **${bw.errors ?? 'n/a'}**.`,
    '',
    'Each line is one arena: the boss that spawned, its health, phases entered',
    'out of phases defined, distinct attacks seen, telegraphs counted, hits the',
    'boss landed on the player and damage it dealt. The player is **not** made',
    'invulnerable, so a run only passes if the boss actually connected.',
    '',
    fence(bosswalk),
  ].join('\n'),

  SYSTEMS: [
    `Desktop: **${sy.pass} passed, ${sy.fail} failed**, console errors: **${sy.errors ?? 'n/a'}**.`,
    `Emulated Pixel 5: **${sm.pass} passed, ${sm.fail} failed**, console errors: **${sm.errors ?? 'n/a'}**.`,
    '',
    fence(systems),
    '',
    '### The same checks on an emulated phone',
    '',
    fence(systemsMobile),
  ].join('\n'),

  MOBILE: [
    `**${km.pass} passed, ${km.fail} failed**, console errors: **${km.errors ?? 'n/a'}**.`,
    '',
    fence(smokeMobile),
  ].join('\n'),
};

let doc = readFileSync(DOC, 'utf8');
for (const [key, body] of Object.entries(sections)) {
  const marker = `<!--${key}-->`;
  if (!doc.includes(marker)) throw new Error(`VERIFICATION.md has no ${marker} placeholder left to fill`);
  doc = doc.replace(marker, body);
}
writeFileSync(DOC, doc);

console.log('VERIFICATION.md filled:');
console.log(`  boss walk       ${bw.pass}/${bw.pass + bw.fail} arenas, ${bw.errors} errors`);
console.log(`  systems desktop ${sy.pass} pass / ${sy.fail} fail, ${sy.errors} errors`);
console.log(`  systems mobile  ${sm.pass} pass / ${sm.fail} fail, ${sm.errors} errors`);
console.log(`  smoke desktop   ${tally(smoke).pass} pass / ${tally(smoke).fail} fail, ${tally(smoke).errors} errors`);
console.log(`  smoke mobile    ${km.pass} pass / ${km.fail} fail, ${km.errors} errors`);
