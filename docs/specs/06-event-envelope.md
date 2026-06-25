# Event Envelope 协议规格

**定义位置**: `packages/contracts/src/`
**协议版本**: 1.0
**状态**: M2 实现 — 24 个事件类型 + SSE/EventBus 传输

---

## 1. 概述

Event Envelope 是 AgentHub 所有服务之间通信的**唯一协议**。各服务不共享数据库、不引入编译时类型依赖，只通过 Event Envelope 交换信息。

**铁律**:
- 服务间只通过 Event 通信
- Event Schema 语言无关（JSON Schema），TypeScript 类型为参考实现
- `payload` 基类型为 `unknown`，consumer 按 `eventType` 窄化校验
- 新增 Adapter 或 UI 组件不可绕开事件协议

---

## 2. EventEnvelope 结构

```typescript
interface EventEnvelope<TEventType extends string = string, TPayload = unknown> {
  eventId: string;       // UUID v4（crypto.randomUUID()）
  eventType: TEventType; // 事件类型，如 "agent.run.start"
  timestamp: string;     // ISO 8601 格式
  traceId: string;       // 全链路追踪 ID（UUID），贯穿整个请求生命周期
  source: EventSource;   // 事件来源
  payload: TPayload;     // 事件负载，按 eventType 定义结构
}

interface EventSource {
  service: string;       // 服务名: "core-engine" | "mcp-gateway" | "skill-registry" | "knowledge-base" | "observability"
  instanceId: string;    // 实例标识（容器 hostname 或进程 ID）
}
```

### 2.1 Zod 校验

```typescript
const EventSourceSchema = z.object({
  service: z.string().min(1),
  instanceId: z.string().min(1),
});

const EventEnvelopeSchema = z.object({
  eventId: z.string().uuid(),
  eventType: z.string().min(1),  // consumer 负责窄化校验，此处不做枚举限制
  timestamp: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/),
  traceId: z.string().min(1),
  source: EventSourceSchema,
  payload: z.unknown().nullable(),
});
```

**设计决策**: 基 Schema 不校验 `eventType` 枚举值（开放-封闭原则）。Consumer 在收到事件后按需窄化校验。

### 2.2 工厂函数

```typescript
function createEventEnvelope<TEventType, TPayload>(
  eventType: TEventType,
  payload: TPayload,
  source: EventSource,
  traceId?: string
): EventEnvelope<TEventType, TPayload>
```

- `eventId`: 自动生成 UUID v4
- `traceId`: 未提供时自动生成 UUID，贯穿整个请求链
- `timestamp`: 自动设为当前 ISO 8601 时间

---

## 3. 事件类型全集（24 个）

定义在 `packages/contracts/src/event-types.ts`。分为 8 大类。

### 3.1 Agent 生命周期（4）

| eventType | 常量名 | Payload | 方向 |
|-----------|--------|---------|------|
| `agent.run.start` | `AGENT_RUN_START` | `{ agentId: string, agentName: string, conversationId: string, messageId: string }` | Core → Frontend |
| `agent.run.complete` | `AGENT_RUN_COMPLETE` | `{ agentId: string, conversationId: string, messageId: string, usage: { promptTokens: number, completionTokens: number } }` | Core → Frontend |
| `agent.run.failed` | `AGENT_RUN_FAILED` | `{ agentId: string, conversationId: string, messageId: string, error: string }` | Core → Frontend |
| `agent.run.aborted` | `AGENT_RUN_ABORTED` | `{ agentId: string, conversationId: string, messageId: string }` | Core → Frontend |

### 3.2 消息流式传输（6）

| eventType | 常量名 | Payload | 方向 |
|-----------|--------|---------|------|
| `message.created` | `MESSAGE_CREATED` | `{ messageId: string, role: 'user'\|'assistant'\|'system', conversationId: string }` | Core → Frontend |
| `message.part.text` | `MESSAGE_PART_TEXT` | `{ messageId: string, content: string }` (文本 delta) | Core → Frontend |
| `message.part.thinking` | `MESSAGE_PART_THINKING` | `{ messageId: string, content: string }` (推理 delta) | Core → Frontend |
| `message.part.tool_use` | `MESSAGE_PART_TOOL_USE` | `{ messageId: string, toolCallId: string, toolName: string, phase: 'start' \| 'end', input?: Record<string, unknown> }` | Core → Frontend |
| `message.part.tool_result` | `MESSAGE_PART_TOOL_RESULT` | `{ messageId: string, toolCallId: string, toolName: string, result: unknown, isError: boolean }` | Core → Frontend |
| `message.complete` | `MESSAGE_COMPLETE` | `{ messageId: string, conversationId?: string }` | Core → Frontend |

**流式合并规则**: 连续的 `message.part.text` delta 在 Consumer 端合并为单个 `MessagePart`（type: `text`）。连续 `message.part.thinking` delta 同理合并。

### 3.3 工具系统（2）

| eventType | 常量名 | Payload | 方向 |
|-----------|--------|---------|------|
| `tool.call` | `TOOL_CALL` | `{ toolName: string, input: Record<string, unknown>, conversationId: string, agentId: string }` | Core → Core (内部) |
| `tool.result` | `TOOL_RESULT` | `{ toolName: string, result: unknown, isError: boolean, conversationId: string, agentId: string }` | Core → Core (内部) |

### 3.4 产物生命周期（2）

| eventType | 常量名 | Payload | 方向 |
|-----------|--------|---------|------|
| `artifact.created` | `ARTIFACT_CREATED` | `{ artifactId: string, conversationId: string, type: 'web_app'\|'document'\|'code'\|'image', title: string, version: number }` | Core → Frontend |
| `artifact.updated` | `ARTIFACT_UPDATED` | `{ artifactId: string, conversationId: string, version: number, changes: Record<string, unknown> }` | Core → Frontend |

### 3.5 知识（2）

| eventType | 常量名 | Payload | 方向 |
|-----------|--------|---------|------|
| `knowledge.write` | `KNOWLEDGE_WRITE` | `{ content: string, metadata?: Record<string, unknown>, source?: string, conversationId?: string }` | Core → KB |
| `knowledge.query` | `KNOWLEDGE_QUERY` | `{ query: string, topK?: number, threshold?: number, filters?: Record<string, unknown> }` | Core → KB |

### 3.6 Skill（1）

| eventType | 常量名 | Payload | 方向 |
|-----------|--------|---------|------|
| `skill.invoke` | `SKILL_INVOKE` | `{ skillId: string, skillName: string, version: string, parameters: Record<string, unknown>, conversationId: string, agentId: string }` | Core → Skill Registry |

### 3.7 审计（1）

| eventType | 常量名 | Payload | 方向 |
|-----------|--------|---------|------|
| `audit.log` | `AUDIT_LOG` | `{ entryType: string, payload: Record<string, unknown>, service: string }` | * → Observability |

### 3.8 系统（1）

| eventType | 常量名 | Payload | 方向 |
|-----------|--------|---------|------|
| `system.heartbeat` | `SYSTEM_HEARTBEAT` | `{ service: string, status: string, uptime: number }` | * → Observability |

### 3.9 M6 计划新增 — Orchestrator 事件

| eventType (计划) | Payload | 说明 |
|-----------------|---------|------|
| `orchestrator.plan.start` | `{ conversationId, goal, agentCount }` | 开始规划任务 DAG |
| `orchestrator.plan.complete` | `{ plan: ExecutionPlan }` | DAG 规划完成 |
| `orchestrator.task.start` | `{ taskId, agentId }` | 子任务开始执行 |
| `orchestrator.task.complete` | `{ taskId, result: TaskResult }` | 子任务完成 |
| `orchestrator.task.failed` | `{ taskId, error }` | 子任务失败 |
| `orchestrator.aggregate.complete` | `{ conversationId, summary }` | 结果聚合完成 |

---

## 4. 通信模式

### 4.1 SSE 实时流（Frontend ↔ Core Engine）

```
GET /api/events?topic=agent.
→ Content-Type: text/event-stream
→ data: <JSON EventEnvelope>\n\n
```

- 单条全局连接
- 可选 topic 前缀过滤
- 客户端断开时自动清理订阅

### 4.2 EventBus 进程内（Core Engine 内部）

```
EventBus (HMR-safe singleton, globalThis)
  emit(envelope) → 遍历 subscribers → 匹配 topic 前缀 → 推入 queue
  subscribe(topicPrefix) → 创建 queue → 返回 AsyncGenerator
  unsubscribe(topicPrefix) → 删除 queue
```

- HMR 安全: `Symbol.for('agenthub.eventbus')` 作为 `globalThis` key
- 进程内零序列化开销

### 4.3 RabbitMQ 跨服务（M6 计划）

```
                          RabbitMQ
                    agenthub.events (topic exchange)
                   /        |         \
          knowledge.*    audit.*    agent.*
              ↓            ↓           ↓
        KB Queue      Obs Queue   (future consumers)
```

- Topic Exchange: `agenthub.events`
- Routing Key: `event.eventType` (如 `knowledge.write`)
- 持久化消息 + Ack/Nack
- DLQ: `agenthub.events.dlq`

---

## 5. SSE 线格式

```
data: {"eventId":"...","eventType":"agent.run.start","timestamp":"...","traceId":"...","source":{"service":"core-engine","instanceId":"..."},"payload":{...}}

```

- 每行以 `data: ` 开头
- 后跟 JSON EventEnvelope（单行，无格式化空格）
- 每个事件以 `\n\n` 结尾
- Content-Type: `text/event-stream`
- Cache-Control: `no-cache`
- Connection: `keep-alive`

---

## 6. 事件分组合集

```typescript
const AGENT_EVENTS = ['agent.run.start', 'agent.run.complete', 'agent.run.failed', 'agent.run.aborted'];
const MESSAGE_EVENTS = ['message.created', 'message.part.text', 'message.part.thinking', 'message.part.tool_use', 'message.part.tool_result', 'message.complete'];
const TOOL_EVENTS = ['tool.call', 'tool.result'];
const ARTIFACT_EVENTS = ['artifact.created', 'artifact.updated'];
const KNOWLEDGE_EVENTS = ['knowledge.write', 'knowledge.query'];
const SKILL_EVENTS = ['skill.invoke'];
const AUDIT_EVENTS = ['audit.log'];
const SYSTEM_EVENTS = ['system.heartbeat'];
```

用于 topic 订阅时的前缀匹配。订阅 `agent.` 可接收全部 4 个 `agent.run.*` 事件。

---

*关联文档: [Core Engine 规格](./01-core-engine.md) · [Knowledge Base 规格](./04-knowledge-base.md) · [架构全景图](../architecture/overview.md) · [数据流](../architecture/data-flow.md)*
