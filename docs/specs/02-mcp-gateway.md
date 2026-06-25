# MCP Gateway 服务接口规格

**服务**: MCP Gateway
**端口**: 8080 (可配置 `MCP_GATEWAY_PORT`)
**语言**: Go (标准库 `net/http`)
**状态**: M4 完成 — JSON-RPC 2.0 + 工具注册 + Echo 内置工具

---

## 1. 服务概述

MCP Gateway 是 AgentHub 的 MCP (Model Context Protocol) 网关，负责：
- JSON-RPC 2.0 传输层（单请求 / 批量请求 / 通知）
- MCP 协议握手（`initialize` 方法）
- 工具发现（`tools/list`）+ 工具调用（`tools/call`）
- 工具注册表（`Register` / `List` / `Call`），线程安全
- 鉴权（可插拔 `AuthStrategy`）+ 限流（可插拔 `RateLimitStrategy`）

**协议版本**: `2024-11-05`（MCP 规范版本）

---

## 2. API 契约

### 2.1 `GET /health`

健康检查端点。

**Response** `200`:
```json
{
  "status": "ok",
  "service": "mcp-gateway",
  "timestamp": "2026-06-25T10:00:00.000Z"
}
```

---

### 2.2 `POST /jsonrpc`

JSON-RPC 2.0 统一端点。接受单请求、批量请求、或通知。

**Content-Type**: `application/json`

**鉴权**: 通过 `AuthStrategy.Authenticate(r)` 中间件，失败返回 `401`
**限流**: 通过 `RateLimitStrategy.Allow(clientKey)` 检查，超限返回 `429`

#### 2.2.1 单请求

**Request**:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list",
  "params": {}
}
```

**Response** (成功):
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": { ... }
}
```

**Response** (错误):
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32601,
    "message": "Method not found",
    "data": "No handler registered for method 'unknown_method'"
  }
}
```

#### 2.2.2 批量请求

**Request**:
```json
[
  { "jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {} },
  { "jsonrpc": "2.0", "id": 2, "method": "ping", "params": {} }
]
```

**Response**: 按顺序返回每个请求的结果数组。

#### 2.2.3 通知

无 `id` 字段的请求，服务器不返回响应：
```json
{
  "jsonrpc": "2.0",
  "method": "notifications/initialized",
  "params": {}
}
```

---

### 2.3 JSON-RPC 方法

#### `initialize`

MCP 协议握手。客户端连接时必须首先调用。

**Params** (`InitializeRequest`):
```json
{
  "protocolVersion": "2024-11-05",
  "clientInfo": {
    "name": "agenthub-core-engine",
    "version": "0.1.0"
  },
  "capabilities": {}
}
```

**Result** (`InitializeResult`):
```json
{
  "protocolVersion": "2024-11-05",
  "serverInfo": {
    "name": "agenthub-mcp-gateway",
    "version": "0.1.0"
  },
  "capabilities": {
    "tools": {
      "listChanged": true
    }
  }
}
```

---

#### `tools/list`

列出所有已注册的 MCP 工具定义。

**Params**: 无

**Result** (`ToolsListResult`):
```json
{
  "tools": [
    {
      "name": "echo",
      "description": "Echo back the input message with a timestamp",
      "inputSchema": {
        "type": "object",
        "properties": {
          "message": {
            "type": "string",
            "description": "The message to echo back"
          }
        },
        "required": ["message"]
      }
    }
  ]
}
```

**实现**: `Registry.List()` → 返回所有 `ToolDefinition`

---

#### `tools/call`

调用已注册的工具。

**Params** (`ToolsCallRequest`):
```json
{
  "name": "echo",
  "arguments": {
    "message": "Hello, MCP!"
  }
}
```

**Result** (`ToolsCallResult`):
```json
{
  "content": [
    {
      "type": "text",
      "text": "Echo: Hello, MCP! (at 2026-06-25T10:00:00Z)"
    }
  ],
  "isError": false
}
```

**Errors**:
| 错误码 | 说明 |
|--------|------|
| `-32602` | 无效参数（参数校验失败） |
| `-32602` | 工具未找到 |

**实现**: `Registry.Call(ctx, name, args)` → 执行 `Entry.Handler(ctx, args)`

---

#### `ping`

存活检查。

**Params**: 无

**Result** (`PingResult`):
```json
{
  "status": "ok"
}
```

---

### 2.4 JSON-RPC 错误码

| 错误码 | 常量 | 说明 |
|--------|------|------|
| `-32700` | Parse Error | JSON 解析失败 |
| `-32600` | Invalid Request | 不是有效的 JSON-RPC 2.0 请求 |
| `-32601` | Method Not Found | 方法未注册 |
| `-32602` | Invalid Params | 参数校验失败 |
| `-32603` | Internal Error | 工具执行内部错误 |

---

## 3. 事件

### 3.1 产生的事件

当前无。M6 计划：每次 `tools/call` 通过 RabbitMQ 产生 `audit.log` 事件。

### 3.2 消费的事件

无。

---

## 4. 策略接口

### 4.1 AuthStrategy

**定义位置**: `services/mcp-gateway/internal/auth/auth.go`

```go
type Strategy interface {
    Authenticate(r *http.Request) (bool, error)
}
```

- 返回 `(true, nil)` — 认证通过
- 返回 `(false, nil)` — 认证拒绝（返回 401）
- 返回 `(false, error)` — 认证系统错误（返回 500）

**默认实现**: `NoopAuth` — 始终返回 `(true, nil)`
**M6 计划**: `APIKeyAuth`（验证 `Authorization: Bearer <key>`）、`OAuth2Auth`、`mTLSAuth`

### 4.2 RateLimitStrategy

**定义位置**: `services/mcp-gateway/internal/ratelimit/ratelimit.go`

```go
type Strategy interface {
    Allow(key string) bool
}
```

**默认实现**: `NoopStrategy` — 始终返回 `true`
**M6 计划**: `TokenBucketStrategy`、`SlidingWindowStrategy`

---

## 5. 工具注册表

**定义位置**: `services/mcp-gateway/internal/tools/registry.go`

```go
type Registry struct { ... }  // 线程安全（sync.RWMutex）

func (r *Registry) Register(entry Entry)
func (r *Registry) List() []ToolDefinition
func (r *Registry) Call(ctx context.Context, name string, args map[string]any) (*ToolsCallResult, error)
```

**Entry**:
```go
type Entry struct {
    Definition ToolDefinition
    Handler    func(ctx context.Context, args map[string]any) (*ToolsCallResult, error)
}
```

**ToolDefinition**:
```go
type ToolDefinition struct {
    Name        string
    Description string
    InputSchema map[string]any  // JSON Schema
}
```

### 5.1 内置工具: `echo`

返回输入消息 + 时间戳。用于验证工具调用链路连通性。

```json
{
  "name": "echo",
  "description": "Echo back the input message with a timestamp",
  "inputSchema": {
    "type": "object",
    "properties": {
      "message": { "type": "string", "description": "The message to echo back" }
    },
    "required": ["message"]
  }
}
```

---

## 6. 数据库表

无 — MCP Gateway 是无状态网关，不持久化数据。

---

## 7. 依赖关系

### 上游依赖

| 依赖 | 用途 |
|------|------|
| Go 标准库 `net/http` | HTTP 服务器 |
| Go 标准库 `sync` | 线程安全注册表 |
| Go 标准库 `encoding/json` | JSON 编解码 |
| Go 标准库 `log/slog` | 结构化日志 |

### 下游消费方

| 服务 | 消费方式 | 状态 |
|------|---------|------|
| Core Engine | `POST /jsonrpc` → `tools/list` + `tools/call` | 🔜 M6 |
| 外部 MCP 客户端 | `POST /jsonrpc` | ✅ 就绪 |

---

*关联文档: [Core Engine 规格](./01-core-engine.md) · [Event Envelope 协议](./06-event-envelope.md)*
