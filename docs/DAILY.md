# DAILY — AgentHub 每日记录

---

## 2026-06-24 — 项目启动日

### 完成事项

- [x] 深度分析参考项目 bitdance-agenthub 的完整架构（五层架构、StreamEvent 协议、Orchestrator 三阶段、Adapter 层、工具系统、安全模型）
- [x] 确定 AgentHub 核心技术决策：
  - TypeScript 为主力语言，Go 实现 MCP Gateway
  - PostgreSQL + pgvector 一体化存储
  - Redis + RabbitMQ 分布式状态与消息队列
  - Docker Compose 一键部署
  - 策略模式全解耦（8 个策略接口）
- [x] 定稿六层可靠性栈作为项目设计哲学
- [x] 建立 monorepo 项目骨架（6 个服务 + 3 个基础设施）
- [x] 编写 CLAUDE.md — AI 协作规则主文档
- [x] 编写完整 PRD（18 页）：产品愿景、254 个内置 Agent、MVP 阶段定义、验收标准
- [x] 254 个 Agent 来源于 agency-agents 开源库（18 分类），YAML frontmatter 解析导入
- [x] GitHub 仓库创建并首次推送
- [x] TODO.md + DAILY.md 维护体系建立

### 关键决策记录

1. **Go vs Rust for MCP Gateway**: 选 Go。理由：goroutine 天然适合并发代理场景，学习曲线低，部署简单（单一二进制）。
2. **消息队列选型**: RabbitMQ/NATS 而非 Redis Pub/Sub。理由：需要持久化 + ack 机制保证 Agent 间消息可靠性。
3. **向量存储**: pgvector 而非 FAISS。理由：与元数据同库，一条 SQL 完成向量搜索+元数据过滤，运维简单。
4. **Agent 导入**: 254 个内置 Agent 启动时不全部加载，按分类懒加载。
5. **Skill 定义**: 是"预定义的 Agent 工作流模板"，非原子操作。

### 待解决问题

- [ ] Fastify vs Hono for API Gateway 待定
- [ ] 前端 Next.js 项目初始化待 M2 阶段执行
- [ ] MCP Gateway Go 项目结构待设计

### 下一步

进入 M1 具体实施：pnpm workspace 配置 → Docker Compose → 各服务 health 端点

---

## 2026-06-24 — M1 骨架实施完成

### 完成事项

- [x] pnpm workspace 配置：`pnpm-workspace.yaml`，7 个包（contracts/shared + 4 TS 服务 + 根），Go 服务独立
- [x] pnpm catalog 统一管理共享依赖版本（typescript, vitest, tsx, @types/node）
- [x] `pnpm install` 成功，168 个包安装
- [x] TypeScript 严格模式：根 `tsconfig.json`（strict + noImplicitAny + noUncheckedIndexedAccess + NodeNext），6 个 TS 包 extends
- [x] `vitest.workspace.ts` + 各包 `vitest.config.ts`（globals + v8 coverage）
- [x] `packages/contracts` Event Schema：
  - `event-types.ts` — 24 个事件类型常量 + 8 个命名空间分组 + EventType union
  - `event-envelope.ts` — EventEnvelope + EventSource 类型 + Zod Schema + createEventEnvelope 工厂
  - TDD RED→GREEN→REFACTOR：27 个测试全部通过
- [x] 服务 Health 端点：
  - `packages/shared/src/server/create-health-server.ts` — Fastify factory，避免 4 服务重复
  - 4 个 TS 服务入口（core-engine:3001, skill-registry:3002, knowledge-base:3003, observability:3004）
  - TDD：每个服务 2 个 health 测试共 8 个，全部通过
- [x] Go MCP Gateway：`go.mod` + `main.go` min `net/http` server，`/health` 返回 200
- [x] Docker Compose：5 个 Dockerfile（4 TS + 1 Go），`docker-compose.yml`（3 infra + 5 app services，health check + network + volumes）
- [x] `.dockerignore` + `.env.example` 完整
- [x] `pnpm typecheck` 6/6 pass · `pnpm test` 35/35 pass · `pnpm build` 6/6 pass

### 关键决策

1. **API 框架**: 确认 Fastify（CLAUDE.md 待定已消除）
2. **TypeScript 模块解析**: NodeNext + NodeNext，相对导入统一加 `.js` 扩展名（标准 ESM）
3. **依赖版本管理**: pnpm catalog 协议，避免跨包版本漂移
4. **Event Envelope 设计**: 基础 Schema 不校验 eventType 枚举值，由 consumer 做窄化校验（开放-封闭原则）

### 下一步

进入 **M2: Core Engine 核心** — AgentRunner → DeepSeekAdapter → EventBus → AgentRegistry → ToolExecutor → ConversationService → SecurityService → WorkspaceService → API Gateway

---

*[2026-06-24] M1 骨架从计划到实施全部完成，51 个源文件，35 个测试通过，具备 M2 启动条件。*

---

## 2026-06-24 — M2 Core Engine 实施完成

### 完成事项

13 Steps 全部完成，~40 新文件：
- [x] DB Schema (Drizzle pg-core): agents, conversations, messages, artifacts + InMemoryDB
- [x] AgentAdapter Interface: StreamChunk, LLMMessage, ToolDefinition, AgentConfig
- [x] SecurityService: Bash POSIX 23 项 + Windows 6 项黑名单, Path 穿越防护
- [x] EventBus: HMR-safe (globalThis Symbol), topic 前缀过滤, emit/subscribe/unsubscribe
- [x] DeepSeekAdapter: OpenAI SDK, SSE 流解析 → StreamChunk, AbortSignal
- [x] MockDeepSeekAdapter: setTextResponse/setToolCallSequence/setError, 全测试基座
- [x] WorkspaceService: read/write/exec, SecurityService 校验, temp dir tests
- [x] ToolExecutor: 5 个内置工具（write_artifact, fs_read, fs_write, bash, ask_user）
- [x] AgentRegistry: CRUD + search + metadata/full 分离（懒加载）
- [x] ConversationService: 会话/消息 CRUD + appendPart/updateStatus（流式）
- [x] Agent Seed Script: gray-matter YAML 解析, 18 分类工具分配, 幂等导入
- [x] AgentRunner: 核心循环（systemPrompt→streamChat→emit→toolExecute→loop）, max 10 rounds
- [x] API Routes: /api/agents CRUD, /api/conversations SSE 流, /api/events SSE 全局
- [x] Entry Point: 全服务连接, graceful shutdown

### 验证结果

- `pnpm typecheck` → 6/6 pass
- `pnpm test` → 19 files, 162 tests pass
- `pnpm build` → 6/6 compiled
- 新增依赖: openai, gray-matter, pg, drizzle-kit, memfs (dev)

### 关键决策

1. **DB 持久化**: InMemoryDB 仅测试用。生产通过 DrizzleDB 连接 PostgreSQL（docker compose），`createDB()` 工厂根据 `DATABASE_URL` 选择实现
2. **Repository 模式**: Database 接口（AgentRepository/ConversationRepository/MessageRepository/ArtifactRepository），DrizzleDB + InMemoryDB 双实现
3. **Adapter 无状态**: streamChat() 每次传入完整历史，AgentRunner 管理 tool loop
4. **API Gateway**: 在 core-engine 内，单服务入口

### 下一步

进入 **M3: 前端基础** — Next.js 16 + Tailwind + shadcn/ui 初始化

---

## 2026-06-24 — M2 DB 层修复：InMemoryDB → DrizzleDB

### 问题

M2 初版使用了自研 `InMemoryDB`（Map 实现），数据只在进程内存中，进程重启全丢。用户明确要求应用数据必须持久化到 PostgreSQL。

### 修复内容

- 新增 `packages/shared/src/db/repository.ts` — 5 个 Repository 接口 + Database 组合接口
- 新增 `packages/shared/src/db/drizzle-db.ts` — DrizzleDB 实现（drizzle-orm/node-postgres + pg Pool）
- 重写 `InMemoryDB` 实现 Database 接口（仅测试用）
- 更新 4 个服务 + routes + 入口文件使用 Database 接口
- `createDB()` 工厂：`DATABASE_URL` 环境变量存在 → DrizzleDB，否则 InMemoryDB + warning

### 验证

- `pnpm typecheck` → 6/6 pass
- `pnpm test` → 19 files 全部通过

---

*[2026-06-24] M2 DB 层修复完成，生产使用 PostgreSQL，测试使用 InMemoryDB。*

---

## 2026-06-24 — M3 前端基础实施完成

### 完成事项

- [x] Next.js 16 + React 19 + shadcn/ui 项目初始化（`frontend/` 目录）
- [x] monorepo 集成：pnpm workspace + pnpm catalog 共享依赖
- [x] Tailwind CSS v4 CSS-first 配置 + CSS 变量主题（light/dark）
- [x] shadcn/ui 17 个组件：button, input, dialog, scroll-area, avatar, badge, card, dropdown-menu, tooltip, separator, toggle, skeleton, textarea, select, label, popover, command
- [x] **Zustand + Immer 归一化 store**：conversations/messages/agents/artifacts + UI state + settings
- [x] **Stream Reducer**：9 个事件类型的状态变更逻辑（text coalescing, tool lifecycle, agent lifecycle, artifacts）
- [x] **SSE 客户端**：EventSource + 指数退避重连（1s→30s）+ Jitter + SSEProvider context
- [x] **API 客户端**：typed fetch wrapper (GET/POST/streamPost)
- [x] **三栏 IM 布局**：Sidebar (64px) | ConversationList (320px) | ChatArea (flex-1) + DetailPanel (400px)
- [x] **会话管理**：列表（pinned/recent）+ 搜索 + 创建对话框（选择 Agent + mode）
- [x] **聊天组件**：ChatHeader + MessageList（auto-scroll）+ MessageBubble + MessageInput（Enter/Shift+Enter）+ StreamingIndicator
- [x] **MessagePart 渲染**：TextPart (react-markdown) + ThinkingPart (collapsible) + ToolUsePart + ToolResultPart + ArtifactRefPart
- [x] **Agent 管理**：AgentCard grid + CategoryFilter pills + SearchInput + CreateDialog + AgentProfile detail
- [x] **产物预览**：DetailPanel tabs → ArtifactPreview → ArtifactIframe (sandboxed) + ArtifactMarkdown + ArtifactCode
- [x] **Settings 页面**：ApiKeyManager (add/delete/toggle visibility) + localStorage persistence
- [x] Next.js rewrites proxy `/api/*` → core-engine:3001（零 CORS 问题）
- [x] App Router 7 routes: `/` → `/chat`, `/chat`, `/chat/[id]`, `/agents`, `/agents/[id]`, `/settings`

### 架构决策

1. **内联 contracts 类型**：`@agenthub/contracts` 使用 NodeNext 的 `.js` 扩展名，与 Next.js bundler 冲突。将 `EventEnvelope` 和 `EVENT_TYPES` 内联到 `@/lib/constants` 避免跨包解析问题
2. **transpilePackages**：Next.js 配置 `transpilePackages: ['@agenthub/shared']` 以便将来 shared 包可直接引用
3. **client-side pin/archive**：后端无 PATCH conversation 端点，钉选/归档为 Zustand 客户端状态
4. **API keys localStorage**：M3 阶段 API Keys 存浏览器本地，生产环境迁移到服务端加密存储

### 验证结果

- `pnpm typecheck` → 7/7 pass
- `pnpm test` → 20 files, 157 tests pass（含新增 10 个 stream-reducer 测试）
- `next build` → 编译成功，6 static + 2 dynamic routes
- 零 `: any` 类型 · 零 `console.log`（业务代码）

### 文件统计

- 约 50 个源文件（不含 shadcn/ui 生成的 17 个）
- 1 个测试文件（stream-reducer.test.ts, 10 tests）
- 7 个 App Router 路由页面

### 下一步

进入 **M4: 外围服务** — MCP Gateway (Go) + Skill Registry + Knowledge Base + Observability

---

*[2026-06-24] M3 前端基础全部完成，50+ 源文件，157 个测试通过，Next.js 16 三栏 IM UI 可构建运行。*

---

## 2026-06-24 — M4 外围服务实施完成

### 完成事项

4 个外围服务全部实现，约 30 个新文件：

- [x] **Shared Infrastructure**: documents 表（pgvector vector 列）+ DocumentRepository + DrizzleDB/InMemoryDB 双实现
- [x] **Skill Registry** (TS, :3002):
  - skills + skill_versions 表（Drizzle pg-core）
  - SkillRegistryOperations — CRUD + semver 版本管理（自动 bump patch / 显式指定）
  - 6 个 REST 端点 + Zod 校验 + 自定义错误
  - 内置 "code-reviewer" Skill 幂等种子
  - 27 个测试（22 operations + 3 seed + 2 health）
- [x] **Observability** (TS, :3004):
  - token_records + audit_log 表
  - TokenRecorder — 5 模型计价表 + cost 计算 + daily/weekly/monthly 聚合
  - AuditLogger — SHA-256 链（previousHash → currentHash）+ verifyChain
  - 5 个 REST 端点 + Zod 校验
  - 17 个测试（8 token + 7 audit + 2 health）
- [x] **Knowledge Base** (TS, :3003):
  - 3 个策略接口：EmbeddingStrategy, ChunkingStrategy, VectorStoreBackend
  - 3 个默认实现：DeepSeekEmbeddingStrategy, RecursiveChunker, PgVectorStore
  - 3 个 Mock 实现用于测试
  - KnowledgeService — 文档 chunk→embed→store→search 全流程
  - MemoryService — 三层记忆（Working/Short-term/Long-term）
  - 9 个 REST 端点 + Zod 校验
  - 19 个测试
- [x] **MCP Gateway** (Go, :8080):
  - JSON-RPC 2.0 handler（单请求 + 批量 + 通知）
  - MCP 协议类型：initialize, tools/list, tools/call, ping
  - ToolRegistry（线程安全）+ Echo 工具
  - Auth + RateLimit 占位接口（NoopAuth + NoopStrategy）
  - 18 个 Go 测试全部通过 + go vet clean
- [x] packages/shared 新增 documents 表（pgvector customType）

### 验证结果

- `pnpm typecheck` → 7/7 pass
- `pnpm test` → 26 files, 221 tests pass（M3 时 20 files 157 tests）
- Go tests → 18 pass + go vet clean
- Go build → 成功

### 关键技术决策

1. **pgvector 集成**: drizzle-orm 无原生 vector 支持，使用 `customType` 定义 vector(1536) 列，搜索使用 raw SQL（cosine similarity <=> 操作符）
2. **策略模式落地**: Knowledge Base 的 3 个策略接口（Embedding/Chunking/VectorStore）完全遵循 CLAUDE.md 3.5 节规范，通过环境变量插拔
3. **InMemoryVectorStore 命名**: `store` 属性与 `store()` 方法冲突，改名 `documents` 解决
4. **Zod 类型**: `z.infer` 返回 output type（含 default 值），`z.input` 返回 input type（optional 保留），服务方法签名使用 `z.input`
5. **Go JSON-RPC Error**: 需实现 `Error()` 方法才能作为 `error` 接口返回

### 文件统计

- TS 新文件 ~22 个（Skill Registry 7 + Observability 5 + Knowledge Base 9 + Shared 1）
- Go 新文件 ~12 个（jsonrpc 4 + mcp 2 + tools 4 + auth 1 + ratelimit 1）
- 新增测试：TS 63 tests + Go 18 tests

### 下一步

进入 **M5: 集成联调** — Docker Compose 一键启动全栈 + 端到端流程验证

---

*[2026-06-24] M4 外围服务全部完成，4 服务 30+ 文件，221 TS tests + 18 Go tests 通过，具备 M5 集成联调条件。*
