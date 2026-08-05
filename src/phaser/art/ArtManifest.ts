import Phaser from 'phaser';
import type { BiomeId, EnemyState } from '../../game/core/types';

export interface EnemyArtDefinition {
  texture: string;
  path: string;
  /** Visual diameter relative to the simulation collision radius. */
  diameterScale: number;
  facesLeft?: boolean;
  tiltWithVelocity?: boolean;
}

const ENEMY_ART: Record<EnemyState['type'], EnemyArtDefinition> = {
  puff: creature('puff', 3.2),
  needler: creature('needler', 3.6, true, true),
  shellbud: creature('shellbud', 3.25),
  'bomb-bloom': creature('bomb-bloom', 3.45),
  skipper: creature('skipper', 3.7, true, true),
  splitter: creature('splitter', 3.35),
  mirrorling: creature('mirrorling', 3.15),
  'bubble-ray': creature('bubble-ray', 3.75, true, true),
  'knot-knight': creature('knot-knight', 3.25),
  'storm-spool': creature('storm-spool', 3.15),
  'twin-maw': creature('twin-maw', 3.45, true, true),
  tanglejaw: creature('tanglejaw', 3.15)
};

const BACKGROUND_ART: Record<BiomeId, { texture: string; path: string }> = {
  meadow: { texture: 'environment-meadow', path: 'assets/art/environment/meadow.webp' },
  reef: { texture: 'environment-reef', path: 'assets/art/environment/reef.webp' }
};

function creature(
  id: EnemyState['type'],
  diameterScale: number,
  facesLeft = false,
  tiltWithVelocity = false
): EnemyArtDefinition {
  return {
    texture: `creature-${id}`,
    path: `assets/art/creatures/${id}.webp`,
    diameterScale,
    facesLeft,
    tiltWithVelocity
  };
}

export function preloadArt(scene: Phaser.Scene): void {
  for (const definition of Object.values(ENEMY_ART)) {
    scene.load.image(definition.texture, definition.path);
  }
  for (const definition of Object.values(BACKGROUND_ART)) {
    scene.load.image(definition.texture, definition.path);
  }
}

export function getEnemyArt(type: EnemyState['type']): EnemyArtDefinition {
  return ENEMY_ART[type];
}

export function getBackgroundTexture(biome: BiomeId): string {
  return BACKGROUND_ART[biome].texture;
}
