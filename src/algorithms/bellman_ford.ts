/**
 * Bellman-Ford Algorithm
 *
 * Single-source shortest-path algorithm that works by repeatedly relaxing
 * every edge in the graph. After the i-th relaxation pass, the distance map
 * holds the shortest path that uses at most i edges. Unlike Dijkstra, it does
 * NOT need a priority queue — it can even handle negative edge weights (grid
 * costs in Arena are always positive, so no negative-cycle handling is
 * required) and is the classic alternative when weights may be arbitrary.
 *
 * Equivalent to Dijkstra's algorithm when all costs are positive, and like
 * Dijkstra it does not use a heuristic — never sets `heuristicTarget` on
 * consider events.
 *
 * ## Generator protocol
 *
 * Each tick yields:
 *   1. `consider` — a node whose best-known distance was just improved.
 *   2. `visit`    — confirms the node was officially explored.
 *   3. `frontier` — the batch of nodes improved in the current pass.
 *   4. `path`     — current best-known path (reconstructed from came-from map).
 *
 * On termination the generator **returns** (not yields) the `AlgorithmResult`.
 *
 * @module algorithms/bellman_ford
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

// ── Bellman-Ford generator ─────────────────────────────────────────────────

/**
 * Bellman-Ford search generator factory.
 *
 * @param grid    - Immutable grid snapshot.
 * @param _config - Unused; Bellman-Ford has no tunable knobs.
 * @returns A generator that yields StepEvents and returns an AlgorithmResult.
 */
export function* bellmanFordSearch(
  grid: GridSnapshot,
  _config?: AlgorithmConfig,
): AlgorithmGenerator {
  const t0 = performance.now();
  let nodesExplored = 0;

  const cameFrom = new Map<string, Point>();
  const dist = new Map<string, number>();

  const startKey = key(grid.start);
  dist.set(startKey, 0);

  // Yield consider/visit/frontier/path events for the start node
  yield { kind: 'consider', node: grid.start };
  nodesExplored++;
  yield { kind: 'visit', node: grid.start };

  // Goal check — start may itself be a goal (multi-goal seeds)
  if (isGoal(grid, grid.start)) {
    const path = reconstructPath(cameFrom, grid.start);
    yield { kind: 'path', path };
    const result: AlgorithmResult = {
      status: 'success',
      path,
      nodesExplored,
      timeMs: performance.now() - t0,
      cost: 0,
    };
    yield { kind: 'done', result };
    return result;
  }

  yield { kind: 'frontier', nodes: [grid.start] };
  yield { kind: 'path', path: reconstructPath(cameFrom, grid.start) };

  // Upper bound on passes: a shortest path uses at most (number of cells - 1) edges
  const maxPasses = grid.width * grid.height - 1;

  for (let pass = 1; pass <= maxPasses; pass++) {
    const improved: Point[] = [];

    // Full relaxation sweep over every edge (u -> v)
    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) {
        const u = { x, y };
        const uKey = key(u);
        if (grid.walls.has(uKey)) continue;

        const du = dist.get(uKey);
        if (du === undefined || du === Infinity) continue;

        for (const v of neighbors(u, grid)) {
          const vKey = key(v);
          const stepCost = grid.costs?.get(vKey) ?? 1;
          const tentative = du + stepCost;
          const best = dist.get(vKey) ?? Infinity;

          if (tentative < best) {
            dist.set(vKey, tentative);
            cameFrom.set(vKey, u);
            improved.push(v);
          }
        }
      }
    }

    // No edge improved this pass — distances have converged, stop early
    if (improved.length === 0) {
      break;
    }

    // Visualization ticks for every node whose best-known distance improved
    for (const node of improved) {
      yield { kind: 'consider', node };
      nodesExplored++;
      yield { kind: 'visit', node };
      yield { kind: 'path', path: reconstructPath(cameFrom, node) };
    }
    yield { kind: 'frontier', nodes: improved };
  }

  // After convergence, every reachable goal's distance is optimal —
  // pick the cheapest reachable goal (multi-goal grids behave like Dijkstra).
  const candidateGoals = grid.goals && grid.goals.length > 0 ? grid.goals : [grid.goal];
  let bestGoal: Point | null = null;
  let bestDist = Infinity;
  for (const goal of candidateGoals) {
    const goalDist = dist.get(key(goal));
    if (goalDist !== undefined && goalDist !== Infinity && goalDist < bestDist) {
      bestDist = goalDist;
      bestGoal = goal;
    }
  }

  if (bestGoal !== null) {
    const path = reconstructPath(cameFrom, bestGoal);
    yield { kind: 'path', path };
    const result: AlgorithmResult = {
      status: 'success',
      path,
      nodesExplored,
      timeMs: performance.now() - t0,
      cost: bestDist,
    };
    yield { kind: 'done', result };
    return result;
  }

  // Goal unreachable — report failure.
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
export const bellmanFordFactory: AlgorithmFactory = bellmanFordSearch;
