/**
 * Simulated Annealing Search Algorithm
 *
 * A probabilistic optimization that can escape local optima (unlike Hill
 * Climbing) by occasionally accepting worse moves. Starting from a high
 * "temperature" the walker accepts almost any move; as the temperature cools
 * toward zero it becomes greedier, until it is effectively frozen.
 *
 * ## Termination semantics
 *
 * - `success` — the walker reached the goal.
 * - `failed`  — the current node has no neighbors at all (isolated cell).
 * - `trapped` — the temperature froze (or the step budget ran out) before
 *               reaching the goal. The walked path is returned so the
 *               visualization shows where it halted.
 *
 * ## Config knobs (optional)
 *
 * - `initialTemp` (default 100) — starting temperature.
 * - `coolingRate` (default: auto-computed from grid size and start-goal
 *   distance) — multiplier applied to T after every step. If omitted, it is
 *   derived so the walker gets a step budget proportional to how far the goal
 *   is, instead of a fixed ~1,840 steps regardless of grid size.
 * - `maxSteps` (default `width * height * 16`) — hard cap on steps, so a
 *   `coolingRate` close to 1 can't run away indefinitely.
 * - `avoidImmediateBacktrack` (default true) — when the current cell has more
 *   than one neighbor, excludes the cell we just came from from the candidate
 *   pool. This is a deliberate deviation from textbook SA (which samples
 *   uniformly over the full neighborhood): on a grid, "the cell you just
 *   left" is disproportionately likely to be re-proposed and, at high
 *   temperature, disproportionately likely to be re-accepted, which burns
 *   through the step budget on A↔B oscillation instead of exploration. Set to
 *   `false` to restore pure textbook sampling.
 *
 * Acceptance probability of a worse move (ΔE = h(neighbor) - h(current) > 0):
 *
 *     P = e^(-ΔE / T)
 *
 * ## Generator protocol
 *
 * Each tick yields one or more `StepEvent`s:
 *   1. `consider` — the neighbor being evaluated for the next move, with
 *                   `heuristicTarget` = goal and the live `temperature`.
 *   2. `visit`    — the neighbor was accepted and moved onto.
 *   3. `frontier` — the accepted move (or an empty list when rejected).
 *   4. `path`     — the walked path so far.
 *
 * On termination the generator **returns** (not yields) the `AlgorithmResult`.
 *
 * @module algorithms/simulatedAnnealing
 */

import type {
  AlgorithmConfig,
  AlgorithmFactory,
  AlgorithmGenerator,
  AlgorithmResult,
  GridSnapshot,
  Point,
} from './types';
import { isGoal, nearestGoal, nearestGoalDist, neighbors } from './utils';

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Coerce a config value to a number. `AlgorithmConfig` values may be numbers
 * or booleans; numeric knobs only make sense as numbers, so anything else
 * falls back to `fallback`.
 */
function asNumber(value: number | boolean | undefined, fallback: number): number {
  return typeof value === 'number' ? value : fallback;
}

/** Total traversal cost of `path` (default cost per step is 1). */
function pathCost(path: Point[], grid: GridSnapshot): number {
  let cost = 0;
  for (let i = 1; i < path.length; i++) {
    const p = path[i]!;
    cost += grid.costs?.get(`${p.x},${p.y}`) ?? 1;
  }
  return cost;
}

/** Temperature below which the system is considered frozen. */
const FREEZE_THRESHOLD = 0.01;

/** Upper bound on the derived annealing budget (keeps races watchable). */
const MAX_BUDGET = 1500;

/**
 * Derive a cooling rate that gives the walker a step budget proportional to
 * how far it actually has to travel, instead of a fixed ~1,840 steps
 * regardless of grid size. Solves `initialTemp * rate^targetSteps =
 * FREEZE_THRESHOLD` for `rate`, then clamps to a sane range.
 *
 * @internal
 */
function autoCoolingRate(
  grid: GridSnapshot,
  initialTemp: number,
  maxSteps: number,
): number {
  const distance = Math.max(1, nearestGoalDist(grid, grid.start));
  const cells = grid.width * grid.height;
  // A small map needs a comfortable budget relative to its size; the distance
  // term prevents a long thin corridor from being starved; MAX_BUDGET keeps
  // large maps from spending ~4k steps wandering.
  const targetSteps = Math.min(
    maxSteps,
    Math.max(distance * 10, Math.min(cells * 12, MAX_BUDGET)),
  );
  const rate = Math.pow(FREEZE_THRESHOLD / initialTemp, 1 / targetSteps);
  return Math.min(0.999, Math.max(0.9, rate));
}

// ── Simulated Annealing generator ───────────────────────────────────────────

/**
 * Simulated Annealing search generator factory.
 *
 * @param grid   - Immutable grid snapshot.
 * @param config - Optional `initialTemp`, `coolingRate`, `maxSteps`, and
 *                 `avoidImmediateBacktrack` knobs. See module docs above.
 * @returns A generator that yields StepEvents and returns an AlgorithmResult.
 */
export function* simulatedAnnealingSearch(
  grid: GridSnapshot,
  config?: AlgorithmConfig,
): AlgorithmGenerator {
  const initialTemp = asNumber(config?.initialTemp, 100);
  const maxSteps = asNumber(config?.maxSteps, grid.width * grid.height * 16);
  const coolingRate =
    typeof config?.coolingRate === 'number'
      ? config.coolingRate
      : autoCoolingRate(grid, initialTemp, maxSteps);
  const avoidFlag = config?.avoidImmediateBacktrack;
  const avoidImmediateBacktrack = avoidFlag === undefined ? true : Boolean(avoidFlag);
  const t0 = performance.now();

  const path: Point[] = [grid.start];
  let nodesExplored = 1;
  let temperature = initialTemp;
  let steps = 0;

  // ── start is one of the goals ─────────────────────────────────────────────
  if (isGoal(grid, grid.start)) {
    yield { kind: 'consider', node: grid.start, heuristicTarget: nearestGoal(grid, grid.start), temperature: initialTemp };
    yield { kind: 'visit', node: grid.start };
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

  yield { kind: 'consider', node: grid.start, heuristicTarget: nearestGoal(grid, grid.start), temperature: initialTemp };
  yield { kind: 'visit', node: grid.start };

  // ── Annealing loop ────────────────────────────────────────────────────────
  while (temperature >= FREEZE_THRESHOLD && steps < maxSteps) {
    steps++;
    const current = path[path.length - 1]!;
    const parent = path.length > 1 ? path[path.length - 2]! : null;
    const rawNeighbors = neighbors(current, grid);

    // Isolated cell — nothing left to walk to.
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

    // Optionally exclude the cell we just came from so the walker doesn't
    // waste high-temperature steps oscillating in place. Only applied when
    // there's an actual alternative — a dead end still needs to backtrack.
    let pool = rawNeighbors;
    if (avoidImmediateBacktrack && parent) {
      const withoutParent = rawNeighbors.filter(
        (n) => !(n.x === parent.x && n.y === parent.y),
      );
      if (withoutParent.length > 0) pool = withoutParent;
    }

    // Pick a random candidate and compute the energy change.
    const candidate = pool[Math.floor(Math.random() * pool.length)]!;
    const deltaE = nearestGoalDist(grid, candidate) - nearestGoalDist(grid, current);
    const accepted = deltaE <= 0 || Math.random() < Math.exp(-deltaE / temperature);

    nodesExplored++;

    // Evaluate the candidate move visually.
    yield { kind: 'consider', node: candidate, heuristicTarget: nearestGoal(grid, candidate), temperature };

    if (accepted) {
      path.push(candidate);
      yield { kind: 'visit', node: candidate };

      // Reached one of the goals.
      if (isGoal(grid, candidate)) {
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

      yield { kind: 'frontier', nodes: [candidate] };
      yield { kind: 'path', path: [...path] };
    } else {
      yield { kind: 'frontier', nodes: [] };
    }

    // Cool down after the step.
    temperature *= coolingRate;
  }

  // ── Frozen (or step budget exhausted) without reaching the goal ───────────
  const result: AlgorithmResult = {
    status: 'trapped',
    path,
    nodesExplored,
    timeMs: performance.now() - t0,
  };
  yield { kind: 'done', result };
  return result;
}

// Re-export the factory with the correct type for the registry
export const simulatedAnnealingFactory: AlgorithmFactory = simulatedAnnealingSearch;