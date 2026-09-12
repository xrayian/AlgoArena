/**
 * Greedy Best-First Search Algorithm
 *
 * Expands nodes by h(n) only (no g(n) cost). This makes it faster than A*
 * in many cases but **not optimal** — the path found may not be the shortest.
 *
 * It uses a priority (min-heap) frontier ordered by the Manhattan distance to
 * the goal, always expanding the node that *appears* closest to the goal.
 * Because it evaluates each cell with a closed set, it can backtrack across
 * branches (unlike Hill Climbing, which has no backtracking), but it may still
 * land in a suboptimal path.
 *
 * ## Generator protocol
 *
 * Each tick yields one or more `StepEvent`s:
 *   1. `consider` — the node being expanded, with `heuristicTarget` set to goal.
 *   2. `visit`    — confirms the node was officially explored.
 *   3. `frontier` — updated open set after neighbor expansion.
 *   4. `path`     — current best-known path (reconstructed from came-from map).
 *
 * On termination the generator **returns** (not yields) the `AlgorithmResult`.
 *
 * @module algorithms/greedyBestFirst
 */

import type {
  AlgorithmConfig,
  AlgorithmFactory,
  AlgorithmGenerator,
  AlgorithmResult,
  GridSnapshot,
  Point,
} from './types';
import { isGoal, key, nearestGoal, nearestGoalDist, neighbors, reconstructPath } from './utils';
import { MinHeap } from './heap';

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Total traversal cost of `path` (default cost per step is 1). */
function pathCost(path: Point[], grid: GridSnapshot): number {
  let cost = 0;
  for (let i = 1; i < path.length; i++) {
    const p = path[i]!;
    cost += grid.costs?.get(`${p.x},${p.y}`) ?? 1;
  }
  return cost;
}

// ── Types ───────────────────────────────────────────────────────────────────

interface HeapEntry {
  point: Point;
  h: number;
}

// ── Greedy Best-First generator ─────────────────────────────────────────────

/**
 * Greedy Best-First search generator factory.
 *
 * @param grid    - Immutable grid snapshot.
 * @param _config - Unused; Greedy Best-First has no tunable knobs.
 * @returns A generator that yields StepEvents and returns an AlgorithmResult.
 */
export function* greedyBestFirstSearch(
  grid: GridSnapshot,
  _config?: AlgorithmConfig,
): AlgorithmGenerator {
  const t0 = performance.now();
  let nodesExplored = 0;

  const frontier = new MinHeap<HeapEntry>((e) => e.h);
  const cameFrom = new Map<string, Point>();
  const closedSet = new Set<string>();

  frontier.push({ point: grid.start, h: nearestGoalDist(grid, grid.start) });

  while (frontier.size > 0) {
    const entry = frontier.pop()!;
    const current = entry.point;
    const currentKey = key(current);

    // Skip if already visited (duplicate entries in heap)
    if (closedSet.has(currentKey)) {
      continue;
    }

    // Yield consider event — shows where the heuristic is pointing
    yield { kind: 'consider', node: current, heuristicTarget: nearestGoal(grid, current) };

    // Mark as visited
    closedSet.add(currentKey);
    nodesExplored++;
    yield { kind: 'visit', node: current };

    // Goal check — reaching ANY goal counts as success
    if (isGoal(grid, current)) {
      const path = reconstructPath(cameFrom, current);
      yield { kind: 'path', path };

      const result: AlgorithmResult = {
        status: 'success',
        path,
        nodesExplored,
        timeMs: performance.now() - t0,
        cost: pathCost(path, grid),
      };
      yield { kind: 'done', result };
      return result;
    }

    // Expand neighbors
    const frontierNodes: Point[] = [];

    for (const nbr of neighbors(current, grid)) {
      const nbrKey = key(nbr);
      if (closedSet.has(nbrKey)) continue;

      // Greedy ordering uses ONLY the heuristic — no g(n) cost is tracked.
      cameFrom.set(nbrKey, current);
      frontier.push({ point: nbr, h: nearestGoalDist(grid, nbr) });
      frontierNodes.push(nbr);
    }

    if (frontierNodes.length > 0) {
      yield { kind: 'frontier', nodes: frontierNodes };
    }

    // Yield current best path to the node just expanded
    yield { kind: 'path', path: reconstructPath(cameFrom, current) };
  }

  // Frontier exhausted — goal unreachable
  const result: AlgorithmResult = {
    status: 'failed',
    path: null,
    nodesExplored,
    timeMs: performance.now() - t0,
  };
  yield { kind: 'done', result };
  return result;
}

// Re-export the factory with the correct type for the registry
export const greedyBestFirstFactory: AlgorithmFactory = greedyBestFirstSearch;
