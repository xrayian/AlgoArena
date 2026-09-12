/**
 * Unit tests for Depth-First Search (DFS).
 *
 * Tests cover all 4 shared fixture grids:
 *   1. Open field — finds a valid path (explicitly not guaranteed optimal).
 *   2. Wall detour — navigates around obstacle.
 *   3. U-trap — solves despite the concave wall by exploring and backtracking.
 *   4. Fully blocked — reports 'failed' when goal is unreachable.
 *
 * Additional tests verify:
 *   - Generator protocol (step event ordering, no heuristicTarget on consider).
 *   - Edge cases (start === goal, 1x1 grid).
 *   - Path contiguity and wall avoidance.
 *
 * @module algorithms/__tests__/dfs.test
 */

import { describe, it, expect } from 'vitest';
import { depthFirstSearch } from '../dfs';
import type { StepEvent, AlgorithmResult } from '../types';
import {
  OPEN_FIELD,
  OPEN_FIELD_OPTIMAL_LENGTH,
  WALL_DETOUR,
  U_TRAP,
  FULLY_BLOCKED,
  pathEndpoints,
  pathIsContiguous,
  pathAvoidsWalls,
} from './fixtures';

// ── Helper ──────────────────────────────────────────────────────────────────

/** Run the generator to completion and collect events + final result. */
function run(grid: Parameters<typeof depthFirstSearch>[0]) {
  const gen = depthFirstSearch(grid);
  const events: StepEvent[] = [];
  let step = gen.next();
  while (!step.done) {
    events.push(step.value as StepEvent);
    step = gen.next();
  }
  return { events, result: step.value as AlgorithmResult };
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('Depth-First Search (DFS)', () => {
  // ── Open field ──────────────────────────────────────────────────────────

  describe('open field (no walls)', () => {
    it('should find a path (status: success)', () => {
      const { result } = run(OPEN_FIELD);
      expect(result.status).toBe('success');
      expect(result.path).not.toBeNull();
    });

    it('should produce a valid contiguous path from start to goal', () => {
      const { result } = run(OPEN_FIELD);
      expect(result.path).not.toBeNull();
      const path = result.path!;
      expect(pathEndpoints(path, OPEN_FIELD.start, OPEN_FIELD.goal)).toBe(true);
      expect(pathIsContiguous(path)).toBe(true);
    });

    it('path length should be at least the optimal length (DFS may be suboptimal)', () => {
      const { result } = run(OPEN_FIELD);
      expect(result.path!.length).toBeGreaterThanOrEqual(OPEN_FIELD_OPTIMAL_LENGTH);
    });

    it('should report positive nodesExplored', () => {
      const { result } = run(OPEN_FIELD);
      expect(result.nodesExplored).toBeGreaterThan(0);
    });

    it('should report timeMs', () => {
      const { result } = run(OPEN_FIELD);
      expect(result.timeMs).toBeGreaterThanOrEqual(0);
    });

    it('should report cost consistent with path length for unweighted grid', () => {
      const { result } = run(OPEN_FIELD);
      expect(result.cost).toBe(result.path!.length - 1);
    });
  });

  // ── Wall detour ─────────────────────────────────────────────────────────

  describe('wall detour', () => {
    it('should find a path around the wall', () => {
      const { result } = run(WALL_DETOUR);
      expect(result.status).toBe('success');
      expect(result.path).not.toBeNull();
    });

    it('should produce a valid path that avoids walls', () => {
      const { result } = run(WALL_DETOUR);
      const path = result.path!;
      expect(pathEndpoints(path, WALL_DETOUR.start, WALL_DETOUR.goal)).toBe(true);
      expect(pathIsContiguous(path)).toBe(true);
      expect(pathAvoidsWalls(path, WALL_DETOUR.walls)).toBe(true);
    });
  });

  // ── U-trap ──────────────────────────────────────────────────────────────

  describe('U-trap', () => {
    it('should solve the U-trap (status: success)', () => {
      const { result } = run(U_TRAP);
      expect(result.status).toBe('success');
      expect(result.path).not.toBeNull();
    });

    it('should produce a valid path through the U-trap', () => {
      const { result } = run(U_TRAP);
      const path = result.path!;
      expect(pathEndpoints(path, U_TRAP.start, U_TRAP.goal)).toBe(true);
      expect(pathIsContiguous(path)).toBe(true);
      expect(pathAvoidsWalls(path, U_TRAP.walls)).toBe(true);
    });
  });

  // ── Fully blocked ──────────────────────────────────────────────────────

  describe('fully blocked goal', () => {
    it('should report failed when goal is unreachable', () => {
      const { result } = run(FULLY_BLOCKED);
      expect(result.status).toBe('failed');
      expect(result.path).toBeNull();
    });

    it('should still report nodesExplored > 0', () => {
      const { result } = run(FULLY_BLOCKED);
      expect(result.nodesExplored).toBeGreaterThan(0);
    });
  });

  // ── Generator protocol ─────────────────────────────────────────────────

  describe('generator protocol', () => {
    it('should yield visit events for explored nodes', () => {
      const { events } = run(OPEN_FIELD);
      const visits = events.filter((e): e is StepEvent & { kind: 'visit' } => e.kind === 'visit');
      expect(visits.length).toBeGreaterThan(0);
    });

    it('should yield consider events without heuristicTarget (no heuristic)', () => {
      const { events } = run(OPEN_FIELD);
      const considers = events.filter(
        (e): e is StepEvent & { kind: 'consider' } => e.kind === 'consider',
      );
      expect(considers.length).toBeGreaterThan(0);
      for (const c of considers) {
        expect(c.heuristicTarget).toBeUndefined();
      }
    });

    it('should yield frontier events', () => {
      const { events } = run(OPEN_FIELD);
      const frontiers = events.filter(
        (e): e is StepEvent & { kind: 'frontier' } => e.kind === 'frontier',
      );
      expect(frontiers.length).toBeGreaterThan(0);
    });

    it('should yield a done event as the last yielded event', () => {
      const { events } = run(OPEN_FIELD);
      const lastEvent = events[events.length - 1];
      expect(lastEvent).toBeDefined();
      expect(lastEvent!.kind).toBe('done');
    });

    it('should yield path events during search', () => {
      const { events } = run(OPEN_FIELD);
      const paths = events.filter(
        (e): e is StepEvent & { kind: 'path' } => e.kind === 'path',
      );
      expect(paths.length).toBeGreaterThan(0);
    });
  });

  // ── Edge cases ─────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('should handle start === goal', () => {
      const gen = depthFirstSearch({
        width: 3,
        height: 3,
        walls: new Set<string>(),
        start: { x: 1, y: 1 },
        goal: { x: 1, y: 1 },
      });
      const events: StepEvent[] = [];
      let step = gen.next();
      while (!step.done) {
        events.push(step.value as StepEvent);
        step = gen.next();
      }
      const result = step.value as AlgorithmResult;
      expect(result.status).toBe('success');
      expect(result.path).toHaveLength(1);
      expect(result.path![0]).toEqual({ x: 1, y: 1 });
      expect(result.cost).toBe(0);
    });

    it('should handle a 1×1 grid with start === goal', () => {
      const gen = depthFirstSearch({
        width: 1,
        height: 1,
        walls: new Set<string>(),
        start: { x: 0, y: 0 },
        goal: { x: 0, y: 0 },
      });
      const events: StepEvent[] = [];
      let step = gen.next();
      while (!step.done) {
        events.push(step.value as StepEvent);
        step = gen.next();
      }
      const result = step.value as AlgorithmResult;
      expect(result.status).toBe('success');
      expect(result.cost).toBe(0);
    });
  });
});
