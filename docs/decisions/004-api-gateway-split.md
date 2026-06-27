# ADR-004: API Gateway 拆分 + Event 持久化

**日期**: 2026-06-27
**状态**: Proposed
**决策者**: Chance（基于软件架构师审查 R3、R4、R2 的建议）
**前置**: M6 完成，ADR-003

---

## Context

2026-06-27 架构审查识别出三个结构性问题：

1. **Core Engine 是上帝服务** — 单个 Fastify 实例承载了 10+ 关注点：HTTP 路由、认证中间件、速率限制、SSE 传输、AgentRunner、ToolExecutor、Orchestrator、ConversationService、WorkspaceService、AgentRegistry、EventBus/EventBridge、可观测性。这与服务拓扑文档中定义的 "API Gateway → Core Engine" 分层不一致。

2. **EventBridge 静默丢弃事件** — 内存 EventBus + EventBridge 模式在 RabbitMQ 发布失败时静默丢弃事件（R2 已修复为结构化日志，但事件仍不可恢复）。缺少持久化 EventBus 作为可替换策略。

3. **认证中间件耦合 Fastify** — 认证策略本身已是框架无关的（在 `packages/shared/auth/` 中），但中间件注册钩子（`registerAuthMiddleware`）在 Core Engine 内部，与 Fastify 强耦合。

ADR-003 明确将 API Gateway 提取推迟到 M6 之后："与 API Gateway 同进程，M6 不拆独立 Gateway"。

---

## Decision

### Decision 1: 反向代理网关模式（Option B）

新建 `services/api-gateway/` 作为独立 Fastify 服务，采用**反向代理**模式：

```
浏览器 / 客户端
    │
    ▼
┌─────────────────────────────────────┐
│ API Gateway (:3000)                  │
│  ├── CORS (Fastify hook)             │
│  ├── Auth 中间件 (preHandler hook)   │
│  ├── RateLimit 中间件 (preHandler)   │
│  └── Proxy → Core Engine (:3001)     │
│       /api/* → http://core-engine:3001│
│       /health → local                │
└─────────────────────────────────────┘
    │ HTTP (internal network)
    ▼
┌─────────────────────────────────────┐
│ Core Engine (:3001, internal)        │
│  ├── Routes (agents, conversations,  │
│  │         orchestrator, events)     │
│  ├── SSE Transport                   │
│  ├── AgentRunner, ToolExecutor       │
│  ├── Orchestrator                    │
│  ├── SafetyNet (RateLimit+CostGuard  │
│  │            +CircuitBreaker)       │
│  ├── EventBus / EventBridge          │
│  └── DB, Adapters, Workspace         │
└─────────────────────────────────────┘
```

**选择理由**：
- **最小改动**：Core Engine 路由和传输策略（SSE、StreamableHTTP）保持不动
- **关注点分离**：网关处理横切 HTTP 关注点（CORS、Auth、RateLimit）；Core Engine 处理业务逻辑
- **可逆**：`AUTH_GATEWAY_MODE=standalone` 保留 Core Engine 独立运行模式，开发时不依赖网关
- **独立伸缩**：网关可水平扩展（无状态），Core Engine 按需扩展

**不选择的方案**：
- Option A（网关+Controller+RPC）：需要大幅改造路由处理程序，风险高
- Option C（共享传输层在 packages/shared）：不解决 Core Engine 上帝服务问题

### Decision 2: PersistentEventBus 策略

在 `packages/shared/src/event-bus/` 新增 `PersistentEventBus` 实现：

```
EventBus 接口
    ├── EventBusImpl (内存，默认) —— 当前实现
    └── PersistentEventBus (新增) —— 写入 PostgreSQL events 表
```

- 与内存 EventBus 同接口，`EVENT_BUS_BACKEND=memory|postgres` 切换
- PersistentEventBus 在投递给订阅者前先写入 `events` 表
- EventBridge 从持久存储读取事件发布到 RabbitMQ（消除静默丢弃的根因）
- 生产环境推荐 `postgres`，开发/测试默认 `memory`

### Decision 3: 网关运行模式

Core Engine 新增 `AUTH_GATEWAY_MODE` 环境变量：

| 值 | 行为 | 使用场景 |
|----|------|---------|
| `standalone` | Core Engine 注册自己的 auth 中间件 | 本地开发，不启动网关 |
| `behind-proxy` | Core Engine 跳过 auth 中间件 | Docker Compose / 生产 |

---

## Consequences

### 获得的
- Core Engine 职责减少：不再管理 CORS、不再执行 HTTP 级认证
- 认证在 HTTP 边缘统一处理，避免重复
- 网关无状态，可独立水平扩展
- 框架无关的认证策略保持可复用
- 开发模式不受影响（standalone 模式）
- PersistentEventBus 使事件在重启后仍可恢复

### 牺牲的
- 新增 `services/api-gateway/` 需要维护（多一个服务）
- 请求多一跳网络延迟（~1ms 内网）
- SSE 代理需要验证正确性（流式传输穿透代理）
- 运维复杂度：多一个进程/容器

### 风险
- SSE 代理可能截断或延迟流帧 → 缓解：集成测试验证；standalone 模式可供回退
- 网关成为单点故障 → 缓解：网关无状态，可部署多副本
- PersistentEventBus 增加 DB 写入 → 缓解：异步批量写入；仅生产环境启用

### 迁移路径
1. `AUTH_GATEWAY_MODE` 默认 `standalone`（零行为变更）
2. Docker Compose 中设置 `AUTH_GATEWAY_MODE=behind-proxy`
3. 生产部署时启动 api-gateway 服务

---

## 相关
- ADR-003: 明确将网关提取推迟到 M6 后
- 架构审查报告 2026-06-27 (R2, R3, R4)
- `CLAUDE.md` 架构核心原则 §3.2 服务拓扑
