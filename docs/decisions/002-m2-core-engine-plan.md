# ADR-002: M2 Core Engine 实施计划

**日期**: 2026-06-24
**状态**: ✅ 已完成

## Context

M1 项目骨架已完成。M2 是 AgentHub 的核心——实现单 Agent 对话流程，从 LLM Adapter 到工具执行到 SSE 实时推送的完整链路。

## 关键架构决策

| 决策 | 结论 | 理由 |
|------|------|------|
| **数据库策略** | Drizzle ORM + 测试用 SQLite（better-sqlite3）、生产用 PG | 测试无需 Docker，Drizzle 跨方言兼容 |
| **Agent 种子数据** | git submodule at `data/agency-agents/`，gray-matter 解析 YAML frontmatter | 254 个 Agent，18 分类，启动时懒加载元数据，systemPrompt 按需查询 |
| **API Gateway 位置** | core-engine 服务内 | M2 单服务入口，M6 再拆分为独立 Gateway |
| **SSE 传输** | 单条全局连接 `GET /api/events` + topic 过滤 | 与 CLAUDE.md 一致 |
| **Adapter 无状态** | `streamChat()` 每次调用传入完整历史；AgentRunner 管理 tool loop | Adapter 简单，编排逻辑显式 |
| **WorkspaceService** | core-engine 内，管理每会话沙箱目录 + bash 执行 | 有状态副作用，属于 core-engine 职责 |
| **SecurityService** | `packages/shared/src/security/` 纯函数 | 无依赖，所有服务复用 |

## 新增依赖

**pnpm catalog 新增**: `drizzle-kit: ^0.30.0`

**packages/shared 新增**: `pg`, `@types/pg`, `drizzle-orm`（已有）

**services/core-engine 新增**: `openai`, `gray-matter`, `better-sqlite3`, `@types/better-sqlite3`, `memfs`（dev）

## 实施步骤（按依赖顺序）

### Step 1: DB Schema（Drizzle）

**独立，无上游依赖**

创建 `packages/shared/src/db/`:
- `schema.ts` — 4 张表：`agents`, `conversations`, `messages`, `artifacts`（含 Drizzle 关系定义）
- `connection.ts` — 工厂函数：测试环境返回 SQLite 实例，生产环境返回 PostgreSQL 池
- `schema.test.ts` — 验证 SQLite 创建/插入/外键约束
- `connection.test.ts` — 验证工厂按环境切换驱动

### Step 2: AgentAdapter Interface

**独立，纯类型定义**

创建 `packages/shared/src/adapter/`:
- `agent-adapter.interface.ts` — `AgentAdapter` 接口 + `StreamChunk` 联合类型 + `LLMMessage` + `ToolDefinition` + `AgentConfig`
- `agent-adapter.interface.test.ts` — 类型级测试

### Step 3: SecurityService

**独立，纯校验函数**

创建 `packages/shared/src/security/`:
- `security.service.ts` — `validateBashCommand()`（POSIX + Windows 黑名单）+ `validatePath()`（路径穿越防护）
- `security.service.test.ts` — 每个黑名单项独立测试 + 路径遍历变体 + 边缘情况

### Step 4: EventBus

**独立，依赖 contracts**

创建 `packages/shared/src/event-bus/`:
- `event-bus.ts` — HMR-safe 单例（`globalThis`），`emit()` + `subscribe(topicPrefix)` → AsyncGenerator + `unsubscribe()`
- `event-bus.test.ts` — emit/subscribe/topic 过滤/多订阅者/HMR 存活/退订/背压/高吞吐量

### Step 5: DeepSeekAdapter + Mock

**依赖 Step 2 (AgentAdapter interface)**

创建 `services/core-engine/src/adapters/`:
- `deepseek-adapter.ts` — 实现 `AgentAdapter`，使用 `openai` SDK（baseURL: api.deepseek.com），SSE 流解析为 `StreamChunk`，支持 AbortSignal
- `mock-deepseek-adapter.ts` — 实现同一接口，返回预配置响应（`setTextResponse`, `setToolCallSequence`），关键测试基座
- 测试文件 — mock-only，零真实 API 调用

### Step 6: WorkspaceService

**依赖 Step 3 (SecurityService)**

创建 `services/core-engine/src/services/`:
- `workspace.service.ts` — `read/write/exec/readMultiple`，所有操作经过 SecurityService 校验
- `workspace.service.test.ts` — 用 `memfs` 虚拟文件系统测试

### Step 7: ToolExecutor

**依赖 Step 3 + Step 6**

创建 `services/core-engine/src/services/`:
- `tool-executor.ts` — 注册 5 个内置工具（`write_artifact`, `fs_read`, `fs_write`, `bash`, `ask_user`），`register/getDefinitions/execute`
- `tool-executor.test.ts` — 每个工具独立测试 + 未知工具/错误参数/并发执行

### Step 8: AgentRegistry

**依赖 Step 1 (DB Schema)**

创建 `services/core-engine/src/services/`:
- `agent-registry.ts` — `listByCategory/listAll/getById/create/search/count`，元数据与完整数据分离
- `agent-registry.test.ts` — 内存 SQLite CRUD 全覆盖

### Step 9: ConversationService

**依赖 Step 1 (DB Schema)**

创建 `services/core-engine/src/services/`:
- `conversation.service.ts` — 会话 CRUD + 消息 CRUD + `appendPart/updateStatus`（流式更新）
- `conversation.service.test.ts` — CRUD + 分页 + 外键约束

### Step 10: Agent Seed Script

**依赖 Step 1 + Step 8**

- `git submodule add https://github.com/msitarzewski/agency-agents.git data/agency-agents`
- 创建 `services/core-engine/src/db/seed.ts` — `gray-matter` 解析 YAML frontmatter，按分类分配工具集，幂等导入
- `seed.test.ts` — 临时目录 mock markdown 文件测试

### Step 11: AgentRunner

**依赖 Step 2 + 4 + 5 + 7 + 9**

创建 `services/core-engine/src/services/`:
- `agent-runner.ts` — 核心循环：
  1. emit `agent.run.start`
  2. 构建 LLM 消息（system + history + new user）
  3. 获取工具定义
  4. Loop (max 10 rounds): adapter.streamChat → yield 流式 chunks → 收集 tool calls → ToolExecutor.execute → yield tool results → append to history
  5. emit `agent.run.complete` | `agent.run.failed` | `agent.run.aborted`
  6. 所有事件包在 `EventEnvelope` 中
- `agent-runner.test.ts` — **全 MockDeepSeekAdapter**，覆盖：纯文本/工具使用/最大轮数/abort/错误/事件格式/对话历史

### Step 12: API Routes

**依赖 Step 4 + 8 + 9 + 11**

创建 `services/core-engine/src/routes/`:
- `agents.ts` — `GET /api/agents`, `GET /api/agents/:id`, `POST /api/agents`
- `conversations.ts` — `POST /api/conversations`, `GET /api/conversations/:id/messages`, `POST /api/conversations/:id/messages`（SSE 流式响应）
- `events.ts` — `GET /api/events?topic=`（SSE 全局事件流）
- `__tests__/integration/agents.test.ts` + `conversations.test.ts`

### Step 13: 入口更新

**依赖 Step 12**

修改 `services/core-engine/src/index.ts` — 初始化 DB、运行 migration/seed、创建所有服务单例、注册路由、加入 graceful shutdown

## 依赖关系图

```
Step 1 (DB Schema) ────────────────────────────┐
Step 2 (AgentAdapter Interface) ───────────┐   │
Step 3 (SecurityService) ──────────┐        │   │
Step 4 (EventBus) ─────────────┐    │        │   │
                               │    │        │   │
Step 5 (DeepSeekAdapter) ◄─────┤    │        │   │
Step 6 (WorkspaceService) ◄────┼────┤        │   │
Step 7 (ToolExecutor) ◄────────┼────┤        │   │
Step 8 (AgentRegistry) ◄───────┼────┼────────┤   │
Step 9 (ConversationService) ◄─┼────┼────────┤   │
Step 10 (Seed Script) ◄────────┼────┼────────┤   │
                               │    │        │   │
Step 11 (AgentRunner) ◄────────┴────┴────────┴───┘
Step 12 (API Routes) ◄──── Step 4 + 8 + 9 + 11
Step 13 (Entry Update) ◄──── Step 12
```

## Mock 策略

| 组件 | Mock 方式 | 理由 |
|------|----------|------|
| LLM API | `MockDeepSeekAdapter` | 零成本，确定性，可测错误路径 |
| 数据库 | SQLite 内存 (better-sqlite3) | 无 Docker，快速，Schema 兼容 PG |
| 文件系统 | `memfs` | 无磁盘污染，测试并行安全 |
| Bash | mock `child_process.exec` | 无真实 shell 执行 |
| 环境变量 | 测试中显式设置 | 确定性，不依赖 `.env` |
| HTTP | Fastify `app.inject()` | 无网络，全请求生命周期 |

## M2 验收标准

- [ ] `pnpm typecheck` 全仓库通过（严格模式，零 `any`）
- [ ] `pnpm test` 全部测试通过
- [ ] `pnpm test:coverage` shared ≥95%, core-engine ≥85%
- [ ] `docker compose up` core-engine 启动且 /health 返回 200
- [ ] `POST /api/conversations/:id/messages` 返回 SSE 流，EventEnvelope 格式
- [ ] `GET /api/agents` 返回种子 Agent（含分类过滤）
- [ ] `GET /api/events?topic=agent.` 仅流式推送 agent 事件
- [ ] Abort SSE 连接时 emit `agent.run.aborted`
- [ ] Bash 黑名单拒绝 `rm -rf /`
- [ ] 路径穿越防护拒绝 `../../../etc/passwd`
- [ ] 测试套件零真实 LLM API 调用
- [ ] `pnpm db:seed` 幂等导入 254 个 Agent
- [ ] 无 `console.log`，无 `any`，相对导入含 `.js` 扩展名

## 文件树（新增 ~40 个文件）

```
packages/shared/src/
├── adapter/          (3 files: interface + test + index)
├── event-bus/        (3 files: implementation + test + index)
├── security/         (3 files: implementation + test + index)
├── db/               (5 files: schema + test, connection + test, index)
└── drizzle.config.ts

services/core-engine/src/
├── adapters/         (5 files: deepseek + test, mock + test, index)
├── services/         (12 files: workspace, tool-executor, agent-registry,
│                       conversation, agent-runner + tests + index)
├── routes/           (4 files: agents, conversations, events, index)
├── db/               (3 files: seed + test, migrate)
└── __tests__/integration/ (2 files: agents, conversations)

data/agency-agents/   (git submodule)
```
