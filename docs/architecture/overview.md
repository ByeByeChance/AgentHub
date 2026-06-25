# AgentHub 架构全景图

**更新日期**: 2026-06-25
**当前阶段**: M6 完成 — 策略完备 + 可靠性栈 + 跨服务集成

---

## 1. 服务拓扑

```
                    Frontend (Next.js 16)
                    [M3 阶段实现]
                         │
                         │ SSE + REST
                         ▼
                 API Gateway (Fastify)
                 [core-engine :3001]
                         │
        ┌────────┬───────┼────────┬────────┐
        ▼        ▼       ▼        ▼        ▼
    Core      MCP      Skill    Knowledge  Observ
    Engine    Gateway  Registry Base      -ability
    (TS)      (Go)     (TS)     (TS)      (TS)
    :3001     :8080    :3002    :3003     :3004
        │        │       │        │         │
        └────────┴───────┴────────┴─────────┘
                         │
              ┌──────────┼──────────┐
              ▼          ▼          ▼
          PostgreSQL   Redis    RabbitMQ
          :5432        :6379    :5672
```

## 2. 服务职责

| 服务 | 端口 | 语言 | 职责 | 状态 |
|------|------|------|------|------|
| **Core Engine** | 3001 | TypeScript | Agent 生命周期、Orchestrator DAG、EventBus、Tool Executor、EventBridge、SSE | M1-M6 完整实现 ✅ |
| **MCP Gateway** | 8080 | Go | 工具发现、路由、鉴权、限流、Transport 适配 | M1-M4 实现 ✅ |
| **Skill Registry** | 3002 | TypeScript | Skill 模板 CRUD、版本管理、检索 | M1-M4 完整实现 ✅ |
| **Knowledge Base** | 3003 | TypeScript | Embedding 写入、pgvector 检索、三层记忆、RabbitMQ Consumer | M1-M6 完整实现 ✅ |
| **Observability** | 3004 | TypeScript | Token 追踪、Cost 聚合、审计链 SHA-256、RabbitMQ Consumer | M1-M6 完整实现 ✅ |

## 3. 基础设施

| 组件 | 镜像 | 端口 | 用途 |
|------|------|------|------|
| **PostgreSQL** | `pgvector/pgvector:pg16` | 5432 | 元数据 + 向量存储（一体化） |
| **Redis** | `redis:7-alpine` | 6379 | 分布式状态、会话缓存 |
| **RabbitMQ** | `rabbitmq:3-management-alpine` | 5672 (AMQP), 15672 (UI) | 跨服务异步消息、EventBridge |

> **开发模式**: 无需 Docker。所有服务自动降级到内存实现（MockQueue、InMemoryDB、NoopAuth）。只需 `pnpm dev` + 填入 `DEEPSEEK_API_KEY`。

## 4. 技术栈

| 层 | 选型 | 版本 |
|---|---|---|
| 运行时 | Node.js | 22 LTS |
| 语言 | TypeScript (strict) + Go | TS 5.7+, Go 1.24 |
| 包管理 | pnpm | 9.x |
| 后端框架 | Fastify | 5.x |
| ORM | Drizzle ORM | 0.42+ |
| 数据库 | PostgreSQL + pgvector | 16 |
| 验证 | Zod | 3.x |
| 测试 | Vitest | 3.x |
| LLM SDK | openai (DeepSeek 兼容) | 4.x |
| E2E | Playwright | 1.x |
| CI/CD | GitHub Actions | — |
| 容器化 | Docker Compose | — |

## 5. 策略模式插拔点（全部完成）

| 接口 | 默认实现 | 环境变量 | 状态 |
|------|---------|---------|------|
| `AgentAdapter` | `DeepSeekAdapter` | `AGENT_ADAPTER=deepseek` | M2 实现 ✅ |
| `EmbeddingStrategy` | `DeepSeekEmbedding` (fallback: Mock) | `EMBEDDING_STRATEGY=mock` | M4 实现 ✅ |
| `ChunkingStrategy` | `RecursiveChunker` | `CHUNKING_STRATEGY=recursive` | M4 实现 ✅ |
| `VectorStoreBackend` | `InMemoryVectorStore` (prod: PgVector) | `VECTOR_BACKEND=inmemory` | M4 实现 ✅ |
| `QueueBackend` | `MockQueueBackend` (prod: RabbitMQ) | `QUEUE_BACKEND=mock` | M6 实现 ✅ |
| `ExecutionStrategy` | `DAGExecutor` | `EXECUTION_STRATEGY=dag` | M6 实现 ✅ |
| `TransportStrategy` | `SSETransport` | `TRANSPORT_STRATEGY=sse` | M6 实现 ✅ |
| `AuthStrategy` | `NoopAuthStrategy` (prod: APIKey) | `AUTH_STRATEGY=noop` | M6 实现 ✅ |
| `CircuitBreaker` | 三态状态机 (CLOSED→OPEN→HALF_OPEN) | `CIRCUIT_BREAKER_*` | M6 实现 ✅ |
| `RateLimiter` | Token Bucket | `RATE_LIMIT_*` | M6 实现 ✅ |
| `CostGuard` | per-run / per-session / per-day | `MAX_*` | M6 实现 ✅ |
| `DeadLetterQueue` | InMemory (指数退避重试) | — | M6 实现 ✅ |

## 6. Monorepo 结构

```
agenthub/
├── .github/workflows/
│   └── ci.yml             # CI: typecheck + lint + test + coverage + E2E
├── packages/
│   ├── contracts/          # @agenthub/contracts — Event Envelope + Event Types
│   └── shared/             # @agenthub/shared — 12 策略接口 + 可靠性组件
├── services/
│   ├── core-engine/        # @agenthub/core-engine — 核心引擎 + Orchestrator
│   ├── mcp-gateway/        # Go 服务 — MCP 工具网关
│   ├── skill-registry/     # @agenthub/skill-registry — Skill 注册中心
│   ├── knowledge-base/     # @agenthub/knowledge-base — 知识库 + EventConsumer
│   └── observability/      # @agenthub/observability — 可观测性 + EventConsumer
├── frontend/               # Next.js 16 — 三栏 IM UI
├── docker-compose.yml      # PostgreSQL + Redis + RabbitMQ 基础设施栈
├── data/
│   └── agency-agents/      # 254 个内置 Agent（git submodule）
├── docs/
│   ├── architecture/       # 架构文档
│   ├── decisions/          # ADR 决策记录
│   └── specs/              # 7 个服务接口规格
├── scripts/                # 运维脚本
└── skills/built-in/        # 内置 Skill 模板
```

## 7. 六层可靠性栈（全部完成）

```
层6 ✅ SafetyNet      — 有序门控 (RateLimit→CostGuard→CircuitBreaker→AgentRun)
层5 ✅ CrossReview   — 多 Agent 交叉审查 (majority_vote/unanimous/threshold, auto-fix)
层4 ✅ Knowledge Base — RAG / pgvector 向量检索 / 三层记忆
层3 ✅ Prompt Eng.   — Zod 校验 LLM 输出 / 策略模式插拔
层2 ✅ Tool System   — MCP Gateway (Go) / JSON-RPC 2.0 / 工具确定性
层1 ✅ Foundation    — Adapter 模式屏蔽 LLM 差异 / DeepSeek 兼容协议
```

## 8. M6 新增端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/conversations/:id/execute` | POST | Orchestrator 多 Agent DAG 执行 (SSE streaming) |

## 9. 跨服务事件流

```
AgentRunner (CoreEngine)
  │ emit(EventBus)
  ▼
EventBridge ──publish──► RabbitMQ (agenthub.events)
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
         knowledge.*   audit.*      (future)
              │            │
              ▼            ▼
      KnowledgeBase   Observability
      EventConsumer   EventConsumer
```

## 10. 测试覆盖

| 包/服务 | 测试文件 | 测试用例 |
|---------|---------|---------|
| packages/shared | 12 | 146 |
| services/core-engine | 16 | 105 |
| services/knowledge-base | 3 | — |
| services/observability | 3 | — |
| services/skill-registry | 3 | — |
| packages/contracts | 1 | 8 |
| frontend | 9 | 45 |
| **合计** | **47** | **414** |

---

*配套文档：[data-flow.md](data-flow.md) · [ADR-003 M6 实施计划](../decisions/003-m6-implementation-plan.md)*
