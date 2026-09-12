/**
 * Generic binary min-heap priority queue.
 *
 * Dependency-free, reusable min-heap ordered by a customizable score function.
 * Used across priority-based search algorithms (A*, Dijkstra, Greedy Best-First,
 * Bidirectional A*).
 *
 * @module algorithms/heap
 */

export class MinHeap<T> {
  private data: T[] = [];
  private score: (item: T) => number;

  /**
   * @param score - Function extracting the numeric priority score for an item.
   *                Lower scores are popped first.
   */
  constructor(score: (item: T) => number) {
    this.score = score;
  }

  get size(): number {
    return this.data.length;
  }

  /** Read-only view of the heap entries. */
  get entries(): readonly T[] {
    return this.data;
  }

  /** Peek at the top entry with the minimum score without popping. */
  peek(): T | undefined {
    return this.data[0];
  }

  /** Peek at the minimum score in the heap without popping. Returns Infinity if empty. */
  peekScore(): number {
    return this.data[0] !== undefined ? this.score(this.data[0]) : Infinity;
  }

  push(entry: T): void {
    this.data.push(entry);
    this.bubbleUp(this.data.length - 1);
  }

  pop(): T | undefined {
    const top = this.data[0];
    const last = this.data.pop();
    if (this.data.length > 0 && last !== undefined) {
      this.data[0] = last;
      this.sinkDown(0);
    }
    return top;
  }

  private bubbleUp(i: number): void {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.score(this.data[i]!) < this.score(this.data[parent]!)) {
        [this.data[i], this.data[parent]] = [this.data[parent]!, this.data[i]!];
        i = parent;
      } else {
        break;
      }
    }
  }

  private sinkDown(i: number): void {
    const n = this.data.length;
    while (true) {
      let smallest = i;
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      if (left < n && this.score(this.data[left]!) < this.score(this.data[smallest]!)) {
        smallest = left;
      }
      if (right < n && this.score(this.data[right]!) < this.score(this.data[smallest]!)) {
        smallest = right;
      }
      if (smallest !== i) {
        [this.data[i], this.data[smallest]] = [this.data[smallest]!, this.data[i]!];
        i = smallest;
      } else {
        break;
      }
    }
  }
}
