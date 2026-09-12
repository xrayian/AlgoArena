/**
 * Multi-goal tests
 *
 * Every implemented algorithm must treat reaching ANY of the grid's goals as
 * success. Three canonical multi-goal grids live in fixtures.ts.
 *
 * Run: npm test
 */

import { describe, expect, it } from 'vitest';
import { aStarSearch } from '../astar';
import { breadthFirstSearch } from '../bfs';
import { dijkstraFactory } from '../dijkstra';
import { dfsFactory } from '../dfs';
import { greedyBestFirstFactory } from '../greedyBestFirst';
import { hillClimbingFactory } from '../hillClimbing';
import { simulatedAnnealingSearch } from '../simulatedAnnealing';
import { bidirectionalBfsFactory } from '../bidirectionalBfs';
import { bidirectionalAStarFactory } from '../bidirectionalAstar';
import type { AlgorithmResult, StepEvent } from '../types';
import {
  MULTI_GOAL_OPEN,
  MULTI_GOAL_NEAREST,
  MULTI_GOAL_WALLED_GOAL,
  pathEndsAt,
  pathEndsAtAnyGoal,
  pathIsContiguous,
  runToCompletion,
} from './fixtures';

/** The nine implemented factories exercised by these tests. */
const IMPLEMENTED_FACTORIES = [
  { name: 'A*', factory: aStarSearch },
  { name: 'BFS', factory: breadthFirstSearch },
  { name: 'Dijkstra', factory: dijkstraFactory },
  { name: 'DFS', factory: dfsFactory },
  { name: 'Greedy Best-First', factory: greedyBestFirstFactory },
  { name: 'Hill Climbing', factory: hillClimbingFactory },
  { name: 'Simulated Annealing', factory: simulatedAnnealingSearch },
  { name: 'Bidirectional BFS', factory: bidirectionalBfsFactory },
  { name: 'Bidirectional A*', factory: bidirectionalAStarFactory },
] as const;

function run(factory: (typeof IMPLEMENTED_FACTORIES)[number]['factory'], grid: Parameters<typeof aStarSearch>[0]) {
  const { events, result } = runToCompletion(factory(grid));
  return { events: events as StepEvent[], result: result as unknown as AlgorithmResult };
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('multi-goal support', () => {
  describe('MULTI_GOAL_OPEN (three reachable goals)', () => {
    for (const { name, factory } of IMPLEMENTED_FACTORIES) {
      it(`${name} succeeds and its path ends at one of the goals`, () => {
        const { result } = run(factory, MULTI_GOAL_OPEN);
        expect(result.status).toBe('success');
        expect(result.path).not.toBeNull();
        const path = result.path!;
        expect(pathEndsAtAnyGoal(path, MULTI_GOAL_OPEN.start, MULTI_GOAL_OPEN.goals!)).toBe(true);
        expect(pathIsContiguous(path)).toBe(true);
      });
    }
  });

  describe('MULTI_GOAL_NEAREST (two goals, one closer)', () => {
    for (const { name, factory } of IMPLEMENTED_FACTORIES) {
      it(`${name} succeeds and ends at a goal`, () => {
        const { result } = run(factory, MULTI_GOAL_NEAREST);
        expect(result.status).toBe('success');
        expect(result.path).not.toBeNull();
        const path = result.path!;
        expect(pathEndsAtAnyGoal(path, MULTI_GOAL_NEAREST.start, MULTI_GOAL_NEAREST.goals!)).toBe(true);
      });
    }

    it('A* ends at the NEAREST goal (1, 0), not the primary goal (6, 3)', () => {
      const { result } = run(aStarSearch, MULTI_GOAL_NEAREST);
      expect(result.status).toBe('success');
      expect(result.path).not.toBeNull();
      expect(pathEndsAt(result.path!, { x: 1, y: 0 })).toBe(true);
    });

    it('BFS ends at the NEAREST goal (1, 0), not the primary goal (6, 3)', () => {
      const { result } = run(breadthFirstSearch, MULTI_GOAL_NEAREST);
      expect(result.status).toBe('success');
      expect(result.path).not.toBeNull();
      expect(pathEndsAt(result.path!, { x: 1, y: 0 })).toBe(true);
    });

    it('Dijkstra ends at the NEAREST goal (1, 0), not the primary goal (6, 3)', () => {
      const { result } = run(dijkstraFactory, MULTI_GOAL_NEAREST);
      expect(result.status).toBe('success');
      expect(result.path).not.toBeNull();
      expect(pathEndsAt(result.path!, { x: 1, y: 0 })).toBe(true);
    });

    it('Bidirectional BFS ends at the NEAREST goal (1, 0)', () => {
      const { result } = run(bidirectionalBfsFactory, MULTI_GOAL_NEAREST);
      expect(result.status).toBe('success');
      expect(result.path).not.toBeNull();
      expect(pathEndsAt(result.path!, { x: 1, y: 0 })).toBe(true);
    });

    it('Bidirectional A* ends at the NEAREST goal (1, 0)', () => {
      const { result } = run(bidirectionalAStarFactory, MULTI_GOAL_NEAREST);
      expect(result.status).toBe('success');
      expect(result.path).not.toBeNull();
      expect(pathEndsAt(result.path!, { x: 1, y: 0 })).toBe(true);
    });
  });

  describe('MULTI_GOAL_WALLED_GOAL (nearest goal reachable, one goal unreachable)', () => {
    for (const { name, factory } of IMPLEMENTED_FACTORIES) {
      it(`${name} succeeds even though one goal is walled off`, () => {
        const { result } = run(factory, MULTI_GOAL_WALLED_GOAL);
        expect(result.status).toBe('success');
        expect(result.path).not.toBeNull();
        const path = result.path!;
        expect(pathEndsAtAnyGoal(path, MULTI_GOAL_WALLED_GOAL.start, MULTI_GOAL_WALLED_GOAL.goals!)).toBe(true);
      });
    }

    it('Hill Climbing targets the reachable nearest goal (4, 0), not the boxed one', () => {
      const { result } = run(hillClimbingFactory, MULTI_GOAL_WALLED_GOAL);
      expect(result.status).toBe('success');
      expect(result.path).not.toBeNull();
      expect(pathEndsAt(result.path!, { x: 4, y: 0 })).toBe(true);
    });
  });

  describe('AlgorithmResult cost consistency', () => {
    for (const { name, factory } of IMPLEMENTED_FACTORIES) {
      it(`${name} populates a non-negative cost in AlgorithmResult`, () => {
        const { result } = run(factory, MULTI_GOAL_OPEN);
        expect(result.status).toBe('success');
        expect(result.cost).toBeDefined();
        expect(typeof result.cost).toBe('number');
        expect(result.cost).toBeGreaterThanOrEqual(0);
      });
    }
  });

  describe('start positioned directly on a secondary goal', () => {
    const startOnSecondaryGoal = {
      width: 5,
      height: 5,
      walls: new Set<string>(),
      start: { x: 0, y: 0 },
      goal: { x: 4, y: 4 },
      goals: [
        { x: 4, y: 4 },
        { x: 0, y: 0 }, // start is this secondary goal
      ],
    };

    for (const { name, factory } of IMPLEMENTED_FACTORIES) {
      it(`${name} immediately succeeds when start is a secondary goal`, () => {
        const { result } = run(factory, startOnSecondaryGoal);
        expect(result.status).toBe('success');
        expect(result.path).not.toBeNull();
        expect(result.path).toHaveLength(1);
        expect(result.path![0]).toEqual({ x: 0, y: 0 });
      });
    }
  });

  describe('generator events', () => {
    it('A* yields consider events whose heuristicTarget is one of the goals', () => {
      const { events } = run(aStarSearch, MULTI_GOAL_OPEN);
      const considers = events.filter(
        (e): e is StepEvent & { kind: 'consider' } => e.kind === 'consider' && e.heuristicTarget !== undefined,
      );
      expect(considers.length).toBeGreaterThan(0);
      for (const c of considers) {
        const target = c.heuristicTarget!;
        const onAnyGoal = MULTI_GOAL_OPEN.goals!.some((g) => g.x === target.x && g.y === target.y);
        expect(onAnyGoal).toBe(true);
      }
    });

    it('Simulated Annealing yields consider events targeting nearest goal of candidate', () => {
      const { events } = run(simulatedAnnealingSearch, MULTI_GOAL_OPEN);
      const considers = events.filter(
        (e): e is StepEvent & { kind: 'consider' } => e.kind === 'consider' && e.heuristicTarget !== undefined,
      );
      expect(considers.length).toBeGreaterThan(0);
      for (const c of considers) {
        const target = c.heuristicTarget!;
        const onAnyGoal = MULTI_GOAL_OPEN.goals!.some((g) => g.x === target.x && g.y === target.y);
        expect(onAnyGoal).toBe(true);
      }
    });
  });
});