/**
 * Floyd-Warshall Algorithm
 *
 * All-pairs shortest-path algorithm. For every intermediate node k, every
 * ordered pair (i, j) is checked for a cheaper route through k:
 *
 *   dist[i][j] = min(dist[i][j], dist[i][k] + dist[k][j])
 *
 * After V passes the full distance matrix is optimal, so the start->goal path
 * is extracted from the next-hop matrix. Unlike Dijkstra/Bellman-Ford it does
 * no edge selection — it simply re-relaxed the whole matrix V times. Like
 * Dijkstra it does not use a heuristic — never sets `heuristicTarget` on
 * consider events.
 *
 * ## Generator protocol
 *
 * Each tick yields:
 *   1. `consider` — the intermediate node k just used as a relay.
 *   2. `visit`    — confirms the intermediate node was officially explored.
 *   3. `frontier` — the batch of pairwise improvements made this pass.
 *   4. `path`     — current best-known path (reconstructed from next-hops).
 *
 * On termination the generator **returns** (not yields) the `AlgorithmResult`.
 *
 * @module algorithms/floyd_warshall
 */

import type {
  AlgorithmConfig,
  AlgorithmFactory,
  AlgorithmGenerator,
  AlgorithmResult,
  GridSnapshot,
  Point,
} from './types';
import { goalPoints, isGoal, key, neighbors } from './utils';

// ── Floyd-Warshall generator ───────────────────────────────────────────────

/**
 * Floyd-Warshall search generator factory.
 *
 * @param grid    - Immutable grid snapshot.
 * @param _config - Unused; Floyd-Warshall has no tunable knobs.
 * @returns A generator that yields StepEvents and returns an AlgorithmResult.
 */
export function* floydWarshallSearch(
  grid: GridSnapshot,
  _config?: AlgorithmConfig,
): AlgorithmGenerator {
  const t0 = performance.now();
  let nodesExplored = 0;

  // ── Index the walkable cells ────────────────────────────────────────────
  const indexOf = new Map<string, number>();
  const pointAt: Point[] = [];
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      const p = { x, y };
      if (!grid.walls.has(key(p))) {
        indexOf.set(key(p), pointAt.length);
        pointAt.push(p);
      }
    }
  }
  const V = pointAt.length;

  const dist = new Float64Array(V * V).fill(Infinity);
  const nxt = new Int32Array(V * V).fill(-1);

  for (let i = 0; i < V; i++) {
    dist[i * V + i] = 0;
    nxt[i * V + i] = i;
  }

  // Direct (single-hop) edges
  for (let i = 0; i < V; i++) {
    const u = pointAt[i]!;
    for (const v of neighbors(u, grid)) {
      const j = indexOf.get(key(v));
      if (j === undefined) continue;
      const stepCost = grid.costs?.get(key(v)) ?? 1;
      if (stepCost < dist[i * V + j]!) {
        dist[i * V + j] = stepCost;
        nxt[i * V + j] = j;
      }
    }
  }

  const startIndex = indexOf.get(key(grid.start)) ?? -1;
  const primaryGoalIndex = indexOf.get(key(grid.goal)) ?? -1;

  // Yield consider/visit/frontier for the start node
  yield { kind: 'consider', node: grid.start };
  nodesExplored++;
  yield { kind: 'visit', node: grid.start };

  // Goal check — start may itself be a goal (multi-goal seeds)
  if (isGoal(grid, grid.start)) {
    const path: Point[] = [{ ...grid.start }];
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
  yield { kind: 'path', path: [{ ...grid.start }] };

  // ── Helper: reconstruct start->target path via next-hop matrix ──────────
  const reconstructTo = (target: number): Point[] | null => {
    if (startIndex < 0 || target < 0) return null;
    if (!Number.isFinite(dist[startIndex * V + target]!)) return null;
    const path: Point[] = [];
    let cursor = startIndex;
    let hops = 0;
    while (cursor !== target && hops <= V) {
      path.push({ ...pointAt[cursor]! });
      const hop = nxt[cursor * V + target]!;
      if (hop < 0 || hop === cursor) return null; // inconsistent chain guard
      cursor = hop;
      hops++;
    }
    if (cursor !== target) return null;
    path.push({ ...pointAt[target]! });
    return path;
  };

  // Cheapest currently-known goal index, or -1 when none reachable yet
  const currentBestGoal = (): number => {
    let best = -1;
    let bestD = Infinity;
    for (const g of goalPoints(grid)) {
      const gi = indexOf.get(key(g));
      if (gi === undefined) continue;
      const d = dist[startIndex * V + gi]!;
      if (Number.isFinite(d) && d < bestD) {
        bestD = d;
        best = gi;
      }
    }
    return best;
  };

  // ── Triple-loop relaxation over intermediate nodes k ────────────────────
  for (let k = 0; k < V; k++) {
    const improvedEndpoints: Point[] = [];

    for (let i = 0; i < V; i++) {
      const ik = dist[i * V + k]!;
      if (!Number.isFinite(ik)) continue;
      const rowI = i * V;
      const rowK = k * V;
      for (let j = 0; j < V; j++) {
        const viaKJ = dist[rowK + j]!;
        if (!Number.isFinite(viaKJ)) continue;
        const candidate = ik + viaKJ;
        if (candidate < dist[rowI + j]!) {
          dist[rowI + j] = candidate;
          nxt[rowI + j] = nxt[i * V + k]!;
          if (i === startIndex) {
            improvedEndpoints.push({ ...pointAt[j]! });
          }
        }
      }
    }

    const relay = pointAt[k]!;
    yield { kind: 'consider', node: relay };
    nodesExplored++;
    yield { kind: 'visit', node: relay };

    if (improvedEndpoints.length > 0) {
      yield { kind: 'frontier', nodes: improvedEndpoints };
    } else {
      yield { kind: 'frontier', nodes: [relay] };
    }

    // Current best-known path from start (to cheapest currently-reached goal,
    // falling back to the primary goal for consistent trail visuals)
    const bestGoalNow = currentBestGoal();
    const target = bestGoalNow >= 0 ? bestGoalNow : primaryGoalIndex;
    const currentPath = target >= 0 ? reconstructTo(target) : null;
    yield { kind: 'path', path: currentPath ?? [{ ...grid.start }] };
  }

  // ── Resolve the final answer ────────────────────────────────────────────
  let bestGoalIndex = -1;
  let bestD = Infinity;
  for (const g of goalPoints(grid)) {
    const gi = indexOf.get(key(g));
    if (gi === undefined) continue;
    const d = dist[startIndex * V + gi]!;
    if (Number.isFinite(d) && d < bestD) {
      bestD = d;
      bestGoalIndex = gi;
    }
  }

  if (bestGoalIndex >= 0) {
    const path = reconstructTo(bestGoalIndex);
    if (path !== null) {
      yield { kind: 'path', path };
      const result: AlgorithmResult = {
        status: 'success',
        path,
        nodesExplored,
        timeMs: performance.now() - t0,
        cost: bestD,
      };
      yield { kind: 'done', result };
      return result;
    }
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
export const floydWarshallFactory: AlgorithmFactory = floydWarshallSearch;
