import type { GameState, PatternFamily, PatternModifiers, SeamDefinition } from '../../core/types';
import { PATTERN_BY_ID, DEFAULT_PATTERN_MODIFIERS, SEAMS } from '../../content/patterns';
import { WORLD_RULE_BY_ID } from '../../content/worldRules';

export interface WorldModifiers {
  enemySpeed: number;
  spawnCount: number;
  projectileSpeed: number;
  armorDelta: number;
  scoreMultiplier: number;
  tensionRate: number;
  echoChord: boolean;
  wildEveryThird: boolean;
}

function addModifiers(target: PatternModifiers, source: Partial<PatternModifiers>): void {
  for (const key of Object.keys(source) as Array<keyof PatternModifiers>) {
    target[key] += source[key] ?? 0;
  }
}

function matchingSeam(a: PatternFamily, b: PatternFamily): SeamDefinition | undefined {
  return SEAMS.find((seam) =>
    (seam.familyA === a && seam.familyB === b) || (seam.familyA === b && seam.familyB === a));
}

export function getActiveSeams(state: GameState): SeamDefinition[] {
  const seams = new Map<string, SeamDefinition>();
  for (let index = 0; index < state.player.patternSlots.length; index += 1) {
    const currentId = state.player.patternSlots[index];
    const nextId = state.player.patternSlots[(index + 1) % state.player.patternSlots.length];
    if (!currentId || !nextId) continue;
    const current = PATTERN_BY_ID[currentId];
    const next = PATTERN_BY_ID[nextId];
    if (!current || !next) continue;
    const seam = matchingSeam(current.family, next.family);
    if (seam) seams.set(seam.id, seam);
  }
  return [...seams.values()];
}

export function getPatternModifiers(state: GameState): PatternModifiers {
  const result = { ...DEFAULT_PATTERN_MODIFIERS };
  for (const patternId of state.player.patternSlots) {
    if (!patternId) continue;
    const pattern = PATTERN_BY_ID[patternId];
    if (pattern) addModifiers(result, pattern.modifiers);
  }
  const seams = getActiveSeams(state);
  state.activeSeams = seams.map((seam) => seam.id);
  for (const seam of seams) addModifiers(result, seam.modifiers);
  return result;
}

export function getWorldModifiers(state: GameState): WorldModifiers {
  const result: WorldModifiers = {
    enemySpeed: 1,
    spawnCount: 1,
    projectileSpeed: 1,
    armorDelta: 0,
    scoreMultiplier: 1,
    tensionRate: 1,
    echoChord: false,
    wildEveryThird: false
  };
  for (const ruleId of state.worldRules) {
    const modifiers = WORLD_RULE_BY_ID[ruleId]?.modifiers;
    if (!modifiers) continue;
    if (modifiers.enemySpeed) result.enemySpeed *= modifiers.enemySpeed;
    if (modifiers.spawnCount) result.spawnCount *= modifiers.spawnCount;
    if (modifiers.projectileSpeed) result.projectileSpeed *= modifiers.projectileSpeed;
    if (modifiers.armorDelta) result.armorDelta += modifiers.armorDelta;
    if (modifiers.scoreMultiplier) result.scoreMultiplier *= modifiers.scoreMultiplier;
    if (modifiers.tensionRate) result.tensionRate *= modifiers.tensionRate;
    result.echoChord ||= modifiers.echoChord ?? false;
    result.wildEveryThird ||= modifiers.wildEveryThird ?? false;
  }
  return result;
}
