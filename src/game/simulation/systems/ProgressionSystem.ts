import { STAGES } from '../../content/encounters';
import { PATTERNS } from '../../content/patterns';
import { WORLD_RULES } from '../../content/worldRules';
import { getWorldModifiers } from './BuildSystem';
import type { EnemySystem } from './EnemySystem';
import type { SimulationContext } from '../SimulationContext';

export class ProgressionSystem {
  constructor(
    private readonly context: SimulationContext,
    private readonly enemies: EnemySystem
  ) {}

  initializeRun(): void {
    const { state } = this.context;
    const center = state.player.anchor;
    this.enemies.spawnNormal('puff', { x: center.x - 94, y: center.y - 86 });
    this.enemies.spawnNormal('puff', { x: center.x, y: center.y - 118 });
    this.enemies.spawnNormal('puff', { x: center.x + 94, y: center.y - 86 });
    state.spawnedInStage = 3;
  }

  update(delta: number): void {
    const state = this.context.state;
    if (state.phase !== 'playing') return;
    const stage = STAGES[state.stage];
    if (!stage) return;

    if (stage.boss) {
      if (!state.bossStarted) this.enemies.spawnBoss();
      const bossAlive = state.enemies.some((enemy) => enemy.behavior === 'boss' && !enemy.dead);
      if (state.bossStarted && !bossAlive) {
        state.previousPhase = state.phase;
        state.phase = 'victory';
      }
      return;
    }

    if (state.tutorialStep < 2) return;
    this.spawnForStage(delta);
    const objectiveDone = state.objective.current >= state.objective.target;
    if (objectiveDone) {
      state.stageCompleteTimer += delta;
      if (state.stageCompleteTimer >= 0.85) this.offerPattern();
    } else {
      state.stageCompleteTimer = 0;
    }
  }

  choosePattern(patternId: string): void {
    const state = this.context.state;
    if (state.phase !== 'pattern-choice' || !state.patternChoices.includes(patternId)) return;
    const emptyIndex = state.player.patternSlots.findIndex((slot) => slot === null);
    const targetIndex = emptyIndex >= 0 ? emptyIndex : state.stage % state.player.patternSlots.length;
    state.player.patternSlots[targetIndex] = patternId;
    state.patternChoices = [];
    if (state.awaitingRuleAfterPattern) {
      state.ruleChoices = this.context.random.shuffle(WORLD_RULES).slice(0, 3).map((rule) => rule.id);
      state.previousPhase = state.phase;
      state.phase = 'rule-choice';
    } else {
      this.advanceStage();
    }
  }

  chooseRule(ruleId: string): void {
    const state = this.context.state;
    if (state.phase !== 'rule-choice' || !state.ruleChoices.includes(ruleId)) return;
    state.worldRules.push(ruleId);
    state.ruleChoices = [];
    state.awaitingRuleAfterPattern = false;
    this.advanceStage();
  }

  private spawnForStage(delta: number): void {
    const state = this.context.state;
    const stage = STAGES[state.stage]!;
    const world = getWorldModifiers(state);
    state.spawnTimer -= delta;
    const aliveLimit = Math.min(18, Math.round(10 * world.spawnCount));
    if (state.spawnTimer > 0 || state.spawnedInStage >= state.stageQuota || state.enemies.length >= aliveLimit) return;

    if (stage.objective === 'rescue' && state.motes.length + state.objective.current < state.objective.target + 1
      && state.spawnedInStage % 3 === 0) {
      this.enemies.spawnMote();
    }

    let enemyType = this.context.random.pick(stage.enemyPool);
    if (stage.objective === 'knotbreak' && state.spawnedInStage % 3 === 0) {
      enemyType = stage.biome === 'meadow' ? 'shellbud' : 'bubble-ray';
    }
    this.enemies.spawnNormal(enemyType);
    state.spawnedInStage += 1;

    if (stage.elite && !state.eliteSpawned && state.spawnedInStage >= Math.ceil(state.stageQuota * 0.48)) {
      this.enemies.spawnElite(stage.elite);
      state.eliteSpawned = true;
    }

    const extraChance = Math.max(0, world.spawnCount - 1);
    if (state.spawnedInStage < state.stageQuota && this.context.random.next() < extraChance) {
      this.enemies.spawnNormal(this.context.random.pick(stage.enemyPool));
      state.spawnedInStage += 1;
    }
    state.spawnTimer = this.context.random.range(0.72, 1.22) / Math.max(1, world.enemySpeed * 0.8);
  }

  private offerPattern(): void {
    const state = this.context.state;
    if (state.phase !== 'playing') return;
    const equipped = new Set(state.player.patternSlots.filter((slot): slot is string => slot !== null));
    let pool = PATTERNS.filter((pattern) => !equipped.has(pattern.id));
    if (pool.length < 3) pool = PATTERNS;
    state.patternChoices = this.context.random.shuffle(pool).slice(0, 3).map((pattern) => pattern.id);
    state.awaitingRuleAfterPattern = STAGES[state.stage + 1]?.biome !== STAGES[state.stage]?.biome;
    state.previousPhase = state.phase;
    state.phase = 'pattern-choice';
    state.player.drawing = false;
    state.player.path = [];
  }

  private advanceStage(): void {
    const state = this.context.state;
    state.stage += 1;
    const nextStage = STAGES[state.stage];
    if (!nextStage) {
      state.previousPhase = state.phase;
      state.phase = 'victory';
      return;
    }
    state.biome = nextStage.biome;
    state.objective = { id: nextStage.objective, current: 0, target: nextStage.target };
    state.stageQuota = nextStage.quota;
    state.spawnedInStage = 0;
    state.spawnTimer = 0.85;
    state.eliteSpawned = false;
    state.stageCompleteTimer = 0;
    state.bossStarted = false;
    state.enemies = [];
    state.projectiles = [];
    state.motes = [];
    state.previousPhase = state.phase;
    state.phase = 'playing';
    this.context.banner(nextStage.bannerKey, nextStage.boss ? 3.6 : 2.5);
  }
}
