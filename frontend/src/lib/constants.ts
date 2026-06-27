// Event type constants (inlined from @agenthub/contracts to avoid
// NodeNext .js extension resolution issues with Next.js bundler)

/** Message status lifecycle. */
export const MESSAGE_STATUS = {
  STREAMING: 'streaming',
  COMPLETE: 'complete',
  ABORTED: 'aborted',
  FAILED: 'failed',
} as const;
export type MessageStatus = (typeof MESSAGE_STATUS)[keyof typeof MESSAGE_STATUS];

export const EVENT_TYPES = {
  // Agent lifecycle
  AGENT_RUN_START: 'agent.run.start',
  AGENT_RUN_COMPLETE: 'agent.run.complete',
  AGENT_RUN_FAILED: 'agent.run.failed',
  AGENT_RUN_ABORTED: 'agent.run.aborted',

  // Message streaming
  MESSAGE_CREATED: 'message.created',
  MESSAGE_PART_TEXT: 'message.part.text',
  MESSAGE_PART_THINKING: 'message.part.thinking',
  MESSAGE_PART_TOOL_USE: 'message.part.tool_use',
  MESSAGE_PART_TOOL_RESULT: 'message.part.tool_result',
  MESSAGE_COMPLETE: 'message.complete',

  // Tool system
  TOOL_CALL: 'tool.call',
  TOOL_RESULT: 'tool.result',

  // Artifact lifecycle
  ARTIFACT_CREATED: 'artifact.created',
  ARTIFACT_UPDATED: 'artifact.updated',

  // Knowledge
  KNOWLEDGE_WRITE: 'knowledge.write',
  KNOWLEDGE_QUERY: 'knowledge.query',

  // Skill
  SKILL_INVOKE: 'skill.invoke',

  // Audit
  AUDIT_LOG: 'audit.log',

  // System
  SYSTEM_HEARTBEAT: 'system.heartbeat',
} as const;

export type EventType = (typeof EVENT_TYPES)[keyof typeof EVENT_TYPES];

// Event Envelope type — re-exported from @agenthub/contracts to avoid type drift.
// Previously inlined due to NodeNext .js extension issues; resolved by Next.js
// bundler moduleResolution which handles extension-less imports.
export type { EventEnvelope } from '@agenthub/contracts';

export const CORE_ENGINE_URL =
  process.env.NEXT_PUBLIC_CORE_ENGINE_URL ?? 'http://localhost:3001';
