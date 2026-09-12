/**
 * Algorithm Registry
 *
 * Central registry mapping algorithm keys to their display metadata and
 * factory functions. Both the UI (dropdown, color assignment) and the race
 * scheduler read from this single source of truth.
 *
 * ## Status legend
 *
 * - Implemented (true)  — factory is functional and tested.
 * - TODO (false)        — factory throws; needs implementation by a contributor.
 *
 * @module algorithms/index
 */

import type { AlgorithmFactory } from './types';
import { aStarSearch } from './astar';
import { breadthFirstSearch } from './bfs';
import { dijkstraFactory } from './dijkstra';
import { dfsFactory } from './dfs';
import { greedyBestFirstFactory } from './greedyBestFirst';
import { hillClimbingFactory } from './hillClimbing';
import { simulatedAnnealingFactory } from './simulatedAnnealing';
import { bidirectionalBfsFactory } from './bidirectionalBfs';
import { bidirectionalAStarFactory } from './bidirectionalAstar';

// Re-export types for convenience
export type { AlgorithmFactory, AlgorithmGenerator, AlgorithmConfig } from './types';
export type { Point, GridSnapshot, StepEvent, AlgorithmResult } from './types';

export interface AlgorithmEntry {
  /** Human-readable display label for the UI dropdown. */
  label: string;
  /** Hex color assigned to this algorithm's pawn and overlays. */
  color: string;
  /** Factory that creates a generator for one run of this algorithm. */
  factory: AlgorithmFactory;
  /** Whether this algorithm is fully implemented and tested. */
  implemented: boolean;
}

/**
 * The canonical algorithm registry.
 *
 * Keys are stable identifiers used in agent state and URL params.
 * Colors come from the init.md §3 spec and must not be changed ad-hoc.
 */
export const ALGORITHMS: Record<string, AlgorithmEntry> = {
  astar:     { label: 'A*',                  color: '#C91A09', factory: aStarSearch,              implemented: true },
  bfs:       { label: 'BFS',                 color: '#F2CD37', factory: breadthFirstSearch,       implemented: true },
  dijkstra:  { label: "Dijkstra's",          color: '#0055BF', factory: dijkstraFactory,          implemented: true },
  dfs:       { label: 'DFS',                 color: '#4B9F4A', factory: dfsFactory,               implemented: true },
  greedy:    { label: 'Greedy Best-First',   color: '#FE8A18', factory: greedyBestFirstFactory,   implemented: true },
  hillclimb: { label: 'Hill Climbing',       color: '#923978', factory: hillClimbingFactory,      implemented: true },
  annealing: { label: 'Simulated Annealing', color: '#36AEBF', factory: simulatedAnnealingFactory, implemented: true },
  'bidir-bfs': { label: 'Bidirectional BFS', color: '#E5A91E', factory: bidirectionalBfsFactory, implemented: true },
  'bidir-astar': { label: 'Bidirectional A*', color: '#9E1507', factory: bidirectionalAStarFactory, implemented: true },
} as const;

/**
 * Returns only the algorithms that are currently implemented and testable.
 * Use this in the UI to prevent users from selecting unfinished algorithms.
 */
export function getImplementedAlgorithms(): Record<string, AlgorithmEntry> {
  const result: Record<string, AlgorithmEntry> = {};
  for (const [k, v] of Object.entries(ALGORITHMS)) {
    if (v.implemented) {
      result[k] = v;
    }
  }
  return result;
}

/**
 * Returns the keys of algorithms that still need implementation.
 * Useful for progress tracking and contributor dashboards.
 */
export function getTodoAlgorithms(): string[] {
  return Object.entries(ALGORITHMS)
    .filter(([, v]) => !v.implemented)
    .map(([k]) => k);
}
