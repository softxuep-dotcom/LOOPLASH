import type { EffectState, GameState } from '../core/types';
import { SeededRandom } from '../core/SeededRandom';

export class SimulationContext {
  state: GameState;
  random: SeededRandom;
  private uid = 1;

  constructor(state: GameState) {
    this.state = state;
    this.random = new SeededRandom(state.runSeed);
  }

  replaceState(state: GameState): void {
    this.state = state;
    this.random = new SeededRandom(state.runSeed);
    this.uid = 1;
  }

  nextUid(): number {
    const value = this.uid;
    this.uid += 1;
    return value;
  }

  effect(effect: Omit<EffectState, 'uid' | 'maxLife'> & { maxLife?: number }): void {
    this.state.effects.push({
      ...effect,
      uid: this.nextUid(),
      maxLife: effect.maxLife ?? effect.life
    });
  }

  banner(key: string, duration = 2.4): void {
    this.state.bannerKey = key;
    this.state.bannerTimer = duration;
  }
}
