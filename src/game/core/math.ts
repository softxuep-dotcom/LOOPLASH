import type { Vec2 } from './types';

export const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));
export const lerp = (from: number, to: number, alpha: number): number => from + (to - from) * alpha;

export function length(vector: Vec2): number {
  return Math.hypot(vector.x, vector.y);
}

export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function normalize(vector: Vec2): Vec2 {
  const magnitude = length(vector);
  return magnitude > 0.0001 ? { x: vector.x / magnitude, y: vector.y / magnitude } : { x: 0, y: 0 };
}

export function clampVector(vector: Vec2, maxLength: number): Vec2 {
  const magnitude = length(vector);
  if (magnitude <= maxLength || magnitude <= 0.0001) return { ...vector };
  const ratio = maxLength / magnitude;
  return { x: vector.x * ratio, y: vector.y * ratio };
}

export function polygonArea(points: Vec2[]): number {
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    if (!current || !next) continue;
    area += current.x * next.y - next.x * current.y;
  }
  return Math.abs(area) * 0.5;
}

export function pointInPolygon(point: Vec2, polygon: Vec2[], tolerance = 0): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i];
    const b = polygon[j];
    if (!a || !b) continue;
    if (distancePointToSegment(point, a, b) <= tolerance) return true;
    const intersects = a.y > point.y !== b.y > point.y
      && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y || 0.0001) + a.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function distancePointToSegment(point: Vec2, start: Vec2, end: Vec2): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= 0.0001) return distance(point, start);
  const t = clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared, 0, 1);
  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
}

export function resamplePath(points: Vec2[], minDistance: number, maxPoints: number): Vec2[] {
  if (points.length <= 2) return points.map((point) => ({ ...point }));
  const result: Vec2[] = [{ ...points[0]! }];
  for (let index = 1; index < points.length - 1; index += 1) {
    const point = points[index];
    const previous = result[result.length - 1];
    if (point && previous && distance(point, previous) >= minDistance) result.push({ ...point });
  }
  const last = points[points.length - 1];
  if (last) result.push({ ...last });
  if (result.length <= maxPoints) return result;
  const stride = (result.length - 1) / (maxPoints - 1);
  return Array.from({ length: maxPoints }, (_, index) => ({ ...result[Math.round(index * stride)]! }));
}

export function circleIntersectsSegment(center: Vec2, radius: number, start: Vec2, end: Vec2): boolean {
  return distancePointToSegment(center, start, end) <= radius;
}

export function angleVector(angle: number, magnitude = 1): Vec2 {
  return { x: Math.cos(angle) * magnitude, y: Math.sin(angle) * magnitude };
}
