import { clamp, distance, polygonArea } from '../core/math';
import type { Vec2 } from '../core/types';

const DAWN_REACH = 0.4;

export interface LoopQuality {
  precision: number;
  cleanliness: number;
  normalizedArea: number;
}

/**
 * Scores the shape rather than the raw pixel footprint. Reach normalization
 * prevents a short needle from receiving a free density bonus, while convex
 * hull and path efficiency stop self-crossing scribbles from masquerading as
 * tiny, precise loops.
 */
export function evaluateLoopQuality(
  polygon: Vec2[],
  needleReach: number,
  captures: number
): LoopQuality {
  const traceArea = Math.max(1, polygonArea(polygon));
  const hull = convexHull(polygon);
  const hullArea = Math.max(1, polygonArea(hull));
  const tracedLength = Math.max(1, closedPathLength(polygon));
  const idealLength = 2 * Math.sqrt(Math.PI * hullArea);
  const pathEfficiency = clamp(idealLength / tracedLength, 0.4, 1);
  const areaConsistency = Math.min(traceArea, hullArea) / Math.max(traceArea, hullArea);
  const cleanliness = clamp(Math.sqrt(pathEfficiency * areaConsistency), 0.5, 1);

  const effectiveArea = Math.max(traceArea, hullArea * 0.72);
  const reachScale = Math.max(0.01, needleReach / DAWN_REACH);
  const normalizedArea = effectiveArea / (reachScale * reachScale);
  const targetArea = Math.max(1, captures * 1150);
  const precision = clamp(targetArea / normalizedArea, 0.7, 1.15);
  return { precision, cleanliness, normalizedArea };
}

function closedPathLength(points: Vec2[]): number {
  let total = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    if (current && next) total += distance(current, next);
  }
  return total;
}

function convexHull(points: Vec2[]): Vec2[] {
  if (points.length <= 3) return points.map((point) => ({ ...point }));
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (origin: Vec2, a: Vec2, b: Vec2): number =>
    (a.x - origin.x) * (b.y - origin.y) - (a.y - origin.y) * (b.x - origin.x);
  const half = (source: Vec2[]): Vec2[] => {
    const result: Vec2[] = [];
    for (const point of source) {
      while (result.length >= 2 && cross(result[result.length - 2]!, result[result.length - 1]!, point) <= 0) {
        result.pop();
      }
      result.push(point);
    }
    result.pop();
    return result;
  };
  return [...half(sorted), ...half([...sorted].reverse())].map((point) => ({ ...point }));
}
