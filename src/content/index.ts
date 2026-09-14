/**
 * The replaceable content layer.
 *
 * Everything that names or describes the world lives under src/content: stage
 * and boss text, ring lore, dialogue, and the localisation dictionary. The
 * systems in src/systems and the scenes in src/scenes only ever read typed
 * definitions from here, so the entire setting can be swapped by replacing this
 * directory.
 */
export * from './rings';
export * from './stages';
export * from './bosses';
export * from './enemies';
export * from './talents';
export * from './equipment';
export * from './buildings';
export { t, setLocale, getLocale, hasKey, allKeys, LOCALES } from './locale';
export type { LocaleId } from './locale';

import { RINGS, SYNERGIES } from './rings';
import { STAGES } from './stages';
import { BOSSES } from './bosses';
import { ENEMIES } from './enemies';
import { TALENTS } from './talents';
import { EQUIPMENT } from './equipment';
import { BUILDINGS, HOME_TIERS, RESIDENTS } from './buildings';
import { LOCALES } from './locale';

export interface ContentIssue { where: string; message: string }

/**
 * Structural validation of the content layer. Run by the test suite and, in
 * development builds, at boot - so a broken or partially translated content
 * pack fails loudly instead of producing an unplayable stage.
 */
export function validateContent(): ContentIssue[] {
  const issues: ContentIssue[] = [];
  const dict = LOCALES.en;
  const key = (where: string, k: string) => {
    if (!dict[k]) issues.push({ where, message: `missing locale key: ${k}` });
  };

  if (STAGES.length !== 30) issues.push({ where: 'stages', message: `expected 30 stages, found ${STAGES.length}` });
  if (RINGS.length !== 12) issues.push({ where: 'rings', message: `expected 12 rings, found ${RINGS.length}` });
  if (SYNERGIES.length !== 6) issues.push({ where: 'synergies', message: `expected 6 synergies, found ${SYNERGIES.length}` });
  if (BOSSES.length !== 30) issues.push({ where: 'bosses', message: `expected 30 bosses, found ${BOSSES.length}` });
  if (TALENTS.length !== 30) issues.push({ where: 'talents', message: `expected 30 talent nodes, found ${TALENTS.length}` });

  const ringIds = new Set(RINGS.map((r) => r.id));
  for (const r of RINGS) {
    for (const k of [r.nameKey, r.loreKey, r.activeKey, r.supportKey, r.homeKey, r.evolutions[0].key, r.evolutions[1].key]) key(`ring:${r.id}`, k);
    if (r.evolutions[0].rank !== 4 || r.evolutions[1].rank !== 7) {
      issues.push({ where: `ring:${r.id}`, message: 'evolutions must sit at ranks 4 and 7' });
    }
    if (r.cooldownFloor > r.cooldown) issues.push({ where: `ring:${r.id}`, message: 'cooldown floor above base cooldown' });
    if (!STAGES.some((s) => s.id === r.source)) issues.push({ where: `ring:${r.id}`, message: `source stage ${r.source} does not exist` });
  }
  for (const s of SYNERGIES) {
    for (const rid of s.rings) if (!ringIds.has(rid)) issues.push({ where: `synergy:${s.id}`, message: `unknown ring ${rid}` });
    key(`synergy:${s.id}`, s.nameKey);
    key(`synergy:${s.id}`, s.descKey);
    if (s.icd <= 0) issues.push({ where: `synergy:${s.id}`, message: 'internal cooldown must be positive' });
    if (s.cap <= 0) issues.push({ where: `synergy:${s.id}`, message: 'effect cap must be positive' });
  }

  const enemyIds = new Set(ENEMIES.map((e) => e.id));
  const bossStages = new Set(BOSSES.map((b) => b.stage));
  const guaranteedRings = new Set<string>();
  for (const s of STAGES) {
    for (const k of [s.nameKey, s.objectiveKey, s.loreKey, s.bossTestKey, s.seasonRoute.noteKey]) key(`stage:${s.id}`, k);
    if (s.ringSight) {
      key(`stage:${s.id}`, s.ringSight.noteKey);
      if (!ringIds.has(s.ringSight.ring)) issues.push({ where: `stage:${s.id}`, message: `ring sight names unknown ring ${s.ringSight.ring}` });
    }
    if (!bossStages.has(s.id)) issues.push({ where: `stage:${s.id}`, message: 'no boss defined' });
    for (const e of s.enemies) if (!enemyIds.has(e)) issues.push({ where: `stage:${s.id}`, message: `unknown enemy ${e}` });
    if (s.firstClear.ringId) {
      if (!ringIds.has(s.firstClear.ringId)) issues.push({ where: `stage:${s.id}`, message: `grants unknown ring ${s.firstClear.ringId}` });
      guaranteedRings.add(s.firstClear.ringId);
    }
    if ((s.firstClear.gold ?? 0) !== 80 + 35 * s.id) {
      issues.push({ where: `stage:${s.id}`, message: `first-clear gold must be 80 + 35 * stage (${80 + 35 * s.id})` });
    }
  }
  for (const r of RINGS) {
    if (!guaranteedRings.has(r.id)) issues.push({ where: `ring:${r.id}`, message: 'has no guaranteed acquisition' });
  }

  for (const b of BOSSES) {
    for (const k of [b.nameKey, b.titleKey, b.introKey, b.defeatKey, b.tipKey]) key(`boss:${b.id}`, k);
    const attackIds = new Set(b.attacks.map((a) => a.id));
    if (b.phases.length === 0) issues.push({ where: `boss:${b.id}`, message: 'no phases' });
    for (const p of b.phases) {
      if (p.introKey) key(`boss:${b.id}`, p.introKey);
      if (p.attacks.length === 0) issues.push({ where: `boss:${b.id}:${p.id}`, message: 'phase has no attacks' });
      for (const a of p.attacks) if (!attackIds.has(a)) issues.push({ where: `boss:${b.id}:${p.id}`, message: `unknown attack ${a}` });
    }
    for (const a of b.attacks) {
      // Every damaging attack must be readable: a telegraph or a projectile the
      // player can see coming. `echo` is the deliberate exception - it is the
      // delayed repeat of a strike that was itself telegraphed.
      if (a.damage > 0 && a.telegraph < 260 && a.shape !== 'projectile' && a.id !== 'echo') {
        issues.push({ where: `boss:${b.id}:${a.id}`, message: `telegraph ${a.telegraph}ms is too short to read` });
      }
      if (a.recovery <= 0) issues.push({ where: `boss:${b.id}:${a.id}`, message: 'attack has no recovery window' });
    }
  }

  for (const t2 of TALENTS) {
    key(`talent:${t2.id}`, t2.nameKey);
    key(`talent:${t2.id}`, t2.descKey);
    if (t2.requires && !TALENTS.some((x) => x.id === t2.requires)) {
      issues.push({ where: `talent:${t2.id}`, message: `requires unknown node ${t2.requires}` });
    }
  }
  for (const e of EQUIPMENT) key(`equip:${e.id}`, e.nameKey);
  for (const b of BUILDINGS) { key(`build:${b.id}`, b.nameKey); key(`build:${b.id}`, b.descKey); }
  for (const h of HOME_TIERS) key(`home:${h.id}`, h.nameKey);
  for (const r of RESIDENTS) {
    key(`npc:${r.id}`, r.nameKey);
    key(`npc:${r.id}`, r.roleKey);
    key(`npc:${r.id}`, r.serviceKey);
    for (const l of r.lines) key(`npc:${r.id}`, l);
  }
  for (const e of ENEMIES) key(`enemy:${e.id}`, e.nameKey);

  return issues;
}
