import type { InputFrame, NeedleId, RuntimeSnapshot } from '../core/types';
import { createInitialState } from './state';
import { SimulationContext } from './SimulationContext';
import { EnemySystem } from './systems/EnemySystem';
import { LoopSystem } from './systems/LoopSystem';
import { ProgressionSystem } from './systems/ProgressionSystem';

export class GameSimulation {
  readonly context: SimulationContext;
  readonly enemies: EnemySystem;
  readonly loop: LoopSystem;
  readonly progression: ProgressionSystem;

  constructor(width: number, height: number, seed: number) {
    this.context = new SimulationContext(createInitialState(width, height, seed));
    this.enemies = new EnemySystem(this.context);
    this.loop = new LoopSystem(this.context, this.enemies);
    this.progression = new ProgressionSystem(this.context, this.enemies);
    this.progression.initializeRun();
  }

  step(delta: number, input: InputFrame): void {
    const state = this.context.state;
    if (input.pausePressed) this.togglePause();
    if (state.phase === 'paused' || state.phase === 'gameover' || state.phase === 'victory'
      || state.phase === 'pattern-choice' || state.phase === 'rule-choice') {
      this.updateEffects(delta * 0.25);
      return;
    }
    state.elapsed += delta;
    state.bannerTimer = Math.max(0, state.bannerTimer - delta);
    if (state.bannerTimer <= 0) state.bannerKey = '';
    this.loop.update(delta, input);
    if (state.phase === 'playing') {
      this.enemies.update(delta);
      this.progression.update(delta);
    }
    this.updateEffects(delta);
  }

  reset(seed = Date.now() & 0x7fffffff): void {
    const old = this.context.state;
    const state = createInitialState(old.width, old.height, seed, old.player.needleId);
    state.reducedMotion = old.reducedMotion;
    state.highContrast = old.highContrast;
    this.context.replaceState(state);
    this.progression.initializeRun();
  }

  resize(width: number, height: number): void {
    const state = this.context.state;
    const oldWidth = Math.max(1, state.width);
    const oldHeight = Math.max(1, state.height);
    const scaleX = width / oldWidth;
    const scaleY = height / oldHeight;
    state.width = width;
    state.height = height;
    state.player.anchor.x *= scaleX;
    state.player.anchor.y *= scaleY;
    state.player.needle.x *= scaleX;
    state.player.needle.y *= scaleY;
    for (const enemy of state.enemies) {
      enemy.x *= scaleX;
      enemy.y *= scaleY;
    }
    for (const projectile of state.projectiles) {
      projectile.x *= scaleX;
      projectile.y *= scaleY;
    }
    this.loop.forceSafeRelease();
  }

  chooseNeedle(needleId: NeedleId): void {
    const state = this.context.state;
    if (state.phase !== 'ready' && state.phase !== 'gameover') return;
    state.player.needleId = needleId;
  }

  choosePattern(patternId: string): void {
    this.progression.choosePattern(patternId);
  }

  chooseRule(ruleId: string): void {
    this.progression.chooseRule(ruleId);
  }

  pause(): void {
    const state = this.context.state;
    if (state.phase !== 'playing' && state.phase !== 'ready') return;
    this.loop.forceSafeRelease();
    state.previousPhase = state.phase;
    state.phase = 'paused';
  }

  resume(): void {
    const state = this.context.state;
    if (state.phase !== 'paused') return;
    state.phase = state.previousPhase === 'ready' ? 'ready' : 'playing';
  }

  togglePause(): void {
    if (this.context.state.phase === 'paused') this.resume();
    else this.pause();
  }

  setReducedMotion(enabled: boolean): void {
    this.context.state.reducedMotion = enabled;
  }

  setHighContrast(enabled: boolean): void {
    this.context.state.highContrast = enabled;
  }

  snapshot(): RuntimeSnapshot {
    const state = this.context.state;
    return {
      phase: state.phase,
      stage: state.stage,
      biome: state.biome,
      objective: { ...state.objective },
      score: state.player.score,
      hearts: state.player.hearts,
      maxHearts: state.player.maxHearts,
      shield: state.player.shield,
      flow: state.player.flow,
      tension: state.player.tension,
      needleId: state.player.needleId,
      patternSlots: [...state.player.patternSlots],
      essences: [...state.player.essences],
      worldRules: [...state.worldRules],
      activeSeams: [...state.activeSeams],
      patternChoices: [...state.patternChoices],
      ruleChoices: [...state.ruleChoices],
      bannerKey: state.bannerKey,
      tutorialStep: state.tutorialStep,
      reducedMotion: state.reducedMotion,
      highContrast: state.highContrast
    };
  }

  private updateEffects(delta: number): void {
    const state = this.context.state;
    for (const effect of state.effects) effect.life -= delta;
    state.effects = state.effects.filter((effect) => effect.life > 0);
  }
}
