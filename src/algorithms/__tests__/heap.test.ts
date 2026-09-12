/**
 * Unit tests for generic MinHeap priority queue.
 *
 * @module algorithms/__tests__/heap.test
 */

import { describe, it, expect } from 'vitest';
import { MinHeap } from '../heap';

describe('MinHeap', () => {
  it('should start empty', () => {
    const heap = new MinHeap<number>((x) => x);
    expect(heap.size).toBe(0);
    expect(heap.peek()).toBeUndefined();
    expect(heap.pop()).toBeUndefined();
  });

  it('should pop elements in ascending order of score', () => {
    const heap = new MinHeap<number>((x) => x);
    const nums = [5, 3, 8, 1, 9, 2, 7, 4, 6];
    for (const n of nums) heap.push(n);

    expect(heap.size).toBe(nums.length);
    expect(heap.peek()).toBe(1);

    const popped: number[] = [];
    while (heap.size > 0) {
      popped.push(heap.pop()!);
    }

    expect(popped).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('should support custom objects with score extractor', () => {
    interface Task {
      name: string;
      dist: number;
    }
    const heap = new MinHeap<Task>((t) => t.dist);
    heap.push({ name: 'C', dist: 30 });
    heap.push({ name: 'A', dist: 10 });
    heap.push({ name: 'B', dist: 20 });

    expect(heap.pop()?.name).toBe('A');
    expect(heap.pop()?.name).toBe('B');
    expect(heap.pop()?.name).toBe('C');
  });

  it('should handle duplicate priorities correctly', () => {
    const heap = new MinHeap<{ id: number; cost: number }>((x) => x.cost);
    heap.push({ id: 1, cost: 5 });
    heap.push({ id: 2, cost: 5 });
    heap.push({ id: 3, cost: 2 });
    heap.push({ id: 4, cost: 8 });

    expect(heap.pop()?.cost).toBe(2);
    expect(heap.pop()?.cost).toBe(5);
    expect(heap.pop()?.cost).toBe(5);
    expect(heap.pop()?.cost).toBe(8);
  });

  it('should expose entries array', () => {
    const heap = new MinHeap<number>((x) => x);
    heap.push(10);
    heap.push(5);
    expect(heap.entries).toHaveLength(2);
    expect(heap.entries).toContain(10);
    expect(heap.entries).toContain(5);
  });
});
