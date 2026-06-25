import { describe, it, expect } from 'vitest';
import { applyStreamEvent } from '../../../store/reducers/stream-reducer';
import { EVENT_TYPES } from '@/lib/constants';
import type { AgentHubState } from '@/store/interfaces';

function createMockState(): AgentHubState {
  return {
    conversations: {},
    messages: {},
    agents: {},
    agentDetails: {},
    artifacts: {},
    ui: {
      activeConversationId: null,
      activeAgentId: null,
      isDetailPanelOpen: false,
      detailPanelTab: 'agent',
      selectedArtifactId: null,
      sidebarTab: 'chat',
      isCreatingConversation: false,
      isStreaming: false,
      streamingMessageId: null,
      globalSSEStatus: 'disconnected',
      conversationSearchQuery: '',
      messageSearchQuery: '',
      isMessageSearchOpen: false,
      agentSearchQuery: '',
      agentCategoryFilter: null,
    },
    settings: {
      apiKeys: [],
      theme: 'system',
    },
  };
}

function makeEvent(eventType: string, payload: unknown) {
  return {
    eventId: 'evt-1',
    eventType,
    timestamp: new Date().toISOString(),
    traceId: 'trace-1',
    source: { service: 'test', instanceId: 'test-1' },
    payload,
  };
}

describe('stream-reducer', () => {
  describe('AGENT_RUN_START', () => {
    it('should set streaming state when agent run starts', () => {
      const state = createMockState();
      applyStreamEvent(state, makeEvent(EVENT_TYPES.AGENT_RUN_START, {
        agentId: 'a1',
        agentName: 'Test',
        conversationId: 'c1',
        messageId: 'm1',
      }));
      expect(state.ui.isStreaming).toBe(true);
      expect(state.ui.streamingMessageId).toBe('m1');
    });
  });

  describe('AGENT_RUN_COMPLETE', () => {
    it('should clear streaming state and mark message complete', () => {
      const state = createMockState();
      state.ui.isStreaming = true;
      state.ui.streamingMessageId = 'm1';
      state.messages['m1'] = {
        id: 'm1',
        conversationId: 'c1',
        role: 'assistant',
        parts: [],
        status: 'streaming',
        createdAt: new Date().toISOString(),
      };

      applyStreamEvent(state, makeEvent(EVENT_TYPES.AGENT_RUN_COMPLETE, {
        agentId: 'a1',
        conversationId: 'c1',
        messageId: 'm1',
        usage: { promptTokens: 10, completionTokens: 20 },
      }));

      expect(state.ui.isStreaming).toBe(false);
      expect(state.ui.streamingMessageId).toBeNull();
      expect(state.messages['m1']!.status).toBe('complete');
    });
  });

  describe('AGENT_RUN_FAILED', () => {
    it('should mark message as failed', () => {
      const state = createMockState();
      state.messages['m1'] = {
        id: 'm1',
        conversationId: 'c1',
        role: 'assistant',
        parts: [],
        status: 'streaming',
        createdAt: new Date().toISOString(),
      };

      applyStreamEvent(state, makeEvent(EVENT_TYPES.AGENT_RUN_FAILED, {
        agentId: 'a1',
        conversationId: 'c1',
        messageId: 'm1',
        error: 'Something went wrong',
      }));

      expect(state.messages['m1']!.status).toBe('failed');
      expect(state.ui.isStreaming).toBe(false);
    });
  });

  describe('MESSAGE_PART_TEXT', () => {
    it('should add a new text part when no existing text part', () => {
      const state = createMockState();
      state.messages['m1'] = {
        id: 'm1',
        conversationId: 'c1',
        role: 'assistant',
        parts: [],
        status: 'streaming',
        createdAt: new Date().toISOString(),
      };

      applyStreamEvent(state, makeEvent(EVENT_TYPES.MESSAGE_PART_TEXT, {
        messageId: 'm1',
        content: 'Hello ',
      }));

      expect(state.messages['m1']!.parts).toHaveLength(1);
      expect(state.messages['m1']!.parts[0]).toEqual({
        type: 'text',
        content: 'Hello ',
      });
    });

    it('should append to existing text part (streaming coalescing)', () => {
      const state = createMockState();
      state.messages['m1'] = {
        id: 'm1',
        conversationId: 'c1',
        role: 'assistant',
        parts: [{ type: 'text', content: 'Hello ' }],
        status: 'streaming',
        createdAt: new Date().toISOString(),
      };

      applyStreamEvent(state, makeEvent(EVENT_TYPES.MESSAGE_PART_TEXT, {
        messageId: 'm1',
        content: 'World!',
      }));

      expect(state.messages['m1']!.parts).toHaveLength(1);
      expect(state.messages['m1']!.parts[0]!.content).toBe('Hello World!');
    });
  });

  describe('MESSAGE_PART_THINKING', () => {
    it('should append thinking content', () => {
      const state = createMockState();
      state.messages['m1'] = {
        id: 'm1',
        conversationId: 'c1',
        role: 'assistant',
        parts: [],
        status: 'streaming',
        createdAt: new Date().toISOString(),
      };

      applyStreamEvent(state, makeEvent(EVENT_TYPES.MESSAGE_PART_THINKING, {
        messageId: 'm1',
        content: 'Let me think...',
      }));

      expect(state.messages['m1']!.parts[0]).toEqual({
        type: 'thinking',
        content: 'Let me think...',
      });
    });
  });

  describe('MESSAGE_PART_TOOL_USE', () => {
    it('should add a tool_use part', () => {
      const state = createMockState();
      state.messages['m1'] = {
        id: 'm1',
        conversationId: 'c1',
        role: 'assistant',
        parts: [],
        status: 'streaming',
        createdAt: new Date().toISOString(),
      };

      applyStreamEvent(state, makeEvent(EVENT_TYPES.MESSAGE_PART_TOOL_USE, {
        messageId: 'm1',
        toolCallId: 'tc1',
        toolName: 'bash',
      }));

      expect(state.messages['m1']!.parts[0]).toMatchObject({
        type: 'tool_use',
        toolCallId: 'tc1',
        toolName: 'bash',
      });
    });

    it('should NOT duplicate when TOOL_CALL already created the part', () => {
      const state = createMockState();
      state.messages['m1'] = {
        id: 'm1',
        conversationId: 'c1',
        role: 'assistant',
        parts: [{ type: 'tool_use', toolCallId: 'tc1', toolName: 'bash', toolInput: { cmd: 'ls' } }],
        status: 'streaming',
        createdAt: new Date().toISOString(),
      };

      // MESSAGE_PART_TOOL_USE after TOOL_CALL → should skip duplicate
      applyStreamEvent(state, makeEvent(EVENT_TYPES.MESSAGE_PART_TOOL_USE, {
        messageId: 'm1',
        toolCallId: 'tc1',
        toolName: 'bash',
      }));

      expect(state.messages['m1']!.parts).toHaveLength(1);
      // Should preserve the toolInput from TOOL_CALL
      expect(state.messages['m1']!.parts[0]!.toolInput).toEqual({ cmd: 'ls' });
    });
  });

  describe('MESSAGE_PART_TOOL_RESULT', () => {
    it('should add a tool_result part with error flag', () => {
      const state = createMockState();
      state.messages['m1'] = {
        id: 'm1',
        conversationId: 'c1',
        role: 'assistant',
        parts: [],
        status: 'streaming',
        createdAt: new Date().toISOString(),
      };

      applyStreamEvent(state, makeEvent(EVENT_TYPES.MESSAGE_PART_TOOL_RESULT, {
        messageId: 'm1',
        toolCallId: 'tc1',
        toolName: 'bash',
        result: 'command failed',
        isError: true,
      }));

      expect(state.messages['m1']!.parts[0]).toMatchObject({
        type: 'tool_result',
        toolCallId: 'tc1',
        toolName: 'bash',
        isError: true,
      });
    });

    it('should NOT duplicate when TOOL_RESULT already created the part', () => {
      const state = createMockState();
      state.messages['m1'] = {
        id: 'm1',
        conversationId: 'c1',
        role: 'assistant',
        parts: [{ type: 'tool_result', toolCallId: 'tc1', toolName: 'bash', toolResult: 'ok', isError: false }],
        status: 'streaming',
        createdAt: new Date().toISOString(),
      };

      // MESSAGE_PART_TOOL_RESULT after TOOL_RESULT → should skip duplicate
      applyStreamEvent(state, makeEvent(EVENT_TYPES.MESSAGE_PART_TOOL_RESULT, {
        messageId: 'm1',
        toolCallId: 'tc1',
        toolName: 'bash',
        result: 'other',
        isError: false,
      }));

      expect(state.messages['m1']!.parts).toHaveLength(1);
      // Should preserve the original result from TOOL_RESULT
      expect(state.messages['m1']!.parts[0]!.toolResult).toBe('ok');
    });
  });

  describe('ARTIFACT_CREATED', () => {
    it('should add artifact to store', () => {
      const state = createMockState();

      applyStreamEvent(state, makeEvent(EVENT_TYPES.ARTIFACT_CREATED, {
        id: 'art-1',
        conversationId: 'c1',
        type: 'web_app',
        title: 'My App',
        content: '<html></html>',
      }));

      expect(state.artifacts['art-1']).toMatchObject({
        id: 'art-1',
        type: 'web_app',
        title: 'My App',
      });
    });
  });

  describe('unknown event type', () => {
    it('should not throw for undefined event types', () => {
      const state = createMockState();
      expect(() => {
        applyStreamEvent(state, makeEvent('custom.unknown', {}));
      }).not.toThrow();
    });
  });

  describe('TOOL_CALL deduplication', () => {
    it('should update existing tool_use part instead of creating duplicate', () => {
      const state = createMockState();
      state.messages['m1'] = {
        id: 'm1',
        conversationId: 'c1',
        role: 'assistant',
        parts: [{ type: 'tool_use', toolCallId: 'tc1', toolName: 'bash' }],
        status: 'streaming',
        createdAt: new Date().toISOString(),
      };

      // TOOL_CALL with the same toolCallId as existing MESSAGE_PART_TOOL_USE
      applyStreamEvent(state, makeEvent(EVENT_TYPES.TOOL_CALL, {
        messageId: 'm1',
        toolCallId: 'tc1',
        toolName: 'bash',
        input: { cmd: 'ls' },
      }));

      expect(state.messages['m1']!.parts).toHaveLength(1); // NOT 2
      expect(state.messages['m1']!.parts[0]).toMatchObject({
        type: 'tool_use',
        toolCallId: 'tc1',
        toolInput: { cmd: 'ls' },
      });
    });

    it('should create new tool_use part when no existing match', () => {
      const state = createMockState();
      state.messages['m1'] = {
        id: 'm1',
        conversationId: 'c1',
        role: 'assistant',
        parts: [],
        status: 'streaming',
        createdAt: new Date().toISOString(),
      };

      applyStreamEvent(state, makeEvent(EVENT_TYPES.TOOL_CALL, {
        messageId: 'm1',
        toolCallId: 'tc1',
        toolName: 'bash',
        input: { cmd: 'ls' },
      }));

      expect(state.messages['m1']!.parts).toHaveLength(1);
      expect(state.messages['m1']!.parts[0]!.type).toBe('tool_use');
    });
  });

  describe('TOOL_RESULT deduplication', () => {
    it('should update existing tool_result part instead of creating duplicate', () => {
      const state = createMockState();
      state.messages['m1'] = {
        id: 'm1',
        conversationId: 'c1',
        role: 'assistant',
        parts: [{ type: 'tool_result', toolCallId: 'tc1', toolName: 'bash', toolResult: 'partial', isError: false }],
        status: 'streaming',
        createdAt: new Date().toISOString(),
      };

      // TOOL_RESULT with same toolCallId
      applyStreamEvent(state, makeEvent(EVENT_TYPES.TOOL_RESULT, {
        messageId: 'm1',
        toolCallId: 'tc1',
        toolName: 'bash',
        result: 'file1.txt\nfile2.txt',
        isError: false,
      }));

      expect(state.messages['m1']!.parts).toHaveLength(1); // NOT 2
      expect(state.messages['m1']!.parts[0]!.toolResult).toBe('file1.txt\nfile2.txt');
    });

    it('should not match across different toolCallIds', () => {
      const state = createMockState();
      state.messages['m1'] = {
        id: 'm1',
        conversationId: 'c1',
        role: 'assistant',
        parts: [{ type: 'tool_result', toolCallId: 'tc1', toolName: 'bash', toolResult: 'ok', isError: false }],
        status: 'streaming',
        createdAt: new Date().toISOString(),
      };

      applyStreamEvent(state, makeEvent(EVENT_TYPES.TOOL_RESULT, {
        messageId: 'm1',
        toolCallId: 'tc2', // different toolCallId
        toolName: 'read',
        result: 'content',
        isError: false,
      }));

      expect(state.messages['m1']!.parts).toHaveLength(2); // Different tool, so keep both
    });
  });
});
