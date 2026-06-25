# 2026-06-25 会话总结

## 一、补完 `docs/specs/`

之前目录为空，本次写入 7 个服务接口规格：

| 文件 | 内容 |
|------|------|
| `docs/specs/01-core-engine.md` | 9 个端点（8 REST + 2 SSE 流）、AgentAdapter 接口、5 个内部服务类、14 个事件类型 |
| `docs/specs/02-mcp-gateway.md` | JSON-RPC 2.0 端点 + 4 个方法（initialize/tools/list/tools/call/ping）、AuthStrategy/RateLimitStrategy、Tool Registry |
| `docs/specs/03-skill-registry.md` | 6 个 REST 端点 + Zod Schema、semver 版本管理、自定义错误、内置 code-reviewer |
| `docs/specs/04-knowledge-base.md` | 9 个端点（文档 CRUD + 三层记忆 L1/L2/L3）、Embedding/Chunking/VectorStore 策略接口 |
| `docs/specs/05-observability.md` | 5 个端点、TokenRecorder/AuditLogger、SHA-256 链式审计、模型定价表 |
| `docs/specs/06-event-envelope.md` | EventEnvelope 协议 + 24 个事件类型完整 Payload + SSE/EventBus/RabbitMQ 三种通信模式 |
| `docs/specs/07-database-schema.md` | 9 张表完整 DDL + Repository 接口 + 关系图 |

## 二、ADR-003 M6 实施计划

`docs/decisions/003-m6-implementation-plan.md` — 13 Steps × 5 Phases 完整计划。

## 三、M6 Phase 1 实现（3 模块）

### A1: QueueBackend
```
packages/shared/src/queue/
  interfaces/queue-backend.interface.ts   → QueueBackend + MessageHandler
  mock-queue-backend.ts                   → MockQueueBackend
  rabbitmq-backend.ts                     → RabbitMQBackend (amqplib)
  factory.ts                              → createQueueBackend(env)
  index.ts
  __tests__/queue/queue-backend.test.ts   → 10 tests
```

### A3: AuthStrategy
```
packages/shared/src/auth/
  interfaces/auth-strategy.interface.ts   → AuthStrategy + AuthRequest + AuthResult
  api-key-strategy.ts                     → APIKeyStrategy (Authorization: Bearer)
  noop-auth-strategy.ts                   → NoopAuthStrategy
  factory.ts                              → createAuthStrategy(env)
  index.ts
  __tests__/auth/auth-strategy.test.ts    → 16 tests

services/core-engine/src/auth/
  middleware.ts                           → registerAuthMiddleware (Fastify preHandler)
  index.ts
  __tests__/auth/middleware.test.ts       → 8 tests
```
已接入 `services/core-engine/src/index.ts`。

### B1: CircuitBreaker
```
packages/shared/src/reliability/
  circuit-breaker.ts                      → CLOSED→OPEN→HALF_OPEN 状态机 + 事件 + CircuitBreakerOpenError
  __tests__/reliability/circuit-breaker.test.ts → 17 tests
```

## 四、M6 Phase 2 实现（4 模块）

### A2: TransportStrategy
```
packages/shared/src/transport/
  interfaces/transport-strategy.interface.ts → TransportStrategy + TransportReply
  index.ts

services/core-engine/src/transport/
  sse-transport.ts                        → SSETransport (text/event-stream)
  streamable-http-transport.ts            → StreamableHTTPTransport (application/x-ndjson)
  factory.ts                              → createTransport(env)
  index.ts
  __tests__/transport/sse-transport.test.ts → 11 tests
```

### A4: ExecutionStrategy
```
packages/shared/src/execution/
  interfaces/execution-strategy.interface.ts → ExecutionStrategy + TaskNode + TaskResult + ExecutionPlan + ExecutionEvent
  index.ts

services/core-engine/src/execution/
  dag-executor.ts                         → DAGExecutor (拓扑排序→波次分组→并行执行)
  sequential-executor.ts                  → SequentialExecutor
  parallel-executor.ts                    → ParallelExecutor
  factory.ts                              → createExecutionStrategy(env)
  index.ts
  __tests__/execution/dag-executor.test.ts → 13 tests
```

### B2: RateLimiter
```
packages/shared/src/reliability/
  rate-limiter.ts                         → Token Bucket 算法 + 独立 key + 自动 refill
  __tests__/reliability/rate-limiter.test.ts → 9 tests
```

### B3: CostGuard
```
packages/shared/src/reliability/
  cost-guard.ts                           → per-run / per-session / per-day 三重限制
  __tests__/reliability/cost-guard.test.ts → 7 tests
```

## 五、修改的现有文件

| 文件 | 变更 |
|------|------|
| `packages/shared/src/index.ts` | 新增 queue/auth/reliability/transport/execution 导出 |
| `packages/shared/src/constants/strategy-names.ts` | 新增 QUEUE_BACKENDS/AUTH/TRANSPORT/EXECUTION 常量 + 类型 |
| `packages/shared/src/reliability/index.ts` | 新增 RateLimiter/CostGuard 导出 |
| `packages/shared/package.json` | 新增 `./auth`, `./queue`, `./reliability`, `./transport`, `./execution` 子路径导出 |
| `services/core-engine/src/index.ts` | 导入 createAuthStrategy + 注册 registerAuthMiddleware |
| `.env.example` | 新增 M6 Auth + Reliability 环境变量 |
| `pnpm-lock.yaml` | 新增 amqplib + @types/amqplib |

## 六、验证结果

```
pnpm typecheck     → 7/7 pass
pnpm test          → 35 files, 317 tests
新增测试            → 83 tests (269 → 317)
新增文件            → ~40 个
新增依赖            → amqplib
回归                → 0
```

## 七、待完成

| Phase | 内容 |
|-------|------|
| **Phase 3** | C1 接线 TokenRecorder/AuditLogger、C2 EventBridge、B4 DeadLetterQueue、C3/C4 KB+Obs RabbitMQ 消费者 |
| **Phase 4** | A5 Orchestrator、B5 Layer5 CrossReview、B6 Layer6 SafetyNet |
| **集成** | TransportStrategy 接入 routes、CostGuard 接入 AgentRunner |
