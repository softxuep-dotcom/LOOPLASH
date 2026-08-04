import type { InputFrame, Vec2 } from '../src/game/core/types.ts';
import { GameSimulation } from '../src/game/simulation/GameSimulation.ts';
import { ENEMIES } from '../src/game/content/enemies.ts';
import { ELITES } from '../src/game/content/elites.ts';
import { NEEDLE_LIST } from '../src/game/content/needles.ts';
import { PATTERNS, SEAMS } from '../src/game/content/patterns.ts';
import { WORLD_RULES } from '../src/game/content/worldRules.ts';
import { STAGES } from '../src/game/content/encounters.ts';

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Smoke test failed: ${message}`);
}

const idle: InputFrame = {
  deployPressed: false,
  deployHeld: false,
  deployReleased: false,
  steer: { x: 0, y: 0 },
  pausePressed: false
};

function step(simulation: GameSimulation, frames: number, input: InputFrame = idle): void {
  for (let frame = 0; frame < frames; frame += 1) simulation.step(1 / 60, input);
}

function drawLoop(simulation: GameSimulation, points: Vec2[]): void {
  simulation.step(1 / 60, { ...idle, deployPressed: true, deployHeld: true, steer: points[0]! });
  for (const point of points) step(simulation, 3, { ...idle, deployHeld: true, steer: point });
  simulation.step(1 / 60, { ...idle, deployReleased: true, steer: points.at(-1)! });
}

function completeStageChoice(simulation: GameSimulation): void {
  const state = simulation.context.state;
  state.player.invulnerable = 999;
  state.objective.current = state.objective.target;
  step(simulation, 60);
  invariant(state.phase === 'pattern-choice', `stage ${state.stage + 1} should offer a pattern`);
  const pattern = state.patternChoices[0];
  invariant(pattern, 'pattern offer should contain choices');
  simulation.choosePattern(pattern);
  if (state.phase === 'rule-choice') {
    const rule = state.ruleChoices[0];
    invariant(rule, 'world-rule offer should contain choices');
    simulation.chooseRule(rule);
  }
  invariant(state.phase === 'playing', 'choice should resume play');
}

invariant(Object.keys(ENEMIES).length === 8, 'Player Fit needs 8 normal enemy definitions');
invariant(Object.keys(ELITES).length === 3, 'Player Fit needs 3 elite definitions');
invariant(NEEDLE_LIST.length === 3, 'Player Fit needs 3 needle definitions');
invariant(PATTERNS.length === 15, 'Player Fit needs 15 patterns');
invariant(WORLD_RULES.length === 6, 'Player Fit needs 6 world rules');
invariant(SEAMS.length === 10, 'Player Fit needs 10 seams');
invariant(new Set(STAGES.map((stage) => stage.biome)).size === 2, 'Player Fit needs 2 biomes');

const simulation = new GameSimulation(1280, 720, 20260804);
invariant(simulation.context.state.phase === 'ready', 'run should wait for the first gesture');
drawLoop(simulation, [
  { x: -135, y: 35 }, { x: -175, y: -80 }, { x: -120, y: -175 },
  { x: 0, y: -215 }, { x: 120, y: -175 }, { x: 175, y: -80 },
  { x: 135, y: 35 }, { x: 20, y: 82 }
]);
invariant(simulation.context.state.objective.current >= 3, 'first loop should capture the tutorial trio');
invariant(simulation.context.state.player.score > 0, 'first loop should award score');

completeStageChoice(simulation);
invariant(simulation.context.state.stage === 1, 'first pattern should advance to meadow stage 2');
completeStageChoice(simulation);
invariant(simulation.context.state.stage === 2, 'biome crossing should advance to reef');
invariant(simulation.context.state.worldRules.length === 1, 'biome crossing should add a world rule');
completeStageChoice(simulation);
completeStageChoice(simulation);
invariant(simulation.context.state.stage === 4, 'four completed objectives should reach the boss stage');
step(simulation, 1);
invariant(simulation.context.state.enemies.some((enemy) => enemy.behavior === 'boss'), 'boss stage should spawn Tanglejaw');

console.info('Simulation smoke passed: first loop, build choices, biome rule, and boss entry.');
