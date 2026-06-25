# AgentHub 数据流与事件协议

**更新日期**: 2026-06-24

---

## 1. 统一契约：Event Envelope

系统各服务之间只通过 Event Envelope 通信。定义在 `packages/contracts/src/event-envelope.ts`。

```typescript
interface EventEnvelope<TEventType extends string = string, TPayload = unknown> {
  eventId: string;       // UUID（crypto.randomUUID()）
  eventType: TEventType; // 如 "agent.run.start", "message.part.text"
  timestamp: string;     // ISO 8601
  traceId: string;       // 全链路追踪 ID
  source: {              // 事件来源
    service: string;     // "core-engine" | "mcp-gateway" | ...
    instanceId: string;  // 实例 ID
  };
  payload: TPayload;     // 由 eventType 决定结构，基类型为 unknown
}
```

**铁律**：
- 各服务之间只通过 Event 通信，不共享数据库
- Event Schema 语言无关，TypeScript 类型在 `@agenthub/contracts` 中定义
- `payload` 基类型为 `unknown`，consumer 按 eventType 窄化校验
- 新增 Adapter 或 UI 组件时不可绕开事件协议

## 2. 事件类型体系

全部 24 个事件类型定义在 `packages/contracts/src/event-types.ts`。

### 2.1 Agent 生命周期

| eventType | 方向 | 触发时机 |
|-----------|------|---------|
| `agent.run.start` | Core → Frontend | AgentRunner 开始执行 |
| `agent.run.complete` | Core → Frontend | Agent 正常完成 |
| `agent.run.failed` | Core → Frontend | Agent 执行失败 |
| `agent.run.aborted` | Core → Frontend | 用户取消或超时中断 |

### 2.2 消息流式传输

| eventType | 方向 | 触发时机 |
|-----------|------|---------|
| `message.created` | Core → Frontend | 新建消息（用户或 Agent） |
| `message.part.text` | Core → Frontend | LLM 流式输出文本 delta |
| `message.part.thinking` | Core → Frontend | LLM 推理过程 delta |
| `message.part.tool_use` | Core → Frontend | Agent 发起工具调用 |
| `message.part.tool_result` | Core → Frontend | 工具执行结果 |
| `message.complete` | Core → Frontend | 消息流完成 |

### 2.3 工具系统

| eventType | 方向 | 触发时机 |
|-----------|------|---------|
| `tool.call` | Core → Core (内部) | ToolExecutor 执行前 |
| `tool.result` | Core → Core (内部) | ToolExecutor 执行后 |

### 2.4 产物生命周期

| eventType | 方向 | 触发时机 |
|-----------|------|---------|
| `artifact.created` | Core → Frontend | write_artifact 工具创建产物 |
| `artifact.updated` | Core → Frontend | 产物版本更新 |

### 2.5 知识/Skill/审计

| eventType | 方向 | 触发时机 |
|-----------|------|---------|
| `knowledge.write` | Core → Knowledge Base | Agent 产出知识写入 |
| `knowledge.query` | Core → Knowledge Base | Agent 检索知识 |
| `skill.invoke` | Core → Skill Registry | Skill 模板被调用 |
| `audit.log` | * → Observability | 审计日志写入 |

### 2.6 系统

| eventType | 方向 | 触发时机 |
|-----------|------|---------|
| `system.heartbeat` | * → Observability | 服务心跳 |

## 3. 通信模式

### 3.1 SSE 实时流（前端 ↔ Core Engine）

```
Frontend                          Core Engine
   │                                   │
   │── GET /api/events?topic=agent. ──→│  建立 SSE 长连接
   │←── data: {eventType:"agent.run.start",...} ──│
   │←── data: {eventType:"message.part.text",...} ──│
   │←── data: {eventType:"tool.call",...} ──│
   │←── data: {eventType:"message.part.tool_result",...} ──│
   │←── data: {eventType:"agent.run.complete",...} ──│
   │                                   │
```

- 单条全局 SSE 连接：`GET /api/events`
- 可选 topic 过滤：`?topic=agent.` 仅接收 agent.* 事件
- Content-Type: `text/event-stream`
- 每行格式: `data: <JSON EventEnvelope>\n\n`

### 3.2 REST 同步调用

```
Frontend                          Core Engine
   │                                   │
   │── POST /api/conversations ──────→│  创建会话
   │←── {id, title, mode, agentIds} ──│
   │                                   │
   │── POST /api/conversations/:id/messages →│  发送消息
   │←── SSE stream (见上) ────────────│  流式响应
   │                                   │
   │── GET /api/agents?category=eng ──→│  查询 Agent 列表
   │←── [{id, name, emoji,...}] ──────│
```

### 3.3 RabbitMQ 异步消息（跨服务削峰，M4+）

```
Core Engine ──[knowledge.write]──→ RabbitMQ ──→ Knowledge Base → PostgreSQL
Core Engine ──[audit.log]────────→ RabbitMQ ──→ Observability → PostgreSQL
```

## 4. 数据流：单 Agent 对话（M2 核心流程）

```
1. 用户发消息 "帮我写一个 React 组件"
        │
2. Frontend ── POST /api/conversations/:id/messages ──→ Core Engine
        │
3. ConversationService.createMessage(role:'user') → DB messages
        │
4. AgentRunner.run(agentConfig, messages, tools, signal)
        │
5. emit agent.run.start
        │
6. adapter.streamChat(messages, tools, signal)
        │  └── fetch('https://api.deepseek.com/v1/chat/completions', {stream:true})
        │       │
        │       ├── emit message.part.text ("我来帮你写一个...")
        │       ├── emit message.part.thinking ("需要先确认组件需求...")
        │       ├── emit message.part.tool_use (tool: fs_write, args: {path, content})
        │       │       │
        │       │       ├── ToolExecutor.execute('fs_write', args, context)
        │       │       │      ├── SecurityService.validatePath(path, workspaceRoot) → allowed
        │       │       │      └── WorkspaceService.write(path, content)
        │       │       │
        │       │       └── emit message.part.tool_result (success)
        │       │
        │       └── emit done (finishReason: "stop")
        │
7. emit agent.run.complete
        │
8. SSE 推送所有 EventEnvelope 到 Frontend
        │
9. Frontend 渲染 MessagePart 流（text/thinking/tool_use/tool_result/artifact_ref）
```

## 5. EventBus 架构（M2 实现）

```
                EventBus (HMR-safe singleton, globalThis)
               ┌──────────────────────────────────────┐
               │  subscribers: Map<topic, queue[]>     │
               │                                       │
emit(event) ──→│  遍历 subscribers                     │
               │  匹配 topic 前缀                      │
               │  推入匹配的 queue                      │
               │                                       │
subscribe(topic) ──→ 创建 queue ──→ AsyncGenerator    │
               │                                       │
unsubscribe(topic) ──→ 删除 queue                     │
               └──────────────────────────────────────┘
```

HMR 安全：使用 `Symbol.for('agenthub.eventbus')` 作为 `globalThis` 上的 key，确保模块热重载时引用同一个实例。

---

*配套文档：[overview.md](overview.md) · [ADR-001 M1 实施计划](../decisions/001-m1-implementation-plan.md)*
