/**
 * Dijkstra's Algorithm
 *
 * Uniform-cost search (UCS). Finds the path with the minimum total cost from
 * start to goal by expanding nodes in non-decreasing order of cost g(n).
 *
 * Equivalent to A* search where h(n) = 0 for all nodes.
 * Does not use a heuristic — never sets `heuristicTarget` on consider events.
 *
 * ## Generator protocol
 *
 * Each tick yields:
 *   1. `consider` — the node being expanded (no heuristicTarget).
 *   2. `visit`    — confirms the node was officially explored.
 *   3. `frontier` — nodes newly added or updated in the open set this tick.
 *   4. `path`     — current best-known path (reconstructed from came-from map).
 *
 * On termination the generator **returns** (not yields) the `AlgorithmResult`.
 *
 * @module algorithms/dijkstra
 */

import type {
  AlgorithmConfig,
  AlgorithmFactory,
  AlgorithmGenerator,
  AlgorithmResult,
  GridSnapshot,
  Point,
} from './types';
import { isGoal, key, neighbors, reconstructPath } from './utils';
import { MinHeap } from './heap';

// ── Types ───────────────────────────────────────────────────────────────────

interface HeapEntry {
  point: Point;
  dist: number;
}

// ── Dijkstra generator ─────────────────────────────────────────────────────

/**
 * Dijkstra search generator factory.
 *
 * @param grid    - Immutable grid snapshot.
 * @param _config - Unused; Dijkstra has no tunable knobs.
 * @returns A generator that yields StepEvents and returns an AlgorithmResult.
 */
export function* dijkstraSearch(
  grid: GridSnapshot,
  _config?: AlgorithmConfig,
): AlgorithmGenerator {
  const t0 = performance.now();
  let nodesExplored = 0;

  const openSet = new MinHeap<HeapEntry>((e) => e.dist);
  const cameFrom = new Map<string, Point>();
  const dist = new Map<string, number>();
  const closedSet = new Set<string>();

  const startKey = key(grid.start);
  dist.set(startKey, 0);
  openSet.push({ point: grid.start, dist: 0 });

  while (openSet.size > 0) {
    const entry = openSet.pop()!;
    const current = entry.point;
    const currentKey = key(current);

    // Skip if already visited (handles duplicate entries with higher distance in heap)
    if (closedSet.has(currentKey)) {
      continue;
    }

    // Yield consider event (no heuristic target for Dijkstra)
    yield { kind: 'consider', node: current };

    // Mark as visited
    closedSet.add(currentKey);
    nodesExplored++;
    yield { kind: 'visit', node: current };

    // Goal check — reaching ANY goal counts as success
    if (isGoal(grid, current)) {
      const path = reconstructPath(cameFrom, current);
      yield { kind: 'path', path };

      const cost = dist.get(currentKey) ?? 0;
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
    const currentDist = dist.get(currentKey) ?? Infinity;
    const frontierNodes: Point[] = [];

    for (const nbr of neighbors(current, grid)) {
      const nbrKey = key(nbr);
      if (closedSet.has(nbrKey)) continue;

      const stepCost = grid.costs?.get(nbrKey) ?? 1;
      const tentativeDist = currentDist + stepCost;
      const bestDist = dist.get(nbrKey) ?? Infinity;

      if (tentativeDist < bestDist) {
        cameFrom.set(nbrKey, current);
        dist.set(nbrKey, tentativeDist);
        openSet.push({ point: nbr, dist: tentativeDist });
        frontierNodes.push(nbr);
      }
    }

    if (frontierNodes.length > 0) {
      yield { kind: 'frontier', nodes: frontierNodes };
    }

    // Yield current best path to the node just expanded
    yield { kind: 'path', path: reconstructPath(cameFrom, current) };
  }

  // Open set exhausted — goal unreachable
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
export const dijkstraFactory: AlgorithmFactory = dijkstraSearch;
