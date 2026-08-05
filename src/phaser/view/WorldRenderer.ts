import Phaser from 'phaser';
import type { EffectState, EnemyState, GameState } from '../../game/core/types';
import { NEEDLES } from '../../game/content/needles';
import { circleIntersectsSegment, polygonArea } from '../../game/core/math';
import {
  buildLoopGeometry,
  isEnemyInsideLoop,
  MIN_LOOP_AREA
} from '../../game/simulation/loopGeometry';
import {
  getBackgroundTexture,
  getEnemyArt,
  getNeedleTexture,
  getPlayerAnchorTexture
} from '../art/ArtManifest';

const WHITE = 0xffffff;

/** Hybrid art renderer: simulation state goes in, Phaser display objects come out. */
export class WorldRenderer {
  private readonly scene: Phaser.Scene;
  private readonly background: Phaser.GameObjects.Graphics;
  private readonly backgroundArt: Phaser.GameObjects.TileSprite;
  private readonly world: Phaser.GameObjects.Graphics;
  private readonly glow: Phaser.GameObjects.Graphics;
  private readonly enemySprites = new Map<number, Phaser.GameObjects.Image>();
  private readonly playerAnchorSprite: Phaser.GameObjects.Image | null;
  private readonly playerNeedleSprite: Phaser.GameObjects.Image | null;
  private backgroundKey = '';

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.background = scene.add.graphics().setDepth(-30);
    this.backgroundArt = scene.add.tileSprite(0, 0, 1, 1, getBackgroundTexture('meadow'))
      .setOrigin(0)
      .setDepth(-29);
    this.glow = scene.add.graphics().setDepth(-10);
    this.world = scene.add.graphics().setDepth(10);
    this.playerAnchorSprite = scene.textures.exists(getPlayerAnchorTexture())
      ? scene.add.image(0, 0, getPlayerAnchorTexture()).setDepth(5)
      : null;
    this.playerNeedleSprite = scene.textures.exists(getNeedleTexture('dawn'))
      ? scene.add.image(0, 0, getNeedleTexture('dawn')).setDepth(6)
      : null;
  }

  render(state: GameState): void {
    this.drawBackground(state);
    this.world.clear();
    this.glow.clear();
    this.syncEnemySprites(state);
    this.syncPlayerSprites(state);
    this.drawMotes(state);
    this.drawProjectiles(state);
    this.drawEnemies(state);
    this.drawThread(state);
    this.drawPlayer(state);
    this.drawEffects(state);
  }

  destroy(): void {
    this.background.destroy();
    this.backgroundArt.destroy();
    this.world.destroy();
    this.glow.destroy();
    this.playerAnchorSprite?.destroy();
    this.playerNeedleSprite?.destroy();
    for (const sprite of this.enemySprites.values()) sprite.destroy();
    this.enemySprites.clear();
  }

  private drawBackground(state: GameState): void {
    const texture = getBackgroundTexture(state.biome);
    const key = `${texture}:${state.width}:${state.height}:${state.highContrast}`;
    const meadow = state.biome === 'meadow';
    const base = state.highContrast ? 0x05060b : meadow ? 0x0b1730 : 0x071a2d;
    if (key !== this.backgroundKey) {
      this.backgroundKey = key;
      this.background.clear().fillStyle(base, 1).fillRect(0, 0, state.width, state.height);
      this.backgroundArt
        .setTexture(texture)
        .setSize(state.width, state.height)
        .setAlpha(state.highContrast ? 0.32 : 0.72);
      const source = this.scene.textures.get(texture).getSourceImage() as HTMLImageElement;
      const scale = state.height / Math.max(1, source.height);
      this.backgroundArt.setTileScale(scale);
    }
    const drift = state.reducedMotion ? 0 : state.elapsed;
    this.backgroundArt.setTilePosition(drift * 1.8, Math.sin(drift * 0.08) * 5);
  }

  private syncEnemySprites(state: GameState): void {
    const living = new Set<number>();
    for (const enemy of state.enemies) {
      if (enemy.dead) continue;
      const art = getEnemyArt(enemy.type);
      if (!this.scene.textures.exists(art.texture)) continue;
      living.add(enemy.uid);
      let sprite = this.enemySprites.get(enemy.uid);
      if (!sprite) {
        sprite = this.scene.add.image(enemy.x, enemy.y, art.texture).setOrigin(0.5);
        this.enemySprites.set(enemy.uid, sprite);
      } else if (sprite.texture.key !== art.texture) {
        sprite.setTexture(art.texture);
      }

      const motion = Math.hypot(enemy.vx, enemy.vy);
      const bob = state.reducedMotion ? 0 : Math.sin(enemy.age * 4.4 + enemy.phase) * enemy.radius * 0.08;
      const squash = state.reducedMotion ? 0 : Math.sin(enemy.age * 6.2 + enemy.uid) * 0.035;
      const diameter = enemy.radius * art.diameterScale;
      sprite
        .setPosition(enemy.x, enemy.y + bob)
        .setDisplaySize(diameter * (1 + squash), diameter * (1 - squash))
        .setDepth(enemy.y / 100_000)
        .setAlpha(enemy.dead ? 0 : 1)
        .setFlipX(art.facesLeft === true && enemy.vx > 2);

      const targetRotation = art.tiltWithVelocity && motion > 2
        ? Math.atan2(enemy.vy, Math.abs(enemy.vx)) * 0.16
        : (state.reducedMotion ? 0 : Math.sin(enemy.age * 2.6 + enemy.phase) * 0.035);
      sprite.setRotation(targetRotation);

      if ((enemy.flash ?? 0) > 0) {
        sprite.setTint(WHITE).setTintMode(Phaser.TintModes.FILL);
      } else {
        sprite.clearTint();
      }
    }

    for (const [uid, sprite] of this.enemySprites) {
      if (living.has(uid)) continue;
      sprite.destroy();
      this.enemySprites.delete(uid);
    }
  }

  private syncPlayerSprites(state: GameState): void {
    const player = state.player;
    const invulnerableFlash = player.invulnerable > 0 && Math.floor(state.elapsed * 12) % 2 === 0;
    if (this.playerAnchorSprite) {
      this.playerAnchorSprite
        .setPosition(player.anchor.x, player.anchor.y)
        .setDisplaySize(56, 56)
        .setRotation(state.reducedMotion ? 0 : Math.sin(state.elapsed * 1.5) * 0.025)
        .setAlpha(invulnerableFlash ? 0.46 : 1);
    }
    if (this.playerNeedleSprite) {
      const texture = getNeedleTexture(player.needleId);
      if (this.playerNeedleSprite.texture.key !== texture) this.playerNeedleSprite.setTexture(texture);
      const angle = Math.atan2(player.needle.y - player.anchor.y, player.needle.x - player.anchor.x);
      const breathing = state.reducedMotion ? 1 : 1 + Math.sin(state.elapsed * 5.2) * 0.025;
      this.playerNeedleSprite
        .setPosition(player.needle.x, player.needle.y)
        .setDisplaySize(52 * breathing, 52 * breathing)
        .setRotation(angle)
        .setAlpha(invulnerableFlash ? 0.52 : 1);
    }
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
      if (!this.enemySprites.has(enemy.uid)) {
        if (enemy.behavior === 'boss') this.drawBoss(enemy, state.elapsed);
        else if (enemy.behavior.startsWith('elite')) this.drawElite(enemy, state.elapsed);
        else this.drawCreature(enemy, state.elapsed);
      }
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
    const geometry = buildLoopGeometry(state);
    const points = geometry.sampled.map((point) => new Phaser.Math.Vector2(point.x, point.y));
    const tensionColor = player.tension < 0.7 ? needle.color : player.tension < 0.9 ? 0xffd75a : 0xff5f7f;
    this.glow.lineStyle(12, tensionColor, 0.11).strokePoints(points, false);
    this.world.lineStyle(state.highContrast ? 6 : 4, tensionColor, 0.96).strokePoints(points, false);
    const chordStart = geometry.sampled.at(-1) ?? player.needle;
    this.glow.lineStyle(10, 0xffd75a, 0.1).lineBetween(chordStart.x, chordStart.y, player.anchor.x, player.anchor.y);
    this.world.lineStyle(state.highContrast ? 5 : 3, 0xffe786, 0.78)
      .lineBetween(chordStart.x, chordStart.y, player.anchor.x, player.anchor.y);
    if (geometry.sampled.length > 4) {
      const polygon = geometry.polygon.map((point) => new Phaser.Math.Vector2(point.x, point.y));
      this.world.fillStyle(tensionColor, state.highContrast ? 0.24 : 0.18).fillPoints(polygon, true);
      if (polygonArea(geometry.polygon) >= MIN_LOOP_AREA && geometry.sampled.length >= 4) {
        this.drawCapturePreview(state, geometry);
      }
    }
  }

  private drawCapturePreview(state: GameState, geometry: ReturnType<typeof buildLoopGeometry>): void {
    const chordStart = geometry.sampled.at(-1) ?? state.player.needle;
    const chordEnd = state.player.anchor;
    for (const enemy of state.enemies) {
      if (enemy.dead) continue;
      const inside = isEnemyInsideLoop(enemy, geometry);
      const chordHit = circleIntersectsSegment(enemy, enemy.radius * 0.72 + 6, chordStart, chordEnd);
      if (!inside && !(enemy.armor > 0 && chordHit)) continue;
      if (enemy.type === 'bomb-bloom' && inside) {
        const warningShape = this.polygon(
          enemy.x,
          enemy.y,
          enemy.radius * 1.08,
          8,
          enemy.phase + state.elapsed * 0.25
        );
        this.glow.fillStyle(0xff426f, 0.3).fillCircle(enemy.x, enemy.y, enemy.radius * 1.8);
        this.world.fillStyle(0x5b123f, 0.82).fillPoints(warningShape, true);
        this.world.lineStyle(5, 0xffd75a, 0.98).strokePoints(warningShape, true);
        this.world.lineStyle(3, 0xff7b9e, 0.95);
        const span = enemy.radius * 0.72;
        for (const offset of [-0.45, 0, 0.45]) {
          const shift = enemy.radius * offset;
          this.world.lineBetween(
            enemy.x - span + shift,
            enemy.y + span,
            enemy.x + span + shift,
            enemy.y - span
          );
        }
        continue;
      }

      if (inside) {
        const highlight = enemy.armor > 0 && !chordHit ? 0xffb552 : 0xf2ffb8;
        this.glow.lineStyle(12, highlight, 0.3).strokeCircle(enemy.x, enemy.y, enemy.radius + 7);
        this.world.lineStyle(state.highContrast ? 6 : 4, highlight, 0.98).strokeCircle(enemy.x, enemy.y, enemy.radius + 6);
      }
      if (enemy.armor > 0) this.drawArmorTarget(enemy, chordHit, state.elapsed);
    }
  }

  private drawArmorTarget(enemy: EnemyState, chordHit: boolean, elapsed: number): void {
    const color = chordHit ? 0xa8f096 : 0xffd75a;
    const pulse = 1 + Math.sin(elapsed * 6 + enemy.uid) * 0.12;
    const radius = 9 * pulse;
    this.glow.fillStyle(color, chordHit ? 0.28 : 0.16).fillCircle(enemy.x, enemy.y, radius * 2.2);
    this.world.lineStyle(chordHit ? 4 : 3, color, 1).strokeCircle(enemy.x, enemy.y, radius);
    this.world.lineStyle(2, color, 0.9);
    this.world.lineBetween(enemy.x - radius - 5, enemy.y, enemy.x - radius + 1, enemy.y);
    this.world.lineBetween(enemy.x + radius - 1, enemy.y, enemy.x + radius + 5, enemy.y);
    this.world.lineBetween(enemy.x, enemy.y - radius - 5, enemy.x, enemy.y - radius + 1);
    this.world.lineBetween(enemy.x, enemy.y + radius - 1, enemy.x, enemy.y + radius + 5);
    if (chordHit) this.world.fillStyle(color, 1).fillCircle(enemy.x, enemy.y, 3.5);
  }

  private drawPlayer(state: GameState): void {
    const player = state.player;
    const needle = NEEDLES[player.needleId];
    const invulnerable = player.invulnerable > 0 && Math.floor(state.elapsed * 12) % 2 === 0;
    this.glow.fillStyle(needle.color, 0.12).fillCircle(player.anchor.x, player.anchor.y, 38);
    if (!this.playerAnchorSprite) {
      this.world.lineStyle(3, invulnerable ? 0xff5f7f : needle.color, 0.96).strokeCircle(player.anchor.x, player.anchor.y, 14);
      this.world.fillStyle(0x11162a, 1).fillCircle(player.anchor.x, player.anchor.y, 8);
      this.world.fillStyle(needle.color, 1).fillCircle(player.anchor.x, player.anchor.y, 4);
    }
    if (!this.playerNeedleSprite) {
      const angle = Math.atan2(player.needle.y - player.anchor.y, player.needle.x - player.anchor.x);
      const tip = { x: player.needle.x + Math.cos(angle) * 13, y: player.needle.y + Math.sin(angle) * 13 };
      this.world.fillStyle(needle.color, 1).fillTriangle(
        tip.x, tip.y,
        player.needle.x + Math.cos(angle + 2.35) * 10, player.needle.y + Math.sin(angle + 2.35) * 10,
        player.needle.x + Math.cos(angle - 2.35) * 10, player.needle.y + Math.sin(angle - 2.35) * 10
      );
    }
    for (let index = 0; index < player.capturedShots; index += 1) {
      const angle = state.elapsed * 2.8 + (index / Math.max(1, player.capturedShots)) * Math.PI * 2;
      const radius = 35 + (index % 2) * 5;
      const x = player.anchor.x + Math.cos(angle) * radius;
      const y = player.anchor.y + Math.sin(angle) * radius;
      this.glow.fillStyle(0xb7a6ff, 0.28).fillCircle(x, y, 10);
      this.world.fillStyle(0xede8ff, 1).fillCircle(x, y, 3.5);
      this.world.lineStyle(2, 0xb7a6ff, 0.95).strokeCircle(x, y, 6);
    }
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
