/**
 * Code Trace Store — Zustand store for the algorithm code inspector panel.
 *
 * Manages which agent's code trace is currently displayed, allowing
 * the user to open, close, and switch between algorithm code views.
 *
 * @module state/codeTraceStore
 */

import { create } from 'zustand';

export interface CodeTraceState {
  /** ID of the agent whose code trace is currently displayed, or null if closed. */
  selectedAgentId: string | null;

  /** Open the code trace panel for a specific agent. */
  openTrace: (agentId: string) => void;
  /** Close the code trace panel. */
  closeTrace: () => void;
  /** Toggle the code trace panel for a specific agent. */
  toggleTrace: (agentId: string) => void;
}

export const useCodeTraceStore = create<CodeTraceState>((set, get) => ({
  selectedAgentId: null,

  openTrace: (agentId: string) => {
    set({ selectedAgentId: agentId });
  },

  closeTrace: () => {
    set({ selectedAgentId: null });
  },

  toggleTrace: (agentId: string) => {
    const current = get().selectedAgentId;
    set({ selectedAgentId: current === agentId ? null : agentId });
  },
}));
