import Phaser from 'phaser';
import type { EffectState, EnemyState, GameState } from '../../game/core/types';
import { NEEDLES } from '../../game/content/needles';

const WHITE = 0xffffff;

/** Vector-only renderer: simulation state goes in, Phaser draw calls come out. */
export class WorldRenderer {
  private readonly background: Phaser.GameObjects.Graphics;
  private readonly world: Phaser.GameObjects.Graphics;
  private readonly glow: Phaser.GameObjects.Graphics;
  private backgroundKey = '';

  constructor(scene: Phaser.Scene) {
    this.background = scene.add.graphics();
    this.world = scene.add.graphics();
    this.glow = scene.add.graphics();
  }

  render(state: GameState): void {
    this.drawBackground(state);
    this.world.clear();
    this.glow.clear();
    this.drawMotes(state);
    this.drawProjectiles(state);
    this.drawEnemies(state);
    this.drawThread(state);
    this.drawPlayer(state);
    this.drawEffects(state);
  }

  destroy(): void {
    this.background.destroy();
    this.world.destroy();
    this.glow.destroy();
  }

  private drawBackground(state: GameState): void {
    const key = `${state.biome}:${state.width}:${state.height}:${state.highContrast}`;
    if (key === this.backgroundKey) return;
    this.backgroundKey = key;
    const meadow = state.biome === 'meadow';
    const base = state.highContrast ? 0x05060b : meadow ? 0x0b1730 : 0x071a2d;
    const accent = meadow ? 0x2a3564 : 0x0d4661;
    this.background.clear().fillStyle(base, 1).fillRect(0, 0, state.width, state.height);
    this.background.fillStyle(accent, state.highContrast ? 0.16 : 0.28);
    for (let row = 0; row < 8; row += 1) {
      for (let col = 0; col < 12; col += 1) {
        const x = ((col + (row % 2) * 0.5) / 12) * state.width;
        const y = 54 + (row / 8) * state.height;
        const radius = 1.5 + ((row * 7 + col * 3) % 4);
        this.background.fillCircle(x, y, radius);
      }
    }
    this.background.lineStyle(1, accent, 0.22);
    const spacing = Math.max(72, Math.min(state.width, state.height) / 7);
    for (let x = 0; x < state.width + spacing; x += spacing) this.background.lineBetween(x, 54, x - spacing * 0.75, state.height);
    for (let y = 54; y < state.height + spacing; y += spacing) this.background.lineBetween(0, y, state.width, y + spacing * 0.42);
  }

  private drawMotes(state: GameState): void {
    for (const mote of state.motes) {
      const pulse = 1 + Math.sin(state.elapsed * 5 + mote.uid) * 0.12;
      this.glow.fillStyle(0xa8f096, 0.12).fillCircle(mote.x, mote.y, mote.radius * 2.2 * pulse);
      this.world.fillStyle(0xf1ffd2, 0.96).fillCircle(mote.x, mote.y, mote.radius * 0.52);
      this.world.lineStyle(2.5, 0xa8f096, 0.9).strokeCircle(mote.x, mote.y, mote.radius * pulse);
      for (let index = 0; index < 4; index += 1) {
        const angle = index * Math.PI * 0.5 + state.elapsed;
        this.world.lineBetween(mote.x + Math.cos(angle) * 6, mote.y + Math.sin(angle) * 6,
          mote.x + Math.cos(angle) * 16, mote.y + Math.sin(angle) * 16);
      }
    }
  }

  private drawProjectiles(state: GameState): void {
    for (const shot of state.projectiles) {
      this.glow.fillStyle(shot.color, 0.16).fillCircle(shot.x, shot.y, shot.radius * 2.6);
      this.world.fillStyle(shot.color, 0.96).fillCircle(shot.x, shot.y, shot.radius);
      this.world.fillStyle(WHITE, 0.86).fillCircle(shot.x - 1.5, shot.y - 1.5, shot.radius * 0.34);
    }
  }

  private drawEnemies(state: GameState): void {
    for (const enemy of state.enemies) {
      const flash = (enemy.flash ?? 0) > 0;
      this.glow.fillStyle(flash ? WHITE : enemy.color, flash ? 0.25 : 0.1).fillCircle(enemy.x, enemy.y, enemy.radius * 1.75);
      if (enemy.behavior === 'boss') this.drawBoss(enemy, state.elapsed);
      else if (enemy.behavior.startsWith('elite')) this.drawElite(enemy, state.elapsed);
      else this.drawCreature(enemy, state.elapsed);
      this.drawEnemyHealth(enemy);
    }
  }

  private drawCreature(enemy: EnemyState, elapsed: number): void {
    const wobble = Math.sin(elapsed * 4 + enemy.uid) * 0.08;
    const sides = enemy.type === 'shellbud' ? 6 : enemy.type === 'mirrorling' ? 4 : enemy.type === 'bomb-bloom' ? 8 : 12;
    this.world.fillStyle(enemy.color, 0.94);
    this.world.fillPoints(this.polygon(enemy.x, enemy.y, enemy.radius * (1 + wobble), sides, enemy.phase + elapsed * 0.25), true);
    this.world.lineStyle(enemy.type === 'shellbud' ? 4 : 2, enemy.accent, 0.95);
    this.world.strokePoints(this.polygon(enemy.x, enemy.y, enemy.radius * 0.72, sides, -enemy.phase), true);
    this.world.fillStyle(enemy.accent, 0.95);
    if (enemy.type === 'needler' || enemy.type === 'bubble-ray') {
      const angle = Math.atan2(enemy.vy, enemy.vx);
      this.world.fillTriangle(
        enemy.x + Math.cos(angle) * enemy.radius * 1.45, enemy.y + Math.sin(angle) * enemy.radius * 1.45,
        enemy.x + Math.cos(angle + 2.35) * enemy.radius * 0.6, enemy.y + Math.sin(angle + 2.35) * enemy.radius * 0.6,
        enemy.x + Math.cos(angle - 2.35) * enemy.radius * 0.6, enemy.y + Math.sin(angle - 2.35) * enemy.radius * 0.6
      );
    } else {
      this.world.fillCircle(enemy.x - enemy.radius * 0.28, enemy.y - 1, 2.6);
      this.world.fillCircle(enemy.x + enemy.radius * 0.28, enemy.y - 1, 2.6);
    }
    if (enemy.type === 'bomb-bloom') {
      this.world.lineStyle(3, 0xffd75a, 0.95).lineBetween(enemy.x, enemy.y - enemy.radius, enemy.x + 8, enemy.y - enemy.radius - 13);
    }
  }

  private drawElite(enemy: EnemyState, elapsed: number): void {
    const sides = enemy.behavior === 'elite-knot' ? 6 : enemy.behavior === 'elite-twin' ? 3 : 10;
    this.world.fillStyle(enemy.color, 0.94).fillPoints(this.polygon(enemy.x, enemy.y, enemy.radius, sides, elapsed * 0.3 + enemy.uid), true);
    this.world.lineStyle(4, enemy.accent, 0.95).strokePoints(this.polygon(enemy.x, enemy.y, enemy.radius * 0.72, sides, -elapsed * 0.55), true);
    this.world.lineStyle(2, WHITE, 0.7).strokeCircle(enemy.x, enemy.y, enemy.radius * 0.35);
  }

  private drawBoss(enemy: EnemyState, elapsed: number): void {
    this.world.fillStyle(enemy.color, 0.92).fillPoints(this.polygon(enemy.x, enemy.y, enemy.radius, 12, elapsed * 0.18), true);
    this.world.fillStyle(0x28162e, 1).fillCircle(enemy.x, enemy.y, enemy.radius * 0.58);
    this.world.lineStyle(5, enemy.accent, 0.95).strokePoints(this.polygon(enemy.x, enemy.y, enemy.radius * 0.82, 4, Math.PI * 0.25 - elapsed * 0.32), true);
    this.world.fillStyle(0xfff2ba, 0.96).fillCircle(enemy.x, enemy.y, 10 + Math.sin(elapsed * 4) * 2);
    this.world.lineStyle(3, 0xff5f89, 0.85);
    for (let index = 0; index < 4; index += 1) {
      const angle = index * Math.PI * 0.5 + elapsed * 0.2;
      const outerX = enemy.x + Math.cos(angle) * enemy.radius * 1.46;
      const outerY = enemy.y + Math.sin(angle) * enemy.radius * 1.46;
      this.world.lineBetween(enemy.x + Math.cos(angle) * enemy.radius * 0.8, enemy.y + Math.sin(angle) * enemy.radius * 0.8, outerX, outerY);
      this.world.fillCircle(outerX, outerY, 7);
    }
  }

  private drawEnemyHealth(enemy: EnemyState): void {
    if (enemy.maxArmor > 0) {
      const pips = Math.max(enemy.maxArmor, enemy.armor);
      for (let index = 0; index < pips; index += 1) {
        const angle = -Math.PI * 0.75 + (index / Math.max(1, pips - 1)) * Math.PI * 1.5;
        this.world.fillStyle(index < enemy.armor ? 0xffd75a : 0x3b4059, index < enemy.armor ? 0.96 : 0.5);
        this.world.fillCircle(enemy.x + Math.cos(angle) * (enemy.radius + 8), enemy.y + Math.sin(angle) * (enemy.radius + 8), 3.5);
      }
    }
    if (enemy.behavior === 'boss' || enemy.behavior.startsWith('elite')) {
      const width = enemy.radius * 1.45;
      const ratio = Math.max(0, enemy.health / Math.max(1, enemy.maxHealth));
      this.world.fillStyle(0x111528, 0.85).fillRoundedRect(enemy.x - width * 0.5, enemy.y + enemy.radius + 11, width, 6, 3);
      this.world.fillStyle(enemy.color, 1).fillRoundedRect(enemy.x - width * 0.5, enemy.y + enemy.radius + 11, width * ratio, 6, 3);
    }
  }

  private drawThread(state: GameState): void {
    const player = state.player;
    if (!player.drawing || player.path.length < 2) return;
    const needle = NEEDLES[player.needleId];
    const points = player.path.map((point) => new Phaser.Math.Vector2(point.x, point.y));
    const tensionColor = player.tension < 0.7 ? needle.color : player.tension < 0.9 ? 0xffd75a : 0xff5f7f;
    this.glow.lineStyle(12, tensionColor, 0.11).strokePoints(points, false);
    this.world.lineStyle(state.highContrast ? 6 : 4, tensionColor, 0.96).strokePoints(points, false);
    this.world.lineStyle(2, WHITE, 0.34).lineBetween(player.path[0]!.x, player.path[0]!.y, player.needle.x, player.needle.y);
    if (player.path.length > 4) {
      const polygon = [...points, new Phaser.Math.Vector2(player.anchor.x, player.anchor.y)];
      this.world.fillStyle(tensionColor, 0.055).fillPoints(polygon, true);
    }
  }

  private drawPlayer(state: GameState): void {
    const player = state.player;
    const needle = NEEDLES[player.needleId];
    const invulnerable = player.invulnerable > 0 && Math.floor(state.elapsed * 12) % 2 === 0;
    this.glow.fillStyle(needle.color, 0.12).fillCircle(player.anchor.x, player.anchor.y, 38);
    this.world.lineStyle(3, invulnerable ? 0xff5f7f : needle.color, 0.96).strokeCircle(player.anchor.x, player.anchor.y, 14);
    this.world.fillStyle(0x11162a, 1).fillCircle(player.anchor.x, player.anchor.y, 8);
    this.world.fillStyle(needle.color, 1).fillCircle(player.anchor.x, player.anchor.y, 4);
    const angle = Math.atan2(player.needle.y - player.anchor.y, player.needle.x - player.anchor.x);
    const tip = { x: player.needle.x + Math.cos(angle) * 13, y: player.needle.y + Math.sin(angle) * 13 };
    this.world.fillStyle(needle.color, 1).fillTriangle(
      tip.x, tip.y,
      player.needle.x + Math.cos(angle + 2.35) * 10, player.needle.y + Math.sin(angle + 2.35) * 10,
      player.needle.x + Math.cos(angle - 2.35) * 10, player.needle.y + Math.sin(angle - 2.35) * 10
    );
    if (player.shield > 0) {
      this.world.lineStyle(2, 0x9fd8ff, 0.65).strokeCircle(player.anchor.x, player.anchor.y, 22 + Math.sin(state.elapsed * 5) * 2);
    }
  }

  private drawEffects(state: GameState): void {
    for (const effect of state.effects) this.drawEffect(effect, state.reducedMotion);
  }

  private drawEffect(effect: EffectState, reducedMotion: boolean): void {
    const progress = 1 - effect.life / effect.maxLife;
    const alpha = Math.max(0, 1 - progress);
    if (effect.type === 'chord' && effect.x2 !== undefined && effect.y2 !== undefined) {
      this.glow.lineStyle(reducedMotion ? 6 : 16, effect.color, alpha * 0.18).lineBetween(effect.x, effect.y, effect.x2, effect.y2);
      this.world.lineStyle(reducedMotion ? 3 : 6, effect.color, alpha).lineBetween(effect.x, effect.y, effect.x2, effect.y2);
      return;
    }
    const radius = effect.radius * (reducedMotion ? 0.85 : 0.35 + progress * 0.8);
    this.glow.fillStyle(effect.color, alpha * 0.12).fillCircle(effect.x, effect.y, radius);
    this.world.lineStyle(effect.type === 'hit' ? 5 : 3, effect.color, alpha).strokeCircle(effect.x, effect.y, radius);
  }

  private polygon(x: number, y: number, radius: number, sides: number, rotation: number): Phaser.Math.Vector2[] {
    const points: Phaser.Math.Vector2[] = [];
    for (let index = 0; index < sides; index += 1) {
      const angle = rotation + (index / sides) * Math.PI * 2;
      points.push(new Phaser.Math.Vector2(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius));
    }
    return points;
  }
}
