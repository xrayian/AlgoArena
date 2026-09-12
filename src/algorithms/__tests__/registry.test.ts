/**
 * Unit tests for the algorithm registry.
 *
 * Verifies that the registry is correctly wired and that helper functions
 * accurately report implementation status.
 *
 * @module algorithms/__tests__/registry.test
 */

import { describe, it, expect } from 'vitest';
import { ALGORITHMS, getImplementedAlgorithms, getTodoAlgorithms } from '../index';

describe('Algorithm Registry', () => {
  it('should contain all 9 algorithms', () => {
    const keys = Object.keys(ALGORITHMS);
    expect(keys).toHaveLength(9);
    expect(keys).toContain('astar');
    expect(keys).toContain('bfs');
    expect(keys).toContain('dijkstra');
    expect(keys).toContain('dfs');
    expect(keys).toContain('greedy');
    expect(keys).toContain('hillclimb');
    expect(keys).toContain('annealing');
    expect(keys).toContain('bidir-bfs');
    expect(keys).toContain('bidir-astar');
  });

  it('every entry should have label, color, factory, and implemented fields', () => {
    for (const [key, entry] of Object.entries(ALGORITHMS)) {
      expect(entry.label, `${key} missing label`).toBeTruthy();
      expect(entry.color, `${key} missing color`).toMatch(/^#[0-9a-f]{6}$/i);
      expect(entry.factory, `${key} missing factory`).toBeTypeOf('function');
      expect(entry.implemented, `${key} missing implemented flag`).toBeTypeOf('boolean');
    }
  });

  it('getImplementedAlgorithms should return only implemented ones', () => {
    const impl = getImplementedAlgorithms();
    const keys = Object.keys(impl);
    expect(keys).toHaveLength(9);
    expect(keys).toContain('astar');
    expect(keys).toContain('bfs');
    expect(keys).toContain('greedy');
    expect(keys).toContain('bidir-bfs');
    expect(keys).toContain('bidir-astar');
    expect(keys).toContain('hillclimb');
    expect(keys).toContain('annealing');
    expect(keys).toContain('dijkstra');
    expect(keys).toContain('dfs');
  });

  it('getTodoAlgorithms should return unimplemented algorithm keys', () => {
    const todos = getTodoAlgorithms();
    expect(todos).toHaveLength(0);
    expect(todos).not.toContain('dfs');
    expect(todos).not.toContain('dijkstra');
    expect(todos).not.toContain('greedy');
    expect(todos).not.toContain('hillclimb');
    expect(todos).not.toContain('annealing');
    expect(todos).not.toContain('astar');
    expect(todos).not.toContain('bfs');
    expect(todos).not.toContain('bidir-bfs');
    expect(todos).not.toContain('bidir-astar');
  });

  it('all colors should be unique', () => {
    const colors = Object.values(ALGORITHMS).map((e) => e.color);
    const unique = new Set(colors);
    expect(unique.size).toBe(colors.length);
  });
});
