import { describe, expect, it, beforeEach } from 'vitest';
import { useCodeTraceStore } from '../codeTraceStore';

describe('Code Trace Store', () => {
  beforeEach(() => {
    useCodeTraceStore.setState({ selectedAgentId: null });
  });

  it('starts with no selected agent', () => {
    expect(useCodeTraceStore.getState().selectedAgentId).toBeNull();
  });

  it('opens trace for a specific agent', () => {
    useCodeTraceStore.getState().openTrace('agent-1');
    expect(useCodeTraceStore.getState().selectedAgentId).toBe('agent-1');
  });

  it('closes the trace panel', () => {
    useCodeTraceStore.getState().openTrace('agent-1');
    useCodeTraceStore.getState().closeTrace();
    expect(useCodeTraceStore.getState().selectedAgentId).toBeNull();
  });

  it('toggles trace panel: opens if closed', () => {
    useCodeTraceStore.getState().toggleTrace('agent-2');
    expect(useCodeTraceStore.getState().selectedAgentId).toBe('agent-2');
  });

  it('toggles trace panel: closes if same agent', () => {
    useCodeTraceStore.getState().openTrace('agent-2');
    useCodeTraceStore.getState().toggleTrace('agent-2');
    expect(useCodeTraceStore.getState().selectedAgentId).toBeNull();
  });

  it('toggles trace panel: switches to different agent', () => {
    useCodeTraceStore.getState().openTrace('agent-1');
    useCodeTraceStore.getState().toggleTrace('agent-3');
    expect(useCodeTraceStore.getState().selectedAgentId).toBe('agent-3');
  });
});
