import type { BiomeId, EnemyId, EliteId, ObjectiveId } from '../core/types';

export interface StageDefinition {
  biome: BiomeId;
  objective: ObjectiveId;
  target: number;
  quota: number;
  enemyPool: EnemyId[];
  elite?: EliteId;
  boss?: boolean;
  bannerKey: string;
}

export const STAGES: StageDefinition[] = [
  {
    biome: 'meadow', objective: 'harvest', target: 12, quota: 15,
    enemyPool: ['puff', 'needler', 'shellbud', 'bomb-bloom'], bannerKey: 'banner.firstLoop'
  },
  {
    biome: 'meadow', objective: 'knotbreak', target: 4, quota: 13,
    enemyPool: ['puff', 'needler', 'shellbud', 'bomb-bloom'], elite: 'knot-knight', bannerKey: 'banner.breakKnots'
  },
  {
    biome: 'reef', objective: 'rescue', target: 5, quota: 17,
    enemyPool: ['skipper', 'splitter', 'mirrorling', 'bubble-ray'], elite: 'storm-spool', bannerKey: 'banner.rescue'
  },
  {
    biome: 'reef', objective: 'knotbreak', target: 5, quota: 18,
    enemyPool: ['skipper', 'splitter', 'mirrorling', 'bubble-ray'], elite: 'twin-maw', bannerKey: 'banner.twinMaw'
  },
  {
    biome: 'reef', objective: 'knotbreak', target: 3, quota: 1,
    enemyPool: [], boss: true, bannerKey: 'banner.boss'
  }
];
