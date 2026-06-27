/**
 * MCP (Model Context Protocol) TypeScript type definitions.
 *
 * Mirrors the Go structs in services/mcp-gateway/internal/mcp/protocol.go
 * to keep the TypeScript and Go sides of the protocol aligned.
 *
 * Protocol version: 2024-11-05
 */

/** A tool as returned by tools/list. */
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

/** Result of a tools/list JSON-RPC call. */
export interface MCPToolsListResult {
  tools: MCPTool[];
}

/** Parameters for a tools/call JSON-RPC call. */
export interface MCPToolsCallRequest {
  name: string;
  arguments: Record<string, unknown>;
}

/** A single content item in a tool call result. */
export interface MCPContentItem {
  type: 'text' | 'image' | 'resource';
  text?: string;
  data?: string;
  mimeType?: string;
}

/** Result of a tools/call JSON-RPC call. */
export interface MCPToolsCallResult {
  content: MCPContentItem[];
  isError?: boolean;
}

/** JSON-RPC 2.0 request envelope. */
export interface JSONRPCRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: unknown;
}

/** JSON-RPC 2.0 response envelope. */
export interface JSONRPCResponse {
  jsonrpc: '2.0';
  id: number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}
