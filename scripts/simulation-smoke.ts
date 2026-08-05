import type { InputFrame, Vec2 } from '../src/game/core/types.ts';
import { GameSimulation } from '../src/game/simulation/GameSimulation.ts';
import { ENEMIES } from '../src/game/content/enemies.ts';
import { ELITES } from '../src/game/content/elites.ts';
import { NEEDLE_LIST } from '../src/game/content/needles.ts';
import { PATTERNS, SEAMS } from '../src/game/content/patterns.ts';
import { WORLD_RULES } from '../src/game/content/worldRules.ts';
import { requiredStageSupply, STAGES } from '../src/game/content/encounters.ts';
import { needleMaxLength } from '../src/game/simulation/loopGeometry.ts';

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Smoke test failed: ${message}`);
}

const idle: InputFrame = {
  deployPressed: false,
  deployHeld: false,
  deployReleased: false,
  steer: { x: 0, y: 0 },
  pointer: null,
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

const objectiveLoop: Vec2[] = [
  { x: -145, y: 45 }, { x: -185, y: -80 }, { x: -125, y: -175 },
  { x: 0, y: -220 }, { x: 125, y: -175 }, { x: 185, y: -80 },
  { x: 145, y: 45 }, { x: 18, y: 100 }
];

function arrangeObjectiveSupply(simulation: GameSimulation): void {
  const state = simulation.context.state;
  const { anchor } = state.player;
  let safeIndex = 0;
  let knotIndex = 0;
  for (const enemy of state.enemies) {
    enemy.speed = 0;
    enemy.vx = 0;
    enemy.vy = 0;
    if (enemy.type === 'bomb-bloom') {
      enemy.x = state.width - 70;
      enemy.y = 82;
    } else if (state.objective.id === 'knotbreak' && enemy.armor > 0) {
      enemy.x = anchor.x + 10 + (knotIndex % 2) * 3;
      enemy.y = anchor.y + 58 + Math.floor(knotIndex / 2) * 3;
      knotIndex += 1;
    } else {
      enemy.x = anchor.x - 54 + (safeIndex % 4) * 36;
      enemy.y = anchor.y - 72 - Math.floor(safeIndex / 4) * 25;
      safeIndex += 1;
    }
  }
  state.motes.forEach((mote, index) => {
    mote.vx = 0;
    mote.vy = 0;
    mote.x = anchor.x - 48 + (index % 4) * 32;
    mote.y = anchor.y - 58 - Math.floor(index / 4) * 24;
  });
}

function playUntilObjectiveComplete(simulation: GameSimulation): void {
  const state = simulation.context.state;
  for (let attempt = 0; attempt < 120 && state.phase === 'playing'; attempt += 1) {
    state.player.invulnerable = 999;
    step(simulation, 45);
    if (state.phase !== 'playing') break;
    arrangeObjectiveSupply(simulation);
    drawLoop(simulation, objectiveLoop);
  }
  invariant(
    state.objective.current >= state.objective.target,
    `stage ${state.stage + 1} objective should be completable through gameplay (${state.objective.current}/${state.objective.target})`
  );
}

function completeStageChoice(simulation: GameSimulation): void {
  const state = simulation.context.state;
  playUntilObjectiveComplete(simulation);
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

function measureStageSupply(stageIndex: number, seed: number): number {
  const stage = STAGES[stageIndex]!;
  const simulation = new GameSimulation(1280, 720, seed);
  const state = simulation.context.state;
  state.stage = stageIndex;
  state.biome = stage.biome;
  state.objective = { id: stage.objective, current: 0, target: stage.target };
  state.stageQuota = stage.quota;
  state.spawnedInStage = stageIndex === 0 ? 3 : 0;
  state.eliteSpawned = false;
  state.enemies = stageIndex === 0 ? state.enemies : [];
  state.projectiles = [];
  state.motes = [];
  state.tutorialStep = 2;
  state.phase = 'playing';
  state.spawnTimer = 0;
  state.bossStarted = false;
  state.player.invulnerable = 999;

  const countedEnemies = new Set<number>();
  const countedMotes = new Set<number>();
  let supply = 0;
  const required = requiredStageSupply(stage.target);
  for (let frame = 0; frame < 60 * 120 && supply < required; frame += 1) {
    simulation.step(1 / 60, idle);
    for (const enemy of state.enemies) {
      if (!countedEnemies.has(enemy.uid)) {
        countedEnemies.add(enemy.uid);
        if (stage.objective === 'harvest' && enemy.type !== 'bomb-bloom') supply += 1;
        if (stage.objective === 'knotbreak') supply += enemy.maxArmor;
      }
      if (!stage.boss) enemy.dead = true;
    }
    for (const mote of state.motes) {
      if (!countedMotes.has(mote.uid)) {
        countedMotes.add(mote.uid);
        if (stage.objective === 'rescue') supply += 1;
      }
    }
  }
  return supply;
}

function verifyStageSupplyInvariant(): void {
  for (let stageIndex = 0; stageIndex < STAGES.length; stageIndex += 1) {
    const stage = STAGES[stageIndex]!;
    const required = requiredStageSupply(stage.target);
    const supplies = [101, 202, 303, 404].map((seed) => measureStageSupply(stageIndex, seed + stageIndex));
    const minimum = Math.min(...supplies);
    invariant(
      minimum >= required,
      `stage ${stageIndex + 1} supply ${minimum} must be >= ceil(${stage.target} * 1.4) = ${required}`
    );
  }
}

invariant(Object.keys(ENEMIES).length === 8, 'Player Fit needs 8 normal enemy definitions');
invariant(Object.keys(ELITES).length === 3, 'Player Fit needs 3 elite definitions');
invariant(NEEDLE_LIST.length === 3, 'Player Fit needs 3 needle definitions');
invariant(PATTERNS.length === 15, 'Player Fit needs 15 patterns');
invariant(WORLD_RULES.length === 6, 'Player Fit needs 6 world rules');
invariant(SEAMS.length === 10, 'Player Fit needs 10 seams');
invariant(new Set(STAGES.map((stage) => stage.biome)).size === 2, 'Player Fit needs 2 biomes');
invariant(ENEMIES['bubble-ray'].armor > 0, 'Bubble Ray must supply knots in reef knotbreak stages');

const zeroSizeSimulation = new GameSimulation(0, 0, 17);
zeroSizeSimulation.resize(0, 720);
invariant(zeroSizeSimulation.context.state.width === 0, 'zero-width resize should leave layout untouched');
zeroSizeSimulation.resize(1280, 720);
invariant(zeroSizeSimulation.context.state.player.anchor.x === 640, 'zero-size initialization should recover to horizontal center');
invariant(zeroSizeSimulation.context.state.player.anchor.y > 400, 'zero-size initialization should recover to the intended vertical position');
invariant(zeroSizeSimulation.context.state.enemies.every((enemy) => enemy.x > 0 && enemy.y > 0), 'recovered enemies should be on-screen');

const normalizedNeedleSimulation = new GameSimulation(1280, 720, 19);
const desktopLength = needleMaxLength(normalizedNeedleSimulation.context.state);
normalizedNeedleSimulation.resize(390, 844);
const portraitLength = needleMaxLength(normalizedNeedleSimulation.context.state);
invariant(Math.abs(desktopLength - 288) < 0.001, 'Dawn reach should use 40% of the 720px short side');
invariant(Math.abs(portraitLength - 156) < 0.001, 'Dawn reach should normalize against the new 390px short side');

verifyStageSupplyInvariant();

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

console.info('Simulation smoke passed: supply margin, responsive layout, real objectives, build choices, biome rule, and boss entry.');
