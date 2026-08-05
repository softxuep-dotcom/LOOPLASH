/**
 * Headless playtest harness.
 *
 * Unlike simulation-smoke.ts (short CI invariants and scripted interactions),
 * this runs longer strategies through InputFrame, the same channel a real
 * player uses. It answers the questions the design doc marks as highest risk:
 * capture credibility, big-loop dominance, and objective achievability.
 */
import type { ControlMode, EnemyState, InputFrame, Vec2 } from '../src/game/core/types.ts';
import { GameSimulation } from '../src/game/simulation/GameSimulation.ts';
import { pointInPolygon, polygonArea } from '../src/game/core/math.ts';
import { buildLoopGeometry } from '../src/game/simulation/loopGeometry.ts';
import { poleOfInaccessibility } from '../src/game/simulation/landingGeometry.ts';
import { STAGES } from '../src/game/content/encounters.ts';
import { RESCUE_LOOP_RADIUS } from '../src/game/content/rescueRules.ts';

const DT = 1 / 60;
const QUICK = process.argv.includes('--quick');

const idle: InputFrame = {
  deployPressed: false,
  deployHeld: false,
  deployReleased: false,
  steer: { x: 0, y: 0 },
  pointer: null,
  pausePressed: false
};

/** Deterministic PRNG so results are reproducible. */
function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function step(sim: GameSimulation, frames: number, input: InputFrame = idle): void {
  for (let i = 0; i < frames; i += 1) sim.step(DT, input);
}

/** Resolve whatever blocking choice phase we are in, always taking the first offer. */
function resolveChoices(sim: GameSimulation): void {
  for (let guard = 0; guard < 8; guard += 1) {
    const s = sim.context.state;
    if (s.phase === 'pattern-choice' && s.patternChoices[0]) sim.choosePattern(s.patternChoices[0]);
    else if (s.phase === 'rule-choice' && s.ruleChoices[0]) sim.chooseRule(s.ruleChoices[0]);
    else return;
  }
}

interface LoopOptions {
  /** Loop radius in pixels (distance from anchor). */
  radius: number;
  /** Direction the sweep is centred on, radians. */
  heading: number;
  /** Angular width of the sweep. 2*PI = full orbit around the anchor. */
  sweep: number;
  /** Frames the whole gesture takes. */
  frames: number;
  /** Perpendicular jitter in px, simulating touch tremor. */
  jitter: number;
  rng: () => number;
  /** Absolute center for a remote cast; defaults to the player anchor. */
  center?: Vec2;
}

interface LoopResult {
  /** Path polygon the game actually judged against. */
  polygon: Vec2[];
  /** Enemies alive at the moment of release, with their positions then. */
  enemiesAtRelease: Array<{ uid: number; x: number; y: number; radius: number; type: string }>;
  capturedUids: number[];
  scoreGain: number;
  frames: number;
  meanFingerError: number;
  landingInside: boolean | null;
}

/**
 * Draws one loop through the real input path and reports what the game judged.
 * Mirrors LoopSystem's own resampling so `polygon` is what the game saw.
 */
function drawLoop(sim: GameSimulation, options: LoopOptions): LoopResult {
  const { radius, heading, sweep, frames, jitter, rng } = options;
  const state = sim.context.state;
  const scoreBefore = state.player.score;

  // Absolute pointer control: a player picks a spot on screen and sweeps around
  // it, so the gesture is anchored to where the anchor was when they touched
  // down, not to the anchor as it drifts.
  const origin = options.center ? { ...options.center } : { ...state.player.anchor };
  const pointerAt = (t: number): Vec2 => {
    const angle = heading - sweep / 2 + sweep * t;
    const wobble = jitter > 0 ? (rng() - 0.5) * 2 * jitter : 0;
    const r = radius + wobble;
    return { x: origin.x + Math.cos(angle) * r, y: origin.y + Math.sin(angle) * r };
  };

  const firstPointer = pointerAt(0);
  sim.step(DT, { ...idle, deployPressed: true, deployHeld: true, pointer: firstPointer });
  let fingerError = Math.hypot(state.player.needle.x - firstPointer.x, state.player.needle.y - firstPointer.y);
  let fingerSamples = 1;
  let used = 1;
  for (let i = 1; i < frames; i += 1) {
    if (!state.player.drawing) break; // over-tension forced a snap
    const pointer = pointerAt(i / (frames - 1));
    sim.step(DT, { ...idle, deployHeld: true, pointer });
    fingerError += Math.hypot(state.player.needle.x - pointer.x, state.player.needle.y - pointer.y);
    fingerSamples += 1;
    used += 1;
  }

  // Snapshot the judged geometry and the live enemies immediately before release.
  // Uses the game's own builder so the polygon is exactly what it will judge.
  const polygon = buildLoopGeometry(state).polygon;
  const landing = state.controlMode === 'pull-cast' && polygon.length >= 4 && polygonArea(polygon) >= 1200
    ? poleOfInaccessibility(polygon, 1.5)
    : null;
  const landingInside = state.controlMode === 'pull-cast' && landing
    ? Boolean(landing && pointInPolygon(landing, polygon))
    : null;
  const before: LoopResult['enemiesAtRelease'] = state.enemies
    .filter((e: EnemyState) => !e.dead)
    .map((e: EnemyState) => ({ uid: e.uid, x: e.x, y: e.y, radius: e.radius, type: e.type }));
  const aliveBefore = new Set(before.map((e) => e.uid));

  sim.step(DT, { ...idle, deployReleased: true, pointer: pointerAt(1) });
  used += 1;

  const aliveAfter = new Set(state.enemies.filter((e: EnemyState) => !e.dead).map((e: EnemyState) => e.uid));
  const capturedUids = [...aliveBefore].filter((uid) => !aliveAfter.has(uid));

  return {
    polygon,
    enemiesAtRelease: before,
    capturedUids,
    scoreGain: state.player.score - scoreBefore,
    frames: used,
    meanFingerError: fingerError / fingerSamples,
    landingInside
  };
}

// ---------------------------------------------------------------------------
// Test G — how much of a capture comes from the drawn stroke, and how much from
// the fan that closing back to the anchor adds?
//
// Test B proved there are no false NEGATIVES. This asks the opposite question:
// does the anchor-tethered polygon capture things the player never drew around?
// Those are the captures that read as "why did that count?".
// ---------------------------------------------------------------------------
function testPhantomCaptures(): void {
  console.info('\n=== G. Captures from the anchor fan vs the drawn stroke ===');
  for (const sweepTurns of [0.55, 0.8, 1.0]) {
    let captured = 0;
    let phantom = 0;
    let areaGame = 0;
    let areaStroke = 0;
    let loops = 0;
    const rng = makeRng(4242);

    for (let trial = 0; trial < 260; trial += 1) {
      const sim = new GameSimulation(1280, 720, 61000 + trial);
      step(sim, 90);
      if (sim.context.state.enemies.filter((e: EnemyState) => !e.dead).length === 0) continue;

      const result = drawLoop(sim, {
        radius: 110 + rng() * 130,
        heading: rng() * Math.PI * 2,
        sweep: Math.PI * 2 * sweepTurns,
        frames: 34,
        jitter: 8,
        rng
      });
      loops += 1;
      // The judged polygon is [...stroke, anchor]; dropping the last vertex and
      // closing the stroke on itself gives the shape the player actually drew.
      const stroke = result.polygon.slice(0, -1);
      if (stroke.length < 4) continue;
      areaGame += polygonArea(result.polygon);
      areaStroke += polygonArea(stroke);

      const capturedSet = new Set(result.capturedUids);
      for (const enemy of result.enemiesAtRelease) {
        if (!capturedSet.has(enemy.uid)) continue;
        captured += 1;
        if (!pointInPolygon({ x: enemy.x, y: enemy.y }, stroke, enemy.radius)) phantom += 1;
      }
    }
    const pct = captured > 0 ? (phantom / captured) * 100 : 0;
    console.info(
      `  stroke ${(sweepTurns * 360).toFixed(0)}° | loops ${loops} | captured ${captured}`
      + ` | outside the drawn stroke ${phantom} (${pct.toFixed(1)}%)`
      + ` | judged area is ${(areaGame / Math.max(1, areaStroke)).toFixed(2)}x the drawn area`
    );
  }
}

// ---------------------------------------------------------------------------
// Test A — zero-size initialisation, then a real resize.
// Poki serves games inside an iframe; a hidden or not-yet-laid-out container
// can report 0x0 on the first frame.
// ---------------------------------------------------------------------------
function testZeroSizeInit(): void {
  console.info('\n=== A. Zero-size init then resize ===');
  const sim = new GameSimulation(0, 0, 1234);
  step(sim, 120);
  sim.resize(1280, 720);
  step(sim, 120);
  const s = sim.context.state;
  const anchor = s.player.anchor;
  const enemies = s.enemies.filter((e: EnemyState) => !e.dead);
  const onScreen = enemies.filter((e: EnemyState) => e.x > 1 && e.y > 1).length;
  console.info(`  anchor after resize: (${anchor.x.toFixed(1)}, ${anchor.y.toFixed(1)})  expected ~(640, 403)`);
  console.info(`  enemies alive: ${enemies.length}, positioned on screen: ${onScreen}`);
  const healthy = anchor.x > 100 && anchor.y > 100 && (enemies.length === 0 || onScreen > 0);
  console.info(`  verdict: ${healthy ? 'RECOVERS' : 'STUCK AT ORIGIN — unplayable'}`);

  // Control: normal init resized normally should stay healthy.
  const ok = new GameSimulation(1280, 720, 1234);
  step(ok, 60);
  ok.resize(390, 844);
  step(ok, 60);
  const a2 = ok.context.state.player.anchor;
  console.info(`  control (1280x720 -> 390x844) anchor: (${a2.x.toFixed(1)}, ${a2.y.toFixed(1)})`);
}

// ---------------------------------------------------------------------------
// Test B — capture credibility. The #1 risk in the design doc.
// A false negative (geometrically inside the drawn path but NOT captured) is
// the "I clearly circled it and it didn't count" failure.
// ---------------------------------------------------------------------------
function testCaptureCredibility(): void {
  console.info('\n=== B. Capture credibility ===');
  for (const jitter of [0, 6, 14, 26]) {
    let strictInside = 0;
    let falseNegative = 0;
    let captured = 0;
    let loops = 0;
    const rng = makeRng(99);

    for (let trial = 0; trial < 220; trial += 1) {
      const sim = new GameSimulation(1280, 720, 4000 + trial);
      step(sim, 90); // let some enemies spawn and drift in
      if (sim.context.state.enemies.filter((e: EnemyState) => !e.dead).length === 0) continue;

      const result = drawLoop(sim, {
        radius: 120 + rng() * 130,
        heading: rng() * Math.PI * 2,
        sweep: Math.PI * (1.1 + rng() * 0.9),
        frames: 34,
        jitter,
        rng
      });
      loops += 1;
      captured += result.capturedUids.length;

      const capturedSet = new Set(result.capturedUids);
      for (const enemy of result.enemiesAtRelease) {
        // Strict containment of the enemy CENTRE, zero tolerance: an
        // unambiguous "the line went around it" case.
        if (!pointInPolygon({ x: enemy.x, y: enemy.y }, result.polygon, 0)) continue;
        if (enemy.type === 'bomb-bloom') continue; // intentionally not captured
        strictInside += 1;
        if (!capturedSet.has(enemy.uid)) falseNegative += 1;
      }
    }
    const rate = strictInside > 0 ? (falseNegative / strictInside) * 100 : 0;
    console.info(
      `  jitter ${String(jitter).padStart(2)}px | loops ${loops} | strictly enclosed ${strictInside}`
      + ` | captured ${captured} | FALSE NEGATIVES ${falseNegative} (${rate.toFixed(1)}%)`
    );
  }
  console.info('  design gate: disputes < 5%');
}

// ---------------------------------------------------------------------------
// Test C — big-loop dominance. The doc claims big and small loops both pay.
// ---------------------------------------------------------------------------
interface RunResult {
  score: number;
  survivedSeconds: number;
  stage: number;
  phase: string;
  loops: number;
  captures: number;
}

/**
 * Danger-aware bot. A naive bot that always sweeps toward the swarm tows itself
 * into contact damage, which measures the bot rather than the game. This one
 * retreats when something is close, skips bomb-blooms, and respects i-frames.
 */
function playRun(
  seed: number,
  radiusOf: (rng: () => number) => number,
  sweep: number,
  frames: number,
  diagnostics?: { deaths: Map<string, number> },
  mode: ControlMode = 'remote-cast'
): RunResult {
  const sim = new GameSimulation(1280, 720, seed);
  sim.setControlMode(mode);
  const rng = makeRng(seed ^ 0x5f3a);
  let loops = 0;
  let elapsedFrames = 0;
  let lastHearts = sim.context.state.player.hearts;
  const maxFrames = 60 * (QUICK ? 90 : 60 * 8); // focused check or full eight-minute run

  const noteHitCause = (): void => {
    if (!diagnostics) return;
    const s = sim.context.state;
    if (s.player.hearts >= lastHearts) { lastHearts = s.player.hearts; return; }
    lastHearts = s.player.hearts;
    let cause = 'unknown';
    let best = Infinity;
    for (const e of s.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - s.player.anchor.x, e.y - s.player.anchor.y) - e.radius;
      if (d < best) { best = d; cause = `contact:${e.type}`; }
    }
    for (const p of s.projectiles) {
      if (p.captured || p.life <= 0) continue;
      const d = Math.hypot(p.x - s.player.anchor.x, p.y - s.player.anchor.y) - p.radius;
      if (d < best) { best = d; cause = 'projectile'; }
    }
    if (best > 60) cause = 'bomb-bloom-in-loop';
    diagnostics.deaths.set(cause, (diagnostics.deaths.get(cause) ?? 0) + 1);
  };

  while (elapsedFrames < maxFrames) {
    const s = sim.context.state;
    if (s.phase === 'gameover' || s.phase === 'victory') break;
    resolveChoices(sim);
    if (s.phase === 'pattern-choice' || s.phase === 'rule-choice') break; // could not resolve

    const anchor = s.player.anchor;
    const alive = s.enemies.filter((e: EnemyState) => !e.dead);
    const threats = alive.filter((e: EnemyState) => e.type !== 'bomb-bloom');
    const bombs = alive.filter((e: EnemyState) => e.type === 'bomb-bloom');

    // Nearest thing that can hurt us on contact.
    let nearest: EnemyState | null = null;
    let nearestDist = Infinity;
    for (const e of alive) {
      const d = Math.hypot(e.x - anchor.x, e.y - anchor.y);
      if (d < nearestDist) { nearestDist = d; nearest = e; }
    }

    let heading = rng() * Math.PI * 2;
    let radius = radiusOf(rng);
    let gestureSweep = sweep;
    let castCenter: Vec2 | undefined;

    if (mode === 'remote-cast' && s.objective.id === 'rescue' && s.motes.length > 0) {
      // Model the interaction we actually teach: choose one star mote and draw
      // one ordinary circle. No concave exclusion geometry is available to the bot.
      const target = [...s.motes].sort((left, right) => {
        const clearance = (mote: Vec2) => bombs.length === 0
          ? Number.POSITIVE_INFINITY
          : Math.min(...bombs.map((bomb) => Math.hypot(bomb.x - mote.x, bomb.y - mote.y)));
        return clearance(right) - clearance(left);
      })[0]!;
      castCenter = { x: target.x, y: target.y };
      radius = RESCUE_LOOP_RADIUS;
      gestureSweep = Math.PI * 2;
    } else if (mode === 'remote-cast' && threats.length > 0) {
      const focus = [...threats]
        .sort((left, right) => Math.hypot(left.x - anchor.x, left.y - anchor.y)
          - Math.hypot(right.x - anchor.x, right.y - anchor.y))
        .slice(0, 4);
      castCenter = {
        x: focus.reduce((sum, enemy) => sum + enemy.x, 0) / focus.length,
        y: focus.reduce((sum, enemy) => sum + enemy.y, 0) / focus.length
      };
    } else if (nearest && nearestDist < 110 && s.player.invulnerable <= 0) {
      // Too close: sweep away so the tow pulls us off the threat.
      heading = Math.atan2(anchor.y - nearest.y, anchor.x - nearest.x);
      radius = Math.max(radius, 180);
    } else if (threats.length > 0) {
      // Aim at the densest cluster of capturable targets, avoiding bombs.
      const cx = threats.reduce((sum: number, e: EnemyState) => sum + e.x, 0) / threats.length;
      const cy = threats.reduce((sum: number, e: EnemyState) => sum + e.y, 0) / threats.length;
      heading = Math.atan2(cy - anchor.y, cx - anchor.x);
      for (const bomb of bombs) {
        const bombAngle = Math.atan2(bomb.y - anchor.y, bomb.x - anchor.x);
        let diff = bombAngle - heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        if (Math.abs(diff) < sweep / 2) heading -= Math.sign(diff || 1) * (sweep / 2 - Math.abs(diff) + 0.35);
      }
    }

    const result = drawLoop(sim, { radius, heading, sweep: gestureSweep, frames, jitter: 5, rng, center: castCenter });
    noteHitCause();
    loops += 1;
    elapsedFrames += result.frames;
    step(sim, 14); // reel time between gestures
    noteHitCause();
    elapsedFrames += 14;
  }

  const s = sim.context.state;
  return {
    score: s.player.score,
    survivedSeconds: s.elapsed,
    stage: s.stage,
    phase: s.phase,
    loops,
    captures: s.player.totalCaptures
  };
}

function summarise(label: string, runs: RunResult[]): void {
  const avg = (pick: (r: RunResult) => number) => runs.reduce((a, r) => a + pick(r), 0) / runs.length;
  const wins = runs.filter((r) => r.phase === 'victory').length;
  console.info(
    `  ${label.padEnd(18)} score ${Math.round(avg((r) => r.score)).toString().padStart(7)}`
    + ` | survived ${avg((r) => r.survivedSeconds).toFixed(0).padStart(4)}s`
    + ` | stage ${avg((r) => r.stage).toFixed(2)}`
    + ` | captures ${avg((r) => r.captures).toFixed(0).padStart(4)}`
    + ` | loops ${avg((r) => r.loops).toFixed(0).padStart(4)}`
    + ` | wins ${wins}/${runs.length}`
  );
}

function testLoopStrategies(): void {
  const seedCount = QUICK ? 8 : 30;
  console.info(`\n=== C. Big loop vs small loop (${seedCount} seeds each) ===`);
  const seeds = Array.from({ length: seedCount }, (_, i) => 7000 + i * 13);
  const strategies: Array<[string, (rng: () => number) => number, number, number]> = [
    ['max loop', () => 275, Math.PI * 1.9, 40],
    ['big loop', (r) => 200 + r() * 60, Math.PI * 1.7, 36],
    ['medium loop', (r) => 130 + r() * 50, Math.PI * 1.5, 30],
    ['tight loop', (r) => 70 + r() * 40, Math.PI * 1.4, 22],
    ['mixed', (r) => (r() < 0.5 ? 80 + r() * 40 : 210 + r() * 60), Math.PI * 1.6, 32]
  ];
  for (const [label, radiusOf, sweep, frames] of strategies) {
    summarise(label, seeds.map((seed) => playRun(seed, radiusOf, sweep, frames)));
  }
}

// ---------------------------------------------------------------------------
// Test D — can a bot actually finish stage objectives without cheating?
// ---------------------------------------------------------------------------
function testObjectiveReachability(): void {
  const seedCount = QUICK ? 8 : 20;
  console.info(`\n=== D. Objective reachability by input alone (${seedCount} seeds) ===`);
  const seeds = Array.from({ length: seedCount }, (_, i) => 31000 + i * 7);
  const reached = new Map<number, number>();
  const diagnostics = { deaths: new Map<string, number>() };
  let victories = 0;
  let deaths = 0;
  let bestObjective = 0;
  for (const seed of seeds) {
    const r = playRun(seed, (rng) => 120 + rng() * 110, Math.PI * 1.6, 32, diagnostics);
    reached.set(r.stage, (reached.get(r.stage) ?? 0) + 1);
    bestObjective = Math.max(bestObjective, r.captures);
    if (r.phase === 'victory') victories += 1;
    if (r.phase === 'gameover') deaths += 1;
  }
  console.info(`  furthest stage: ${[...reached.entries()].sort((a, b) => a[0] - b[0]).map(([k, v]) => `s${k}:${v}`).join('  ')}`);
  console.info(`  victories ${victories}/${seeds.length}, deaths ${deaths}/${seeds.length}, stalled ${seeds.length - victories - deaths}`);
  console.info(`  best single-run captures: ${bestObjective} (stage 1 objective needs ${STAGES[0]!.target})`);
  const total = [...diagnostics.deaths.values()].reduce((a, b) => a + b, 0);
  const sorted = [...diagnostics.deaths.entries()].sort((a, b) => b[1] - a[1]);
  console.info(`  hearts lost by cause (${total} total): ${sorted.map(([k, v]) => `${k} ${(v / total * 100).toFixed(0)}%`).join('  ')}`);
}

// ---------------------------------------------------------------------------
// Test E — time to first successful loop.
// ---------------------------------------------------------------------------
function testFirstLoopTime(): void {
  console.info('\n=== E. First successful loop ===');
  const rng = makeRng(5);
  const times: number[] = [];
  let failures = 0;
  for (let trial = 0; trial < 60; trial += 1) {
    const sim = new GameSimulation(1280, 720, 90000 + trial);
    let frames = 0;
    let done = false;
    for (let attempt = 0; attempt < 6 && !done; attempt += 1) {
      const r = drawLoop(sim, {
        radius: 110 + rng() * 120,
        heading: -Math.PI / 2 + (rng() - 0.5),
        sweep: Math.PI * 1.6,
        frames: 32,
        jitter: 12,
        rng
      });
      frames += r.frames;
      if (r.capturedUids.length > 0) done = true;
      else { step(sim, 16); frames += 16; }
    }
    if (done) times.push(frames / 60);
    else failures += 1;
  }
  times.sort((a, b) => a - b);
  const p = (q: number) => times[Math.min(times.length - 1, Math.floor(times.length * q))]?.toFixed(2);
  console.info(`  succeeded ${times.length}/60, never captured ${failures}`);
  console.info(`  time to first capture  p50 ${p(0.5)}s  p80 ${p(0.8)}s  p95 ${p(0.95)}s`);
  console.info('  design gate: 80% of players land the first loop within 8s');
}

// ---------------------------------------------------------------------------
// Test F — is stage 1's objective mathematically reachable?
// stageQuota hard-caps total spawns; bomb-blooms are in the pool but cannot be
// captured. So the capturable budget may be smaller than the objective target.
// ---------------------------------------------------------------------------
function testStageBudget(stageIndex = 0, trials = 500): void {
  const stage = STAGES[stageIndex]!;
  console.info(`\n=== F${stageIndex + 1}. Stage ${stageIndex + 1} budget — ${stage.objective} ${stage.target}, quota ${stage.quota} (${trials} seeds) ===`);
  const results: number[] = [];
  let impossible = 0;
  let zeroMargin = 0;

  for (let trial = 0; trial < trials; trial += 1) {
    const sim = new GameSimulation(1280, 720, 500000 + trial * 3);
    const s = sim.context.state;
    // Jump straight to the stage under test.
    s.stage = stageIndex;
    s.biome = stage.biome;
    s.objective = { id: stage.objective, current: 0, target: stage.target };
    s.stageQuota = stage.quota;
    s.spawnedInStage = stageIndex === 0 ? 3 : 0;
    s.eliteSpawned = false;
    s.enemies = stageIndex === 0 ? s.enemies : [];
    s.motes = [];
    s.tutorialStep = 4;
    s.phase = 'playing';
    const counted = new Set<number>();
    const countedMotes = new Set<number>();
    // Perfect player: capture everything the instant it appears and credit the
    // objective for it. The spawner now replenishes past the quota until the
    // objective is met, so the real question is no longer "is there enough
    // supply" but "does the stage actually terminate, and how fast".
    let frame = 0;
    const cap = 60 * 240;
    for (; frame < cap; frame += 1) {
      s.player.invulnerable = 999;
      sim.step(DT, idle);
      if (s.phase !== 'playing') break; // stage handed off to the choice screen
      let harvested = 0;
      let knots = 0;
      for (const e of s.enemies) {
        if (!counted.has(e.uid)) {
          counted.add(e.uid);
          knots += e.maxArmor ?? 0;
          if (e.type !== 'bomb-bloom') harvested += 1;
        }
        e.dead = true;
      }
      for (const mote of s.motes) {
        if (countedMotes.has(mote.uid)) continue;
        countedMotes.add(mote.uid);
        if (stage.objective === 'rescue') s.objective.current += 1;
      }
      s.motes = [];
      if (stage.objective === 'harvest') s.objective.current += harvested;
      if (stage.objective === 'knotbreak') s.objective.current += knots;
    }
    const completed = s.objective.current >= stage.target;
    results.push(frame / 60);
    if (!completed) impossible += 1;
    else if (frame / 60 > 90) zeroMargin += 1;
  }

  results.sort((a, b) => a - b);
  const avg = results.reduce((a, b) => a + b, 0) / results.length;
  console.info(`  seconds for a perfect player to clear: min ${results[0]!.toFixed(1)}  p50 ${results[Math.floor(results.length / 2)]!.toFixed(1)}  max ${results[results.length - 1]!.toFixed(1)}  avg ${avg.toFixed(1)}`);
  console.info(`  seeds that NEVER complete: ${impossible}/${trials} (${(impossible / trials * 100).toFixed(1)}%)`);
  console.info(`  seeds taking over 90s: ${zeroMargin}/${trials} (${(zeroMargin / trials * 100).toFixed(1)}%)`);
}

// ---------------------------------------------------------------------------
// Test H — direct comparison for classic, legacy pull movement, and the
// player-facing fixed remote cast.
// These are the product decision metrics, kept in one compact table so a
// tuning change cannot improve one axis while quietly regressing another.
// ---------------------------------------------------------------------------
function testControlModeComparison(): void {
  console.info('\n=== H. Control mode A/B ===');
  const modes: ControlMode[] = ['drag-anchor', 'pull-cast', 'remote-cast'];
  for (const mode of modes) {
    const rng = makeRng(mode === 'pull-cast' ? 7701 : mode === 'remote-cast' ? 7703 : 7702);
    let strictInside = 0;
    let falseNegatives = 0;
    let fingerError = 0;
    let fingerLoops = 0;
    let landingSamples = 0;
    let landingInside = 0;

    for (let trial = 0; trial < 120; trial += 1) {
      const sim = new GameSimulation(1280, 720, 72000 + trial);
      sim.setControlMode(mode);
      step(sim, 90);
      const result = drawLoop(sim, {
        radius: 105 + rng() * 125,
        heading: rng() * Math.PI * 2,
        sweep: Math.PI * (1.25 + rng() * 0.65),
        frames: 34,
        jitter: 10,
        rng
      });
      fingerError += result.meanFingerError;
      fingerLoops += 1;
      if (result.landingInside !== null) {
        landingSamples += 1;
        if (result.landingInside) landingInside += 1;
      }
      const captured = new Set(result.capturedUids);
      for (const enemy of result.enemiesAtRelease) {
        if (enemy.type === 'bomb-bloom' || !pointInPolygon(enemy, result.polygon, 0)) continue;
        strictInside += 1;
        if (!captured.has(enemy.uid)) falseNegatives += 1;
      }
    }

    const seeds = Array.from({ length: QUICK ? 4 : 8 }, (_, index) => 88000 + index * 17);
    const maxRuns = seeds.map((seed) => playRun(seed, () => 275, Math.PI * 1.9, 40, undefined, mode));
    const tightRuns = seeds.map((seed) => playRun(seed, (random) => 70 + random() * 40, Math.PI * 1.4, 22, undefined, mode));
    const average = (runs: RunResult[]) => runs.reduce((sum, run) => sum + run.score, 0) / runs.length;
    const balance = average(maxRuns) / Math.max(1, average(tightRuns));
    const diagnostics = { deaths: new Map<string, number>() };
    for (const seed of seeds) playRun(seed + 400, (random) => 120 + random() * 110, Math.PI * 1.6, 32, diagnostics, mode);
    const damageTotal = [...diagnostics.deaths.values()].reduce((sum, count) => sum + count, 0);
    const damage = [...diagnostics.deaths.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([cause, count]) => `${cause} ${(count / Math.max(1, damageTotal) * 100).toFixed(0)}%`)
      .join(', ');
    const misses = strictInside > 0 ? falseNegatives / strictInside * 100 : 0;
    const landing = landingSamples > 0 ? `${(landingInside / landingSamples * 100).toFixed(1)}%` : 'n/a';
    console.info(
      `  ${mode.padEnd(11)} | finger error ${(fingerError / fingerLoops).toFixed(1).padStart(5)}px`
      + ` | capture misses ${misses.toFixed(1)}% | landing inside ${landing}`
      + ` | max/tight score ${balance.toFixed(2)}x | damage ${damage || 'none'}`
    );
  }
}

testPhantomCaptures();
testZeroSizeInit();
testStageBudget(0, QUICK ? 100 : 400);
testStageBudget(1, QUICK ? 100 : 400);
testStageBudget(2, QUICK ? 100 : 400);
testStageBudget(3, QUICK ? 100 : 400);
testCaptureCredibility();
testLoopStrategies();
testObjectiveReachability();
testFirstLoopTime();
testControlModeComparison();
console.info('\nHarness complete.');
