import { EVENT_TYPES, MESSAGE_STATUS, type EventEnvelope } from '@/lib/constants';
import type { AgentHubState } from '../interfaces/index.js';
import type {
  AgentRunStartPayload,
  AgentRunCompletePayload,
  AgentRunFailedPayload,
  AgentRunAbortedPayload,
  MessagePartTextPayload,
  MessagePartThinkingPayload,
  MessagePartToolUsePayload,
  MessagePartToolResultPayload,
  ToolCallPayload,
  ToolResultPayload,
  ArtifactCreatedPayload,
  ArtifactUpdatedPayload,
} from './interfaces/stream-payloads.interface.js';

/**
 * Core stream reducer — applies an EventEnvelope to the draft state.
 * Pure function, designed to be used inside Zustand's Immer `set()`.
 */
export function applyStreamEvent(
  draft: AgentHubState,
  event: EventEnvelope,
): void {
  switch (event.eventType) {
    // ---- Agent Lifecycle ----
    case EVENT_TYPES.AGENT_RUN_START: {
      const payload = event.payload as AgentRunStartPayload;
      draft.ui.isStreaming = true;
      draft.ui.streamingMessageId = payload.messageId;
      break;
    }

    case EVENT_TYPES.AGENT_RUN_COMPLETE: {
      const payload = event.payload as AgentRunCompletePayload;
      const msg = draft.messages[payload.messageId];
      if (msg) {
        msg.status = MESSAGE_STATUS.COMPLETE;
      }
      draft.ui.isStreaming = false;
      draft.ui.streamingMessageId = null;
      break;
    }

    case EVENT_TYPES.AGENT_RUN_FAILED: {
      const payload = event.payload as AgentRunFailedPayload;
      const msg = draft.messages[payload.messageId];
      if (msg) {
        msg.status = MESSAGE_STATUS.FAILED;
      }
      draft.ui.isStreaming = false;
      draft.ui.streamingMessageId = null;
      break;
    }

    case EVENT_TYPES.AGENT_RUN_ABORTED: {
      const payload = event.payload as AgentRunAbortedPayload;
      const msg = draft.messages[payload.messageId];
      if (msg) {
        msg.status = MESSAGE_STATUS.ABORTED;
      }
      draft.ui.isStreaming = false;
      draft.ui.streamingMessageId = null;
      break;
    }

    // ---- Message Streaming Parts ----
    case EVENT_TYPES.MESSAGE_PART_TEXT: {
      const payload = event.payload as MessagePartTextPayload;
      const msg = draft.messages[payload.messageId];
      if (!msg) break;
      const lastPart = msg.parts[msg.parts.length - 1];
      if (lastPart?.type === 'text') {
        // Append to existing text part (streaming coalescing)
        lastPart.content = (lastPart.content ?? '') + payload.content;
      } else {
        msg.parts.push({ type: 'text', content: payload.content });
      }
      break;
    }

    case EVENT_TYPES.MESSAGE_PART_THINKING: {
      const payload = event.payload as MessagePartThinkingPayload;
      const msg = draft.messages[payload.messageId];
      if (!msg) break;
      const lastPart = msg.parts[msg.parts.length - 1];
      if (lastPart?.type === 'thinking') {
        lastPart.content = (lastPart.content ?? '') + payload.content;
      } else {
        msg.parts.push({ type: 'thinking', content: payload.content });
      }
      break;
    }

    case EVENT_TYPES.MESSAGE_PART_TOOL_USE: {
      const payload = event.payload as MessagePartToolUsePayload;
      const msg = draft.messages[payload.messageId];
      if (!msg) break;
      msg.parts.push({
        type: 'tool_use',
        toolCallId: payload.toolCallId,
        toolName: payload.toolName,
      });
      break;
    }

    case EVENT_TYPES.MESSAGE_PART_TOOL_RESULT: {
      const payload = event.payload as MessagePartToolResultPayload;
      const msg = draft.messages[payload.messageId];
      if (!msg) break;
      msg.parts.push({
        type: 'tool_result',
        toolCallId: payload.toolCallId,
        toolName: payload.toolName,
        toolResult: payload.result,
        isError: payload.isError,
      });
      break;
    }

    // ---- Message Complete ----
    case EVENT_TYPES.MESSAGE_CREATED: {
      // MESSAGE_CREATED is typically a confirmatory event — no action needed
      break;
    }

    case EVENT_TYPES.MESSAGE_COMPLETE: {
      draft.ui.isStreaming = false;
      draft.ui.streamingMessageId = null;
      break;
    }

    // ---- Tool Events ----
    case EVENT_TYPES.TOOL_CALL: {
      const payload = event.payload as ToolCallPayload;
      const msg = draft.messages[payload.messageId];
      if (!msg) break;
      msg.parts.push({
        type: 'tool_use',
        toolCallId: payload.toolCallId,
        toolName: payload.toolName,
        toolInput: payload.input,
      });
      break;
    }

    case EVENT_TYPES.TOOL_RESULT: {
      const payload = event.payload as ToolResultPayload;
      const msg = draft.messages[payload.messageId];
      if (!msg) break;
      msg.parts.push({
        type: 'tool_result',
        toolCallId: payload.toolCallId,
        toolName: payload.toolName,
        toolResult: payload.result,
        isError: payload.isError,
      });
      break;
    }

    // ---- Artifacts ----
    case EVENT_TYPES.ARTIFACT_CREATED: {
      const payload = event.payload as ArtifactCreatedPayload;
      draft.artifacts[payload.id] = {
        id: payload.id,
        conversationId: payload.conversationId,
        type: payload.type,
        title: payload.title,
        content: payload.content,
        version: 1,
        parentArtifactId: null,
        createdAt: event.timestamp,
      };
      break;
    }

    case EVENT_TYPES.ARTIFACT_UPDATED: {
      const payload = event.payload as ArtifactUpdatedPayload;
      const existing = draft.artifacts[payload.id];
      if (existing) {
        existing.content = payload.content;
        existing.version = payload.version;
      }
      break;
    }

    // ---- Knowledge Events (prepare for future use) ----
    case EVENT_TYPES.KNOWLEDGE_WRITE:
    case EVENT_TYPES.KNOWLEDGE_QUERY:
    case EVENT_TYPES.SKILL_INVOKE:
    case EVENT_TYPES.AUDIT_LOG:
    case EVENT_TYPES.SYSTEM_HEARTBEAT:
      // Silently ignored — these events are for other services or future use
      break;

    default:
      // Unknown event types are silently ignored
      break;
  }
}
