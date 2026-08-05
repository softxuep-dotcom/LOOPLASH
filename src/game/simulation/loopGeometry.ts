import { NEEDLES } from '../content/needles';
import type { EnemyState, GameState, Vec2 } from '../core/types';
import { pointInPolygon, resamplePath } from '../core/math';
import { getPatternModifiers } from './systems/BuildSystem';

export const MIN_LOOP_AREA = 1200;
export const PATH_SAMPLE_DISTANCE = 11;
/**
 * Decimation ceiling for the judged polygon. Generous on purpose: the renderer
 * draws `player.path` directly, so anything decimation removes here would make
 * the judged shape differ from the drawn one and reintroduce "I circled it and
 * it did not count". At 11px spacing this covers ~2.1k px of arc, more than a
 * maximum-reach loop needs, so in practice the path passes through untouched.
 */
export const MAX_PATH_POINTS = 192;
/** Hard ceiling on the raw trail, so a held scribble cannot grow without bound. */
export const MAX_RAW_PATH_POINTS = 256;

export interface LoopGeometry {
  sampled: Vec2[];
  polygon: Vec2[];
  chordStart: Vec2;
  chordEnd: Vec2;
  captureTolerance: number;
}

export function needleMaxLength(state: GameState): number {
  return NEEDLES[state.player.needleId].maxLength * Math.min(state.width, state.height);
}

/**
 * Needle travel speed, normalised the same way as the rope length so the time
 * to reach full extension is identical on a phone and on a desktop. Keeping it
 * in absolute pixels made the needle roughly twice as sluggish on a 720px-tall
 * desktop as on a 390px-wide phone.
 */
export function needleSpeed(state: GameState): number {
  return NEEDLES[state.player.needleId].needleSpeed * Math.min(state.width, state.height);
}

export function buildLoopGeometry(state: GameState): LoopGeometry {
  const needle = NEEDLES[state.player.needleId];
  const modifiers = getPatternModifiers(state);
  const sampled = resamplePath(
    [...state.player.path, { ...state.player.needle }],
    PATH_SAMPLE_DISTANCE,
    MAX_PATH_POINTS
  );
  const remote = state.controlMode !== 'drag-anchor';
  const chordStart = { ...(sampled.at(-1) ?? state.player.needle) };
  const chordEnd = remote
    ? { ...(sampled[0] ?? state.player.needle) }
    : { ...state.player.anchor };
  return {
    sampled,
    // Remote casting judges exactly the stroke the player drew. Classic mode
    // retains its anchor fan so the old feel remains a faithful A/B control.
    polygon: remote ? sampled.map((point) => ({ ...point })) : [...sampled, { ...state.player.anchor }],
    chordStart,
    chordEnd,
    captureTolerance: 9 * needle.captureTolerance * modifiers.captureTolerance
  };
}

export function isEnemyInsideLoop(enemy: EnemyState, geometry: LoopGeometry): boolean {
  return pointInPolygon(enemy, geometry.polygon, enemy.radius * 0.38 + geometry.captureTolerance);
}
