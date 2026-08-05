import type { ControlMode, NeedleId, RuntimeSnapshot } from '../core/types';
import type { InputFrame } from '../core/types';
import { LocalPlatformAdapter, type PlatformAdapter } from '../platform/PlatformAdapter';
import { GameSimulation } from '../simulation/GameSimulation';

type SnapshotListener = (snapshot: RuntimeSnapshot) => void;

export class GameRuntime {
  private readonly listeners = new Set<SnapshotListener>();
  private readonly platform: PlatformAdapter;
  private simulation: GameSimulation | null = null;
  private lastPhase: RuntimeSnapshot['phase'] = 'ready';
  private emitTimer = 0;

  constructor(platform: PlatformAdapter = new LocalPlatformAdapter()) {
    this.platform = platform;
  }

  initialize(width: number, height: number): GameSimulation {
    if (!this.simulation) {
      this.simulation = new GameSimulation(width, height, Date.now() & 0x7fffffff);
      this.platform.loadingFinished();
      this.lastPhase = this.simulation.snapshot().phase;
      this.emit();
    }
    return this.simulation;
  }

  getSimulation(): GameSimulation {
    if (!this.simulation) throw new Error('Game runtime has not initialized');
    return this.simulation;
  }

  step(delta: number, input: InputFrame): void {
    if (!this.simulation) return;
    this.simulation.step(delta, input);
    const snapshot = this.simulation.snapshot();
    if (snapshot.phase !== this.lastPhase) {
      this.handlePhaseChange(this.lastPhase, snapshot.phase);
      this.lastPhase = snapshot.phase;
      this.emit(snapshot);
    }
    this.emitTimer -= delta;
    if (this.emitTimer <= 0) {
      this.emit(snapshot);
      this.emitTimer = 0.05;
    }
  }

  resize(width: number, height: number): void {
    this.simulation?.resize(width, height);
  }

  chooseNeedle(id: NeedleId): void {
    this.simulation?.chooseNeedle(id);
    this.emit();
  }

  choosePattern(id: string): void {
    this.simulation?.choosePattern(id);
    this.emit();
  }

  chooseRule(id: string): void {
    this.simulation?.chooseRule(id);
    this.emit();
  }

  restart(): void {
    this.platform.gameplayStop();
    this.simulation?.reset();
    this.lastPhase = 'ready';
    this.emit();
  }

  pause(reason = 'manual'): void {
    const before = this.simulation?.snapshot().phase;
    this.simulation?.pause();
    if (before === 'playing') this.platform.measure('pause', reason, 'start');
    this.emit();
  }

  resume(): void {
    this.simulation?.resume();
    this.emit();
  }

  setReducedMotion(enabled: boolean): void {
    this.simulation?.setReducedMotion(enabled);
    this.emit();
  }

  setHighContrast(enabled: boolean): void {
    this.simulation?.setHighContrast(enabled);
    this.emit();
  }

  setControlMode(mode: ControlMode): void {
    this.simulation?.setControlMode(mode);
    this.emit();
  }

  subscribe(listener: SnapshotListener): () => void {
    this.listeners.add(listener);
    if (this.simulation) listener(this.simulation.snapshot());
    return () => this.listeners.delete(listener);
  }

  private emit(snapshot?: RuntimeSnapshot): void {
    if (!this.simulation) return;
    const value = snapshot ?? this.simulation.snapshot();
    for (const listener of this.listeners) listener(value);
  }

  private handlePhaseChange(from: RuntimeSnapshot['phase'], to: RuntimeSnapshot['phase']): void {
    if (from === 'ready' && to === 'playing') {
      this.platform.gameplayStart();
      this.platform.measure('tutorial', 'first-loop', 'start');
    }
    if ((to === 'paused' || to === 'gameover' || to === 'victory') && from === 'playing') {
      this.platform.gameplayStop();
    }
    if (from === 'paused' && to === 'playing') this.platform.gameplayStart();
    if (to === 'gameover') this.platform.measure('run', 'player-fit', 'fail');
    if (to === 'victory') this.platform.measure('run', 'player-fit', 'complete');
  }
}

export const gameRuntime = new GameRuntime();
