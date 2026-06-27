# ADR-005: MCP Gateway 集成契约

**日期**: 2026-06-27
**状态**: Proposed
**决策者**: Chance（基于软件架构师审查 R5 的建议）
**前置**: M6 完成，ADR-004

---

## Context

当前状态：

- **MCP Gateway**（Go）实现了 JSON-RPC 2.0 协议，注册了一个 `echo` 工具，有独立的 auth/rate-limit 策略
- **Core Engine** 有 5 个硬编码内置工具（`fs_read`、`fs_write`、`bash`、`write_artifact`、`ask_user`）
- **两者之间没有代码连接**：同一 Docker Compose 网络中部署，但不通信
- 架构文档声明的职责是"MCP Gateway 负责工具发现、工具路由、鉴权、限流"，但 Core Engine 未使用它

这违反了架构的核心原则：MCP Gateway 的职责被架空，工具都在 Core Engine 内部硬编码。

---

## Decision

### Decision 1: Core Engine 作为 MCP Client

Core Engine 通过 HTTP/JSON-RPC 调用 MCP Gateway，作为工具消费方：

```
Core Engine (MCP Client)
    │
    │  POST /jsonrpc  { "method": "tools/list" }
    │  POST /jsonrpc  { "method": "tools/call", "params": { ... } }
    │
    ▼
MCP Gateway (Go, JSON-RPC 2.0)
    ├── Auth (APIKey / Noop)
    ├── RateLimit (TokenBucket / Noop)
    ├── Tool Registry (Echo, WebSearch, WebFetch, ...)
    └── Transport Adapters (HTTP, stdio)
```

**工具分类**：

| 类别 | 示例 | 位置 | 原因 |
|------|------|------|------|
| 内置工具 | `fs_read`, `fs_write`, `bash`, `write_artifact`, `ask_user` | Core Engine | 需要 Workspace 沙箱访问、数据库写入、用户交互 — 这些是 Core Engine 的本地能力 |
| 外部工具 | `echo`, `web_search`, `web_fetch`, 未来第三方工具 | MCP Gateway | 独立能力，不需要 Core Engine 内部状态 |

### Decision 2: JSON-RPC 2.0 作为集成协议

Core Engine 通过 HTTP POST `/jsonrpc` 调用 MCP Gateway 的两个标准 MCP 方法：

- `tools/list` — 发现所有已注册工具及其 JSON Schema
- `tools/call` — 执行指定工具

不使用 RabbitMQ 作为工具调用通道（工具调用是同步的，需要即时返回结果）。

### Decision 3: 优雅降级

MCP Gateway 不可用时，Core Engine 记录警告日志并继续使用内置工具运行。外部工具调用失败时返回结构化错误消息给 Agent（Agent 可以从错误中恢复或重试）。

### Decision 4: 事件类型扩展

在 `packages/contracts/src/event-types.ts` 新增两个事件类型：
- `MCP_DISCOVER = 'mcp.discover'` — 工具发现成功/失败
- `MCP_CALL = 'mcp.call'` — 工具调用记录（用于审计和成本追踪）

### Decision 5: TypeScript 类型定义

在 `packages/contracts/src/` 新增 `mcp-types.ts`，包含 MCP 协议的 TypeScript 接口：
- `MCPTool`、`MCPToolsListResult`、`MCPToolsCallRequest`、`MCPToolsCallResult`
- 与 Go 侧 `services/mcp-gateway/internal/mcp/protocol.go` 结构对齐

---

## Consequences

### 获得的
- MCP Gateway 实现其声明的架构职责（工具发现、路由、鉴权、限流）
- 工具可插拔：新增工具只需在 Go 侧注册，Core Engine 自动发现
- 消除 TS/Go 双语言实现的 auth/rate-limit 重复（MCP Gateway 的 Go 实现是唯一权威）
- 第三方工具可通过 MCP 协议标准方式接入

### 牺牲的
- 工具调用多一跳网络延迟（~1ms 内网 HTTP）
- 外部工具不可用时 Agent 行为改变（需优雅降级处理）

### 风险
- MCP Gateway 不可用时外部工具全部失效 → 缓解：内置工具保持独立；优雅降级日志
- JSON-RPC 协议版本不匹配 → 缓解：Go 和 TS 侧共享协议版本常量 `2024-11-05`
- 外部工具执行超时 → 缓解：MCP Client 设置超时（默认 30s），超时后返回 error 给 Agent

### 后续步骤
1. 在 Go 侧注册 `web_search` 和 `web_fetch` 工具（可先 stub 实现）
2. 验证工具发现和调用端到端流程
3. 评估将部分内置工具迁移到 MCP Gateway（如 `bash` 在沙箱中执行时可作为外部工具）

---

## 相关
- ADR-004: API Gateway 拆分（Gateway 统一解析 `MCP_GATEWAY_URL`）
- 架构审查报告 2026-06-27 (R5)
- MCP 协议规范: `services/mcp-gateway/internal/mcp/protocol.go`
- `CLAUDE.md` §3.3 服务职责边界
