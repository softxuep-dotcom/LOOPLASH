import type { EnemyDefinition, EnemyId } from '../core/types';

export const ENEMIES: Record<EnemyId, EnemyDefinition> = {
  puff: {
    id: 'puff', nameKey: 'enemy.puff', biome: 'meadow', color: 0xf6a6d5, accent: 0xffe5f5,
    radius: 18, speed: 54, score: 80, essence: 'seed', health: 1, armor: 0, behavior: 'chase'
  },
  needler: {
    id: 'needler', nameKey: 'enemy.needler', biome: 'meadow', color: 0xf2b84b, accent: 0xfff0a8,
    radius: 20, speed: 34, score: 120, essence: 'prism', health: 1, armor: 0, behavior: 'shoot'
  },
  shellbud: {
    id: 'shellbud', nameKey: 'enemy.shellbud', biome: 'meadow', color: 0xe56c78, accent: 0xffc0a8,
    radius: 24, speed: 40, score: 180, essence: 'ember', health: 1, armor: 1, behavior: 'armored'
  },
  'bomb-bloom': {
    id: 'bomb-bloom', nameKey: 'enemy.bombBloom', biome: 'meadow', color: 0xc751d1, accent: 0xff9feb,
    radius: 19, speed: 42, score: 40, essence: 'wild', health: 1, armor: 0, behavior: 'bomb'
  },
  skipper: {
    id: 'skipper', nameKey: 'enemy.skipper', biome: 'reef', color: 0x61d8cf, accent: 0xc6fff8,
    radius: 18, speed: 44, score: 120, essence: 'tide', health: 1, armor: 0, behavior: 'skip'
  },
  splitter: {
    id: 'splitter', nameKey: 'enemy.splitter', biome: 'reef', color: 0x68b7ff, accent: 0xd7efff,
    radius: 23, speed: 49, score: 150, essence: 'tide', health: 1, armor: 0, behavior: 'split'
  },
  mirrorling: {
    id: 'mirrorling', nameKey: 'enemy.mirrorling', biome: 'reef', color: 0x9589ff, accent: 0xe7e2ff,
    radius: 19, speed: 60, score: 150, essence: 'prism', health: 1, armor: 0, behavior: 'mirror'
  },
  'bubble-ray': {
    id: 'bubble-ray', nameKey: 'enemy.bubbleRay', biome: 'reef', color: 0x57a5d8, accent: 0xbfeaff,
    radius: 25, speed: 36, score: 180, essence: 'tide', health: 2, armor: 0, behavior: 'orbit-shoot'
  }
};

export const MEADOW_ENEMIES: EnemyId[] = ['puff', 'needler', 'shellbud', 'bomb-bloom'];
export const REEF_ENEMIES: EnemyId[] = ['skipper', 'splitter', 'mirrorling', 'bubble-ray'];
