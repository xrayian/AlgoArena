/**
 * Agent Store — Zustand store for agent management.
 *
 * Manages the list of agents, their algorithm assignments, physical pawn positions,
 * active scout scanner positions, arrival sequences (for cluster placement),
 * statuses, and per-agent visualization state.
 *
 * @module state/agentStore
 */

import { create } from 'zustand';
import type { AlgorithmResult, Point, StepEvent } from '../algorithms/types';
import { getCodeTrace } from '../algorithms/codeTraces';

// ── Types ───────────────────────────────────────────────────────────────────

export interface Agent {
  id: string;
  /** Key from ALGORITHMS registry (e.g. 'astar', 'bfs'). */
  algorithmKey: string;
  /** Hex color from ALGORITHMS registry. */
  color: string;
  /** Physical pawn position on the grid (stays on valid walkable paths). */
  position: Point;
  /** Active scout scanner probe position evaluating candidate nodes (forward search). */
  scanPosition?: Point;
  /** Active scout scanner probe position evaluating candidate nodes (backward search in bidirectional algorithms). */
  scanPositionBackward?: Point;
  /** Monotonic counter marking when this agent entered its current position. */
  enteredAt: number;
  /** Agent lifecycle status. */
  status: 'idle' | 'running' | 'done';
  /** Final result after the algorithm finishes. */
  result?: AlgorithmResult;

  // ── Per-agent visualization state ────────────────────────────────────
  /** Set of "x,y" keys for cells the algorithm has officially visited. */
  visitedNodes: Set<string>;
  /** Current frontier/open-set nodes. */
  frontierNodes: Point[];
  /** Current best-known path. */
  currentPath: Point[];
  /** Where the forward heuristic is pointing (A*, Greedy, bidirectional start frontier, etc.). */
  heuristicTarget?: Point;
  /** Where the backward heuristic is pointing (Bidirectional A* goal frontier). */
  heuristicTargetBackward?: Point;
  /** Whether this agent's visualization overlay is active. */
  showOverlay: boolean;
  /** Live temperature for Simulated Annealing (undefined for other algorithms). */
  temperature?: number;

  // ── Code trace state ──────────────────────────────────────────────────
  /** Currently highlighted line number in the code trace inspector (1-indexed). */
  activeLine: number | null;
  /** Short human-readable explanation of what the algorithm is doing at this step. */
  lineExplanation?: string;
}

export interface AgentState {
  agents: Agent[];
  /** Whether to render visited and frontier explored plates on the grid (default true). */
  showExploredNodes: boolean;
  /** Toggle visibility of visited and frontier explored plates. */
  toggleExploredNodes: () => void;
  /** Explicitly set visibility of visited and frontier explored plates. */
  setShowExploredNodes: (show: boolean) => void;

  // Actions
  addAgent: (algorithmKey: string, color: string, start: Point) => void;
  removeAgent: (id: string) => void;
  clearAgents: () => void;
  toggleOverlay: (id: string) => void;
  /** Toggle all agents' visual overlays on/off together. */
  toggleAllOverlays: () => void;
  /** Explicitly set visual overlay visibility for all agents. */
  setAllOverlays: (show: boolean) => void;
  /** Change an agent's color (pawn, trail, overlays, standings). */
  setColor: (id: string, color: string) => void;

  /** Apply a step event from the race scheduler to an agent's visualization state. */
  applyStep: (agentId: string, event: StepEvent) => void;
  /** Advance the physical pawn one step along a validated path. */
  advancePawn: (agentId: string, point: Point) => void;
  /** Mark an agent as running (called by race start). */
  setRunning: (agentId: string) => void;
  /** Reset all agents to idle with cleared visualization state. */
  resetAll: (start: Point) => void;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

let nextId = 1;
let entryCounter = 1;

function createAgent(algorithmKey: string, color: string, start: Point): Agent {
  return {
    id: `agent-${nextId++}`,
    algorithmKey,
    color,
    position: { ...start },
    scanPosition: undefined,
    scanPositionBackward: undefined,
    enteredAt: entryCounter++,
    status: 'idle',
    visitedNodes: new Set(),
    frontierNodes: [],
    currentPath: [],
    showOverlay: true,
    activeLine: null,
  };
}

// ── Store ───────────────────────────────────────────────────────────────────

export const useAgentStore = create<AgentState>((set) => ({
  agents: [],
  showExploredNodes: true,
  toggleExploredNodes: () =>
    set((s) => ({ showExploredNodes: !s.showExploredNodes })),
  setShowExploredNodes: (show) => set({ showExploredNodes: show }),

  addAgent: (algorithmKey, color, start) =>
    set((s) => ({
      agents: [...s.agents, createAgent(algorithmKey, color, start)],
    })),

  removeAgent: (id) =>
    set((s) => ({
      agents: s.agents.filter((a) => a.id !== id),
    })),

  clearAgents: () => set({ agents: [] }),

  toggleOverlay: (id) =>
    set((s) => ({
      agents: s.agents.map((a) =>
        a.id === id ? { ...a, showOverlay: !a.showOverlay } : a,
      ),
    })),

  toggleAllOverlays: () =>
    set((s) => {
      const anyVisible = s.agents.some((a) => a.showOverlay);
      return {
        agents: s.agents.map((a) => ({ ...a, showOverlay: !anyVisible })),
      };
    }),

  setAllOverlays: (show) =>
    set((s) => ({
      agents: s.agents.map((a) => ({ ...a, showOverlay: show })),
    })),

  setColor: (agentId, color) =>
    set((s) => ({
      agents: s.agents.map((a) =>
        a.id === agentId ? { ...a, color } : a,
      ),
    })),

  setRunning: (agentId) =>
    set((s) => ({
      agents: s.agents.map((a) =>
        a.id === agentId ? { ...a, status: 'running' as const } : a,
      ),
    })),

  advancePawn: (agentId, point) =>
    set((s) => ({
      agents: s.agents.map((a) => {
        if (a.id !== agentId) return a;
        const moved = a.position.x !== point.x || a.position.y !== point.y;

        // Compute code trace runner phase line highlighting
        const trace = getCodeTrace(a.algorithmKey);
        const traceResult = trace?.mapRunner(
          { position: a.position, currentPath: a.currentPath },
          point,
        );
        const traceFields = traceResult
          ? { activeLine: traceResult.lineNumber, lineExplanation: traceResult.explanation }
          : {};

        return {
          ...a,
          position: { ...point },
          enteredAt: moved ? entryCounter++ : a.enteredAt,
          ...traceFields,
        };
      }),
    })),

  applyStep: (agentId, event) =>
    set((s) => ({
      agents: s.agents.map((a) => {
        if (a.id !== agentId) return a;

        // Compute code trace line highlighting for this step
        const trace = getCodeTrace(a.algorithmKey);
        const traceResult = trace?.mapStep(event, {
          position: a.position,
          currentPath: a.currentPath,
        });
        const traceFields = traceResult
          ? { activeLine: traceResult.lineNumber, lineExplanation: traceResult.explanation }
          : {};

        switch (event.kind) {
          case 'consider': {
            if (event.direction === 'backward') {
              return {
                ...a,
                scanPositionBackward: { ...event.node },
                heuristicTargetBackward: event.heuristicTarget
                  ? { ...event.heuristicTarget }
                  : undefined,
                ...traceFields,
              };
            }
            return {
              ...a,
              scanPosition: { ...event.node },
              heuristicTarget: event.heuristicTarget
                ? { ...event.heuristicTarget }
                : undefined,
              temperature: event.temperature,
              ...traceFields,
            };
          }
          case 'visit': {
            const visited = new Set(a.visitedNodes);
            visited.add(`${event.node.x},${event.node.y}`);
            return { ...a, visitedNodes: visited, ...traceFields };
          }
          case 'frontier': {
            return { ...a, frontierNodes: [...event.nodes], ...traceFields };
          }
          case 'path': {
            return { ...a, currentPath: [...event.path], ...traceFields };
          }
          case 'done': {
            return {
              ...a,
              status: 'done' as const,
              result: event.result,
              currentPath: event.result.path ? [...event.result.path] : [],
              ...traceFields,
            };
          }
        }
      }),
    })),

  resetAll: (start) =>
    set((s) => ({
      agents: s.agents.map((a) => ({
        ...a,
        status: 'idle' as const,
        position: { ...start },
        enteredAt: entryCounter++,
        scanPosition: undefined,
        scanPositionBackward: undefined,
        result: undefined,
        visitedNodes: new Set<string>(),
        frontierNodes: [],
        currentPath: [],
        heuristicTarget: undefined,
        heuristicTargetBackward: undefined,
        temperature: undefined,
      })),
    })),
}));
