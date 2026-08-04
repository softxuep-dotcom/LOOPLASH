import Phaser from 'phaser';
import { gameRuntime } from '../../game/runtime/GameRuntime';
import { GameInputAdapter } from '../input/GameInputAdapter';
import { WorldRenderer } from '../view/WorldRenderer';

const FIXED_STEP = 1 / 60;
/** Phaser owns platform input and drawing; gameplay remains in GameSimulation. */
export class GameScene extends Phaser.Scene {
  private inputAdapter!: GameInputAdapter;
  private worldRenderer!: WorldRenderer;
  private accumulator = 0;

  constructor() {
    super('game');
  }

  create(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    gameRuntime.initialize(width, height);
    this.inputAdapter = new GameInputAdapter(this);
    this.worldRenderer = new WorldRenderer(this);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroyScene, this);
  }

  update(_time: number, deltaMs: number): void {
    const frameDelta = Math.min(deltaMs / 1000, 0.1);
    this.accumulator = Math.min(this.accumulator + frameDelta, FIXED_STEP * 5);
    while (this.accumulator >= FIXED_STEP) {
      gameRuntime.step(FIXED_STEP, this.inputAdapter.poll(FIXED_STEP));
      this.accumulator -= FIXED_STEP;
    }
    this.worldRenderer.render(gameRuntime.getSimulation().context.state);
  }

  private handleResize(gameSize: Phaser.Structs.Size): void {
    gameRuntime.resize(gameSize.width, gameSize.height);
  }

  private destroyScene(): void {
    this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.inputAdapter.destroy();
    this.worldRenderer.destroy();
  }
}
