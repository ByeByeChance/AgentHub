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

  // Orchestrator
  ORCHESTRATOR_PLAN_START: 'orchestrator.plan.start',
  ORCHESTRATOR_PLAN_COMPLETE: 'orchestrator.plan.complete',
  ORCHESTRATOR_PLAN_FAILED: 'orchestrator.plan.failed',
  ORCHESTRATOR_AGGREGATE_COMPLETE: 'orchestrator.aggregate.complete',

  // MCP (Model Context Protocol)
  MCP_DISCOVER: 'mcp.discover',
  MCP_CALL: 'mcp.call',

  // Audit
  AUDIT_LOG: 'audit.log',

  // System
  SYSTEM_HEARTBEAT: 'system.heartbeat',
} as const;

export type EventType = (typeof EVENT_TYPES)[keyof typeof EVENT_TYPES];

export const AGENT_EVENTS = [
  EVENT_TYPES.AGENT_RUN_START,
  EVENT_TYPES.AGENT_RUN_COMPLETE,
  EVENT_TYPES.AGENT_RUN_FAILED,
  EVENT_TYPES.AGENT_RUN_ABORTED,
] as const;

export const MESSAGE_EVENTS = [
  EVENT_TYPES.MESSAGE_CREATED,
  EVENT_TYPES.MESSAGE_PART_TEXT,
  EVENT_TYPES.MESSAGE_PART_THINKING,
  EVENT_TYPES.MESSAGE_PART_TOOL_USE,
  EVENT_TYPES.MESSAGE_PART_TOOL_RESULT,
  EVENT_TYPES.MESSAGE_COMPLETE,
] as const;

export const TOOL_EVENTS = [
  EVENT_TYPES.TOOL_CALL,
  EVENT_TYPES.TOOL_RESULT,
] as const;

export const ARTIFACT_EVENTS = [
  EVENT_TYPES.ARTIFACT_CREATED,
  EVENT_TYPES.ARTIFACT_UPDATED,
] as const;

export const KNOWLEDGE_EVENTS = [
  EVENT_TYPES.KNOWLEDGE_WRITE,
  EVENT_TYPES.KNOWLEDGE_QUERY,
] as const;

export const SKILL_EVENTS = [
  EVENT_TYPES.SKILL_INVOKE,
] as const;

export const AUDIT_EVENTS = [
  EVENT_TYPES.AUDIT_LOG,
] as const;

export const MCP_EVENTS = [
  EVENT_TYPES.MCP_DISCOVER,
  EVENT_TYPES.MCP_CALL,
] as const;

export const ORCHESTRATOR_EVENTS = [
  EVENT_TYPES.ORCHESTRATOR_PLAN_START,
  EVENT_TYPES.ORCHESTRATOR_PLAN_COMPLETE,
  EVENT_TYPES.ORCHESTRATOR_PLAN_FAILED,
  EVENT_TYPES.ORCHESTRATOR_AGGREGATE_COMPLETE,
] as const;

export const SYSTEM_EVENTS = [
  EVENT_TYPES.SYSTEM_HEARTBEAT,
] as const;
