import type { TalentNode, TalentPath } from '@/types';

/**
 * Three paths, ten one-point nodes each. A level-30 character earns 29 talent
 * points, so no build can fill more than one path plus most of another, and
 * respecialisation at home is free.
 */
export const TALENTS: readonly TalentNode[] = [
  // ------------------------------------------------------------- Guardian
  { id: 'g1', path: 'guardian', tier: 1, nameKey: 'talent.g1.name', descKey: 'talent.g1.desc', effect: { stat: 'maxHealth', value: 12 } },
  { id: 'g2', path: 'guardian', tier: 1, nameKey: 'talent.g2.name', descKey: 'talent.g2.desc', effect: { stat: 'armour', value: 3 } },
  { id: 'g3', path: 'guardian', tier: 2, nameKey: 'talent.g3.name', descKey: 'talent.g3.desc', effect: { stat: 'blockReduction', value: 0.1 }, requires: 'g1' },
  { id: 'g4', path: 'guardian', tier: 2, nameKey: 'talent.g4.name', descKey: 'talent.g4.desc', effect: { stat: 'parryWindow', value: 0.06 }, requires: 'g2' },
  { id: 'g5', path: 'guardian', tier: 3, nameKey: 'talent.g5.name', descKey: 'talent.g5.desc', effect: { stat: 'staggerPower', value: 0.15 }, requires: 'g3' },
  { id: 'g6', path: 'guardian', tier: 3, nameKey: 'talent.g6.name', descKey: 'talent.g6.desc', effect: { stat: 'maxHealth', value: 22 }, requires: 'g4' },
  { id: 'g7', path: 'guardian', tier: 4, nameKey: 'talent.g7.name', descKey: 'talent.g7.desc', effect: { stat: 'guardStaminaCost', value: -0.25 }, requires: 'g5' },
  { id: 'g8', path: 'guardian', tier: 4, nameKey: 'talent.g8.name', descKey: 'talent.g8.desc', effect: { stat: 'poiseResist', value: 0.2 }, requires: 'g6' },
  { id: 'g9', path: 'guardian', tier: 5, nameKey: 'talent.g9.name', descKey: 'talent.g9.desc', effect: { stat: 'parryStagger', value: 0.3 }, requires: 'g7' },
  { id: 'g10', path: 'guardian', tier: 5, nameKey: 'talent.g10.name', descKey: 'talent.g10.desc', effect: { stat: 'lastStand', value: 1 }, requires: 'g8' },

  // --------------------------------------------------------------- Ranger
  { id: 'r1', path: 'ranger', tier: 1, nameKey: 'talent.r1.name', descKey: 'talent.r1.desc', effect: { stat: 'moveSpeed', value: 0.05 } },
  { id: 'r2', path: 'ranger', tier: 1, nameKey: 'talent.r2.name', descKey: 'talent.r2.desc', effect: { stat: 'maxStamina', value: 15 } },
  { id: 'r3', path: 'ranger', tier: 2, nameKey: 'talent.r3.name', descKey: 'talent.r3.desc', effect: { stat: 'dodgeCost', value: -4 }, requires: 'r1' },
  { id: 'r4', path: 'ranger', tier: 2, nameKey: 'talent.r4.name', descKey: 'talent.r4.desc', effect: { stat: 'staminaRegen', value: 4 }, requires: 'r2' },
  { id: 'r5', path: 'ranger', tier: 3, nameKey: 'talent.r5.name', descKey: 'talent.r5.desc', effect: { stat: 'dodgeIFrames', value: 0.04 }, requires: 'r3' },
  { id: 'r6', path: 'ranger', tier: 3, nameKey: 'talent.r6.name', descKey: 'talent.r6.desc', effect: { stat: 'attackSpeed', value: 0.08 }, requires: 'r4' },
  { id: 'r7', path: 'ranger', tier: 4, nameKey: 'talent.r7.name', descKey: 'talent.r7.desc', effect: { stat: 'backstabDamage', value: 0.2 }, requires: 'r5' },
  { id: 'r8', path: 'ranger', tier: 4, nameKey: 'talent.r8.name', descKey: 'talent.r8.desc', effect: { stat: 'chargedShot', value: 0.25 }, requires: 'r6' },
  { id: 'r9', path: 'ranger', tier: 5, nameKey: 'talent.r9.name', descKey: 'talent.r9.desc', effect: { stat: 'dodgeRefund', value: 1 }, requires: 'r7' },
  { id: 'r10', path: 'ranger', tier: 5, nameKey: 'talent.r10.name', descKey: 'talent.r10.desc', effect: { stat: 'weaponDamage', value: 0.12 }, requires: 'r8' },

  // ----------------------------------------------------------- Ringkeeper
  { id: 'k1', path: 'ringkeeper', tier: 1, nameKey: 'talent.k1.name', descKey: 'talent.k1.desc', effect: { stat: 'ringPower', value: 0.06 } },
  { id: 'k2', path: 'ringkeeper', tier: 1, nameKey: 'talent.k2.name', descKey: 'talent.k2.desc', effect: { stat: 'ringCooldown', value: -0.06 } },
  { id: 'k3', path: 'ringkeeper', tier: 2, nameKey: 'talent.k3.name', descKey: 'talent.k3.desc', effect: { stat: 'ringRange', value: 0.08 }, requires: 'k1' },
  { id: 'k4', path: 'ringkeeper', tier: 2, nameKey: 'talent.k4.name', descKey: 'talent.k4.desc', effect: { stat: 'ringCooldown', value: -0.06 }, requires: 'k2' },
  { id: 'k5', path: 'ringkeeper', tier: 3, nameKey: 'talent.k5.name', descKey: 'talent.k5.desc', effect: { stat: 'synergyPower', value: 0.15 }, requires: 'k3' },
  { id: 'k6', path: 'ringkeeper', tier: 3, nameKey: 'talent.k6.name', descKey: 'talent.k6.desc', effect: { stat: 'ringPower', value: 0.08 }, requires: 'k4' },
  { id: 'k7', path: 'ringkeeper', tier: 4, nameKey: 'talent.k7.name', descKey: 'talent.k7.desc', effect: { stat: 'ringOnHitCdr', value: 0.12 }, requires: 'k5' },
  { id: 'k8', path: 'ringkeeper', tier: 4, nameKey: 'talent.k8.name', descKey: 'talent.k8.desc', effect: { stat: 'supportPower', value: 0.2 }, requires: 'k6' },
  { id: 'k9', path: 'ringkeeper', tier: 5, nameKey: 'talent.k9.name', descKey: 'talent.k9.desc', effect: { stat: 'synergyIcd', value: -0.2 }, requires: 'k7' },
  { id: 'k10', path: 'ringkeeper', tier: 5, nameKey: 'talent.k10.name', descKey: 'talent.k10.desc', effect: { stat: 'ringPower', value: 0.1 }, requires: 'k8' },
] as const;

export const TALENT_PATHS: readonly TalentPath[] = ['guardian', 'ranger', 'ringkeeper'];

export function talentById(id: string): TalentNode | undefined {
  return TALENTS.find((t) => t.id === id);
}

export function talentsForPath(path: TalentPath): TalentNode[] {
  return TALENTS.filter((t) => t.path === path);
}

/** 29 points are earned over levels 2..30. */
export const MAX_TALENT_POINTS = 29;
