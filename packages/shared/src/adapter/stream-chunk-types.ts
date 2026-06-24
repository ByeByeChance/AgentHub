/** Stream chunk type discriminated union key — use in switch/case instead of raw strings. */
export const STREAM_CHUNK_TYPE = {
  TEXT_DELTA: 'text_delta',
  THINKING_DELTA: 'thinking_delta',
  TOOL_USE_START: 'tool_use_start',
  TOOL_USE_DELTA: 'tool_use_delta',
  TOOL_USE_END: 'tool_use_end',
  DONE: 'done',
} as const;

export type StreamChunkTypeValue = (typeof STREAM_CHUNK_TYPE)[keyof typeof STREAM_CHUNK_TYPE];
