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

export interface LandingHazard extends Vec2 {
  /** Already includes the desired personal-space padding. */
  radius: number;
}

export function landingHazardClearance(point: Vec2, hazards: LandingHazard[]): number {
  if (hazards.length === 0) return Infinity;
  return Math.min(...hazards.map((hazard) =>
    Math.hypot(point.x - hazard.x, point.y - hazard.y) - hazard.radius));
}

function polygonClearance(point: Vec2, polygon: Vec2[]): number {
  let clearance = Infinity;
  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index];
    const end = polygon[(index + 1) % polygon.length];
    if (start && end) clearance = Math.min(clearance, distancePointToSegment(point, start, end));
  }
  return clearance;
}

/**
 * Starts from the geometric pole, then searches the valid interior for a point
 * with actual clearance from surviving enemies, bombs and shots. Geometry is
 * still authoritative: every candidate must be inside the player's stroke and
 * inside the same arena bounds used by movement.
 */
export function safeLandingPoint(
  polygon: Vec2[],
  hazards: LandingHazard[],
  width: number,
  height: number,
  precision = 4
): Vec2 | null {
  const pole = poleOfInaccessibility(polygon, precision);
  if (!pole) return null;
  if (hazards.length === 0) return clampLandingPoint(pole, width, height);
  const clampedPole = clampLandingPoint(pole, width, height);
  // Most strokes already have a safe geometric pole. The risk-aware grid is
  // reserved for genuinely occupied landings, keeping live preview cheap.
  if (pointInPolygon(clampedPole, polygon) && landingHazardClearance(clampedPole, hazards) >= 18) {
    return clampedPole;
  }

  const safeMinX = 30;
  const safeMinY = 70;
  const safeMaxX = Math.max(safeMinX, width - 30);
  const safeMaxY = Math.max(safeMinY, height - 30);
  const minX = Math.max(safeMinX, Math.min(...polygon.map((point) => point.x)));
  const minY = Math.max(safeMinY, Math.min(...polygon.map((point) => point.y)));
  const maxX = Math.min(safeMaxX, Math.max(...polygon.map((point) => point.x)));
  const maxY = Math.min(safeMaxY, Math.max(...polygon.map((point) => point.y)));
  if (maxX < minX || maxY < minY) return clampedPole;

  const score = (point: Vec2): number => {
    if (!pointInPolygon(point, polygon)) return -Infinity;
    const hazard = Math.min(150, landingHazardClearance(point, hazards));
    const edge = Math.min(70, polygonClearance(point, polygon));
    return hazard * 2.2 + edge * 0.65 - Math.hypot(point.x - pole.x, point.y - pole.y) * 0.04;
  };

  let best: Vec2 | null = null;
  let bestScore = -Infinity;
  const consider = (point: Vec2): void => {
    if (point.x < safeMinX || point.x > safeMaxX || point.y < safeMinY || point.y > safeMaxY) return;
    const candidateScore = score(point);
    if (candidateScore <= bestScore) return;
    best = { ...point };
    bestScore = candidateScore;
  };
  consider(pole);

  const livePreview = precision >= 5;
  const gridDivisions = livePreview ? 3 : 8;
  let step = Math.max(precision * 2, Math.min(maxX - minX, maxY - minY) / gridDivisions);
  if (!Number.isFinite(step) || step <= 0) return best ?? clampedPole;
  for (let x = minX; x <= maxX; x += step) {
    for (let y = minY; y <= maxY; y += step) consider({ x, y });
  }
  const refinementPasses = livePreview ? 1 : 4;
  for (let pass = 0; pass < refinementPasses && best; pass += 1) {
    step *= 0.5;
    const center = { ...(best as Vec2) };
    for (const dx of [-step, 0, step]) {
      for (const dy of [-step, 0, step]) consider({ x: center.x + dx, y: center.y + dy });
    }
  }
  return best ?? clampedPole;
}
