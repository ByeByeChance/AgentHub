/** Message status lifecycle. */
export const MESSAGE_STATUS = {
  STREAMING: 'streaming',
  COMPLETE: 'complete',
  ABORTED: 'aborted',
  FAILED: 'failed',
} as const;
export type MessageStatus = (typeof MESSAGE_STATUS)[keyof typeof MESSAGE_STATUS];

/** Message roles in a conversation. */
export const MESSAGE_ROLE = {
  USER: 'user',
  ASSISTANT: 'assistant',
  SYSTEM: 'system',
} as const;
export type MessageRole = (typeof MESSAGE_ROLE)[keyof typeof MESSAGE_ROLE];

/** Types of parts that compose a message. */
export const MESSAGE_PART_TYPE = {
  TEXT: 'text',
  THINKING: 'thinking',
  TOOL_USE: 'tool_use',
  TOOL_RESULT: 'tool_result',
  ARTIFACT_REF: 'artifact_ref',
} as const;
export type MessagePartType = (typeof MESSAGE_PART_TYPE)[keyof typeof MESSAGE_PART_TYPE];

/** Conversation mode. */
export const CONVERSATION_MODE = {
  SINGLE: 'single',
  GROUP: 'group',
} as const;
export type ConversationMode = (typeof CONVERSATION_MODE)[keyof typeof CONVERSATION_MODE];

/** Artifact types produced by agents. */
export const ARTIFACT_TYPE = {
  WEB_APP: 'web_app',
  DOCUMENT: 'document',
  CODE: 'code',
  IMAGE: 'image',
} as const;
export type ArtifactType = (typeof ARTIFACT_TYPE)[keyof typeof ARTIFACT_TYPE];
