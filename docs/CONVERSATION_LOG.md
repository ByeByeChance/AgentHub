# CONVERSATION_LOG — AgentHub 讨论记录

---

## 2026-06-24: 项目启动与架构设计

### 背景

用户已完成六个阶段的 Agent 架构师学习路线（Phase 1-6），对 bitdance-agenthub 项目进行了深度分析，现在要构建自己的多 Agent 协调项目。

### 核心讨论

**参考项目分析**：
- bitdance-agenthub：IM 群聊式 Agent 协作，五层架构，StreamEvent 统一协议
- 可借鉴点：IM 范式、Orchestrator 三阶段、MessagePart 设计、Adapter 模式
- 不足之处：内存队列无持久化、Orchestrator 单点、审批无超时

**AgentHub 差异化**：
- 可部署（Docker + PostgreSQL + Redis + RabbitMQ）
- 六层可靠性栈（总纲.md 的设计哲学）
- 策略模式全解耦，接口与实现分离
- MCP Gateway（Go）和 Skill Registry 作为独立服务
- 本地知识库 + pgvector 向量检索
- 254 个内置 Agent（来自 agency-agents 开源库）

**技术决策**：
- TypeScript 主力 + Go（MCP Gateway）
- PostgreSQL/pgvector 一体化
- Redis + RabbitMQ
- Docker Compose
- Next.js 16 + React 19 + shadcn/ui
- DeepSeek 实验模型

**项目命名**：
- 初定为 AgentForge，后改为 AgentHub

### 产出物

- CLAUDE.md — AI 协作规则
- PRD — 产品需求文档（18 页）
- TODO.md + DAILY.md

---

## 2026-06-24: M1 骨架实施

### 背景

M1 剩余 5 项基础设施任务（pnpm workspace / TS 配置 / Docker Compose / .env.example / Event Schema），是 M2-M6 开发的基石。

### 实施过程

- **Step 1**: pnpm workspace + catalog 统一版本管理，7 个包声明完成，`pnpm install` 成功
- **Step 2**: TypeScript strict 模式 + NodeNext ESM，6 个 tsconfig + 7 个 vitest config
- **Step 3**: TDD Event Schema — 先写 27 个测试→RED→实现 event-types + event-envelope→GREEN
- **Step 4**: TDD Health 端点 — create-health-server 工厂 + 4 服务入口 + 8 个集成测试
- **Step 5**: Docker Compose — 5 Dockerfile + 9 服务编排（3 infra + 5 app + network）
- **Step 6**: .env.example 41 个环境变量分 8 节

### 关键决策

1. Fastify 确认（CLAUDE.md "待定"已消除）
2. NodeNext 模块解析 + .js 扩展名（标准 ESM）
3. pnpm catalog 统一管理共享 devDeps 版本

### 验证结果

- `pnpm typecheck` → 6/6 pass
- `pnpm test` → 35 tests pass (6 files)
- `pnpm build` → 6/6 compiled
- 51 个源文件，M1 验收 5 项全部达标

---

## 2026-06-24: M2 Core Engine 实施

### 背景

M1 骨架完成后开始 M2 核心引擎实现——单 Agent 对话全链路。

### 实施内容

13 Steps, ~40 新文件，覆盖：
- 数据层：Drizzle schema + InMemoryDB（better-sqlite3 macOS 编译失败后改用 Map 实现）
- 策略接口：AgentAdapter（StreamChunk 联合类型）+ MockDeepSeekAdapter
- 安全层：Bash 黑名单（POSIX + Windows）+ Path 穿越防护
- 基础设施：EventBus（HMR-safe singleton）+ SecurityService（纯函数）
- 适配器层：DeepSeekAdapter（OpenAI SDK + SSE 解析）+ Mock（测试基座）
- 服务层：WorkspaceService, ToolExecutor（5 个内置工具）, AgentRegistry, ConversationService
- 编排层：AgentRunner（buildPrompt→streamChat→emit→toolExecute→loop, max 10 rounds）
- API 层：Fastify routes（agents CRUD, conversations SSE, events SSE）
- 入口：全服务连接 + graceful shutdown

### 关键决策

1. SQLite → InMemoryDB：better-sqlite3 macOS C++ 编译失败，改用纯 TypeScript Map 实现
2. Adapter 无状态：每次调用传入完整历史，AgentRunner 管理 tool loop
3. API Gateway 在 core-engine 内：M2 单服务，M6 拆分
4. SSE 单条全局连接 + topic 过滤

### 验证结果

- `pnpm typecheck` → 6/6 pass
- `pnpm test` → 19 files, 162 tests pass
- `pnpm build` → 6/6 compiled
- 零真实 LLM API 调用（全部使用 MockDeepSeekAdapter）

### 产出文件

```
packages/shared/src/adapter/    3 files (interface + tests + index)
packages/shared/src/event-bus/  3 files (impl + tests + index)
packages/shared/src/security/   3 files (impl + tests + index)
packages/shared/src/db/         5 files (schema + connection + tests + index)
services/core-engine/src/
  adapters/                     5 files (deepseek + mock + tests + index)
  services/                     12 files (workspace, tool-executor, agent-registry,
                                  conversation, agent-runner + tests + index)
  routes/                       4 files (agents, conversations, events, index)
  db/                           3 files (seed, test, migrate)
```

### 下一步：M3 前端基础

---

## 2026-06-24: M2 DB 层修复 — 内存 → PostgreSQL

### 问题

M2 初版使用了 InMemoryDB（Map 实现），数据在进程内存中不持久化。用户明确要求：数据不能写进程本地内存，必须到 PostgreSQL。

### 修复

引入 Repository 模式：
- `Database` 接口（AgentRepository, ConversationRepository, MessageRepository, ArtifactRepository）
- `DrizzleDB` — drizzle-orm/node-postgres + pg Pool，连接 PostgreSQL
- `InMemoryDB` — 仅测试用，实现同一接口
- `createDB()` 工厂：`DATABASE_URL` env → DrizzleDB，否则回退 InMemoryDB + warning
- 4 个服务 + routes + 入口全部切换到 Database 接口

---

*本次讨论包含 5 节可视化设计呈现（服务架构、数据流、数据库、前端 UX、MVP 范围），参见 `.superpowers/brainstorm/`。*
