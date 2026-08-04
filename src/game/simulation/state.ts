import type { GameState, NeedleId } from '../core/types';
import { STAGES } from '../content/encounters';

export function createInitialState(width: number, height: number, seed: number, needleId: NeedleId = 'dawn'): GameState {
  const center = { x: width * 0.5, y: height * 0.56 };
  const firstStage = STAGES[0]!;
  return {
    phase: 'ready',
    previousPhase: 'ready',
    width,
    height,
    runSeed: seed,
    elapsed: 0,
    stage: 0,
    biome: firstStage.biome,
    objective: { id: firstStage.objective, current: 0, target: firstStage.target },
    player: {
      anchor: { ...center },
      needle: { x: center.x + 42, y: center.y },
      path: [],
      drawing: false,
      tension: 0,
      hearts: 3,
      maxHearts: 3,
      invulnerable: 0,
      shield: 1,
      flow: 1,
      flowGrace: 0,
      score: 0,
      combo: 0,
      capturedShots: 0,
      needleId,
      patternSlots: [null, null, null, null, null, null],
      essences: [],
      totalCaptures: 0,
      lastSnapWasSweet: false
    },
    enemies: [],
    projectiles: [],
    motes: [],
    effects: [],
    worldRules: [],
    activeSeams: [],
    patternChoices: [],
    ruleChoices: [],
    tutorialStep: 0,
    bannerKey: firstStage.bannerKey,
    bannerTimer: 3.2,
    spawnTimer: 0.8,
    spawnedInStage: 0,
    stageQuota: firstStage.quota,
    eliteSpawned: false,
    stageCompleteTimer: 0,
    awaitingRuleAfterPattern: false,
    bossStarted: false,
    reducedMotion: typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    highContrast: false
  };
}
