# CLAUDE.md — AgentHub 项目 AI 协作主文档

> 任何 AI 协作工具（Claude Code、Codex、Cursor 等）在本项目工作时**必须**先读此文档。
>
> 与其它文档的分工：`CLAUDE.md` 定**规则**（怎么做 / 不做什么）· `docs/architecture/` 定**架构**（服务拓扑 / 数据流）· `docs/specs/` 定**规格**（接口契约 / 事件协议）· `docs/decisions/` 定**决策**（ADR 架构决策记录）。

---

## 1. 项目定位

**AgentHub** — 在不可靠的 LLM 基座上建造可靠的 Agent 系统。

> 把多 Agent 协作做成 IM 群聊体验。Agent 是「联系人」，对话是「工作空间」，Orchestrator 是「群里的项目经理」。

核心差异化：
- **可部署**：Docker 容器化，PostgreSQL + Redis 持久化，非本地单机玩具
- **可靠性栈**：六层递进防御（认知→工具→Prompt→记忆→多点协作→安全网），每层填补特定维度的不可靠
- **策略模式**：所有关键组件接口与实现分离，插拔式替换
- **独立服务**：MCP Gateway 和 Skill Registry 是独立部署的服务，非进程内嵌

## 2. 技术栈（已锁定）

| 层 | 选型 | 备注 |
|---|---|---|
| 前端 | Next.js 16 App Router + React 19 + shadcn/ui + Tailwind CSS v4 | 同 AgentHub 的验证过的技术栈 |
| 前端状态 | Zustand + Immer | 归一化 store，reducer 应用 StreamEvent |
| 流式传输 | SSE（单条全局连接） | 不用 WebSocket |
| 后端框架 | Fastify / Hono（待定） | 性能优先，需支持 SSE |
| 语言 | TypeScript（strict）为主，Go（MCP Gateway） | 严禁 `any` |
| ORM | Drizzle | 不用 Prisma |
| DB | PostgreSQL | 元数据 + 向量（pgvector） |
| 向量存储 | pgvector | 与元数据同库，一条 SQL 同时查向量+元数据 |
| 缓存/队列 | Redis + RabbitMQ | Redis 用于分布式状态，RabbitMQ 用于服务间消息 |
| 容器化 | Docker + Docker Compose | 一键启动全栈 |
| LLM SDK | openai SDK（DeepSeek 兼容协议） | 通过 Adapter 屏蔽差异 |
| AI SDK | `@anthropic-ai/sdk`、`openai` 等 | 按 Adapter 按需引入 |
| 包管理 | pnpm | monorepo |

## 3. 架构核心原则

### 3.1 六层可靠性栈

```
层6：接受失败，建立安全网        ← 熔断 / 降级 / 审计
层5：用多点协作互相纠错           ← 多 Agent 交叉审查
层4：用事实锚定消除幻觉           ← RAG / 向量检索
层3：用程序外壳约束模型           ← Prompt Engineering
层2：用确定性工具替代推理          ← MCP / 工具系统
层1：先承认不可靠                 ← LLM 本质理解
```

**层与层之间不是"并列"，是"下层没有被上层替代"。** 熔断器不能替代 Prompt 校验，RAG 不能替代工具确定性。

### 3.2 服务拓扑

```
Frontend (Next.js) ←→ API Gateway (Fastify/Hono)
                         |
        ┌────────┬────────┼────────┬────────┐
        ▼        ▼        ▼        ▼        ▼
    Core      MCP      Skill    Knowledge  Observ
    Engine    Gateway  Registry Base      -ability
    (TS)      (Go)     (TS)     (TS)      (TS)
        │        │        │        │
        └────────┴────────┴────────┴──────→ PostgreSQL
                                           Redis
                                           RabbitMQ
```

### 3.3 服务职责边界

| 服务 | 职责 | 反职责（不做什么） |
|------|------|-------------------|
| **Core Engine** | Agent 生命周期、Orchestrator DAG 调度、Event Bus、Tool Executor | 不存储工具定义、不直接调用 LLM API |
| **MCP Gateway** (Go) | 工具发现、工具路由、鉴权、限流、Transport 适配 | 不执行业务逻辑、不存工具状态 |
| **Skill Registry** | Skill 模板存储、版本管理、检索、渲染 | 不执行 Skill（由 Core Engine 执行） |
| **Knowledge Base** | Embedding、向量检索、三层记忆管理 | 不生成回答、不做推理 |
| **Observability** | 成本追踪、审计日志、告警 | 不做业务决策 |

### 3.4 统一契约

整个系统通过 **Event Envelope** 协议粘合：

```typescript
interface EventEnvelope {
  eventId: string
  eventType: string          // "agent.run.start" | "tool.call" | ...
  timestamp: string          // ISO 8601
  traceId: string            // 全链路追踪
  source: { service: string; instanceId: string }
  payload: unknown           // 按 eventType 的 JSON Schema 校验
}
```

**铁律**：
- 各服务之间**只通过 Event 通信**，不共享数据库、不引入编译时类型依赖
- Event Schema 是语言无关的 JSON Schema，存放在 `packages/contracts/`
- 新增 Adapter 或 UI 组件时，事件协议不可绕开

### 3.5 策略模式 — 接口与实现分离

项目中所有关键组件必须遵循：

```
定义接口（interface/abstract class）
    ↓
提供默认实现（default strategy）
    ↓
支持运行时替换（DI / factory）
    ↓
环境变量控制选择（WHICH_STRATEGY=xxx）
```

**必须应用策略模式的核心点**：

| 接口 | 默认实现 | 可替换实现 |
|------|---------|-----------|
| `AgentAdapter` | `DeepSeekAdapter` | `AnthropicAdapter`, `OpenAIAdapter` |
| `TransportStrategy` | `SSETransport` | `StreamableHTTPTransport` |
| `EmbeddingStrategy` | `DeepSeekEmbedding` | `OpenAIEmbedding`, `BGE-M3`（本地） |
| `ChunkingStrategy` | `RecursiveChunker` | `SemanticChunker`, `CodeChunker` |
| `VectorStoreBackend` | `PgVector` | `FAISS`, `ChromaDB` |
| `QueueBackend` | `RabbitMQ` | `Redis`, `NATS` |
| `AuthStrategy` | `APIKey` | `OAuth2`, `mTLS` |
| `ExecutionStrategy` | `DAGExecutor` | `SequentialExecutor`, `ParallelExecutor` |

### 3.6 Agent 间不耦合

- Agent A **永远不**直接调用 Agent B
- Agent 间通信**只通过**：Orchestrator 分派（`plan_tasks`）或 Shared Memory（向量检索）
- 子 Agent **不看到**完整群聊历史，只看到 Orchestrator 构造的隔离上下文
- 每个 Agent 有独立的 System Prompt、Tool Set、Model Config

---

## 4. 代码风格

### 4.1 命名约定

| 类型 | 风格 | 例 |
|------|------|-----|
| 文件 | `kebab-case.ts` | `agent-runner.ts` |
| React 组件 | `PascalCase.tsx` | `ChatPanel.tsx` |
| 类型/接口 | PascalCase | `AgentConfig`, `StreamEvent` |
| 变量/函数 | camelCase | `buildAdapterInput` |
| 常量 | UPPER_SNAKE | `MAX_CONCURRENT_AGENTS` |
| 策略接口 | PascalCase + `Strategy` 后缀 | `EmbeddingStrategy` |
| DB 列名 | snake_case | `created_at` |
| URL 路径 | kebab-case | `/api/conversations/:id/messages` |

### 4.2 铁律

- ✅ 跨进程边界的输入**必须** Zod 校验
- ✅ 所有 LLM 调用**必须**带 AbortSignal
- ✅ 所有文件/命令操作**必须**经过 Workspace 沙箱
- ✅ 异常必须带上下文（不写 `throw new Error('failed')`）
- ✅ 纯函数放 `packages/shared/`，副作用集中在各服务的 `src/` 内
- ✅ 每个功能模块**必须**配套测试文件（见 §5 TDD 约束）
- ❌ 不用 `any`，需要时用 `unknown` 再 narrow
- ❌ 不引入新依赖不经讨论
- ❌ 不在业务代码里 `console.log`（用结构化 logger）
- ❌ 不写 `// TODO` 不跟进
- ❌ 不为「将来可能用到」加抽象
- ❌ 不提交未经测试的代码——测试和实现在同一个 commit

---

## 5. 测试驱动开发（TDD）— 强制约束

**所有功能代码必须配套测试。不允许提交未经测试的实现。**

### 5.1 TDD 工作流

```
1. RED：先写失败的测试，验证测试确实会失败
2. GREEN：写最少代码让测试通过
3. REFACTOR：重构代码，保持测试通过
4. COMMIT：测试 + 实现一起提交
```

**铁律**：不允许先写实现再补测试。测试和实现必须在同一个 commit 中。

### 5.2 测试金字塔

```
         ┌──────┐
         │ E2E  │  ← 关键用户路径
        ┌┴──────┴┐
        │ 集成测试 │  ← 服务边界、API 契约、DB 交互
       ┌┴────────┴┐
       │  单元测试  │  ← 纯函数、策略逻辑、工具函数、校验器
      └───────────┘
```

| 层级 | 覆盖目标 | 工具 | 占比 |
|------|---------|------|------|
| 单元测试 | 纯函数、策略实现、Zod schema、工具校验逻辑 | Vitest | ~60% |
| 集成测试 | API 端点、DB 查询、事件发布/消费、跨服务契约 | Vitest + Supertest | ~30% |
| E2E | 关键用户路径（创建会话→发消息→Agent 回复→产物展示） | Playwright | ~10% |

### 5.3 测试文件约定

所有测试文件放在 `src/__tests__/` 目录下，目录结构镜像 `src/` 的目录结构：

```
src/
├── server/
│   ├── agent-runner.ts
│   ├── dispatch-plan.ts
│   └── adapters/
│       └── deepseek-adapter.ts
├── shared/
│   ├── types.ts                    ← 类型定义（无需测试文件）
│   └── validation.ts
└── __tests__/                      ← 所有测试文件
    ├── server/
    │   ├── agent-runner.test.ts
    │   ├── dispatch-plan.test.ts
    │   └── adapters/
    │       └── deepseek-adapter.test.ts
    ├── shared/
    │   └── validation.test.ts
    ├── api/                        ← 集成测试（跨模块）
    │   ├── conversations.test.ts
    │   └── agents.test.ts
    └── contracts/
        └── event-schema.test.ts
```

### 5.4 必须测试的场景

| 场景 | 测试类型 | 示例 |
|------|---------|------|
| **正常路径** | 单元/集成 | 策略接口的默认实现产生预期输出 |
| **边界条件** | 单元 | 空输入、超长输入、token 预算耗尽 |
| **错误处理** | 单元/集成 | Adapter 抛出时 AgentRunner 返回 failed 状态 |
| **并发场景** | 集成 | DAG 调度中同波次并行任务 + 信号量上限 |
| **安全路径** | 单元 | Bash 黑名单拒绝 `rm -rf /`、路径穿越拒绝 `../../etc` |
| **Schema 校验** | 单元 | Event Envelope 各 eventType 的合法/非法 payload |
| **策略替换** | 单元 | 切换 `AGENT_ADAPTER` 环境变量后工厂返回正确实现 |
| **级联行为** | 集成 | 父 run abort → 子 run 收到 abort 信号 → 状态标记为 aborted |

### 5.5 测试工具链

```bash
pnpm test              # 全量单元 + 集成测试
pnpm test:watch        # watch 模式（开发时使用）
pnpm test:coverage     # 覆盖率报告（目标 ≥ 80%）
pnpm e2e               # Playwright E2E
pnpm e2e:ui            # Playwright UI 模式
```

### 5.6 覆盖率门槛

| 模块 | 最低行覆盖率 |
|------|------------|
| `packages/shared/` 纯函数 | 95% |
| Core Engine 核心逻辑（AgentRunner, DispatchPlan, ToolExecutor） | 85% |
| Adapter 层 | 80% |
| API 路由 | 80% |
| 前端组件 | 70% |
| MCP Gateway (Go) | 80% |

**低于门槛的 PR 不允许合并。** 覆盖率报告在 CI 中自动生成。

### 5.7 测试命名约定

```typescript
// describe('被测模块', () => {
//   describe('方法/场景', () => {
//     it('should 预期行为 when 条件', () => { ... })
//   })
// })

describe('AgentRunner', () => {
  describe('executeSimpleRun', () => {
    it('should return complete status when adapter streams successfully', async () => { ... })
    it('should return failed status when adapter throws an error', async () => { ... })
    it('should abort mid-stream when signal is triggered', async () => { ... })
  })
})
```

### 5.8 Mock 策略

- **LLM API 调用**：必须 mock（不烧 token）。每个 Adapter 提供对应的 `MockAdapter`。
- **数据库**：单元测试用内存 SQLite 或 mock DB 层；集成测试用真实 PostgreSQL（testcontainers）。
- **Redis / RabbitMQ**：集成测试用 testcontainers；单元测试 mock 接口。
- **文件系统**：用 `memfs` 或 `tmpdir`，不操作真实文件系统。
- **环境变量**：测试中显式设置，不依赖 `.env` 文件。

---

## 6. 安全模型

- LLM 输出视为**不可信输入**
- 生成的 HTML 在 sandboxed iframe 渲染
- Bash 命令经双平台黑名单过滤（POSIX / Windows）
- 文件操作限制在 Workspace 有效路径内
- API Key 优先级：`agent.apiKey` > `app_settings` > `process.env`
- **绝不**在代码中硬编码 Key
- MCP Gateway 层的工具调用需鉴权（调用方身份 + 参数范围 + 速率限制）

---

## 7. AI 协作规则

### 7.1 三种工作模式

| 模式 | 触发 | 行为 |
|------|------|------|
| **Spec 驱动** | 「实现 X」 | 先读 `docs/specs/` 找对应规格 → spec 缺失时先写 spec → 人确认后写代码 |
| **修复驱动** | 「修 bug」 | 先定位根因（不是症状）→ 在 PR 说明根因 |
| **探索驱动** | 「研究 / 设计 X」 | 不写实现代码，输出 spec / ADR |

### 7.2 必须停下来问

- 需要新增依赖
- 需要修改 spec 里定义的接口 / 数据结构
- 需要删除 / 重命名已被多处引用的符号
- 需要修改安全约束（黑名单、沙箱规则）
- 用户的请求和某个 spec 冲突

### 7.3 完成自检

- [ ] `pnpm typecheck` 通过
- [ ] `pnpm lint` 通过
- [ ] `pnpm test` 全部通过（新增代码必须有对应测试）
- [ ] `pnpm test:coverage` 覆盖率不低于模块门槛（§5.6）
- [ ] 涉及 spec 的修改，spec 已同步更新
- [ ] 新增策略实现了对应接口，且测试验证了策略可替换性
- [ ] 环境变量已在 `.env.example` 中声明
- [ ] 没有遗留的 `console.log` / `TODO` / 注释代码

---

## 8. 提交规范

```
<type>(<scope>): <subject>

scope: core | gateway | skill | knowledge | obs | frontend | contracts | docs
type: feat | fix | refactor | docs | chore | test | spec
```

---

## 9. 环境变量约定

```bash
# LLM
DEEPSEEK_API_KEY=sk-...
DEEPSEEK_MODEL_ID=deepseek-v4-pro
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

# Database
DATABASE_URL=postgresql://agenthub:agenthub@localhost:5432/agenthub
REDIS_URL=redis://localhost:6379

# Message Queue
RABBITMQ_URL=amqp://localhost:5672

# Service Discovery
MCP_GATEWAY_URL=http://localhost:8080
SKILL_REGISTRY_URL=http://localhost:8081
KNOWLEDGE_BASE_URL=http://localhost:8082

# Strategies（插拔式选择）
AGENT_ADAPTER=deepseek          # deepseek | anthropic | openai
EMBEDDING_STRATEGY=deepseek    # deepseek | openai | local-bge
CHUNKING_STRATEGY=recursive    # recursive | semantic | code
VECTOR_BACKEND=pgvector        # pgvector | faiss | chroma
QUEUE_BACKEND=rabbitmq         # rabbitmq | redis | nats
```

所有环境变量在 `.env.example` 中声明，`.env.local` 不提交。

---

## 10. 文档索引

| 文档 | 用途 |
|------|------|
| `CLAUDE.md`（本文件） | AI 协作规则 |
| `docs/architecture/overview.md` | 架构全景图 |
| `docs/architecture/data-flow.md` | 数据流与事件协议 |
| `docs/specs/` | 各服务接口规格 |
| `docs/decisions/` | ADR 架构决策记录 |
| `docs/PRD.md` | 产品需求文档 |
| `skills/` | 可复用开发任务模板 |

---

*本文件与 `docs/specs/` 配套：CLAUDE.md 定规则，specs 定规格。冲突时以 spec 为准。*
