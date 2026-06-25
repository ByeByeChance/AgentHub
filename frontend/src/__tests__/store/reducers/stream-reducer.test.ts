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
});
