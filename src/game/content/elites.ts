import type { EliteId, Essence } from '../core/types';

export interface EliteDefinition {
  id: EliteId;
  color: number;
  accent: number;
  radius: number;
  speed: number;
  health: number;
  armor: number;
  score: number;
  essence: Essence;
  behavior: 'elite-knot' | 'elite-storm' | 'elite-twin';
}

export const ELITES: Record<EliteId, EliteDefinition> = {
  'knot-knight': {
    id: 'knot-knight', color: 0xff6c86, accent: 0xffd36b, radius: 34, speed: 42,
    health: 2, armor: 3, score: 900, essence: 'ember', behavior: 'elite-knot'
  },
  'storm-spool': {
    id: 'storm-spool', color: 0x5e9cff, accent: 0xc9ecff, radius: 36, speed: 34,
    health: 3, armor: 2, score: 1100, essence: 'prism', behavior: 'elite-storm'
  },
  'twin-maw': {
    id: 'twin-maw', color: 0x7ddad2, accent: 0xf7bcff, radius: 31, speed: 48,
    health: 2, armor: 2, score: 1200, essence: 'tide', behavior: 'elite-twin'
  }
};
