/**
 * Hill Climbing Search Algorithm
 *
 * Greedy local search that always moves to the walkable neighbor with the
 * lowest heuristic value (Manhattan distance to the goal). It has **no
 * backtracking** — it walks downhill on the heuristic and can never revisit
 * a cell, so the moment no neighbor improves on the current position it halts.
 *
 * ## Termination semantics
 *
 * The stub distinguishes two kinds of failure:
 * - `failed`  — the current node has **no neighbors at all** (frontier
 *               exhausted). No path can possibly continue.
 * - `trapped` — neighbors exist but **none improve** on the current node's
 *               heuristic. This is the classic local-optimum halt (e.g. facing
 *               the concave wall of the U-trap grid).
 *
 * In both non-success cases the walker returns: `trapped` keeps the path it
 * walked (so the visualization shows where it got stuck), `failed` has no
 * path at all (`null`).
 *
 * ## Generator protocol
 *
 * Each tick yields one or more `StepEvent`s:
 *   1. `consider` — the node being walked over, `heuristicTarget` = goal.
 *   2. `visit`    — confirms the node was explored.
 *   3. `frontier` — the single chosen neighbor when the walker advances.
 *   4. `path`     — the path walked so far.
 *
 * On termination the generator **returns** (not yields) the `AlgorithmResult`.
 *
 * @module algorithms/hillClimbing
 */

import type {
  AlgorithmConfig,
  AlgorithmFactory,
  AlgorithmGenerator,
  AlgorithmResult,
  GridSnapshot,
  Point,
} from './types';
import { isGoal, key, nearestGoal, nearestGoalDist, neighbors } from './utils';

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

// ── Hill Climbing generator ─────────────────────────────────────────────────

/**
 * Hill Climbing search generator factory.
 *
 * @param grid    - Immutable grid snapshot.
 * @param _config - Unused; Hill Climbing has no tunable knobs.
 * @returns A generator that yields StepEvents and returns an AlgorithmResult.
 */
export function* hillClimbingSearch(
  grid: GridSnapshot,
  _config?: AlgorithmConfig,
): AlgorithmGenerator {
  const t0 = performance.now();

  const path: Point[] = [grid.start];
  const visited = new Set<string>([key(grid.start)]);
  let nodesExplored = 1;

  while (true) {
    const current = path[path.length - 1]!;

    // Goal check — reached any of the goals (including when start is a goal).
    if (isGoal(grid, current)) {
      yield { kind: 'consider', node: current, heuristicTarget: nearestGoal(grid, current) };
      yield { kind: 'visit', node: current };

      const result: AlgorithmResult = {
        status: 'success',
        path,
        nodesExplored,
        timeMs: performance.now() - t0,
        cost: pathCost(path, grid),
      };
      yield { kind: 'path', path };
      yield { kind: 'done', result };
      return result;
    }

    yield { kind: 'consider', node: current, heuristicTarget: nearestGoal(grid, current) };
    yield { kind: 'visit', node: current };

    const rawNeighbors = neighbors(current, grid);

    // No neighbors at all → nothing left to walk to.
    if (rawNeighbors.length === 0) {
      const result: AlgorithmResult = {
        status: 'failed',
        path: null,
        nodesExplored,
        timeMs: performance.now() - t0,
      };
      yield { kind: 'done', result };
      return result;
    }

    // Only consider unvisited neighbors (no backtracking).
    const candidates = rawNeighbors.filter((n) => !visited.has(key(n)));

    // Everything reachable has already been walked — we're stuck.
    if (candidates.length === 0) {
      const result: AlgorithmResult = {
        status: 'trapped',
        path,
        nodesExplored,
        timeMs: performance.now() - t0,
      };
      yield { kind: 'done', result };
      return result;
    }

    // Pick the neighbor with the smallest heuristic distance to the nearest goal.
    let best = candidates[0]!;
    let bestH = nearestGoalDist(grid, best);
    for (let i = 1; i < candidates.length; i++) {
      const c = candidates[i]!;
      const h = nearestGoalDist(grid, c);
      if (h < bestH) {
        best = c;
        bestH = h;
      }
    }

    // No neighbor improves the heuristic → local optimum → trapped.
    const currentH = nearestGoalDist(grid, current);
    if (bestH >= currentH) {
      const result: AlgorithmResult = {
        status: 'trapped',
        path,
        nodesExplored,
        timeMs: performance.now() - t0,
      };
      yield { kind: 'done', result };
      return result;
    }

    // Advance the walker.
    path.push(best);
    visited.add(key(best));
    nodesExplored++;

    yield { kind: 'frontier', nodes: [best] };
    yield { kind: 'path', path: [...path] };
  }
}

// Re-export the factory with the correct type for the registry
export const hillClimbingFactory: AlgorithmFactory = hillClimbingSearch;