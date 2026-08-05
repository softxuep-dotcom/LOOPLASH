import type { PatternDefinition, PatternModifiers, SeamDefinition } from '../core/types';

export const DEFAULT_PATTERN_MODIFIERS: PatternModifiers = {
  chordRepeats: 0,
  chordDamage: 1,
  captureTolerance: 1,
  tensionRate: 1,
  anchorPull: 1,
  projectileCapacity: 0,
  reflectedPower: 1,
  tightShield: 0,
  healEvery: 0,
  flowGrace: 0,
  snapBlast: 0,
  scoreMultiplier: 1
};

export const PATTERNS: PatternDefinition[] = [
  { id: 'backstitch', nameKey: 'pattern.backstitch.name', descriptionKey: 'pattern.backstitch.description', family: 'ember', glyph: '↯', color: 0xff6b62, modifiers: { chordRepeats: 1 } },
  { id: 'ember-edge', nameKey: 'pattern.emberEdge.name', descriptionKey: 'pattern.emberEdge.description', family: 'ember', glyph: '△', color: 0xff8065, modifiers: { chordDamage: 0.9 } },
  { id: 'flare-knot', nameKey: 'pattern.flareKnot.name', descriptionKey: 'pattern.flareKnot.description', family: 'ember', glyph: '✹', color: 0xffaa50, modifiers: { snapBlast: 110 } },
  { id: 'hot-flow', nameKey: 'pattern.hotFlow.name', descriptionKey: 'pattern.hotFlow.description', family: 'ember', glyph: '⌁', color: 0xffca64, modifiers: { flowGrace: 0.75 } },

  { id: 'undertow', nameKey: 'pattern.undertow.name', descriptionKey: 'pattern.undertow.description', family: 'tide', glyph: '≋', color: 0x54cfe0, modifiers: { anchorPull: 0.32 } },
  { id: 'soft-spool', nameKey: 'pattern.softSpool.name', descriptionKey: 'pattern.softSpool.description', family: 'tide', glyph: '◌', color: 0x73d9f0, modifiers: { tensionRate: -0.18 } },
  { id: 'wide-wake', nameKey: 'pattern.wideWake.name', descriptionKey: 'pattern.wideWake.description', family: 'tide', glyph: '◯', color: 0x82bfff, modifiers: { captureTolerance: 0.22 } },
  { id: 'tide-score', nameKey: 'pattern.tideScore.name', descriptionKey: 'pattern.tideScore.description', family: 'tide', glyph: '≈', color: 0x659cff, modifiers: { scoreMultiplier: 0.18 } },

  { id: 'patchwork', nameKey: 'pattern.patchwork.name', descriptionKey: 'pattern.patchwork.description', family: 'seed', glyph: '⬡', color: 0x81d879, modifiers: { tightShield: 1 } },
  { id: 'starbud', nameKey: 'pattern.starbud.name', descriptionKey: 'pattern.starbud.description', family: 'seed', glyph: '❋', color: 0xa4e078, modifiers: { healEvery: 8 } },
  { id: 'seed-burst', nameKey: 'pattern.seedBurst.name', descriptionKey: 'pattern.seedBurst.description', family: 'seed', glyph: '✤', color: 0xc3e67c, modifiers: { snapBlast: 82 } },
  { id: 'green-flow', nameKey: 'pattern.greenFlow.name', descriptionKey: 'pattern.greenFlow.description', family: 'seed', glyph: '♧', color: 0x71d69f, modifiers: { flowGrace: 0.55 } },

  { id: 'splitglass', nameKey: 'pattern.splitglass.name', descriptionKey: 'pattern.splitglass.description', family: 'prism', glyph: '◇', color: 0xb99cff, modifiers: { reflectedPower: 0.8 } },
  { id: 'prism-guard', nameKey: 'pattern.prismGuard.name', descriptionKey: 'pattern.prismGuard.description', family: 'prism', glyph: '◈', color: 0xa996ff, modifiers: { projectileCapacity: 2 } },
  { id: 'facet', nameKey: 'pattern.facet.name', descriptionKey: 'pattern.facet.description', family: 'prism', glyph: '⌑', color: 0xd09cff, modifiers: { chordDamage: 0.7, captureTolerance: 0.1 } }
];

export const PATTERN_BY_ID = Object.fromEntries(PATTERNS.map((pattern) => [pattern.id, pattern])) as Record<string, PatternDefinition>;

export const SEAMS: SeamDefinition[] = [
  { id: 'furnace', nameKey: 'seam.furnace', familyA: 'ember', familyB: 'ember', modifiers: { chordDamage: 0.45 } },
  { id: 'deep-current', nameKey: 'seam.deepCurrent', familyA: 'tide', familyB: 'tide', modifiers: { tensionRate: -0.1 } },
  { id: 'living-knot', nameKey: 'seam.livingKnot', familyA: 'seed', familyB: 'seed', modifiers: { healEvery: 7 } },
  { id: 'hall-of-mirrors', nameKey: 'seam.hallOfMirrors', familyA: 'prism', familyB: 'prism', modifiers: { reflectedPower: 0.65 } },
  { id: 'steam-lash', nameKey: 'seam.steamLash', familyA: 'ember', familyB: 'tide', modifiers: { snapBlast: 34 } },
  { id: 'cinder-bloom', nameKey: 'seam.cinderBloom', familyA: 'ember', familyB: 'seed', modifiers: { tightShield: 1 } },
  { id: 'flare-lens', nameKey: 'seam.flareLens', familyA: 'ember', familyB: 'prism', modifiers: { chordRepeats: 1 } },
  { id: 'kelp-current', nameKey: 'seam.kelpCurrent', familyA: 'tide', familyB: 'seed', modifiers: { anchorPull: 0.14, flowGrace: 0.2 } },
  { id: 'mirror-wake', nameKey: 'seam.mirrorWake', familyA: 'tide', familyB: 'prism', modifiers: { projectileCapacity: 1, captureTolerance: 0.08 } },
  { id: 'crystal-bud', nameKey: 'seam.crystalBud', familyA: 'seed', familyB: 'prism', modifiers: { reflectedPower: 0.35, healEvery: 12 } }
];
