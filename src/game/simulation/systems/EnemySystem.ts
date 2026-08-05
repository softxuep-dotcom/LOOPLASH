import type { EliteId, EnemyId, EnemyState, Vec2 } from '../../core/types';
import { angleVector, clamp, distance, normalize } from '../../core/math';
import { ENEMIES } from '../../content/enemies';
import { ELITES } from '../../content/elites';
import { getWorldModifiers } from './BuildSystem';
import type { SimulationContext } from '../SimulationContext';

const EDGE_PADDING = 58;

export class EnemySystem {
  constructor(private readonly context: SimulationContext) {}

  spawnNormal(type: EnemyId, position?: Vec2, scale = 1): EnemyState {
    const state = this.context.state;
    const definition = ENEMIES[type];
    const world = getWorldModifiers(state);
    const point = position ?? this.edgeSpawnPoint();
    const enemy: EnemyState = {
      uid: this.context.nextUid(),
      type,
      x: point.x,
      y: point.y,
      vx: 0,
      vy: 0,
      radius: definition.radius * scale,
      color: definition.color,
      accent: definition.accent,
      health: definition.health,
      maxHealth: definition.health,
      armor: Math.max(0, definition.armor + world.armorDelta),
      maxArmor: Math.max(0, definition.armor + world.armorDelta),
      speed: definition.speed * world.enemySpeed,
      score: definition.score,
      essence: definition.essence,
      behavior: definition.behavior,
      cooldown: this.context.random.range(0.8, 1.8),
      age: 0,
      phase: this.context.random.range(0, Math.PI * 2)
    };
    state.enemies.push(enemy);
    this.context.effect({ type: 'spawn', x: enemy.x, y: enemy.y, radius: enemy.radius * 1.8, color: enemy.color, life: 0.35 });
    return enemy;
  }

  spawnElite(type: EliteId): EnemyState[] {
    const definition = ELITES[type];
    const world = getWorldModifiers(this.context.state);
    if (type === 'twin-maw') {
      const center = this.edgeSpawnPoint();
      const left = this.createElite(definition, { x: center.x - 52, y: center.y });
      const right = this.createElite(definition, { x: center.x + 52, y: center.y });
      left.linkedUid = right.uid;
      right.linkedUid = left.uid;
      left.armor = Math.max(0, left.armor + world.armorDelta);
      right.armor = Math.max(0, right.armor + world.armorDelta);
      left.maxArmor = left.armor;
      right.maxArmor = right.armor;
      this.context.state.enemies.push(left, right);
      return [left, right];
    }
    const elite = this.createElite(definition, this.edgeSpawnPoint());
    elite.armor = Math.max(0, elite.armor + world.armorDelta);
    elite.maxArmor = elite.armor;
    this.context.state.enemies.push(elite);
    return [elite];
  }

  spawnBoss(): EnemyState {
    const state = this.context.state;
    const boss: EnemyState = {
      uid: this.context.nextUid(),
      type: 'tanglejaw',
      x: state.width * 0.5,
      y: Math.max(100, state.height * 0.18),
      vx: 0,
      vy: 0,
      radius: 58,
      color: 0xff5f89,
      accent: 0xffd75a,
      health: 3,
      maxHealth: 3,
      armor: 5,
      maxArmor: 5,
      speed: 38,
      score: 5000,
      essence: 'ember',
      behavior: 'boss',
      cooldown: 1.5,
      age: 0,
      phase: 0
    };
    state.enemies.push(boss);
    state.bossStarted = true;
    this.context.effect({ type: 'spawn', x: boss.x, y: boss.y, radius: 120, color: boss.color, life: 0.9 });
    return boss;
  }

  update(delta: number): void {
    const state = this.context.state;
    const player = state.player;
    player.invulnerable = Math.max(0, player.invulnerable - delta);
    player.flowGrace = Math.max(0, player.flowGrace - delta);
    if (player.flowGrace <= 0 && !player.drawing) player.flow = Math.max(1, player.flow - delta * 0.22);

    for (const enemy of state.enemies) {
      if (enemy.dead) continue;
      enemy.age += delta;
      enemy.cooldown -= delta;
      enemy.flash = Math.max(0, (enemy.flash ?? 0) - delta);
      this.updateEnemy(enemy, delta);
      enemy.x = clamp(enemy.x, 24, state.width - 24);
      enemy.y = clamp(enemy.y, 52, state.height - 24);
      if (distance(enemy, player.anchor) < enemy.radius + 17) {
        hurtPlayer(this.context, 1, enemy.x, enemy.y);
        const away = normalize({ x: enemy.x - player.anchor.x, y: enemy.y - player.anchor.y });
        enemy.x += away.x * 44;
        enemy.y += away.y * 44;
      }
    }

    for (const projectile of state.projectiles) {
      if (projectile.captured) continue;
      projectile.x += projectile.vx * delta;
      projectile.y += projectile.vy * delta;
      projectile.life -= delta;
      if (distance(projectile, player.anchor) < projectile.radius + 14) {
        projectile.life = 0;
        hurtPlayer(this.context, 1, projectile.x, projectile.y);
      }
      if (projectile.x < -80 || projectile.x > state.width + 80 || projectile.y < -80 || projectile.y > state.height + 80) {
        projectile.life = 0;
      }
    }

    for (const mote of state.motes) {
      mote.x += mote.vx * delta;
      mote.y += mote.vy * delta;
      const wobble = Math.sin(state.elapsed * 2 + mote.uid) * 8;
      mote.x = clamp(mote.x + wobble * delta, 40, state.width - 40);
      mote.y = clamp(mote.y, 70, state.height - 40);
    }

    state.enemies = state.enemies.filter((enemy) => !enemy.dead);
    state.projectiles = state.projectiles.filter((projectile) => projectile.life > 0 && !projectile.captured);
  }

  spawnMote(): void {
    const point = this.edgeSpawnPoint();
    this.context.state.motes.push({
      uid: this.context.nextUid(),
      x: point.x,
      y: point.y,
      vx: this.context.random.range(-12, 12),
      vy: this.context.random.range(-12, 12),
      radius: 13
    });
  }

  private updateEnemy(enemy: EnemyState, delta: number): void {
    const state = this.context.state;
    const player = state.player;
    if (state.tutorialStep < 2 && enemy.type === 'puff') {
      const orbit = angleVector(enemy.uid * 2.1, 2.8);
      enemy.x += orbit.x * delta;
      enemy.y += orbit.y * delta;
      return;
    }
    let target = player.anchor;
    if (enemy.behavior === 'mirror') {
      target = { x: state.width - player.needle.x, y: state.height - player.needle.y };
    }
    const toward = normalize({ x: target.x - enemy.x, y: target.y - enemy.y });
    const tangent = { x: -toward.y, y: toward.x };
    let speed = enemy.speed;

    if (enemy.behavior === 'skip') {
      speed *= enemy.cooldown < 0.24 ? 4.2 : 0.42;
      if (enemy.cooldown <= 0) enemy.cooldown = 1.6;
    } else if (enemy.behavior === 'orbit-shoot') {
      enemy.vx = toward.x * speed * 0.35 + tangent.x * speed;
      enemy.vy = toward.y * speed * 0.35 + tangent.y * speed;
      if (enemy.cooldown <= 0) {
        this.shoot(enemy, 0.72);
        enemy.cooldown = 1.45;
      }
      enemy.x += enemy.vx * delta;
      enemy.y += enemy.vy * delta;
      return;
    } else if (enemy.behavior === 'shoot') {
      speed *= 0.55;
      if (enemy.cooldown <= 0) {
        this.shoot(enemy, 0.62);
        enemy.cooldown = 1.8;
      }
    } else if (enemy.behavior === 'elite-storm') {
      speed *= 0.45;
      if (enemy.cooldown <= 0) {
        for (let index = -2; index <= 2; index += 1) this.shoot(enemy, 0.75, index * 0.18);
        enemy.cooldown = 1.7;
      }
    } else if (enemy.behavior === 'elite-twin' && enemy.linkedUid) {
      const linked = state.enemies.find((candidate) => candidate.uid === enemy.linkedUid);
      if (linked) {
        const midpoint = { x: (enemy.x + linked.x) * 0.5, y: (enemy.y + linked.y) * 0.5 };
        const orbit = angleVector(enemy.age * 1.5 + enemy.uid, 48);
        target = { x: player.anchor.x + orbit.x - (midpoint.x - enemy.x), y: player.anchor.y + orbit.y - (midpoint.y - enemy.y) };
      }
    } else if (enemy.behavior === 'boss') {
      this.updateBoss(enemy, delta);
      return;
    }

    enemy.vx = toward.x * speed;
    enemy.vy = toward.y * speed;
    enemy.x += enemy.vx * delta;
    enemy.y += enemy.vy * delta;
  }

  private updateBoss(enemy: EnemyState, delta: number): void {
    const state = this.context.state;
    const player = state.player;
    const desired = {
      x: state.width * 0.5 + Math.sin(enemy.age * 0.62) * Math.min(260, state.width * 0.25),
      y: state.height * 0.28 + Math.cos(enemy.age * 0.45) * 54
    };
    const direction = normalize({ x: desired.x - enemy.x, y: desired.y - enemy.y });
    const phaseSpeed = enemy.health === 3 ? 0.72 : enemy.health === 2 ? 0.9 : 1.1;
    enemy.x += direction.x * enemy.speed * phaseSpeed * delta;
    enemy.y += direction.y * enemy.speed * phaseSpeed * delta;
    if (enemy.cooldown <= 0) {
      const shots = enemy.health === 3 ? 5 : enemy.health === 2 ? 7 : 9;
      for (let index = 0; index < shots; index += 1) {
        const baseAngle = Math.atan2(player.anchor.y - enemy.y, player.anchor.x - enemy.x);
        const spread = (index - (shots - 1) * 0.5) * 0.14;
        this.shoot(enemy, 0.78 + (3 - enemy.health) * 0.08, spread, baseAngle);
      }
      enemy.cooldown = Math.max(0.8, 1.65 - (3 - enemy.health) * 0.22);
    }
  }

  private shoot(enemy: EnemyState, speedFactor: number, angleOffset = 0, explicitAngle?: number): void {
    const state = this.context.state;
    const world = getWorldModifiers(state);
    const angle = (explicitAngle ?? Math.atan2(state.player.anchor.y - enemy.y, state.player.anchor.x - enemy.x)) + angleOffset;
    const velocity = angleVector(angle, 210 * speedFactor * world.projectileSpeed);
    state.projectiles.push({
      uid: this.context.nextUid(),
      x: enemy.x,
      y: enemy.y,
      vx: velocity.x,
      vy: velocity.y,
      radius: enemy.behavior === 'boss' ? 8 : 7,
      color: enemy.behavior === 'boss' ? 0xffd75a : enemy.accent,
      life: 7
    });
  }

  private createElite(definition: (typeof ELITES)[EliteId], point: Vec2): EnemyState {
    return {
      uid: this.context.nextUid(),
      type: definition.id,
      x: point.x,
      y: point.y,
      vx: 0,
      vy: 0,
      radius: definition.radius,
      color: definition.color,
      accent: definition.accent,
      health: definition.health,
      maxHealth: definition.health,
      armor: definition.armor,
      maxArmor: definition.armor,
      speed: definition.speed,
      score: definition.score,
      essence: definition.essence,
      behavior: definition.behavior,
      cooldown: 1.1,
      age: 0,
      phase: 0
    };
  }

  private edgeSpawnPoint(): Vec2 {
    const state = this.context.state;
    const edge = this.context.random.int(0, 3);
    if (edge === 0) return { x: this.context.random.range(EDGE_PADDING, state.width - EDGE_PADDING), y: 72 };
    if (edge === 1) return { x: state.width - EDGE_PADDING, y: this.context.random.range(90, state.height - EDGE_PADDING) };
    if (edge === 2) return { x: this.context.random.range(EDGE_PADDING, state.width - EDGE_PADDING), y: state.height - EDGE_PADDING };
    return { x: EDGE_PADDING, y: this.context.random.range(90, state.height - EDGE_PADDING) };
  }
}

export function hurtPlayer(context: SimulationContext, amount: number, x: number, y: number): void {
  const { state } = context;
  const player = state.player;
  if (state.phase !== 'playing' || player.invulnerable > 0 || player.pull) return;
  const interruptDrawing = player.drawing && state.controlMode === 'pull-cast';
  if (player.shield > 0) {
    player.shield -= 1;
    player.invulnerable = 0.65;
    context.effect({ type: 'shield', x: player.anchor.x, y: player.anchor.y, radius: 44, color: 0x9fd8ff, life: 0.45 });
    if (interruptDrawing) player.pendingWeakSnap = true;
    return;
  }
  player.hearts = Math.max(0, player.hearts - amount);
  player.invulnerable = 1.05;
  player.flow = Math.max(1, player.flow - 1.2);
  context.effect({ type: 'hit', x, y, radius: 58, color: 0xff5f7f, life: 0.5 });
  if (interruptDrawing) player.pendingWeakSnap = true;
  if (player.hearts <= 0) {
    state.previousPhase = state.phase;
    state.phase = 'gameover';
    player.drawing = false;
    player.path = [];
    player.landingTarget = null;
    player.pull = null;
  }
}
