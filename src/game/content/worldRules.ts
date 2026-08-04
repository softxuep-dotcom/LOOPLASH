import type { WorldRuleDefinition } from '../core/types';

export const WORLD_RULES: WorldRuleDefinition[] = [
  {
    id: 'swift-current', nameKey: 'rule.swiftCurrent.name', descriptionKey: 'rule.swiftCurrent.description', glyph: '➟',
    modifiers: { enemySpeed: 1.14, scoreMultiplier: 1.16 }
  },
  {
    id: 'dense-swarms', nameKey: 'rule.denseSwarms.name', descriptionKey: 'rule.denseSwarms.description', glyph: '⁙',
    modifiers: { spawnCount: 1.3, scoreMultiplier: 1.12 }
  },
  {
    id: 'brittle-knots', nameKey: 'rule.brittleKnots.name', descriptionKey: 'rule.brittleKnots.description', glyph: '⌁',
    modifiers: { armorDelta: -1, projectileSpeed: 1.16 }
  },
  {
    id: 'echo-chord', nameKey: 'rule.echoChord.name', descriptionKey: 'rule.echoChord.description', glyph: '〽',
    modifiers: { echoChord: true, tensionRate: 1.08 }
  },
  {
    id: 'golden-pressure', nameKey: 'rule.goldenPressure.name', descriptionKey: 'rule.goldenPressure.description', glyph: '✦',
    modifiers: { enemySpeed: 1.08, projectileSpeed: 1.08, scoreMultiplier: 1.25 }
  },
  {
    id: 'wild-spool', nameKey: 'rule.wildSpool.name', descriptionKey: 'rule.wildSpool.description', glyph: '✣',
    modifiers: { wildEveryThird: true, spawnCount: 1.12, tensionRate: 1.06 }
  }
];

export const WORLD_RULE_BY_ID = Object.fromEntries(WORLD_RULES.map((rule) => [rule.id, rule])) as Record<string, WorldRuleDefinition>;
