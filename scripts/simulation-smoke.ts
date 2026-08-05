import type { InputFrame, NeedleId, Vec2 } from '../src/game/core/types.ts';
import { GameSimulation } from '../src/game/simulation/GameSimulation.ts';
import { ENEMIES } from '../src/game/content/enemies.ts';
import { ELITES } from '../src/game/content/elites.ts';
import { NEEDLES, NEEDLE_LIST } from '../src/game/content/needles.ts';
import { PATTERNS, SEAMS } from '../src/game/content/patterns.ts';
import { WORLD_RULES } from '../src/game/content/worldRules.ts';
import { requiredStageSupply, STAGES } from '../src/game/content/encounters.ts';
import { BOMB_MOTE_MIN_DISTANCE, RESCUE_LOOP_RADIUS } from '../src/game/content/rescueRules.ts';
import { needleMaxLength } from '../src/game/simulation/loopGeometry.ts';
import { evaluateLoopQuality } from '../src/game/simulation/loopScoring.ts';
import {
  clampLandingPoint,
  landingHazardClearance,
  poleOfInaccessibility,
  safeLandingPoint
} from '../src/game/simulation/landingGeometry.ts';
import { pointInPolygon } from '../src/game/core/math.ts';
import { hurtPlayer } from '../src/game/simulation/systems/EnemySystem.ts';

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
  const state = simulation.context.state;
  for (let frame = 0; frame < 30 && state.player.pull; frame += 1) step(simulation, 1);
  if (state.controlMode === 'drag-anchor') {
    simulation.step(1 / 60, { ...idle, deployPressed: true, deployHeld: true, steer: points[0]! });
    for (const point of points) step(simulation, 3, { ...idle, deployHeld: true, steer: point });
    simulation.step(1 / 60, { ...idle, deployReleased: true, steer: points.at(-1)! });
    return;
  }
  const origin = { ...state.player.anchor };
  const absolute = points.map((point) => ({ x: origin.x + point.x, y: origin.y + point.y }));
  simulation.step(1 / 60, { ...idle, deployPressed: true, deployHeld: true, pointer: absolute[0]! });
  for (const point of absolute) step(simulation, 3, { ...idle, deployHeld: true, pointer: point });
  simulation.step(1 / 60, { ...idle, deployReleased: true, pointer: absolute.at(-1)! });
}

function measureNeedleScore(needleId: NeedleId): number {
  const simulation = new GameSimulation(1280, 720, 29);
  simulation.setControlMode('drag-anchor');
  simulation.chooseNeedle(needleId);
  const state = simulation.context.state;
  const scale = NEEDLES[needleId].maxLength / NEEDLES.dawn.maxLength;
  const offsets = [-72, 0, 72];
  state.enemies.forEach((enemy, index) => {
    enemy.speed = 0;
    enemy.x = state.player.anchor.x + offsets[index]! * scale;
    enemy.y = state.player.anchor.y - 74 * scale;
  });
  drawLoop(simulation, objectiveLoop.map((point) => ({ x: point.x * scale, y: point.y * scale })));
  return state.player.score;
}

const scribbleLoop: Vec2[] = [
  { x: -265, y: 0 }, { x: 0, y: -250 }, { x: 265, y: 0 }, { x: 0, y: 225 },
  { x: -210, y: -35 }, { x: 35, y: -195 }, { x: 210, y: 45 }, { x: -25, y: 170 },
  { x: -160, y: 25 }, { x: 25, y: -135 }, { x: 150, y: 20 }, { x: 18, y: 100 }
];

function measureScribbleScore(needleId: NeedleId): number {
  const simulation = new GameSimulation(1280, 720, 31);
  simulation.setControlMode('drag-anchor');
  simulation.chooseNeedle(needleId);
  const state = simulation.context.state;
  const offsets = [-54, 0, 54];
  state.enemies.forEach((enemy, index) => {
    enemy.speed = 0;
    enemy.x = state.player.anchor.x + offsets[index]!;
    enemy.y = state.player.anchor.y - 58;
  });
  drawLoop(simulation, scribbleLoop);
  return state.player.score;
}

function measureRepeatedScribbleScore(needleId: NeedleId): number {
  const simulation = new GameSimulation(1280, 720, 37);
  simulation.setControlMode('drag-anchor');
  simulation.chooseNeedle(needleId);
  const state = simulation.context.state;
  state.spawnTimer = 999;
  for (let round = 0; round < 8; round += 1) {
    state.enemies = [];
    state.player.invulnerable = 999;
    for (const offset of [-54, 0, 54]) {
      const enemy = simulation.enemies.spawnNormal('puff', {
        x: state.player.anchor.x + offset,
        y: state.player.anchor.y - 58
      });
      enemy.speed = 0;
    }
    drawLoop(simulation, scribbleLoop);
  }
  return state.player.score;
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
      const chordMidpoint = state.controlMode !== 'drag-anchor'
        ? { x: -64, y: 73 }
        : { x: 10, y: 58 };
      enemy.x = anchor.x + chordMidpoint.x + (knotIndex % 2) * 3;
      enemy.y = anchor.y + chordMidpoint.y + Math.floor(knotIndex / 2) * 3;
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
  state.tutorialStep = 4;
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

function verifySimpleRescueLoops(): void {
  const verifyPair = (x: number, y: number, seed: number): void => {
    const simulation = new GameSimulation(390, 844, seed);
    const state = simulation.context.state;
    state.phase = 'playing';
    state.stage = 2;
    state.objective = { id: 'rescue', current: 0, target: 5 };
    state.tutorialStep = 4;
    state.spawnTimer = 999;
    state.enemies = [];
    state.motes = [];
    state.projectiles = [];
    state.player.invulnerable = 999;
    const bomb = simulation.enemies.spawnNormal('bomb-bloom', { x, y });
    bomb.speed = 0;
    simulation.enemies.spawnMote();
    const mote = state.motes[0]!;
    mote.x = x;
    mote.y = y;
    mote.vx = 0;
    mote.vy = 0;
    step(simulation, 12);
    invariant(
      Math.hypot(bomb.x - mote.x, bomb.y - mote.y) >= BOMB_MOTE_MIN_DISTANCE - 0.5,
      'rescue rules must separate an overlapping bomb far enough for a plain small circle'
    );
  };

  verifyPair(195, 260, 701);
  verifyPair(40, 70, 702);

  const simulation = new GameSimulation(1280, 720, 703);
  const state = simulation.context.state;
  state.phase = 'playing';
  state.stage = 2;
  state.objective = { id: 'rescue', current: 0, target: 5 };
  state.tutorialStep = 4;
  state.spawnTimer = 999;
  state.enemies = [];
  state.motes = [];
  state.projectiles = [];
  state.player.invulnerable = 999;
  const moteCenter = { x: state.player.anchor.x, y: state.player.anchor.y - 170 };
  simulation.enemies.spawnMote();
  const mote = state.motes[0]!;
  Object.assign(mote, moteCenter, { vx: 0, vy: 0 });
  const bomb = simulation.enemies.spawnNormal('bomb-bloom', {
    x: moteCenter.x + BOMB_MOTE_MIN_DISTANCE,
    y: moteCenter.y
  });
  bomb.speed = 0;
  const heartsBefore = state.player.hearts;
  const circle = Array.from({ length: 24 }, (_, index) => {
    const angle = index / 24 * Math.PI * 2;
    return {
      x: moteCenter.x - state.player.anchor.x + Math.cos(angle) * RESCUE_LOOP_RADIUS,
      y: moteCenter.y - state.player.anchor.y + Math.sin(angle) * RESCUE_LOOP_RADIUS
    };
  });
  drawLoop(simulation, circle);
  invariant(state.objective.current === 1, 'one ordinary convex circle should rescue one separated mote');
  invariant(!bomb.dead && state.player.hearts === heartsBefore,
    'the same ordinary rescue circle must leave the separated bomb outside');
}

function crescent(depth: number): Vec2[] {
  const radius = 140;
  const innerRadius = 118;
  const shift = radius * depth;
  const outer = Array.from({ length: 33 }, (_, index) => {
    const angle = -Math.PI * 0.5 - (index / 32) * Math.PI;
    return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
  });
  const inner = Array.from({ length: 33 }, (_, index) => {
    const angle = Math.PI * 0.5 + (index / 32) * Math.PI;
    return { x: shift + Math.cos(angle) * innerRadius, y: Math.sin(angle) * innerRadius };
  });
  return [...outer, ...inner];
}

function verifyLandingGeometry(): void {
  for (const depth of [0.15, 0.3, 0.45, 0.6, 0.75, 0.9]) {
    const polygon = crescent(depth);
    const landing = poleOfInaccessibility(polygon, 0.75);
    invariant(landing && pointInPolygon(landing, polygon), `crescent ${depth.toFixed(2)} landing must remain inside its concave loop`);
  }

  const crossing = [
    { x: 0, y: 0 }, { x: 150, y: 140 }, { x: 0, y: 140 }, { x: 150, y: 0 }
  ];
  const crossingLanding = poleOfInaccessibility(crossing, 0.75);
  invariant(crossingLanding && pointInPolygon(crossingLanding, crossing), 'self-crossing stroke landing must choose a filled lobe');
  const clamped = clampLandingPoint({ x: -40, y: 900 }, 390, 844);
  invariant(clamped.x === 30 && clamped.y === 814, 'landing ghost must expose the same arena-clamped target used by movement');

  const safeSquare = [
    { x: 100, y: 100 }, { x: 340, y: 100 }, { x: 340, y: 340 }, { x: 100, y: 340 }
  ];
  const centerHazard = [{ x: 220, y: 220, radius: 86 }];
  const safeLanding = safeLandingPoint(safeSquare, centerHazard, 440, 440, 1);
  invariant(safeLanding && pointInPolygon(safeLanding, safeSquare), 'risk-aware landing must remain inside the drawn loop');
  invariant(landingHazardClearance(safeLanding, centerHazard) > 0,
    'risk-aware landing should move away from an occupied geometric pole');
}

function verifyRemoteCastMechanics(): void {
  const simulation = new GameSimulation(1280, 720, 8181);
  simulation.setControlMode('pull-cast');
  const state = simulation.context.state;
  invariant(state.controlMode === 'pull-cast', 'legacy pull-cast branch should remain testable');
  state.phase = 'playing';
  state.tutorialStep = 4;
  state.enemies = [];
  state.motes = [];
  state.projectiles = [];
  state.spawnTimer = 999;
  state.player.flow = 2;
  state.player.flowGrace = 999;
  const start = { ...state.player.anchor };
  const remoteLoop = Array.from({ length: 20 }, (_, index) => {
    const angle = (index / 20) * Math.PI * 2;
    return { x: 170 + Math.cos(angle) * 68, y: Math.sin(angle) * 68 };
  });
  drawLoop(simulation, remoteLoop);
  const pull = state.player.pull;
  invariant(pull, 'a valid empty remote loop should remain a legal movement action');
  invariant(Math.hypot(state.player.anchor.x - start.x, state.player.anchor.y - start.y) < 0.01,
    'capture resolution must finish before pull movement begins');
  invariant(Math.abs(state.player.flow - 1.65) < 0.001, 'an empty movement loop should keep the existing -0.35 Flow cost');
  invariant(pull.duration <= 0.2 && Math.max(pull.duration, state.player.recovery) <= 0.5,
    'pull and soft recovery must stay within the 0.5s response budget');
  const hearts = state.player.hearts;
  hurtPlayer(simulation.context, 1, state.player.anchor.x, state.player.anchor.y);
  invariant(state.player.hearts === hearts, 'travel frames should be damage-immune');
  for (let frame = 0; frame < 30 && state.player.pull; frame += 1) step(simulation, 1);
  invariant(!state.player.pull, 'remote pull should finish promptly');
  invariant(Math.hypot(state.player.anchor.x - pull.end.x, state.player.anchor.y - pull.end.y) < 0.01,
    'player must finish at the exact ghost destination');
  invariant(state.player.invulnerable >= 0.5, 'arrival should grant a short protection window');
  for (let frame = 0; frame < 30 && state.player.recovery > 0; frame += 1) step(simulation, 1);

  state.player.invulnerable = 0;
  state.player.shield = 0;
  const origin = { ...state.player.anchor };
  const stroke = [
    { x: origin.x - 55, y: origin.y - 55 },
    { x: origin.x + 55, y: origin.y - 55 },
    { x: origin.x + 55, y: origin.y + 55 },
    { x: origin.x - 55, y: origin.y + 55 }
  ];
  simulation.step(1 / 60, { ...idle, deployPressed: true, deployHeld: true, pointer: stroke[0]! });
  for (const point of stroke.slice(1)) simulation.step(1 / 60, { ...idle, deployHeld: true, pointer: point });
  invariant(state.player.drawing, 'remote hit test should have an active valid stroke');
  hurtPlayer(simulation.context, 1, state.player.anchor.x, state.player.anchor.y);
  invariant(state.player.pendingWeakSnap, 'damage should request a weak snap');
  simulation.step(1 / 60, idle);
  invariant(!state.player.drawing && !state.player.lastSnapWasSweet && state.player.recovery > 0,
    'weak snap should resolve the loop with forced recovery');
}

function verifyFixedRemoteCastMechanics(): void {
  const simulation = new GameSimulation(1280, 720, 8282);
  const state = simulation.context.state;
  invariant(state.controlMode === 'remote-cast', 'fixed remote cast should be the default player-facing mode');
  state.phase = 'playing';
  state.tutorialStep = 2;
  state.enemies = [];
  state.spawnTimer = 999;
  state.player.flow = 2;
  state.player.flowGrace = 999;
  const start = { ...state.player.anchor };
  const remoteLoop = Array.from({ length: 20 }, (_, index) => {
    const angle = (index / 20) * Math.PI * 2;
    return { x: 170 + Math.cos(angle) * 68, y: Math.sin(angle) * 68 };
  });
  drawLoop(simulation, remoteLoop);
  invariant(!state.player.pull, 'fixed remote cast must never start automatic player movement');
  invariant(!state.player.landingTarget, 'fixed remote cast must not expose a misleading landing ghost');
  invariant(Math.hypot(state.player.anchor.x - start.x, state.player.anchor.y - start.y) < 0.01,
    'fixed remote cast must leave the player at the original center');
  invariant(Math.abs(state.player.flow - 1.65) < 0.001,
    'empty fixed casts should retain the existing Flow penalty');
}

function verifyRemoteStrainBands(): void {
  const sweetSimulation = new GameSimulation(1280, 720, 9191);
  const sweetState = sweetSimulation.context.state;
  sweetState.phase = 'playing';
  sweetState.stage = 1;
  sweetState.tutorialStep = 4;
  sweetState.enemies = [];
  sweetState.spawnTimer = 999;
  drawLoop(sweetSimulation, objectiveLoop);
  invariant(sweetState.player.lastSnapWasSweet, 'a deliberate medium loop should land in the 0.65-0.88 sweet band');
  const sweetRecovery = sweetState.player.recovery;

  const forcedSimulation = new GameSimulation(1280, 720, 9292);
  const forcedState = forcedSimulation.context.state;
  forcedState.phase = 'playing';
  forcedState.stage = 1;
  forcedState.tutorialStep = 4;
  forcedState.enemies = [];
  forcedState.spawnTimer = 999;
  const origin = { ...forcedState.player.anchor };
  const oversized = Array.from({ length: 40 }, (_, index) => {
    const angle = (index / 40) * Math.PI * 2;
    return { x: origin.x + Math.cos(angle) * 245, y: origin.y + Math.sin(angle) * 245 };
  });
  forcedSimulation.step(1 / 60, { ...idle, deployPressed: true, deployHeld: true, pointer: oversized[0]! });
  for (const point of oversized.slice(1)) {
    if (!forcedState.player.drawing) break;
    forcedSimulation.step(1 / 60, { ...idle, deployHeld: true, pointer: point });
  }
  invariant(!forcedState.player.drawing && !forcedState.player.lastSnapWasSweet,
    'squared stroke cost should force an oversized loop before a full orbit');
  invariant(forcedState.player.recovery > sweetRecovery * 2,
    'overstrain should produce materially longer soft recovery than a sweet loop');
}

invariant(Object.keys(ENEMIES).length === 8, 'Player Fit needs 8 normal enemy definitions');
invariant(Object.keys(ELITES).length === 3, 'Player Fit needs 3 elite definitions');
invariant(NEEDLE_LIST.length === 3, 'Player Fit needs 3 needle definitions');
invariant(PATTERNS.length === 15, 'Player Fit needs 15 patterns');
invariant((PATTERNS.find((pattern) => pattern.id === 'flare-knot')?.modifiers.snapBlast ?? 0) >= 80,
  'a visible snap-blast choice must have a gameplay-readable radius');
invariant((PATTERNS.find((pattern) => pattern.id === 'undertow')?.modifiers.anchorPull ?? 0) >= 0.3,
  'a pull-speed choice must create a noticeable movement difference');
invariant((PATTERNS.find((pattern) => pattern.id === 'soft-spool')?.modifiers.tensionRate ?? 0) <= -0.15,
  'a strain-control choice must noticeably extend the drawable stroke');
invariant(WORLD_RULES.length === 6, 'Player Fit needs 6 world rules');
invariant(SEAMS.length === 10, 'Player Fit needs 10 seams');
invariant(new Set(STAGES.map((stage) => stage.biome)).size === 2, 'Player Fit needs 2 biomes');
invariant(ENEMIES['bubble-ray'].armor > 0, 'Bubble Ray must supply knots in reef knotbreak stages');
invariant(new GameSimulation(1280, 720, 1).context.state.player.shield === 2,
  'the opening stage should provide two layers of learning-room shield');
const openingSafetySimulation = new GameSimulation(1280, 720, 2);
openingSafetySimulation.context.state.phase = 'playing';
openingSafetySimulation.context.state.tutorialStep = 2;
const openingSafetyState = openingSafetySimulation.context.state;
const openingShield = openingSafetyState.player.shield;
const openingHeart = openingSafetyState.player.hearts;
for (const enemy of openingSafetyState.enemies) {
  enemy.x = openingSafetyState.player.anchor.x;
  enemy.y = openingSafetyState.player.anchor.y;
}
step(openingSafetySimulation, 1);
invariant(openingSafetyState.player.shield === openingShield && openingSafetyState.player.hearts === openingHeart,
  'stage one contact must bump without damaging the player before the first power choice');
const armorLessonSimulation = new GameSimulation(1280, 720, 4);
const armorLessonState = armorLessonSimulation.context.state;
armorLessonState.phase = 'playing';
armorLessonState.stage = 1;
armorLessonState.tutorialStep = 2;
armorLessonState.player.shield = 0;
const armorLessonHearts = armorLessonState.player.hearts;
hurtPlayer(armorLessonSimulation.context, 1, armorLessonState.player.anchor.x, armorLessonState.player.anchor.y);
invariant(armorLessonState.player.hearts === armorLessonHearts,
  'the first armor lesson must not kill a player who is still learning the closing chord');
const portraitOpening = new GameSimulation(390, 844, 3).context.state;
const portraitSpan = Math.max(...portraitOpening.enemies.map((enemy) => enemy.x))
  - Math.min(...portraitOpening.enemies.map((enemy) => enemy.x));
invariant(portraitSpan <= 110,
  'the portrait tutorial trio must stay close enough for one comfortable loop');
verifyLandingGeometry();
verifyRemoteCastMechanics();
verifyFixedRemoteCastMechanics();
verifyRemoteStrainBands();

const needleSnapshotSimulation = new GameSimulation(1280, 720, 13);
needleSnapshotSimulation.chooseNeedle('dawn');
invariant(needleSnapshotSimulation.snapshot().projectileCapacity === 4, 'Dawn HUD should expose four caught-shot slots');
needleSnapshotSimulation.chooseNeedle('twin');
invariant(needleSnapshotSimulation.snapshot().projectileCapacity === 3, 'Twin HUD should expose three caught-shot slots');
needleSnapshotSimulation.chooseNeedle('moon');
invariant(needleSnapshotSimulation.snapshot().projectileCapacity === 5, 'Moon HUD should expose five caught-shot slots');

const needleScores = (['dawn', 'twin', 'moon'] as const).map((needle) => measureNeedleScore(needle));
const needleScoreSpread = Math.max(...needleScores) / Math.max(1, Math.min(...needleScores));
invariant(
  needleScoreSpread <= 1.2,
  `equivalent relative loops should score within 20% across needles (dawn/twin/moon: ${needleScores.join('/')})`
);
const scribbleScores = (['dawn', 'twin', 'moon'] as const).map((needle) => measureScribbleScore(needle));
const scribbleSpread = Math.max(...scribbleScores) / Math.max(1, Math.min(...scribbleScores));
console.info(`Needle score check — clean ${needleScores.join('/')} · scribble ${scribbleScores.join('/')}`);
invariant(
  scribbleSpread <= 1.35,
  `the same loose scribble should score within 35% across needles (dawn/twin/moon: ${scribbleScores.join('/')})`
);
const repeatedScribbleScores = (['dawn', 'twin', 'moon'] as const).map((needle) => measureRepeatedScribbleScore(needle));
const repeatedScribbleSpread = Math.max(...repeatedScribbleScores) / Math.max(1, Math.min(...repeatedScribbleScores));
console.info(`Repeated scribble score — dawn/twin/moon ${repeatedScribbleScores.join('/')}`);
invariant(
  repeatedScribbleSpread <= 1.25,
  `repeated scribbling should score within 25% across needles (dawn/twin/moon: ${repeatedScribbleScores.join('/')})`
);
const cleanCircle = Array.from({ length: 24 }, (_, index) => {
  const angle = (index / 24) * Math.PI * 2;
  return { x: Math.cos(angle) * 120, y: Math.sin(angle) * 120 };
});
const cleanQuality = evaluateLoopQuality(cleanCircle, NEEDLES.dawn.maxLength, 3);
const scribbleQuality = evaluateLoopQuality(scribbleLoop, NEEDLES.dawn.maxLength, 3);
invariant(
  scribbleQuality.cleanliness < cleanQuality.cleanliness * 0.75,
  `self-crossing scribbles should earn a clear cleanliness penalty (${scribbleQuality.cleanliness.toFixed(2)} vs ${cleanQuality.cleanliness.toFixed(2)})`
);
for (const needle of NEEDLE_LIST) {
  const scale = needle.maxLength / NEEDLES.dawn.maxLength;
  const scaledCircle = cleanCircle.map((point) => ({ x: point.x * scale, y: point.y * scale }));
  const quality = evaluateLoopQuality(scaledCircle, needle.maxLength, 3);
  invariant(
    Math.abs(quality.precision - cleanQuality.precision) < 0.001,
    `${needle.id} precision should be reach-normalized`
  );
}

const tutorialSpawnSimulation = new GameSimulation(1280, 720, 23);
const tutorialState = tutorialSpawnSimulation.context.state;
tutorialState.phase = 'playing';
tutorialState.tutorialStep = 2;
tutorialState.enemies = [];
tutorialState.spawnTimer = 0;
step(tutorialSpawnSimulation, 1);
invariant(tutorialState.enemies.some((enemy) => enemy.type === 'puff'), 'the first stage should continue the core capture verb');
invariant(
  tutorialState.enemies.every((enemy) => enemy.type === 'puff'),
  'shooters, armor and bombs must stay out of the first-stage learning room'
);

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
verifySimpleRescueLoops();

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
invariant(simulation.context.state.player.patternSlots[0] === 'flare-knot',
  'the first offer should lead with an immediately visible clear option');
invariant(simulation.context.state.patternNoticeId === 'flare-knot',
  'choosing a pattern should publish immediate equipped feedback');
completeStageChoice(simulation);
invariant(simulation.context.state.stage === 2, 'biome crossing should advance to reef');
invariant(simulation.context.state.worldRules.length === 1, 'biome crossing should add a world rule');
completeStageChoice(simulation);
completeStageChoice(simulation);
invariant(simulation.context.state.stage === 4, 'four completed objectives should reach the boss stage');
step(simulation, 1);
invariant(simulation.context.state.enemies.some((enemy) => enemy.behavior === 'boss'), 'boss stage should spawn Tanglejaw');

console.info('Simulation smoke passed: needle score balance, scribble penalty, onboarding, supply, responsive layout, objectives, and boss entry.');
