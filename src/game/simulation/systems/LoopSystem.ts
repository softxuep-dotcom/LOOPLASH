import type { EnemyState, Essence, InputFrame, Vec2 } from '../../core/types';
import {
  circleIntersectsSegment,
  clamp,
  clampVector,
  distance,
  lerp,
  pointInPolygon,
  polygonArea
} from '../../core/math';
import { NEEDLES } from '../../content/needles';
import { getPatternModifiers, getWorldModifiers } from './BuildSystem';
import { hurtPlayer, type EnemySystem } from './EnemySystem';
import type { SimulationContext } from '../SimulationContext';
import {
  buildLoopGeometry,
  isEnemyInsideLoop,
  MAX_RAW_PATH_POINTS,
  MIN_LOOP_AREA,
  needleMaxLength,
  needleSpeed,
  PATH_SAMPLE_DISTANCE
} from '../loopGeometry';

/** Time constant for dissolving the touch-down grab offset. */
const GRAB_DECAY_TIME = 0.06;

export class LoopSystem {
  constructor(
    private readonly context: SimulationContext,
    private readonly enemies: EnemySystem
  ) {}

  update(delta: number, input: InputFrame): void {
    const state = this.context.state;
    const player = state.player;
    if (state.phase !== 'ready' && state.phase !== 'playing') return;

    if (input.deployPressed && !player.drawing) {
      if (state.phase === 'ready') {
        state.previousPhase = state.phase;
        state.phase = 'playing';
      }
      player.drawing = true;
      player.path = [{ ...player.anchor }];
      player.tension = 0;
      // Absorb the gap between the resting needle and the touch point so the
      // first frame does not teleport the needle. GRAB_DECAY_TIME dissolves it.
      player.grabOffset = input.pointer
        ? { x: player.needle.x - input.pointer.x, y: player.needle.y - input.pointer.y }
        : { x: 0, y: 0 };
      state.tutorialStep = Math.max(state.tutorialStep, 1);
    }

    if (player.drawing && input.deployHeld) {
      this.updateDrawing(delta, input);
    }

    if (player.drawing && input.deployReleased) {
      this.snap();
    }

    if (!player.drawing) {
      const orbit = state.elapsed * 2.2;
      player.needle.x = lerp(player.needle.x, player.anchor.x + Math.cos(orbit) * 38, clamp(delta * 8, 0, 1));
      player.needle.y = lerp(player.needle.y, player.anchor.y + Math.sin(orbit) * 38, clamp(delta * 8, 0, 1));
      player.tension = Math.max(0, player.tension - delta * 1.8);
    }
  }

  forceSafeRelease(): void {
    if (this.context.state.player.drawing) this.snap(true);
  }

  /**
   * Where the needle should sit relative to the anchor this frame.
   *
   * Pointers are absolute: the needle goes to the finger, clamped radially to
   * the rope length so that reaching past full extension slides along the
   * maximum-radius circle instead of going dead. `grabOffset` decays to zero
   * over the first ~180ms so the gesture starts where the needle already was
   * and settles into one-to-one control. Keyboard input stays relative.
   */
  private resolveOffset(delta: number, input: InputFrame, maxLength: number): Vec2 {
    const player = this.context.state.player;
    if (!input.pointer) return clampVector(input.steer, maxLength);
    const decay = Math.exp(-delta / GRAB_DECAY_TIME);
    player.grabOffset.x *= decay;
    player.grabOffset.y *= decay;
    if (Math.abs(player.grabOffset.x) < 0.5) player.grabOffset.x = 0;
    if (Math.abs(player.grabOffset.y) < 0.5) player.grabOffset.y = 0;
    return clampVector({
      x: input.pointer.x + player.grabOffset.x - player.anchor.x,
      y: input.pointer.y + player.grabOffset.y - player.anchor.y
    }, maxLength);
  }

  private updateDrawing(delta: number, input: InputFrame): void {
    const state = this.context.state;
    const player = state.player;
    const needle = NEEDLES[player.needleId];
    const patterns = getPatternModifiers(state);
    const world = getWorldModifiers(state);
    const maxLength = needleMaxLength(state);
    if (maxLength <= 0) return;
    const offset = this.resolveOffset(delta, input, maxLength);
    const target = { x: player.anchor.x + offset.x, y: player.anchor.y + offset.y };
    const alpha = clamp((needleSpeed(state) * delta) / Math.max(1, distance(player.needle, target)), 0, 1);
    player.needle.x = lerp(player.needle.x, target.x, alpha);
    player.needle.y = lerp(player.needle.y, target.y, alpha);

    const stretch = distance(player.anchor, player.needle) / maxLength;
    if (stretch > 0.35) {
      const pull = (stretch - 0.35) / 0.65;
      const direction = clampVector({ x: player.needle.x - player.anchor.x, y: player.needle.y - player.anchor.y }, 1);
      const magnitude = Math.hypot(direction.x, direction.y) || 1;
      const anchorSpeed = needle.anchorPull * patterns.anchorPull * pull;
      player.anchor.x += (direction.x / magnitude) * anchorSpeed * delta;
      player.anchor.y += (direction.y / magnitude) * anchorSpeed * delta;
      player.anchor.x = clamp(player.anchor.x, 30, state.width - 30);
      player.anchor.y = clamp(player.anchor.y, 70, state.height - 30);
    }

    const tensionGain = (0.14 + stretch * stretch * 0.9) * needle.tensionRate * patterns.tensionRate * world.tensionRate;
    player.tension = clamp(player.tension + tensionGain * delta, 0, 1.06);

    const last = player.path[player.path.length - 1];
    if (!last || distance(last, player.needle) >= PATH_SAMPLE_DISTANCE) {
      player.path.push({ ...player.needle });
      // Keep the raw trail. Decimation happens once, in buildLoopGeometry();
      // re-decimating an already decimated path on every frame compounded its
      // error and slowly straightened the drawn loop.
      if (player.path.length > MAX_RAW_PATH_POINTS) player.path.shift();
      this.interceptProjectiles(last ?? player.anchor, player.needle);
    }

    if (player.tension >= 1) this.snap(true);
  }

  private interceptProjectiles(start: Vec2, end: Vec2): void {
    const state = this.context.state;
    const player = state.player;
    const needle = NEEDLES[player.needleId];
    const modifiers = getPatternModifiers(state);
    const capacity = needle.projectileCapacity + Math.round(modifiers.projectileCapacity);
    if (player.capturedShots >= capacity) return;
    for (const projectile of state.projectiles) {
      if (projectile.captured || projectile.life <= 0) continue;
      if (!circleIntersectsSegment(projectile, projectile.radius + 8, start, end)) continue;
      projectile.captured = true;
      player.capturedShots += 1;
      this.context.effect({ type: 'capture', x: projectile.x, y: projectile.y, radius: 24, color: projectile.color, life: 0.34 });
      state.tutorialStep = Math.max(state.tutorialStep, 3);
      if (player.capturedShots >= capacity) break;
    }
  }

  private snap(forced = false): void {
    const state = this.context.state;
    const player = state.player;
    const needleDefinition = NEEDLES[player.needleId];
    player.drawing = false;
    const geometry = buildLoopGeometry(state);
    const { sampled, polygon } = geometry;
    const area = polygonArea(polygon);
    const chordStart = sampled[sampled.length - 1] ?? player.needle;
    const chordEnd = { ...player.anchor };
    const sweet = !forced && player.tension >= 0.7 && player.tension <= 0.9;
    player.lastSnapWasSweet = sweet;
    this.context.effect({
      type: 'snap', x: player.anchor.x, y: player.anchor.y,
      radius: Math.min(220, Math.sqrt(Math.max(area, 1)) * 1.35),
      color: sweet ? 0xffd75a : 0xff5f7f, life: state.reducedMotion ? 0.18 : 0.42
    });
    this.context.effect({
      type: 'chord', x: chordStart.x, y: chordStart.y, x2: chordEnd.x, y2: chordEnd.y,
      radius: 1, color: sweet ? 0xffe76d : 0xff91a4, life: 0.24
    });

    if (area < MIN_LOOP_AREA || sampled.length < 4) {
      player.combo = Math.max(0, player.combo - 1);
      player.flow = Math.max(1, player.flow - 0.25);
      player.path = [];
      player.tension = forced ? 0.45 : 0;
      return;
    }

    const modifiers = getPatternModifiers(state);
    const world = getWorldModifiers(state);
    const inside = new Set<number>();
    for (const enemy of state.enemies) {
      if (isEnemyInsideLoop(enemy, geometry)) inside.add(enemy.uid);
    }

    let captures = 0;
    let captureScore = 0;
    const essences: Essence[] = [];
    let brokenKnots = 0;
    const chordHits = needleDefinition.baseChordRepeats + Math.round(modifiers.chordRepeats) + 1
      + (world.echoChord && sweet ? 1 : 0);

    for (const enemy of state.enemies) {
      const isInside = inside.has(enemy.uid);
      const chordHit = circleIntersectsSegment(enemy, enemy.radius * 0.72 + 6, chordStart, chordEnd);
      if (!isInside && !chordHit) continue;

      if (enemy.type === 'bomb-bloom' && isInside) {
        enemy.dead = true;
        hurtPlayer(this.context, 1, enemy.x, enemy.y);
        this.context.effect({ type: 'burst', x: enemy.x, y: enemy.y, radius: 86, color: 0xd256dc, life: 0.55 });
        continue;
      }

      if (enemy.behavior === 'elite-twin' && enemy.linkedUid && isInside && !inside.has(enemy.linkedUid)) {
        enemy.flash = 0.25;
        continue;
      }

      if (chordHit && enemy.armor > 0) {
        const before = enemy.armor;
        enemy.armor = Math.max(0, enemy.armor - chordHits);
        brokenKnots += before - enemy.armor;
        enemy.flash = 0.3;
        this.context.effect({ type: 'hit', x: enemy.x, y: enemy.y, radius: enemy.radius * 1.7, color: 0xffd75a, life: 0.35 });
      } else if (chordHit && enemy.armor <= 0 && enemy.behavior !== 'boss') {
        enemy.health -= Math.max(1, Math.floor(modifiers.chordDamage));
        enemy.flash = 0.2;
      }

      if (isInside && enemy.armor <= 0) {
        if (enemy.behavior === 'boss') {
          enemy.health -= 1;
          if (enemy.health > 0) {
            enemy.armor = enemy.health + 1;
            enemy.maxArmor = enemy.armor;
            this.context.effect({ type: 'spawn', x: enemy.x, y: enemy.y, radius: enemy.radius * 1.8, color: enemy.accent, life: 0.62 });
          }
        } else if (enemy.behavior.startsWith('elite')) enemy.health -= 1;
        else enemy.health = 0;
      }

      if (enemy.health <= 0 && !enemy.dead) {
        enemy.dead = true;
        captures += 1;
        captureScore += enemy.score;
        essences.push(enemy.essence);
        this.context.effect({ type: 'capture', x: enemy.x, y: enemy.y, radius: enemy.radius * 2.1, color: enemy.color, life: 0.48 });
        if (enemy.type === 'splitter') {
          this.enemies.spawnNormal('puff', { x: enemy.x - 18, y: enemy.y }, 0.72);
          this.enemies.spawnNormal('puff', { x: enemy.x + 18, y: enemy.y }, 0.72);
        }
      }
    }

    for (const mote of state.motes) {
      if (!pointInPolygon(mote, polygon, mote.radius * 0.5 + geometry.captureTolerance)) continue;
      mote.radius = 0;
      state.objective.current += state.objective.id === 'rescue' ? 1 : 0;
      captures += 1;
      essences.push('seed');
      this.context.effect({ type: 'heal', x: mote.x, y: mote.y, radius: 34, color: 0xa8f096, life: 0.5 });
    }
    state.motes = state.motes.filter((mote) => mote.radius > 0);

    if (state.objective.id === 'harvest') state.objective.current += captures;
    if (state.objective.id === 'knotbreak') state.objective.current += brokenKnots;
    if (brokenKnots > 0) state.tutorialStep = Math.max(state.tutorialStep, 4);

    if (player.capturedShots > 0) {
      const burst = 115 + player.capturedShots * 16 + modifiers.snapBlast;
      const damage = Math.max(1, Math.floor(player.capturedShots * 0.4 * modifiers.reflectedPower));
      for (const enemy of state.enemies) {
        if (enemy.dead || distance(enemy, player.anchor) > burst + enemy.radius) continue;
        if (enemy.armor > 0) enemy.armor = Math.max(0, enemy.armor - damage);
        else enemy.health -= damage;
        if (enemy.health <= 0) enemy.dead = true;
      }
      this.context.effect({ type: 'burst', x: player.anchor.x, y: player.anchor.y, radius: burst, color: 0xa993ff, life: 0.55 });
      player.capturedShots = 0;
    }

    if (modifiers.snapBlast > 0) this.applySnapBlast(player.anchor, modifiers.snapBlast, 1);

    const targetArea = Math.max(1, captures * 1150);
    const precision = clamp(targetArea / area, 0.35, 1.25);
    const group = 1 + Math.min(1.2, Math.max(0, captures - 1) * 0.13);
    const tension = sweet ? 1.5 : player.tension > 0.9 ? 0.7 : 1;
    if (captures > 0 || brokenKnots > 0) {
      player.combo += 1;
      player.flow = clamp(player.flow + 0.28 + captures * 0.05, 1, 3);
      player.flowGrace = 2.5 + modifiers.flowGrace;
      const points = (captureScore + brokenKnots * 140 + 70) * precision * group * tension * player.flow
        * modifiers.scoreMultiplier * world.scoreMultiplier;
      player.score += Math.round(points);
      player.totalCaptures += captures;
      if (modifiers.tightShield > 0 && area < 12000 && captures > 0) player.shield = Math.min(2, player.shield + modifiers.tightShield);
      if (modifiers.healEvery > 0 && player.totalCaptures > 0 && player.totalCaptures % Math.round(modifiers.healEvery) < captures) {
        player.hearts = Math.min(player.maxHearts, player.hearts + 1);
        this.context.effect({ type: 'heal', x: player.anchor.x, y: player.anchor.y, radius: 48, color: 0xa8f096, life: 0.6 });
      }
      this.addEssence(this.dominantEssence(essences));
      state.tutorialStep = Math.max(state.tutorialStep, 2);
    } else {
      player.combo = Math.max(0, player.combo - 1);
      player.flow = Math.max(1, player.flow - 0.35);
    }

    player.path = [];
    player.tension = forced ? 0.55 : 0;
  }

  private dominantEssence(essences: Essence[]): Essence | null {
    if (essences.length === 0) return null;
    const counts = new Map<Essence, number>();
    for (const essence of essences) counts.set(essence, (counts.get(essence) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  }

  private addEssence(essence: Essence | null): void {
    if (!essence) return;
    const state = this.context.state;
    const world = getWorldModifiers(state);
    const player = state.player;
    const nextEssence = world.wildEveryThird && (player.totalCaptures + player.essences.length) % 3 === 0 ? 'wild' : essence;
    player.essences.push(nextEssence);
    if (player.essences.length < 3) return;
    const recipe = [...player.essences];
    player.essences = [];
    const concrete = recipe.filter((item) => item !== 'wild');
    const unique = new Set(concrete);
    const family = concrete[0];
    if (family && concrete.every((item) => item === family)) {
      if (family === 'ember') this.applySnapBlast(player.anchor, 185, 2);
      if (family === 'tide') {
        for (const enemy of state.enemies) enemy.speed *= 0.76;
        this.context.effect({ type: 'burst', x: player.anchor.x, y: player.anchor.y, radius: 210, color: 0x63d8ef, life: 0.8 });
      }
      if (family === 'seed') player.shield = Math.min(2, player.shield + 1);
      if (family === 'prism') player.capturedShots += 3;
    } else if (unique.size >= 2 || recipe.includes('wild')) {
      player.flow = clamp(player.flow + 0.8, 1, 3);
      player.shield = Math.min(2, player.shield + 1);
      this.context.effect({ type: 'burst', x: player.anchor.x, y: player.anchor.y, radius: 160, color: 0xffd75a, life: 0.65 });
    }
  }

  private applySnapBlast(center: Vec2, radius: number, damage: number): void {
    const state = this.context.state;
    for (const enemy of state.enemies) {
      if (enemy.dead || distance(enemy, center) > radius + enemy.radius) continue;
      if (enemy.armor > 0) enemy.armor = Math.max(0, enemy.armor - damage);
      else enemy.health -= damage;
      if (enemy.health <= 0) enemy.dead = true;
    }
    this.context.effect({ type: 'burst', x: center.x, y: center.y, radius, color: 0xff9868, life: 0.48 });
  }
}
