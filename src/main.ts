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

  if (new URLSearchParams(window.location.search).get('scenario') === 'rescue') {
    const showRescueScenario = (): void => {
      try {
        const simulation = gameRuntime.getSimulation();
        const state = simulation.context.state;
        state.phase = 'playing';
        state.previousPhase = 'playing';
        state.stage = 2;
        state.biome = 'reef';
        state.objective = { id: 'rescue', current: 0, target: 5 };
        state.tutorialStep = 4;
        state.bannerKey = 'banner.rescue';
        state.bannerTimer = 2.5;
        state.spawnTimer = 999;
        state.enemies = [];
        state.motes = [];
        state.projectiles = [];
        state.player.invulnerable = 999;
        const bomb = simulation.enemies.spawnNormal('bomb-bloom', {
          x: state.width * 0.69,
          y: state.height * 0.36
        });
        bomb.speed = 0;
        for (const point of [
          { x: state.width * 0.31, y: state.height * 0.36 },
          { x: state.width * 0.5, y: state.height * 0.53 }
        ]) {
          simulation.enemies.spawnMote();
          Object.assign(state.motes.at(-1)!, point, { vx: 0, vy: 0 });
        }
      } catch {
        window.requestAnimationFrame(showRescueScenario);
      }
    };
    window.requestAnimationFrame(showRescueScenario);
  }
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
