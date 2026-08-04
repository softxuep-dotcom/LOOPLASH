import Phaser from 'phaser';
import { createGameConfig } from './phaser/config';
import { gameRuntime } from './game/runtime/GameRuntime';
import { HudController } from './ui/HudController';
import './styles.css';

const hudRoot = document.querySelector<HTMLElement>('#hud-root');

if (!hudRoot) {
  throw new Error('HUD root is missing');
}

const hud = new HudController(hudRoot, gameRuntime);
const game = new Phaser.Game(createGameConfig());

if (import.meta.env.DEV) {
  Object.defineProperty(globalThis, '__LOOPLASH_DEBUG__', {
    configurable: true,
    value: {
      snapshot: () => gameRuntime.getSimulation().snapshot(),
      state: () => gameRuntime.getSimulation().context.state
    }
  });
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    gameRuntime.pause('visibility');
  }
});

window.addEventListener('blur', () => gameRuntime.pause('blur'));

window.addEventListener('beforeunload', () => {
  hud.destroy();
  game.destroy(true);
});
