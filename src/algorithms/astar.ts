/**
 * A* Search Algorithm
 *
 * Finds the shortest path from start to goal using f(n) = g(n) + h(n), where:
 *   - g(n) = actual cost from start to n
 *   - h(n) = estimated cost from n to goal (Manhattan distance)
 *
 * A* is optimal and complete when using an admissible heuristic (Manhattan
 * distance is admissible for 4-directional grid movement).
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
 * @module algorithms/astar
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

// ── Types ───────────────────────────────────────────────────────────────────

interface HeapEntry {
  point: Point;
  f: number;
}

// ── A* generator ────────────────────────────────────────────────────────────

/**
 * A* search generator factory.
 *
 * @param grid   - Immutable grid snapshot.
 * @param _config - Unused; A* has no tunable knobs.
 * @returns A generator that yields StepEvents and returns an AlgorithmResult.
 */
export function* aStarSearch(
  grid: GridSnapshot,
  _config?: AlgorithmConfig,
): AlgorithmGenerator {
  const t0 = performance.now();
  let nodesExplored = 0;

  const openSet = new MinHeap<HeapEntry>((e) => e.f);
  const cameFrom = new Map<string, Point>();
  const gScore = new Map<string, number>();
  const closedSet = new Set<string>();

  const startKey = key(grid.start);
  gScore.set(startKey, 0);
  openSet.push({ point: grid.start, f: nearestGoalDist(grid, grid.start) });

  while (openSet.size > 0) {
    const entry = openSet.pop()!;
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

      const cost = gScore.get(currentKey) ?? 0;
      const result: AlgorithmResult = {
        status: 'success',
        path,
        nodesExplored,
        timeMs: performance.now() - t0,
        cost,
      };
      yield { kind: 'done', result };
      return result;
    }

    // Expand neighbors
    const currentG = gScore.get(currentKey) ?? Infinity;
    const frontierNodes: Point[] = [];

    for (const nbr of neighbors(current, grid)) {
      const nbrKey = key(nbr);
      if (closedSet.has(nbrKey)) continue;

      const stepCost = grid.costs?.get(nbrKey) ?? 1;
      const tentativeG = currentG + stepCost;
      const bestG = gScore.get(nbrKey) ?? Infinity;

      if (tentativeG < bestG) {
        cameFrom.set(nbrKey, current);
        gScore.set(nbrKey, tentativeG);
        const f = tentativeG + nearestGoalDist(grid, nbr);
        openSet.push({ point: nbr, f });
        frontierNodes.push(nbr);
      }
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
export const aStarFactory: AlgorithmFactory = aStarSearch;
