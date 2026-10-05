/**
 * Beam Search Algorithm
 *
 * A bounded greedy search: like Greedy Best-First, but instead of keeping a
 * full priority-queue frontier, it keeps only the top `beamWidth` most
 * promising candidates (ranked by f(n) = g(n) + h(n), Manhattan h) when
 * expanding each level. Beam search is **incomplete and not optimal** — if
 * the goal falls outside the beam it reports 'failed', because the whole
 * point of the algorithm is to sacrifice completeness for a smaller
 * frontier.
 *
 * Beam width is tunable via `AlgorithmConfig.beamWidth` (default 3).
 *
 * ## Generator protocol
 *
 * Each tick yields:
 *   1. `consider` — the node being expanded, with `heuristicTarget` set to goal.
 *   2. `visit`    — confirms the node was officially explored.
 *   3. `frontier` — children added after neighbor expansion.
 *   4. `path`     — current best-known path (reconstructed from came-from map).
 *
 * On termination the generator **returns** (not yields) the `AlgorithmResult`.
 *
 * @module algorithms/beam
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

// ── Helpers ─────────────────────────────────────────────────────────────────

const DEFAULT_BEAM_WIDTH = 3;

interface BeamEntry {
  point: Point;
  f: number;
}

// ── Beam Search generator ───────────────────────────────────────────────────

/**
 * Beam search generator factory.
 *
 * @param grid    - Immutable grid snapshot.
 * @param config  - Optional `beamWidth` knob (default 3).
 * @returns A generator that yields StepEvents and returns an AlgorithmResult.
 */
export function* beamSearch(
  grid: GridSnapshot,
  config?: AlgorithmConfig,
): AlgorithmGenerator {
  const t0 = performance.now();
  let nodesExplored = 0;

  const rawWidth = config?.beamWidth;
  const beamWidth =
    typeof rawWidth === 'number' && Number.isFinite(rawWidth) && rawWidth >= 1
      ? Math.floor(rawWidth)
      : DEFAULT_BEAM_WIDTH;

  const cameFrom = new Map<string, Point>();
  const gScore = new Map<string, number>();
  const closedSet = new Set<string>();

  const startKey = key(grid.start);
  gScore.set(startKey, 0);
  let beam: BeamEntry[] = [{ point: grid.start, f: nearestGoalDist(grid, grid.start) }];

  while (beam.length > 0) {
    const nextLevel: BeamEntry[] = [];

    for (const entry of beam) {
      const current = entry.point;
      const currentKey = key(current);

      // Skip if already visited (duplicate entries across levels)
      if (closedSet.has(currentKey)) {
        continue;
      }

      // Yield consider event — shows where the heuristic is pointing
      yield { kind: 'consider', node: current, heuristicTarget: nearestGoal(grid, current) };

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
          cost: gScore.get(currentKey) ?? 0,
        };
        yield { kind: 'done', result };
        return result;
      }

      // Expand neighbors
      const frontierNodes: Point[] = [];
      const currentG = gScore.get(currentKey) ?? Infinity;

      for (const nbr of neighbors(current, grid)) {
        const nbrKey = key(nbr);
        if (closedSet.has(nbrKey)) continue;

        const tentativeG = currentG + (grid.costs?.get(nbrKey) ?? 1);
        const bestG = gScore.get(nbrKey) ?? Infinity;

        if (tentativeG < bestG) {
          cameFrom.set(nbrKey, current);
          gScore.set(nbrKey, tentativeG);
          nextLevel.push({ point: nbr, f: tentativeG + nearestGoalDist(grid, nbr) });
          frontierNodes.push(nbr);
        }
      }

      if (frontierNodes.length > 0) {
        yield { kind: 'frontier', nodes: frontierNodes };
      }

      // Yield current best path to the node just expanded
      yield { kind: 'path', path: reconstructPath(cameFrom, current) };
    }

    // Keep only the best `beamWidth` candidates (deduplicated by cell key)
    nextLevel.sort((a, b) => a.f - b.f);
    const seen = new Set<string>();
    beam = [];
    for (const entry of nextLevel) {
      const k = key(entry.point);
      if (seen.has(k) || closedSet.has(k)) continue;
      seen.add(k);
      beam.push(entry);
      if (beam.length >= beamWidth) break;
    }
  }

  // Beam exhausted — goal may have fallen off the beam, report failed
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
export const beamFactory: AlgorithmFactory = beamSearch;
