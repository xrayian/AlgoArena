/**
 * Shared helpers for the Algorithm Arena engine.
 *
 * Focused on multi-goal support: every generator resolves the set of goal
 * nodes through these helpers so that reaching ANY goal counts as success,
 * while single-goal grids (the default) behave exactly as before.
 *
 * @module algorithms/utils
 */

import type { GridSnapshot, Point } from './types';

/** Encode a Point as a string key for Set/Map lookups. */
export function key(p: Point): string {
  return `${p.x},${p.y}`;
}

/** Manhattan distance — admissible heuristic for 4-directional grids. */
export function manhattan(a: Point, b: Point): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/**
 * Resolve the full list of goal nodes for a grid, deduplicated.
 * Falls back to `[goal]` when `goals` is omitted or empty (single-goal grids).
 */
export function goalPoints(grid: GridSnapshot): Point[] {
  const source = grid.goals && grid.goals.length > 0 ? grid.goals : [grid.goal];
  const seen = new Set<string>();
  const result: Point[] = [];
  for (const p of source) {
    const k = key(p);
    if (!seen.has(k)) {
      seen.add(k);
      result.push(p);
    }
  }
  return result;
}

/** All goal node keys as a Set for O(1) membership checks. */
export function goalKeys(grid: GridSnapshot): Set<string> {
  return new Set(goalPoints(grid).map(key));
}

/** Whether `p` is any of the grid's goal nodes. */
export function isGoal(grid: GridSnapshot, p: Point): boolean {
  for (const g of goalPoints(grid)) {
    if (g.x === p.x && g.y === p.y) return true;
  }
  return false;
}

/**
 * The goal node closest (by Manhattan distance) to `p`.
 * Ties resolve to the first goal listed.
 */
export function nearestGoal(grid: GridSnapshot, p: Point): Point {
  let best = grid.goal;
  let bestD = Infinity;
  for (const g of goalPoints(grid)) {
    const d = manhattan(g, p);
    if (d < bestD) {
      bestD = d;
      best = g;
    }
  }
  return best;
}

/** Manhattan distance from `p` to the closest goal node. */
export function nearestGoalDist(grid: GridSnapshot, p: Point): number {
  let bestD = Infinity;
  for (const g of goalPoints(grid)) {
    const d = manhattan(g, p);
    if (d < bestD) bestD = d;
  }
  return bestD;
}

// ── Graph traversal helpers ─────────────────────────────────────────────────

/** Cardinal neighbor offsets (no diagonals). */
export const DIRS: readonly Point[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

/** Return walkable cardinal neighbors of `p` within `grid`. */
export function neighbors(p: Point, grid: GridSnapshot): Point[] {
  const result: Point[] = [];
  for (const d of DIRS) {
    const nx = p.x + d.x;
    const ny = p.y + d.y;
    if (nx >= 0 && nx < grid.width && ny >= 0 && ny < grid.height) {
      if (!grid.walls.has(`${nx},${ny}`)) {
        result.push({ x: nx, y: ny });
      }
    }
  }
  return result;
}

/**
 * Reconstruct the path from start to `current` by walking the came-from map.
 */
export function reconstructPath(cameFrom: Map<string, Point>, current: Point): Point[] {
  const path: Point[] = [current];
  let k = key(current);
  while (cameFrom.has(k)) {
    const prev = cameFrom.get(k)!;
    path.unshift(prev);
    k = key(prev);
  }
  return path;
}