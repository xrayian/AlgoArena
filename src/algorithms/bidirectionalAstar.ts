/**
 * Bidirectional A* Search Algorithm
 *
 * Searches simultaneously from both the start and the goal, alternating
 * expansion between two A* frontiers. Each side orders its frontier by
 * f(n) = g(n) + h(n):
 *   - start side: gA(n) = cost from start, hA(n) = Manhattan(n, goal)
 *   - goal side: gB(n) = cost from goal, hB(n) = Manhattan(n, start)
 *
 * When a node is reached by both frontiers, the two half-paths are joined into
 * a candidate path. The search stops when the sum of the smallest f-values of
 * the two frontiers is no better than the best candidate found so far, which
 * guarantees the shortest (minimum-cost) path for consistent heuristics.
 *
 * ## Generator protocol
 *
 * Each tick yields one or more `StepEvent`s:
 *   1. `consider` — the node being expanded, with `heuristicTarget` pointing
 *                   toward the opposite endpoint of the grid.
 *   2. `visit`    — confirms the node was officially explored.
 *   3. `frontier` — updated open set after neighbor expansion.
 *   4. `path`     — current best-known path (joined half-paths if found).
 *
 * On termination the generator **returns** (not yields) the `AlgorithmResult`.
 *
 * @module algorithms/bidirectionalAstar
 */

import type {
  AlgorithmConfig,
  AlgorithmFactory,
  AlgorithmGenerator,
  AlgorithmResult,
  GridSnapshot,
  Point,
} from './types';
import { MinHeap } from './heap';
import { goalPoints, isGoal, key, manhattan, nearestGoal, nearestGoalDist, neighbors } from './utils';

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Reconstruct the path from the origin of `cameFrom` to `current`.
 * `cameFrom` maps each node to its predecessor (toward the origin side).
 */
function reconstructFrom(cameFrom: Map<string, Point>, current: Point): Point[] {
  const path: Point[] = [current];
  let k = key(current);
  while (cameFrom.has(k)) {
    const prev = cameFrom.get(k)!;
    path.unshift(prev);
    k = key(prev);
  }
  return path;
}

/**
 * Reconstruct the path from `current` outward following `cameFrom`.
 * Used on the goal side, where `cameFrom` points toward the goal.
 */
function reconstructToward(cameFrom: Map<string, Point>, current: Point): Point[] {
  const path: Point[] = [current];
  let k = key(current);
  while (cameFrom.has(k)) {
    const next = cameFrom.get(k)!;
    path.push(next);
    k = key(next);
  }
  return path;
}


// ── Heap entry type ──────────────────────────────────────────────────────────

interface HeapEntry {
  point: Point;
  f: number;
}

/**
 * Purge entries from the top of the heap that have already been closed.
 * Ensures heap.peekScore() and heap.peek() always reflect true unclosed frontier nodes.
 */
function cleanHeap(heap: MinHeap<HeapEntry>, closed: Set<string>): void {
  while (heap.size > 0 && closed.has(key(heap.peek()!.point))) {
    heap.pop();
  }
}

/**
 * Compute the exact total traversal cost for a path.
 */
function computePathCost(path: Point[], grid: GridSnapshot): number {
  let cost = 0;
  for (let i = 1; i < path.length; i++) {
    const p = path[i]!;
    cost += grid.costs?.get(`${p.x},${p.y}`) ?? 1;
  }
  return cost;
}

interface GoalSearcher {
  goal: Point;
  heap: MinHeap<HeapEntry>;
  gScore: Map<string, number>;
  cameFrom: Map<string, Point>;
  closed: Set<string>;
}

// ── Bidirectional A* generator ──────────────────────────────────────────────

/**
 * Bidirectional A* search generator factory.
 *
 * @param grid    - Immutable grid snapshot.
 * @param _config - Unused; Bidirectional A* has no tunable knobs.
 * @returns A generator that yields StepEvents and returns an AlgorithmResult.
 */
export function* bidirectionalAStar(
  grid: GridSnapshot,
  _config?: AlgorithmConfig,
): AlgorithmGenerator {
  const t0 = performance.now();
  let nodesExplored = 0;

  const start = grid.start;
  const goals = goalPoints(grid);

  // If start is one of the goals, we're done immediately.
  if (isGoal(grid, start)) {
    const path = [start];
    yield { kind: 'consider', node: start, heuristicTarget: nearestGoal(grid, start), direction: 'forward' };
    yield { kind: 'visit', node: start };
    yield { kind: 'path', path };
    const result: AlgorithmResult = {
      status: 'success',
      path,
      nodesExplored: 1,
      timeMs: performance.now() - t0,
      cost: 0,
    };
    yield { kind: 'done', result };
    return result;
  }

  // ── Start side (A) ───────────────────────────────────────────────────────
  const openA = new MinHeap<HeapEntry>((e) => e.f);
  const gA = new Map<string, number>();
  const cameFromA = new Map<string, Point>();
  const closedA = new Set<string>();
  gA.set(key(start), 0);
  openA.push({ point: start, f: nearestGoalDist(grid, start) });

  // ── Goal side (B) — independent encapsulated searcher per goal node ─────
  // Each goal gets its own MinHeap, gScore, cameFrom, and closedSet so that
  // neither search branches nor predecessor paths collide between goals.
  const goalSearchers: GoalSearcher[] = goals.map((g) => {
    const heap = new MinHeap<HeapEntry>((e) => e.f);
    const gScore = new Map<string, number>();
    const cameFrom = new Map<string, Point>();
    const closed = new Set<string>();
    gScore.set(key(g), 0);
    heap.push({ point: g, f: manhattan(g, start) });
    return { goal: g, heap, gScore, cameFrom, closed };
  });

  /** Whether any goal frontier still has unclosed nodes that could beat bestCost. */
  function hasOpenB(): boolean {
    for (let i = 0; i < goalSearchers.length; i++) {
      const s = goalSearchers[i]!;
      cleanHeap(s.heap, s.closed);
      if (s.heap.size > 0 && s.heap.peekScore() < bestCost) return true;
    }
    return false;
  }

  /** Lowest f-score across all active goal frontiers. */
  function minOpenBF(): number {
    let minF = Infinity;
    for (let i = 0; i < goalSearchers.length; i++) {
      const s = goalSearchers[i]!;
      cleanHeap(s.heap, s.closed);
      if (s.heap.size > 0) {
        const f = s.heap.peekScore();
        if (f < minF) minF = f;
      }
    }
    return minF;
  }

  // Best complete path found so far and its true cost
  let bestPath: Point[] | null = null;
  let bestCost = Infinity;

  /** Join two half-paths at a meeting node into one full path for a given goal searcher. */
  function joinPath(meet: Point, searcher: GoalSearcher): Point[] {
    const fromStart = reconstructFrom(cameFromA, meet);
    const toGoal = reconstructToward(searcher.cameFrom, meet);
    return [...fromStart, ...toGoal.slice(1)];
  }

  /** Evaluate a complete path between frontiers and update the best candidate. */
  function considerCandidate(path: Point[]): void {
    const cost = computePathCost(path, grid);
    if (cost < bestCost) {
      bestCost = cost;
      bestPath = path;
    }
  }

  /**
   * Determine whether the current best path is provably optimal.
   *
   * Any undiscovered path from Start to Goal must pass through some u in openA
   * and some v in openB. Its cost is strictly bounded from below by:
   *   1. Pohl's bound: max(f_min^A, f_min^B)
   *   2. Pairwise cut-distance bound: min_{u in openA, v in openB} (gA(u) + manhattan(u, v) + gB(v))
   *
   * If either condition indicates no unexamined path can beat bestCost,
   * the search terminates immediately.
   */
  function isOptimal(): boolean {
    if (bestPath === null) return false;
    cleanHeap(openA, closedA);

    // Fast Path 1: Pohl's bound
    const fA = openA.peekScore();
    const fB = minOpenBF();
    if (Math.max(fA, fB) >= bestCost) return true;

    // Fast Path 2: If openA has no unclosed nodes left, no path can advance from Start
    const nodesA = openA.entries.filter((e) => !closedA.has(key(e.point)));
    if (nodesA.length === 0) return true;

    // Condition 2: Pairwise cut-distance lower bound across all active goal frontiers
    for (let i = 0; i < goalSearchers.length; i++) {
      const s = goalSearchers[i]!;
      cleanHeap(s.heap, s.closed);
      const nodesB = s.heap.entries.filter((e) => !s.closed.has(key(e.point)));
      if (nodesB.length === 0) continue;

      let minPair = Infinity;
      for (let a = 0; a < nodesA.length; a++) {
        const ea = nodesA[a]!;
        const ga = gA.get(key(ea.point))!;
        if (ga >= bestCost) continue;

        for (let b = 0; b < nodesB.length; b++) {
          const eb = nodesB[b]!;
          const gb = s.gScore.get(key(eb.point))!;
          const d = ga + manhattan(ea.point, eb.point) + gb;
          if (d < minPair) {
            minPair = d;
            if (minPair < bestCost) break;
          }
        }
        if (minPair < bestCost) break;
      }

      // If this goal frontier could still produce a path cheaper than bestCost, not yet optimal
      if (minPair < bestCost) return false;
    }

    return true;
  }

  // Synchronous multi-head search: in each round, the Start side expands 1 node
  // and EACH active Goal side expands 1 node so all frontiers advance simultaneously.
  while (openA.size > 0 || hasOpenB()) {
    cleanHeap(openA, closedA);
    let advancedThisRound = false;

    // ── 1. Expand one node from the start side ─────────────────────────────
    let currentA: Point | null = null;
    while (openA.size > 0) {
      const entry = openA.pop()!;
      if (closedA.has(key(entry.point))) continue;
      // Since min-heap, if this entry cannot beat bestCost, no remaining entry in openA can
      if (entry.f >= bestCost) {
        break;
      }
      currentA = entry.point;
      break;
    }

    if (currentA !== null) {
      advancedThisRound = true;
      const currentKey = key(currentA);

      yield { kind: 'consider', node: currentA, heuristicTarget: nearestGoal(grid, currentA), direction: 'forward' };
      closedA.add(currentKey);
      nodesExplored++;
      yield { kind: 'visit', node: currentA };

      // If any goal side already reached this node → candidate meeting.
      for (let i = 0; i < goalSearchers.length; i++) {
        const s = goalSearchers[i]!;
        if (s.gScore.has(currentKey)) {
          considerCandidate(joinPath(currentA, s));
        }
      }

      const currentG = gA.get(currentKey) ?? Infinity;
      const frontierNodes: Point[] = [];

      for (const nbr of neighbors(currentA, grid)) {
        const nbrKey = key(nbr);
        if (closedA.has(nbrKey)) continue;

        const stepCost = grid.costs?.get(nbrKey) ?? 1;
        const tentativeG = currentG + stepCost;
        const bestG = gA.get(nbrKey) ?? Infinity;

        if (tentativeG < bestG) {
          cameFromA.set(nbrKey, currentA);
          gA.set(nbrKey, tentativeG);
          const f = tentativeG + nearestGoalDist(grid, nbr);
          if (f < bestCost) {
            openA.push({ point: nbr, f });
            frontierNodes.push(nbr);
          }

          // Neighbor already reached by any goal frontier → candidate meeting.
          for (let i = 0; i < goalSearchers.length; i++) {
            const s = goalSearchers[i]!;
            if (s.gScore.has(nbrKey)) {
              considerCandidate(joinPath(nbr, s));
            }
          }
        }
      }

      if (frontierNodes.length > 0) {
        yield { kind: 'frontier', nodes: frontierNodes };
      }
      yield { kind: 'path', path: bestPath ? [...bestPath] : reconstructFrom(cameFromA, currentA) };

      // Check optimal stop after Start expansion
      if (isOptimal()) {
        break;
      }
    }

    // ── 2. Expand one node from EACH active goal side simultaneously ───────
    for (let i = 0; i < goalSearchers.length; i++) {
      const activeSearcher = goalSearchers[i]!;
      cleanHeap(activeSearcher.heap, activeSearcher.closed);

      let currentB: Point | null = null;
      while (activeSearcher.heap.size > 0) {
        const entry = activeSearcher.heap.pop()!;
        if (activeSearcher.closed.has(key(entry.point))) continue;
        // Since min-heap, if this entry cannot beat bestCost, this goal searcher is finished
        if (entry.f >= bestCost) {
          break;
        }
        currentB = entry.point;
        break;
      }

      if (currentB === null) continue;

      advancedThisRound = true;
      const currentKey = key(currentB);

      yield { kind: 'consider', node: currentB, heuristicTarget: start, direction: 'backward' };
      activeSearcher.closed.add(currentKey);
      nodesExplored++;
      yield { kind: 'visit', node: currentB };

      // If the start side already reached this node → candidate meeting.
      if (gA.has(currentKey)) {
        considerCandidate(joinPath(currentB, activeSearcher));
      }

      const currentG = activeSearcher.gScore.get(currentKey) ?? Infinity;
      const frontierNodes: Point[] = [];

      for (const nbr of neighbors(currentB, grid)) {
        const nbrKey = key(nbr);
        if (activeSearcher.closed.has(nbrKey)) continue;

        // In reverse graph from current to nbr, forward edge is nbr -> current
        const stepCost = grid.costs?.get(currentKey) ?? 1;
        const tentativeG = currentG + stepCost;
        const bestG = activeSearcher.gScore.get(nbrKey) ?? Infinity;

        if (tentativeG < bestG) {
          activeSearcher.cameFrom.set(nbrKey, currentB);
          activeSearcher.gScore.set(nbrKey, tentativeG);
          const f = tentativeG + manhattan(nbr, start);
          if (f < bestCost) {
            activeSearcher.heap.push({ point: nbr, f });
            frontierNodes.push(nbr);
          }

          // Neighbor reached by the start side → candidate meeting.
          if (gA.has(nbrKey)) {
            considerCandidate(joinPath(nbr, activeSearcher));
          }
        }
      }

      if (frontierNodes.length > 0) {
        yield { kind: 'frontier', nodes: frontierNodes };
      }
      yield { kind: 'path', path: bestPath ? [...bestPath] : reconstructToward(activeSearcher.cameFrom, currentB) };

      // Check optimal stop after each Goal expansion
      if (isOptimal()) {
        break;
      }
    }

    // Optimal stop check at round boundary
    if (isOptimal()) {
      break;
    }

    // If no searcher was able to advance, stop
    if (!advancedThisRound) {
      break;
    }

    // If Start is exhausted or all Goals are exhausted and no path exists, stop
    if (bestPath === null && (openA.size === 0 || !hasOpenB())) {
      break;
    }
  }

  // ── Outcome ─────────────────────────────────────────────────────────────
  if (bestPath !== null) {
    yield { kind: 'path', path: bestPath };
    const result: AlgorithmResult = {
      status: 'success',
      path: bestPath,
      nodesExplored,
      timeMs: performance.now() - t0,
      cost: bestCost,
    };
    yield { kind: 'done', result };
    return result;
  }

  // One or both frontiers exhausted — goal unreachable.
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
export const bidirectionalAStarFactory: AlgorithmFactory = bidirectionalAStar;