# TODO — AgentHub 项目任务清单

**创建日期**: 2026-06-24
**当前阶段**: Phase 1 — M5: 集成联调

---

## M1: 项目骨架 ✅

- [x] 项目目录结构初始化
- [x] CLAUDE.md AI 协作主文档
- [x] PRD 产品需求文档
- [x] .gitignore
- [x] GitHub 仓库创建与首次推送
- [x] pnpm workspace 配置
- [x] TypeScript 严格模式 tsconfig
- [x] Docker Compose 编排文件
- [x] .env.example 环境变量声明
- [x] packages/contracts Event Schema 定义

## M2: Core Engine 核心 ✅

- [x] AgentAdapter Interface — StreamChunk, LLMMessage, ToolDefinition, AgentConfig 纯类型
- [x] DB Schema (Drizzle pg-core) — agents, conversations, messages, artifacts + InMemoryDB
- [x] SecurityService — Bash 黑名单（POSIX 23 项 + Windows 6 项）+ Path 穿越防护
- [x] EventBus — HMR-safe 单例（globalThis），topic 前缀过滤，emit/subscribe/unsubscribe
- [x] DeepSeekAdapter — OpenAI SDK，SSE 流解析，AbortSignal 支持
- [x] MockDeepSeekAdapter — 测试基座，setTextResponse/setToolCallSequence/setError
- [x] WorkspaceService — read/write/exec，SecurityService 校验，memfs 测试
- [x] ToolExecutor — 5 个内置工具（write_artifact, fs_read, fs_write, bash, ask_user）
- [x] AgentRegistry — listByCategory/listAll/getById/create/search/count，元数据分离
- [x] ConversationService — 会话/消息 CRUD + appendPart/updateStatus 流式更新
- [x] Agent Seed Script — gray-matter 解析 YAML frontmatter，幂等导入，工具集按分类分配
- [x] AgentRunner — 核心循环（buildPrompt→streamChat→emit→toolExecute→loop），max 10 rounds
- [x] API Routes — agents CRUD + conversations SSE 流 + events SSE 全局事件流
- [x] Entry Point — DB + EventBus + Services + Routes 全连接，graceful shutdown

## M3: 前端基础 ✅

- [x] Next.js 16 + React 19 + shadcn/ui 项目初始化
- [x] 三栏 IM 布局（会话列表 | 聊天区 | 详情面板）
- [x] SSE 客户端（stream-provider）
- [x] MessagePart 渲染组件（text/thinking/tool_use/tool_result/artifact_ref）
- [x] 会话管理（创建/搜索/置顶/归档）
- [x] Agent 管理页面（分类浏览 + 搜索 + 画像创建）
- [x] 产物预览（web_app iframe + document Markdown）
- [x] 设置面板（API Key 管理）
- [x] Zustand 归一化 store + Immer

## M4: 外围服务 ✅

- [x] MCP Gateway (Go) — JSON-RPC 端点 + 代理 1 个 Echo MCP Server
- [x] Skill Registry (TS) — CRUD API + semver 版本管理 + 内置 code-reviewer Skill
- [x] Knowledge Base (TS) — Embedding 写入 + pgvector 检索 + 三层记忆 API + 策略模式
- [x] Observability (TS) — Token 记录 + Cost 聚合 + SHA-256 审计链

## M5: 集成联调 ✅

- [x] Docker Compose 一键启动全栈（8 个服务：postgres + redis + rabbitmq + core-engine + mcp-gateway + skill-registry + knowledge-base + observability + frontend）
- [x] 端到端流程跑通：前端→Core→Adapter→LLM→Tool→产物→前端（消息 ID 对齐、API 端点补齐）
- [x] pnpm typecheck + lint 全仓库通过（lint 脚本修复为 per-workspace typecheck）
- [x] 无 console.log 残留（core-engine 3 处替换为结构化 logger）

## M6: Phase 2 启动

- [ ] Orchestrator 三阶段调度（PLAN → EXECUTE → AGGREGATE）
- [ ] HITL 审批门 + 超时默认策略
- [ ] MCP Gateway 鉴权 + 限流
- [ ] 成本追踪五级预算树
- [ ] Prometheus Metrics

---

*与本文件配套：[PLAN.md](PLAN.md)、[DAILY.md](DAILY.md)、[PRD](superpowers/specs/2026-06-24-agenthub-prd.md)*
