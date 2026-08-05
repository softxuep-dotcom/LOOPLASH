import type { Vec2 } from '../core/types';
import { clamp, distancePointToSegment, pointInPolygon } from '../core/math';

interface Cell extends Vec2 {
  half: number;
  distance: number;
  potential: number;
}

class MaxHeap {
  private readonly items: Cell[] = [];

  get length(): number { return this.items.length; }

  push(cell: Cell): void {
    this.items.push(cell);
    let index = this.items.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.items[parent]!.potential >= cell.potential) break;
      this.items[index] = this.items[parent]!;
      index = parent;
    }
    this.items[index] = cell;
  }

  pop(): Cell | undefined {
    const first = this.items[0];
    const last = this.items.pop();
    if (!first || !last || this.items.length === 0) return first;
    let index = 0;
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      if (left >= this.items.length) break;
      const child = right < this.items.length
        && this.items[right]!.potential > this.items[left]!.potential ? right : left;
      if (this.items[child]!.potential <= last.potential) break;
      this.items[index] = this.items[child]!;
      index = child;
    }
    this.items[index] = last;
    return first;
  }
}

function signedDistance(point: Vec2, polygon: Vec2[]): number {
  let edgeDistance = Infinity;
  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index];
    const end = polygon[(index + 1) % polygon.length];
    if (!start || !end) continue;
    edgeDistance = Math.min(edgeDistance, distancePointToSegment(point, start, end));
  }
  return (pointInPolygon(point, polygon) ? 1 : -1) * edgeDistance;
}

function makeCell(x: number, y: number, half: number, polygon: Vec2[]): Cell {
  const edgeDistance = signedDistance({ x, y }, polygon);
  return {
    x,
    y,
    half,
    distance: edgeDistance,
    potential: edgeDistance + half * Math.SQRT2
  };
}

/**
 * Finds the point inside the even/odd fill of a stroke that is farthest from
 * every edge (the same target as polylabel). It is valid for concave strokes
 * and chooses a real filled lobe for self-intersections instead of escaping
 * into a concavity like an area centroid can.
 */
export function poleOfInaccessibility(polygon: Vec2[], precision = 2): Vec2 | null {
  if (polygon.length < 3) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of polygon) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  const width = maxX - minX;
  const height = maxY - minY;
  const cellSize = Math.min(width, height);
  if (!Number.isFinite(cellSize) || cellSize <= 0) return { ...polygon[0]! };

  const heap = new MaxHeap();
  const half = cellSize * 0.5;
  for (let x = minX; x < maxX; x += cellSize) {
    for (let y = minY; y < maxY; y += cellSize) {
      heap.push(makeCell(x + half, y + half, half, polygon));
    }
  }

  let best = makeCell((minX + maxX) * 0.5, (minY + maxY) * 0.5, 0, polygon);
  for (const vertex of polygon) {
    const candidate = makeCell(vertex.x, vertex.y, 0, polygon);
    if (candidate.distance > best.distance) best = candidate;
  }

  while (heap.length > 0) {
    const cell = heap.pop()!;
    if (cell.distance > best.distance) best = cell;
    if (cell.potential - best.distance <= precision) continue;
    const nextHalf = cell.half * 0.5;
    heap.push(makeCell(cell.x - nextHalf, cell.y - nextHalf, nextHalf, polygon));
    heap.push(makeCell(cell.x + nextHalf, cell.y - nextHalf, nextHalf, polygon));
    heap.push(makeCell(cell.x - nextHalf, cell.y + nextHalf, nextHalf, polygon));
    heap.push(makeCell(cell.x + nextHalf, cell.y + nextHalf, nextHalf, polygon));
  }

  return best.distance >= 0 ? { x: best.x, y: best.y } : null;
}

/** The ghost and the pull use this exact same, post-clamp destination. */
export function clampLandingPoint(point: Vec2, width: number, height: number): Vec2 {
  return {
    x: clamp(point.x, 30, Math.max(30, width - 30)),
    y: clamp(point.y, 70, Math.max(70, height - 30))
  };
}

export function polylineLength(points: Vec2[]): number {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    if (previous && current) total += Math.hypot(current.x - previous.x, current.y - previous.y);
  }
  return total;
}
