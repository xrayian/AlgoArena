import { describe, expect, it } from 'vitest';
import { CODE_TRACES, getCodeTrace } from '../codeTraces';
import { ALGORITHMS } from '../index';
import type { StepEvent } from '../types';

describe('Algorithm Code Traces Engine', () => {
  const registeredKeys = Object.keys(ALGORITHMS);

  it('has a code trace definition for every registered algorithm', () => {
    for (const key of registeredKeys) {
      const trace = getCodeTrace(key);
      expect(trace, `Missing code trace for algorithm ${key}`).toBeDefined();
      expect(trace?.code.length).toBeGreaterThan(5);
      expect(trace?.name).toBeTruthy();
    }
  });

  it('provides valid 1-indexed line numbers within code bounds for all step events', () => {
    const dummyNode = { x: 2, y: 3 };
    const testEvents: StepEvent[] = [
      { kind: 'consider', node: dummyNode },
      { kind: 'consider', node: dummyNode, direction: 'forward' },
      { kind: 'consider', node: dummyNode, direction: 'backward' },
      { kind: 'consider', node: dummyNode, temperature: 42.5 },
      { kind: 'visit', node: dummyNode },
      { kind: 'frontier', nodes: [dummyNode, { x: 2, y: 4 }] },
      { kind: 'path', path: [{ x: 0, y: 0 }, dummyNode] },
      {
        kind: 'done',
        result: {
          status: 'success',
          path: [{ x: 0, y: 0 }, dummyNode],
          nodesExplored: 10,
          timeMs: 5,
          cost: 2,
        },
      },
      {
        kind: 'done',
        result: {
          status: 'failed',
          path: null,
          nodesExplored: 15,
          timeMs: 7,
        },
      },
      {
        kind: 'done',
        result: {
          status: 'trapped',
          path: [{ x: 0, y: 0 }],
          nodesExplored: 4,
          timeMs: 2,
        },
      },
    ];

    for (const [key, trace] of Object.entries(CODE_TRACES)) {
      const lineCount = trace.code.length;

      for (const event of testEvents) {
        const result = trace.mapStep(event);
        expect(
          result.lineNumber,
          `${key} produced out-of-bounds line ${result.lineNumber} for event ${event.kind}`,
        ).toBeGreaterThanOrEqual(1);
        expect(
          result.lineNumber,
          `${key} produced line ${result.lineNumber} exceeding code line count ${lineCount}`,
        ).toBeLessThanOrEqual(lineCount);
        expect(result.explanation.length).toBeGreaterThan(0);
      }

      // Test runner step mapping
      const runnerResult = trace.mapRunner({}, { x: 3, y: 3 });
      expect(runnerResult.lineNumber).toBeGreaterThanOrEqual(1);
      expect(runnerResult.lineNumber).toBeLessThanOrEqual(lineCount);
      expect(runnerResult.explanation.length).toBeGreaterThan(0);
    }
  });

  it('maps backward consider events correctly for bidirectional algorithms', () => {
    const bidirBfs = getCodeTrace('bidir-bfs')!;
    const fwdResult = bidirBfs.mapStep({ kind: 'consider', node: { x: 1, y: 1 }, direction: 'forward' });
    const bwdResult = bidirBfs.mapStep({ kind: 'consider', node: { x: 1, y: 1 }, direction: 'backward' });

    expect(fwdResult.lineNumber).not.toBe(bwdResult.lineNumber);
    expect(bwdResult.explanation).toContain('Backward');
  });
});
