import type { MCPTool, MCPToolsCallResult, JSONRPCRequest, JSONRPCResponse } from '@agenthub/contracts';
import type { Logger } from '@agenthub/shared/logging';

/**
 * Error thrown when an external MCP tool call fails.
 */
export class MCPClientError extends Error {
  constructor(
    message: string,
    public readonly toolName?: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'MCPClientError';
  }
}

/**
 * Lightweight HTTP client for the MCP Gateway's JSON-RPC 2.0 endpoint.
 *
 * Core Engine uses this to discover and call external tools registered
 * in the MCP Gateway (Go service). Built-in tools (fs_read, bash, etc.)
 * are handled locally and do NOT go through this client.
 *
 * If the MCP Gateway is unreachable, the client logs a warning and returns
 * empty results (graceful degradation).
 */
export class MCPClient {
  private nextId = 1;

  constructor(
    private readonly gatewayUrl: string,
    private readonly logger: Logger,
    private readonly timeout = 30_000,
  ) {}

  /**
   * Discover all tools registered in the MCP Gateway.
   * Returns an empty array if the gateway is unreachable.
   */
  async discoverTools(): Promise<MCPTool[]> {
    try {
      const response = await this.call('tools/list', {});
      const result = response as { tools: MCPTool[] };
      this.logger.info('MCP tools discovered', { count: result.tools?.length ?? 0 });
      return result.tools ?? [];
    } catch (err) {
      this.logger.warn('MCP Gateway tool discovery failed — external tools unavailable', {
        gatewayUrl: this.gatewayUrl,
        error: String(err),
      });
      return [];
    }
  }

  /**
   * Call an external tool registered in the MCP Gateway.
   *
   * @throws MCPClientError if the call fails
   */
  async callTool(name: string, args: Record<string, unknown>): Promise<MCPToolsCallResult> {
    try {
      const result = await this.call('tools/call', { name, arguments: args });
      return result as MCPToolsCallResult;
    } catch (err) {
      throw new MCPClientError(
        `MCP tool "${name}" call failed: ${String(err)}`,
        name,
        err,
      );
    }
  }

  // ── private ──

  private async call(method: string, params: unknown): Promise<unknown> {
    const request: JSONRPCRequest = {
      jsonrpc: '2.0',
      id: this.nextId++,
      method,
      params,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const res = await fetch(`${this.gatewayUrl}/jsonrpc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const data = (await res.json()) as JSONRPCResponse;

      if (data.error) {
        throw new Error(`JSON-RPC error ${data.error.code}: ${data.error.message}`);
      }

      return data.result;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
