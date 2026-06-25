# Core Engine 服务接口规格

**服务**: `@agenthub/core-engine`
**端口**: 3001 (可配置 `CORE_ENGINE_PORT`)
**语言**: TypeScript (Fastify 5.x)
**状态**: M5 完成 — 单 Agent 对话完整链路

---

## 1. 服务概述

Core Engine 是 AgentHub 的核心引擎，负责：
- Agent 生命周期管理（创建、查询、分类）
- 会话与消息管理（CRUD + 流式传输）
- LLM 调用编排（AgentRunner → Adapter → Tool Loop）
- 工具执行（5 个内置工具 + 可扩展注册）
- 工作区沙箱（文件读写 + Bash 执行）
- SSE 实时事件推送到前端

---

## 2. API 契约

### 2.1 `GET /health`

健康检查端点。由 `@agenthub/shared/server` 的 `createHealthServer()` 自动注册。

**Response** `200`:
```json
{
  "status": "ok",
  "service": "core-engine",
  "timestamp": "2026-06-25T10:00:00.000Z"
}
```

---

### 2.2 `GET /api/agents`

列出 Agent。支持可选的分类过滤和文本搜索。

**Query Parameters**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `category` | string | 否 | 按分类过滤（如 `engineering`, `marketing`） |
| `search` | string | 否 | 全文搜索 name + description |

**Response** `200`:
```json
[
  {
    "id": "uuid",
    "name": "Frontend Engineer",
    "emoji": "💻",
    "description": "Expert React/TypeScript developer",
    "category": "engineering",
    "isBuiltin": true,
    "isOrchestrator": false,
    "createdAt": "2026-06-25T10:00:00.000Z"
  }
]
```

**实现**: `AgentRegistry.listByCategory()` / `listAll()` / `search()`

---

### 2.3 `GET /api/agents/:id`

获取单个 Agent 的完整信息（含 systemPrompt、adapter 配置、工具集）。

**Path Parameters**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | string (UUID) | 是 | Agent ID |

**Response** `200`:
```json
{
  "id": "uuid",
  "name": "Frontend Engineer",
  "emoji": "💻",
  "description": "Expert React/TypeScript developer",
  "category": "engineering",
  "systemPrompt": "You are an expert frontend engineer...",
  "adapterName": "deepseek",
  "modelId": "deepseek-v4-pro",
  "toolNames": ["fs_read", "fs_write", "bash", "write_artifact"],
  "isBuiltin": true,
  "isOrchestrator": false,
  "createdAt": "2026-06-25T10:00:00.000Z"
}
```

**Errors**:
| 状态码 | 响应 |
|--------|------|
| `404` | `{ "error": "Agent not found" }` |

**实现**: `AgentRegistry.getById()`

---

### 2.4 `POST /api/agents`

创建自定义 Agent。

**Request Body** (Zod: `createAgentSchema`):
```typescript
{
  name: string          // min 1
  emoji: string          // min 1
  description: string    // min 1
  category: string       // min 1
  systemPrompt: string   // min 1
  toolNames?: string[]   // 可选，默认 []
}
```

**Response** `201`:
```json
{
  "id": "uuid",
  "name": "My Custom Agent",
  "emoji": "🤖",
  "description": "A custom agent for...",
  "category": "custom",
  "systemPrompt": "You are...",
  "adapterName": "deepseek",
  "modelId": "deepseek-v4-pro",
  "toolNames": ["fs_read"],
  "isBuiltin": false,
  "isOrchestrator": false,
  "createdAt": "2026-06-25T10:00:00.000Z"
}
```

**Errors**:
| 状态码 | 响应 |
|--------|------|
| `400` | `{ "error": "Validation failed", "details": [...] }` |

**实现**: `AgentRegistry.create()` — 自动生成 UUID，默认 `adapterName: 'deepseek'`, `modelId: 'deepseek-v4-pro'`

---

### 2.5 `POST /api/conversations`

创建会话。

**Request Body** (Zod: `createConvSchema`):
```typescript
{
  title?: string           // 可选，默认 "New Conversation"
  mode?: 'single' | 'group' // 可选，默认 'single'
  agentIds: string[]       // min 1，Agent UUID 列表
}
```

**Response** `201`:
```json
{
  "id": "uuid",
  "title": "My Conversation",
  "mode": "single",
  "agentIds": ["agent-uuid-1"],
  "pinnedAt": null,
  "createdAt": "2026-06-25T10:00:00.000Z"
}
```

**Errors**:
| 状态码 | 响应 |
|--------|------|
| `400` | `{ "error": "Validation failed", "details": [...] }` |

**实现**: `ConversationService.createConversation()`

---

### 2.6 `GET /api/conversations`

列出所有会话。

**Response** `200`:
```json
[
  {
    "id": "uuid",
    "title": "My Conversation",
    "mode": "single",
    "agentIds": ["agent-uuid-1"],
    "pinnedAt": null,
    "createdAt": "2026-06-25T10:00:00.000Z"
  }
]
```

**实现**: `ConversationService.listConversations()`

---

### 2.7 `GET /api/conversations/:id/messages`

获取会话的消息历史（分页）。

**Path Parameters**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | string (UUID) | 是 | 会话 ID |

**Query Parameters**:
| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `limit` | number | 50 | 每页条数 |
| `offset` | number | 0 | 偏移量 |

**Response** `200`:
```json
[
  {
    "id": "uuid",
    "conversationId": "conv-uuid",
    "role": "user",
    "parts": [
      { "type": "text", "content": "帮我写一个 React 组件" }
    ],
    "status": "complete",
    "createdAt": "2026-06-25T10:00:00.000Z"
  },
  {
    "id": "uuid",
    "conversationId": "conv-uuid",
    "role": "assistant",
    "parts": [
      { "type": "text", "content": "好的，我来帮你写..." },
      { "type": "tool_use", "toolCallId": "call_1", "toolName": "fs_write", "toolInput": { "path": "Component.tsx", "content": "..." } },
      { "type": "tool_result", "toolCallId": "call_1", "toolName": "fs_write", "toolResult": "success", "isError": false }
    ],
    "status": "complete",
    "createdAt": "2026-06-25T10:00:01.000Z"
  }
]
```

**MessagePart 类型**:
| type | 说明 | 字段 |
|------|------|------|
| `text` | 文本内容 | `content` |
| `thinking` | 推理过程 | `content` |
| `tool_use` | 工具调用 | `toolCallId`, `toolName`, `toolInput` |
| `tool_result` | 工具结果 | `toolCallId`, `toolName`, `toolResult`, `isError` |
| `artifact_ref` | 产物引用 | `artifactId` |

**Message Status**:
| 值 | 说明 |
|------|------|
| `streaming` | 正在生成 |
| `complete` | 已完成 |
| `aborted` | 被中断 |
| `failed` | 失败 |

**实现**: `ConversationService.getMessages()`

---

### 2.8 `POST /api/conversations/:id/messages` (SSE Stream)

发送消息并流式接收 Agent 响应。**这是核心交互端点。**

**Path Parameters**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | string (UUID) | 是 | 会话 ID |

**Request Body** (Zod: `sendMessageSchema`):
```typescript
{
  content: string         // min 1
  userMessageId?: string  // 可选，用于指定用户消息 ID
  assistantMessageId?: string // 可选，用于指定助手消息 ID
}
```

**Response**: `Content-Type: text/event-stream`
```
data: {"eventId":"...","eventType":"agent.run.start","timestamp":"...","traceId":"...","source":{"service":"core-engine","instanceId":"..."},"payload":{"agentId":"...","agentName":"Frontend Engineer","conversationId":"...","messageId":"..."}}

data: {"eventId":"...","eventType":"message.part.text","timestamp":"...","traceId":"...","source":{...},"payload":{"messageId":"...","content":"好的"}}

data: {"eventId":"...","eventType":"message.part.text","timestamp":"...","traceId":"...","source":{...},"payload":{"messageId":"...","content":"，我来帮你写这个组件"}}

data: {"eventId":"...","eventType":"message.part.tool_use","timestamp":"...","traceId":"...","source":{...},"payload":{"messageId":"...","toolCallId":"call_1","toolName":"fs_write","phase":"start"}}

data: {"eventId":"...","eventType":"message.part.tool_result","timestamp":"...","traceId":"...","source":{...},"payload":{"messageId":"...","toolCallId":"call_1","toolName":"fs_write","result":"File written successfully","isError":false}}

data: {"eventId":"...","eventType":"agent.run.complete","timestamp":"...","traceId":"...","source":{...},"payload":{"agentId":"...","agentName":"Frontend Engineer","conversationId":"...","messageId":"...","usage":{"promptTokens":1234,"completionTokens":567}}}

```

**SSE 流事件序列**:

```
agent.run.start
  ├── message.part.text       (0-N 次，流式文本 delta)
  ├── message.part.thinking   (0-N 次，推理过程 delta，DeepSeek R1)
  ├── message.part.tool_use   (0-N 次，每个工具调用)
  ├── message.part.tool_result (0-N 次，每个工具结果)
  └── agent.run.complete | agent.run.failed | agent.run.aborted
```

**Errors**:
| 状态码 | 响应 |
|--------|------|
| `400` | `{ "error": "Validation failed", "details": [...] }` |
| `404` | `{ "error": "Conversation not found" }` |

**客户端断开**: `request.raw.on('close')` → `AbortController.abort()` → AgentRunner 收到 signal → 停止 LLM 调用 → emit `agent.run.aborted`

---

### 2.9 `GET /api/events` (SSE 全局事件流)

全局 SSE 连接，订阅所有（或按 topic 过滤的）事件。

**Query Parameters**:
| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `topic` | string | `""` (全部) | topic 前缀过滤，如 `?topic=agent.` 仅接收 `agent.*` 事件 |

**Response**: `Content-Type: text/event-stream`
```
data: <JSON EventEnvelope>\n\n
```

**实现**: 订阅 `EventBus` 的 `subscribe(topic)`，每个匹配事件格式化为 SSE `data:` 行。客户端断开时调用 `unsubscribe(topic)` 清理。

---

## 3. 事件

### 3.1 产生的事件

| 事件类型 | 触发时机 | Payload |
|----------|---------|---------|
| `agent.run.start` | AgentRunner 开始执行 | `{ agentId, agentName, conversationId, messageId }` |
| `agent.run.complete` | Agent 正常完成 | `{ agentId, conversationId, messageId, usage: { promptTokens, completionTokens } }` |
| `agent.run.failed` | Agent 执行失败 | `{ agentId, conversationId, messageId, error }` |
| `agent.run.aborted` | 用户取消或超时 | `{ agentId, conversationId, messageId }` |
| `message.created` | 创建新消息 | `{ messageId, role, conversationId }` |
| `message.part.text` | LLM 文本 delta | `{ messageId, content }` |
| `message.part.thinking` | LLM 推理 delta | `{ messageId, content }` |
| `message.part.tool_use` | 工具调用开始 | `{ messageId, toolCallId, toolName, phase: 'start' }` |
| `message.part.tool_result` | 工具执行完成 | `{ messageId, toolCallId, toolName, result, isError }` |
| `message.complete` | 消息流完成 | `{ messageId, conversationId? }` |
| `tool.call` | ToolExecutor 执行前 | `{ toolName, input, conversationId, agentId }` |
| `tool.result` | ToolExecutor 执行后 | `{ toolName, result, isError, conversationId, agentId }` |
| `artifact.created` | write_artifact 创建产物 | `{ artifactId, conversationId, type, title, version }` |
| `artifact.updated` | 产物更新 | `{ artifactId, conversationId, version, changes }` |

### 3.2 消费的事件

当前无跨服务事件消费。M6 计划：
- 从 RabbitMQ 订阅 `skill.invoke` → 检索 Skill 模板
- 从 RabbitMQ 订阅 `knowledge.query` → 触发 RAG 检索

---

## 4. 策略接口

### 4.1 AgentAdapter

**定义位置**: `packages/shared/src/adapter/agent-adapter.interface.ts`

```typescript
interface AgentAdapter {
  readonly name: string;

  streamChat(
    messages: LLMMessage[],
    tools: ToolDefinition[],
    signal: AbortSignal
  ): AsyncGenerator<StreamChunk>;

  buildSystemPrompt(config: AgentConfig): string;
}
```

**默认实现**: `DeepSeekAdapter` — 使用 `openai` SDK 兼容协议，`baseURL: https://api.deepseek.com/v1`
**环境变量**: `AGENT_ADAPTER=deepseek` | `anthropic` | `openai` | `mock`
**StreamChunk 类型**: `text_delta` | `thinking_delta` | `tool_use_start` | `tool_use_delta` | `tool_use_end` | `done`

### 4.2 ExecutionStrategy (M6 计划)

```typescript
interface ExecutionStrategy {
  readonly name: string;
  execute(plan: ExecutionPlan, context: ExecutionContext): AsyncGenerator<ExecutionEvent>;
}
```

**默认实现**: `DAGExecutor` — 拓扑排序 → 波次分组 → 并行执行
**环境变量**: `EXECUTION_STRATEGY=dag` | `sequential` | `parallel`

---

## 5. 内部服务

### 5.1 AgentRunner

核心循环（max 10 tool rounds）:
1. emit `agent.run.start`
2. 构建 LLM 消息（system prompt + history + new user message）
3. 获取工具定义（`ToolExecutor.getDefinitions()`）
4. Loop:
   - `adapter.streamChat(messages, tools, signal)` → yield StreamChunk → emit `message.part.*`
   - 收集 tool_calls
   - `ToolExecutor.execute(name, args, context)` → emit `message.part.tool_result`
   - 将 tool results 追加到消息历史
   - 如果 finishReason === 'stop' → break
5. emit `agent.run.complete` | `agent.run.failed` | `agent.run.aborted`

### 5.2 ToolExecutor

5 个内置工具：
| 工具名 | 说明 | 安全校验 |
|--------|------|---------|
| `write_artifact` | 创建/更新产物 | 路径校验 |
| `fs_read` | 读取工作区文件 | `SecurityService.validatePath()` |
| `fs_write` | 写入工作区文件 | `SecurityService.validatePath()` |
| `bash` | 执行 Bash 命令 | `SecurityService.validateBashCommand()` |
| `ask_user` | 向用户提问 | 无 |

可扩展：`register(tool: ToolRegistration)` 注册自定义工具。

### 5.3 AgentRegistry

`listByCategory` / `listAll` / `getById` / `create` / `search` / `count` — 操作 `agents` 表。

### 5.4 ConversationService

`createConversation` / `getConversation` / `listConversations` / `createMessage` / `getMessages` / `appendPart` / `updateStatus` — 操作 `conversations` + `messages` 表。`appendPart()` 合并连续相同类型的 text/thinking part。

### 5.5 WorkspaceService

`read` / `write` / `exec` — 所有操作经过 `SecurityService` 校验路径和命令安全。通过工厂 `createWorkspaceService(root)` 创建，root 目录为会话沙箱根。

---

## 6. 数据库表

Core Engine 拥有以下表（Drizzle schema 定义在 `packages/shared/src/db/schema.ts`）：

| 表 | 用途 |
|------|------|
| `agents` | Agent 定义（254 内置 + 自定义） |
| `conversations` | 会话元数据 |
| `messages` | 消息及 MessagePart 数组 |
| `artifacts` | Agent 产出的产物（代码/文档/图片） |

详见 [07-database-schema.md](./07-database-schema.md)。

---

## 7. 依赖关系

### 上游依赖

| 包/服务 | 用途 |
|---------|------|
| `@agenthub/shared/adapter` | `AgentAdapter` 接口 + `StreamChunk` 类型 |
| `@agenthub/shared/db` | `Database` 接口 + Repository |
| `@agenthub/shared/event-bus` | `EventBus` 进程内事件分发 |
| `@agenthub/shared/security` | `validatePath` + `validateBashCommand` |
| `@agenthub/shared/server` | `createHealthServer` Fastify 启动器 |
| `@agenthub/shared/logging` | 结构化 Logger |
| `@agenthub/contracts` | `EventEnvelope` + 事件类型常量 |

### 下游消费方

| 服务 | 消费方式 | 状态 |
|------|---------|------|
| Frontend (Next.js) | `POST /api/conversations/:id/messages` SSE + `GET /api/events` SSE | ✅ M3 |
| Observability | `TokenRecorder.record()` / `AuditLogger.log()` (直接调用) | ⚠️ M4 接口就绪，TODO stub 待接线 |
| Knowledge Base | `knowledge.write` / `knowledge.query` 事件 (计划 M6 RabbitMQ) | 🔜 M6 |
| Skill Registry | `skill.invoke` 事件 (计划 M6) | 🔜 M6 |
| MCP Gateway | 工具代理 (计划 M6) | 🔜 M6 |

---

*关联文档: [Event Envelope 协议](./06-event-envelope.md) · [数据库 Schema](./07-database-schema.md) · [架构全景图](../architecture/overview.md)*
