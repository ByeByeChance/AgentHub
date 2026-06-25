# ADR-003: M6 实施计划 — 策略完备 + 可靠性栈 + 跨服务集成

**日期**: 2026-06-25
**状态**: ✅ 已完成 (2026-06-25)
**决策者**: Chance
**前置**: M1-M5 全部完成

---

## Context

M1-M5 已交付完整的单 Agent 对话系统（Core Engine + 4 外围服务 + 前端三栏 UI）。M6 是架构定义的"收尾里程碑"——补完剩余的 4 个策略接口，实现可靠性栈顶层（层5-6），并打通跨服务 RabbitMQ 异步消息。

当前 `docs/architecture/overview.md` 标记以下为"未完成"状态：
- `QueueBackend` → `rabbitmq`
- `ExecutionStrategy` → `dag`
- `TransportStrategy` → `sse`
- `AuthStrategy` → `api-key`
- 层5：多点协作互相纠错
- 层6：接受失败建立安全网
- 跨服务 RabbitMQ 集成
- TokenRecorder/AuditLogger 接线（TODO stub）

---

## 关键架构决策

| 决策 | 结论 | 理由 |
|------|------|------|
| **QueueBackend 协议** | AMQP 0-9-1，Topic Exchange `agenthub.events`，Routing Key = `eventType` | RabbitMQ 已在 docker-compose 中运行，Topic Exchange 天然支持事件前缀路由 |
| **ExecutionStrategy 设计** | `TaskNode` DAG 节点 + `dependsOn` 声明式依赖 + 拓扑排序自动波次分组 | 声明式 DAG 比命令式调度更易验证和可视化 |
| **Orchestrator 分步设计** | `createPlan(LLM)` → `executePlan(DAG)` → `aggregateResults(LLM)` 三阶段 | 每阶段独立可测、独立可替换 |
| **Auth 放置位置** | Core Engine Fastify 中间件层（`preHandler` hook） | 与 API Gateway 同进程，M6 不拆独立 Gateway |
| **断路器实现** | 独立类 `CircuitBreaker`，不依赖外部库 | 策略模式要求插拔式，标准状态机足够 |
| **交叉审查共识** | 可配置 `majority_vote` / `unanimous` / `threshold` | 不同场景需要不同严格级别 |
| **新增依赖** | `amqplib` (RabbitMQ client) | 仅此一个新增依赖 |

---

## 实施步骤

### Phase 1: 基础设施（Track A + B 并行，预计 2 天）

#### Step A1: QueueBackend Interface + RabbitMQ 实现

**依赖**: 无

**新增文件**:
```
packages/shared/src/queue/
  interfaces/queue-backend.interface.ts   # QueueBackend 接口
  rabbitmq-backend.ts                      # RabbitMQ 实现（amqplib）
  mock-queue-backend.ts                    # Mock 实现（测试用）
  factory.ts                               # createQueueBackend(url)
  index.ts                                 # barrel export
packages/shared/src/__tests__/queue/
  queue-backend.test.ts                    # 测试
```

**接口**:
```typescript
interface QueueBackend {
  readonly name: string;
  publish(exchange: string, routingKey: string, message: unknown): Promise<void>;
  subscribe(exchange: string, queue: string, bindingKey: string,
    handler: (msg: unknown, ack: () => Promise<void>, nack: (requeue?: boolean) => Promise<void>) => Promise<void>
  ): Promise<void>;
  close(): Promise<void>;
}
```

**验收**:
- `createQueueBackend('amqp://localhost:5672')` 工厂返回 `RabbitMQBackend`
- `publish` → `subscribe` 端到端消息传递
- `MockQueueBackend` 记录发布历史供测试断言

#### Step A3: AuthStrategy Interface + APIKey 实现

**依赖**: 无

**新增文件**:
```
packages/shared/src/auth/
  interfaces/auth-strategy.interface.ts    # AuthStrategy + AuthResult 类型
  index.ts
services/core-engine/src/auth/
  api-key-strategy.ts                      # APIKeyStrategy
  noop-auth-strategy.ts                    # NoopAuthStrategy
  factory.ts                               # createAuthStrategy()
  middleware.ts                            # Fastify preHandler hook
  index.ts
services/core-engine/src/__tests__/auth/
  api-key-strategy.test.ts
  middleware.test.ts
```

**验收**:
- `Authorization: Bearer <valid-key>` 返回 `{ authenticated: true, identity }`
- 无头/错 key 返回 401
- `AUTH_STRATEGY=noop` 禁用认证（开发模式）

#### Step B1: CircuitBreaker

**依赖**: 无

**新增文件**:
```
packages/shared/src/reliability/
  circuit-breaker.ts                       # CircuitBreaker 类
packages/shared/src/__tests__/reliability/
  circuit-breaker.test.ts                  # 状态机测试
```

**验收**:
- CLOSED → OPEN（5 次连续失败）→ HALF_OPEN（超时后）→ CLOSED（成功）
- OPEN 状态快速失败
- `halfOpenMaxRequests` 限制并发探测

---

### Phase 2: 核心抽象（预计 3 天）

#### Step A2: TransportStrategy Interface + SSE/HTTP 实现

**新增文件**:
```
packages/shared/src/transport/
  interfaces/transport-strategy.interface.ts
  index.ts
services/core-engine/src/transport/
  sse-transport.ts                         # 提取现有 SSE 逻辑
  streamable-http-transport.ts             # chunked JSON lines
  factory.ts
  index.ts
services/core-engine/src/__tests__/transport/
  sse-transport.test.ts
```

**修改**: `routes/conversations.ts` + `routes/events.ts` → 注入 `TransportStrategy`

#### Step A4: ExecutionStrategy Interface + DAG/Sequential/Parallel 实现

**新增文件**:
```
packages/shared/src/execution/
  interfaces/execution-strategy.interface.ts  # TaskNode, TaskResult, ExecutionPlan, ExecutionStrategy
  index.ts
services/core-engine/src/execution/
  dag-executor.ts                              # DAGExecutor
  sequential-executor.ts                       # SequentialExecutor
  parallel-executor.ts                         # ParallelExecutor
  factory.ts
  index.ts
services/core-engine/src/__tests__/execution/
  dag-executor.test.ts                         # 钻石图、循环检测、abort 传播、结果注入
  strategy-factory.test.ts
```

**验收**:
- 钻石依赖图 A→[B,C]→D: B/C 并行执行，D 等待两者完成后执行
- 循环检测: `dependsOn` 成环时抛出
- Abort 传播: 一个任务 abort → 所有兄弟/后代 abort
- `maxConcurrent` 并发控制

#### Step B2: RateLimiter

**新增文件**:
```
packages/shared/src/reliability/rate-limiter.ts     # Token Bucket
packages/shared/src/__tests__/reliability/rate-limiter.test.ts
```

#### Step B3: CostGuard

**新增文件**:
```
packages/shared/src/reliability/cost-guard.ts
packages/shared/src/__tests__/reliability/cost-guard.test.ts
```

**修改**: `agent-runner.ts` → 每轮 LLM 调用前 `costGuard.check()`

---

### Phase 3: 集成（预计 2 天）

#### Step C1: 接线 TokenRecorder + AuditLogger

**修改**: `services/core-engine/src/index.ts` → 消除 TODO stub，创建实例注入 `AgentRunInput`

#### Step C2: EventBridge (EventBus → RabbitMQ)

**新增文件**:
```
packages/shared/src/event-bus/event-bridge.ts
packages/shared/src/__tests__/event-bus/event-bridge.test.ts
```

#### Step B4: DeadLetterQueue

**新增文件**:
```
packages/shared/src/reliability/dead-letter.ts
packages/shared/src/__tests__/reliability/dead-letter.test.ts
```

#### Step C3 + C4: Knowledge Base + Observability RabbitMQ Consumers

**修改**: `services/knowledge-base/src/index.ts` → 订阅 `knowledge.*`
**修改**: `services/observability/src/index.ts` → 订阅 `audit.*`

---

### Phase 4: Orchestrator + 可靠性层5-6（预计 3 天）

#### Step A5: Orchestrator

**新增文件**:
```
services/core-engine/src/orchestrator/
  orchestrator.ts              # createPlan → executePlan → aggregateResults
  plan-parser.ts               # Zod 校验 LLM 输出的 ExecutionPlan
  index.ts
services/core-engine/src/__tests__/orchestrator/
  orchestrator.test.ts
```

**新增 endpoint**: `POST /api/conversations/:id/execute` — 支持 `mode: 'dag'` 模式

**新增事件类型**: `orchestrator.plan.start/complete`, `orchestrator.task.*`, `orchestrator.aggregate.complete`

#### Step B5: Layer 5 — CrossReview

**新增文件**:
```
services/core-engine/src/reliability/cross-review.ts
services/core-engine/src/__tests__/reliability/cross-review.test.ts
```

**共识机制**: `majority_vote` / `unanimous` / `threshold` — 可配置。最多 3 轮 auto-fix 重试。

#### Step B6: Layer 6 — SafetyNet

**新增文件**:
```
services/core-engine/src/reliability/safety-net.ts
services/core-engine/src/__tests__/reliability/safety-net.test.ts
```

**门控顺序**: RateLimit (429) → CostGuard (402) → CircuitBreaker (503) → AgentRun

---

### Phase 5: 收尾（预计 1 天）

- 新增 13 个环境变量到 `.env.example`
- 更新 `docker-compose.yml`（如需 RabbitMQ 配置调整）
- 更新 `docs/architecture/overview.md`（标记 M6 完成状态）
- 全量 `pnpm typecheck` + `pnpm test` + `pnpm test:coverage`
- 移除所有 `console.log` / `any` / `TODO`

---

## 环境变量新增

```bash
# M6 Strategy Selection
QUEUE_BACKEND=rabbitmq           # rabbitmq | redis | nats | mock
TRANSPORT_STRATEGY=sse           # sse | streamable-http
AUTH_STRATEGY=api-key            # api-key | oauth2 | mtls | noop
EXECUTION_STRATEGY=dag           # dag | sequential | parallel

# M6 Auth
AGENTHUB_API_KEYS=

# M6 Reliability
CIRCUIT_BREAKER_FAILURE_THRESHOLD=5
CIRCUIT_BREAKER_RESET_TIMEOUT_MS=30000
RATE_LIMIT_TOKENS_PER_INTERVAL=100
RATE_LIMIT_INTERVAL_SECONDS=60
MAX_TOKENS_PER_RUN=100000
MAX_COST_PER_SESSION=5.00
MAX_DAILY_COST=50.00
CROSS_REVIEW_CONSENSUS=majority_vote
CROSS_REVIEW_MAX_ROUNDS=3
```

---

## 新增依赖

```json
// packages/shared/package.json
"amqplib": "^0.10.0",
"@types/amqplib": "^0.10.0"
```

---

## M6 验收标准

- [ ] `EXECUTION_STRATEGY=dag` — 钻石依赖图 A→[B,C]→D 正确并行执行
- [ ] `AUTH_STRATEGY=api-key` — 未认证请求拒绝 401
- [ ] `QUEUE_BACKEND=rabbitmq` — 事件从 Core Engine 发布到 RabbitMQ，KB 消费 `knowledge.write`
- [ ] TransportStrategy — SSE 和 Streamable HTTP 均可切换
- [ ] CircuitBreaker — 5 次失败后 OPEN，超时后 HALF_OPEN
- [ ] CostGuard — 超 `MAX_TOKENS_PER_RUN` 时中止 AgentRun
- [ ] CrossReview — 3 reviewer majority_vote 产出聚合 verdict
- [ ] SafetyNet — 有序门控（限流→成本→断路器→执行）
- [ ] TokenRecorder + AuditLogger 不再 TODO stub
- [ ] `pnpm typecheck` 全仓库通过（7/7）
- [ ] `pnpm test` 全部通过（预计新增 ~20 个测试文件）
- [ ] `pnpm test:coverage` shared ≥95%, core-engine ≥85%, 其他模块 ≥80%
- [ ] `docker compose up` 全部 8 服务 /health 200
- [ ] 零 `console.log` / `any` / `// TODO` 遗留

---

## 文件变更预估

| 类别 | 新增文件数 |
|------|-----------|
| `packages/shared/src/queue/` | 5 |
| `packages/shared/src/auth/` | 2 |
| `packages/shared/src/transport/` | 2 |
| `packages/shared/src/execution/` | 2 |
| `packages/shared/src/reliability/` | 5 |
| `services/core-engine/src/auth/` | 5 |
| `services/core-engine/src/transport/` | 4 |
| `services/core-engine/src/execution/` | 5 |
| `services/core-engine/src/orchestrator/` | 3 |
| `services/core-engine/src/reliability/` | 3 |
| 测试文件 | ~20 |
| **合计** | **~56** |

---

*前置 ADR: [001 M1 实施计划](./001-m1-implementation-plan.md) · [002 M2 Core Engine 计划](./002-m2-core-engine-plan.md)*
*关联文档: [架构全景图](../architecture/overview.md) · [服务 Specs](../specs/)*
