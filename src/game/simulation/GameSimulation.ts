import type { ControlMode, InputFrame, NeedleId, RuntimeSnapshot } from '../core/types';
import { NEEDLES } from '../content/needles';
import { createInitialState } from './state';
import { SimulationContext } from './SimulationContext';
import { EnemySystem } from './systems/EnemySystem';
import { LoopSystem } from './systems/LoopSystem';
import { ProgressionSystem } from './systems/ProgressionSystem';
import { getPatternModifiers } from './systems/BuildSystem';

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
    state.patternNoticeTimer = Math.max(0, state.patternNoticeTimer - delta);
    if (state.patternNoticeTimer <= 0) state.patternNoticeId = null;
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
    state.controlMode = old.controlMode;
    this.context.replaceState(state);
    this.progression.initializeRun();
  }

  resize(width: number, height: number): void {
    if (width <= 0 || height <= 0) return;
    const state = this.context.state;
    const oldWidth = state.width;
    const oldHeight = state.height;

    if (oldWidth <= 0 || oldHeight <= 0) {
      state.player.drawing = false;
      state.player.path = [];
      state.player.landingTarget = null;
      state.player.pull = null;
      this.layoutFromUninitializedSize(width, height);
      return;
    }

    this.loop.forceSafeRelease();

    const layoutPoint = (point: { x: number; y: number }): void => {
      const relativeX = point.x / oldWidth;
      const relativeY = point.y / oldHeight;
      point.x = relativeX * width;
      point.y = relativeY * height;
    };

    layoutPoint(state.player.anchor);
    layoutPoint(state.player.needle);
    if (state.player.landingTarget) layoutPoint(state.player.landingTarget);
    if (state.player.pull) {
      layoutPoint(state.player.pull.start);
      layoutPoint(state.player.pull.end);
    }
    for (const point of state.player.path) layoutPoint(point);
    for (const enemy of state.enemies) layoutPoint(enemy);
    for (const projectile of state.projectiles) layoutPoint(projectile);
    for (const mote of state.motes) layoutPoint(mote);
    for (const effect of state.effects) {
      layoutPoint(effect);
      if (effect.x2 !== undefined && effect.y2 !== undefined) {
        const endpoint = { x: effect.x2, y: effect.y2 };
        layoutPoint(endpoint);
        effect.x2 = endpoint.x;
        effect.y2 = endpoint.y;
      }
    }
    state.width = width;
    state.height = height;
  }

  private layoutFromUninitializedSize(width: number, height: number): void {
    const state = this.context.state;
    const previousAnchor = { ...state.player.anchor };
    const nextAnchor = { x: width * 0.5, y: height * 0.56 };
    const logicalSize = 720;
    const shortSide = Math.min(width, height);
    const layoutAroundAnchor = (point: { x: number; y: number }): void => {
      const relativeX = (point.x - previousAnchor.x) / logicalSize;
      const relativeY = (point.y - previousAnchor.y) / logicalSize;
      point.x = nextAnchor.x + relativeX * shortSide;
      point.y = nextAnchor.y + relativeY * shortSide;
    };

    layoutAroundAnchor(state.player.needle);
    for (const point of state.player.path) layoutAroundAnchor(point);
    for (const enemy of state.enemies) layoutAroundAnchor(enemy);
    for (const projectile of state.projectiles) layoutAroundAnchor(projectile);
    for (const mote of state.motes) layoutAroundAnchor(mote);
    for (const effect of state.effects) {
      layoutAroundAnchor(effect);
      if (effect.x2 !== undefined && effect.y2 !== undefined) {
        const endpoint = { x: effect.x2, y: effect.y2 };
        layoutAroundAnchor(endpoint);
        effect.x2 = endpoint.x;
        effect.y2 = endpoint.y;
      }
    }
    state.player.anchor.x = nextAnchor.x;
    state.player.anchor.y = nextAnchor.y;
    state.width = width;
    state.height = height;
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

  setControlMode(mode: ControlMode): void {
    const state = this.context.state;
    if (state.controlMode === mode) return;
    this.loop.forceSafeRelease();
    state.controlMode = mode;
    state.player.pull = null;
    state.player.recovery = 0;
    state.player.landingTarget = null;
    state.player.path = [];
    state.player.drawing = false;
    state.player.tension = 0;
  }

  snapshot(): RuntimeSnapshot {
    const state = this.context.state;
    const needle = NEEDLES[state.player.needleId];
    const modifiers = getPatternModifiers(state);
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
      recovery: state.player.recovery,
      capturedShots: state.player.capturedShots,
      projectileCapacity: needle.projectileCapacity + Math.round(modifiers.projectileCapacity),
      needleId: state.player.needleId,
      patternSlots: [...state.player.patternSlots],
      essences: [...state.player.essences],
      worldRules: [...state.worldRules],
      activeSeams: [...state.activeSeams],
      patternChoices: [...state.patternChoices],
      ruleChoices: [...state.ruleChoices],
      patternNoticeId: state.patternNoticeId,
      bannerKey: state.bannerKey,
      tutorialStep: state.tutorialStep,
      controlMode: state.controlMode,
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
