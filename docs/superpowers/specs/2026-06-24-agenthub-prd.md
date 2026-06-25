# AgentHub — 产品需求文档 (PRD)

**版本**: v1.0  
**日期**: 2026-06-24  
**作者**: AgentHub 产品团队  
**状态**: Phase 1 MVP 设计完成，待实施

---

## 1. 产品愿景

**AgentHub** 是一个多 Agent 协作平台。核心命题：**在不可靠的 LLM 基座上建造可靠的 Agent 系统。**

> 把多 Agent 协作做成 IM 群聊体验。Agent 是「联系人」，对话是「工作空间」，Orchestrator 是「群里的项目经理」。

### 1.1 核心差异化

| 维度 | AgentHub | 同类项目 |
|------|---------|---------|
| 部署形态 | Docker + PostgreSQL + Redis + RabbitMQ，可部署 | 多为本地单机 |
| 可靠性 | 六层可靠性栈，逐层消除不可靠 | 通常只关注 Prompt 或 Tool |
| 架构 | 策略模式全解耦，接口与实现分离 | 多为单体或紧耦合 |
| MCP | 独立 Go 实现的 MCP Gateway 服务 | 多为进程内嵌 |
| Skills | 独立 Skill Registry 服务 + 版本管理 | 通常无此概念 |
| 记忆 | pgvector 向量检索 + 三层记忆 | 多为内存 Map 或无 |

### 1.2 目标用户

**首要**：个人开发者（追求效率的全栈/独立开发者）。  
**扩展**：中小技术团队（3-10 人共享实例，按需增权限管理）。  
**远期**：平台级 SaaS（多租户、计费、SLA）。

---

## 2. 核心功能列表

### P0 — Phase 1 MVP（完整骨架）

| 功能 | 描述 |
|------|------|
| IM 会话管理 | 创建会话（单聊/群聊）、消息列表、发送消息 |
| 单 Agent 对话 | DeepSeek Adapter 流式响应，MessagePart 渲染 |
| 内置 254 个 Agent | 从 agency-agents 库导入全部 18 个分类的角色（工程/设计/营销/安全/产品/战略等） |
| Agent 分类浏览 | 按分类/标签筛选 Agent，查看画像、能力、适用场景 |
| Agent 创建 | 模板匹配 + LLM 补全，用户描述画像 → 系统匹配最接近的内置 Agent → 补全差异 |
| 工具系统 | write_artifact、fs_read、fs_write、bash、ask_user 等内置工具 |
| MCP Gateway (Go) | 工具发现、代理至少 1 个 MCP Server |
| Skill Registry | Skill 模板 CRUD + 版本管理 + 至少 1 个内置 Skill |
| Knowledge Base | Embedding 写入 + pgvector 检索 + 三层记忆 API |
| Observability | Token 使用记录 + Cost-per-agent 聚合 + 审计日志 SHA-256 链 |
| 产物预览 | web_app (iframe) + document (Markdown 渲染) |
| Docker Compose | 一键启动全栈（6 服务 + 3 基础设施） |
| SSE 实时流 | 单条连接，Event Envelope 协议 |

### P1 — Phase 2（核心闭环）

| 功能 | 描述 |
|------|------|
| Orchestrator 三阶段调度 | PLAN → EXECUTE(DAG) → AGGREGATE |
| DAG 拓扑排序 + 并行执行 | 同波次无依赖任务并发，全局信号量控制 |
| 动态重规划（补救轮） | 失败/冲突自动补救，最多 N 轮 |
| HITL 审批门 | fs_write、高风险 bash、ask_user，三级粒度 + 超时默认策略 |
| 代码冲突检测 | 同波次多 Agent 写同一文件的冲突检测与上报 |
| MCP Gateway 鉴权 | API Key + 限流 (Token Bucket) |
| 多 Transport | SSE + Streamable HTTP |
| 成本追踪 | 五级预算树 + cost-per-outcome |
| Prometheus Metrics | 各服务暴露 metrics 端点 |

### P2 — Phase 3+（完善与扩展）

| 功能 | 描述 |
|------|------|
| Agent 市场 | 社区共享 Agent 画像与 Skill 模板 |
| 本地 Embedding 模型 | BGE-M3 本地部署，降低 API 成本 |
| 自适应 Chunking | 代码按函数、文档按段落、表格按行列 |
| 多租户隔离 | 团队空间、权限管理 |
| 金丝雀发布 | 模型升级 5%→25%→50%→100% 渐进验证 |
| 移动端伴随 App | Capacitor 原生壳，配对通信 |

### 明确不做的（范围外）

- ❌ 云端托管服务（AgentHub 是自部署的，不提供 SaaS）
- ✅ ~~多语言支持（初期只做中文 + 英文）~~ **已完成：next-intl v4，zh-CN 默认 + en 备选**
- ❌ 实时音视频通话（Agent 不需要视频）
- ❌ 代码合并自动化（冲突检测只上报，不自动合并）
- ❌ 第三方 OAuth 登录（初期本地单用户不需要）

---

## 3. 用户旅程

### 3.1 首次使用

```
1. git clone + docker compose up
2. 浏览器打开 http://localhost:3000
3. 看到 254 个内置 Agent 已就绪，按 18 个分类组织（工程/设计/营销/安全/产品/战略等）
4. 在设置面板填入 DEEPSEEK_API_KEY
5. 点击「新建会话」→ 选择 Agent → 输入第一条消息
6. Agent 流式回复，工具调用过程可见
7. 产物自动出现在详情面板的「产物库」中
```

### 3.2 创建自定义 Agent

```
1. 打开 Agent 管理面板 → 点击「创建 Agent」
2. 输入画像描述：「我需要一个安全审计专家，能审查代码中的安全漏洞」
3. 系统匹配最接近的内置模板（Reviewer）→ LLM 补全差异
4. 预览生成的 System Prompt、推荐工具集、模型配置
5. 用户调整后确认 → Agent 加入可用列表
6. 在群聊中添加该 Agent 即可使用
```

### 3.3 发起多 Agent 协作（Phase 2）

```
1. 创建群聊 → 勾选 Orchestrator + PM + 前端 + Reviewer
2. 发送消息：「帮我从零做一个番茄钟 Web 应用」
3. Orchestrator 分析需求 → 发出调度计划卡
4. 用户审批计划（调整/批准/拒绝）
5. DAG 并行执行：PM 写 PRD + 前端等 PRD 后实现 + Reviewer 审查
6. 最终 Orchestrator 汇总结果 → 产物卡片 + 部署预览
```

### 3.4 使用 Skill 快速启动（Phase 2）

```
1. 在输入框输入 / 触发斜杠命令
2. 搜索「创建 React 组件」Skill
3. 选择 Skill → 填写参数（组件名、Props、样式方案）
4. Skill 自动生成工作流 → Orchestrator 分派执行
5. 代码生成 → 审查 → 测试 → 产物呈现
```

---

## 4. 产品架构

### 4.1 服务拓扑

```
Frontend (Next.js 16) ←→ API Gateway (Fastify)
                            |
           ┌────────┬────────┼────────┬────────┐
           ▼        ▼        ▼        ▼        ▼
       Core      MCP      Skill    Knowledge  Observ
       Engine    Gateway  Registry Base      -ability
       (TS:3001) (Go:8080)(TS:3002)(TS:3003) (TS:3004)
           │        │        │        │
           └────────┴────────┴────────┴──────→ PostgreSQL
                                              Redis
                                              RabbitMQ
```

### 4.2 统一契约

所有服务通过 **Event Envelope** 通信，语言无关的 JSON Schema 定义在 `packages/contracts/`：

- **实时事件**：SSE（前端直连 Core Engine）— run.*, message.*, part.*, tool.*, artifact.*
- **异步事件**：RabbitMQ（跨服务削峰）— token.usage, audit.log, knowledge.write
- **同步调用**：REST/gRPC（MCP Gateway 工具执行、Skill Registry 查询）

### 4.3 策略模式插拔点

| 接口 | 默认实现 | 环境变量 |
|------|---------|---------|
| `AgentAdapter` | `DeepSeekAdapter` | `AGENT_ADAPTER=deepseek` |
| `EmbeddingStrategy` | `DeepSeekEmbedding` | `EMBEDDING_STRATEGY=deepseek` |
| `ChunkingStrategy` | `RecursiveChunker` | `CHUNKING_STRATEGY=recursive` |
| `VectorStoreBackend` | `PgVector` | `VECTOR_BACKEND=pgvector` |
| `QueueBackend` | `RabbitMQ` | `QUEUE_BACKEND=rabbitmq` |
| `ExecutionStrategy` | `DAGExecutor` | `EXECUTION_STRATEGY=dag` |

---

## 5. 数据库核心设计

### 5.1 表清单

| 表 | 用途 | 关键字段 |
|----|------|---------|
| `agents` | Agent 配置 | id, system_prompt, adapter_name, model_id, tool_names, is_orchestrator, is_builtin |
| `conversations` | 会话 | id, mode (single/group), agent_ids[], pinned_at |
| `messages` | 消息 | id, conversation_id, role, parts (JSONB), status |
| `agent_runs` | 运行记录 | id, agent_id, status (queued/running/complete/failed/aborted), parent_run_id, usage (JSONB) |
| `artifacts` | 产物 | id, conversation_id, type, content (JSONB), version, parent_artifact_id |
| `workspaces` | 工作区 | id, conversation_id, root_path, mode (sandbox/local), bound_path |
| `app_settings` | 全局设置 | id, *_api_key, companion_mode |
| `shared_knowledge` | 共享知识 | id, source_agent, content, embedding (VECTOR(768)), knowledge_type, stale_since |
| `skill_templates` | Skill 模板 | id, name, version, workflow_definition (JSONB), parameter_schema (JSONB) |
| `audit_logs` | 审计日志 | id, source_agent, action, detail (JSONB), previous_entry_hash |
| `context_summaries` | 上下文压缩 | id, conversation_id, summary, covered_until_message_id |

### 5.2 关键索引

- `messages(conversation_id, created_at DESC)` — 会话时间线
- `agent_runs(parent_run_id)` — Orchestrator 查询子任务
- `shared_knowledge USING ivfflat (embedding vector_cosine_ops)` — 向量检索
- `shared_knowledge(knowledge_type, created_at DESC) WHERE stale_since IS NULL` — 时效过滤
- `audit_logs(created_at DESC)` — 审计时间线

---

## 6. 非功能需求

### 6.1 性能

- SSE 首字节延迟 < 500ms（从用户发送到第一个 token 出现）
- 工具调用（MCP Gateway 代理）P99 < 2s
- 向量检索（10 万条）P99 < 100ms
- 前端首屏加载 < 3s

### 6.2 安全

- LLM 输出视为不可信输入
- 文件操作限制在 Workspace 有效路径内
- Bash 命令经双平台黑名单过滤（POSIX / Windows）
- API Key 优先级：agent.apiKey > app_settings > process.env
- 生成的 HTML 在 sandboxed iframe 中渲染
- MCP Gateway 层工具调用需鉴权

### 6.3 可扩展性

- 所有关键组件通过策略接口插拔
- 每个服务独立 Docker 容器，可独立扩缩
- RabbitMQ 消费者可独立扩展
- PostgreSQL 连接池可配置

### 6.4 可观测性

- 结构化日志（JSON 格式，traceId 关联）
- Token 用量实时记录 + 按 Agent/Conversation 聚合
- 审计日志 append-only + SHA-256 哈希链防篡改

---

## 7. 里程碑规划

| 里程碑 | 内容 | 预计 |
|--------|------|------|
| **M1: 项目骨架** | monorepo 初始化、Docker Compose、所有服务 health 端点、CLAUDE.md、docs 体系 | 当前 |
| **M2: Core Engine 核心** | AgentRunner + DeepSeekAdapter + ToolExecutor + EventBus + SSE | M1 之后 |
| **M3: 前端基础** | 三栏布局 + SSE 客户端 + MessagePart 渲染 + 会话管理 + Agent 创建 | M2 之后 |
| **M4: 外围服务** | MCP Gateway (Go) 代理 1 工具 + Skill Registry CRUD + Knowledge Base 向量写入检索 + Observability 基础 | 可与 M2/M3 并行 |
| **M5: 集成联调** | 全栈端到端跑通：前端→Core→Adapter→LLM→Tool→MCP Gateway→产物→前端 | M2-M4 之后 |
| **M6: Phase 2 启动** | Orchestrator DAG、HITL 审批、多 Transport、成本追踪 | M5 之后 |

---

## 8. 验收标准

### M1 验收
- [ ] `docker compose up` 一键启动所有服务
- [ ] 每个服务暴露 `/health` 端点且返回 200
- [ ] pnpm typecheck 全仓库通过
- [ ] CLAUDE.md + docs/ 目录完整

### M2 验收
- [ ] 单 Agent 对话（DeepSeek）流式返回，SSE 推送到客户端
- [ ] 内置 254 个 Agent 可通过 API 按分类查询，完整 systemPrompt 按需加载
- [ ] write_artifact 创建产物并持久化到 PostgreSQL
- [ ] 所有 LLM 调用带 AbortSignal

### M3 验收
- [ ] 三栏布局可创建会话、发送消息、查看流式响应
- [ ] MessagePart 各类型正确渲染（text/thinking/tool_use/tool_result/artifact_ref）
- [ ] Agent 创建表单：输入画像 → 匹配模板 → LLM 补全 → 确认创建
- [ ] 产物预览（web_app iframe + document markdown）

### M4 验收
- [ ] MCP Gateway 成功代理至少 1 个 MCP Server 的工具调用
- [ ] Skill Registry 可创建、查询、版本管理 Skill 模板
- [ ] Knowledge Base 可写入 embedding 并基于向量相似度检索
- [ ] Observability 记录 token 使用并支持按 Agent 聚合查询

### M5 验收
- [ ] 前端发送消息 → 后端 Agent 回复 → 工具调用 → 产物创建 → SSE 推送前端 → 渲染
- [ ] 无 console.log 残留
- [ ] 异常场景有明确错误提示

---

## 9. 风险与假设

| 风险 | 缓解措施 |
|------|---------|
| DeepSeek API 不稳定或限流 | Adapter 层内置指数退避重试；后续接入 Anthropic/OpenAI 做降级链 |
| Go 服务开发经验不足 | MCP Gateway MVP 范围控制在 JSON-RPC 代理，暂不做复杂特性 |
| 多服务调试复杂度高 | Docker Compose + 统一日志格式 + traceId 关联 |
| pgvector 性能不达预期 | 当前规模足够；预留 VectorStoreBackend 策略接口可切换到 FAISS |
| RabbitMQ 运维负担 | MVP 可用 Redis Pub/Sub 替代；QueueBackend 策略接口支持切换 |
| 254 个内置 Agent 的 seed 数据量 | 按需懒加载：启动时不全部注入内存，按分类索引、按需加载 Agent 详情 |

---

## 10. 内置 Agent 导入机制

AgentHub 内置 Agent 来源于 [agency-agents](https://github.com/msitarzewski/agency-agents) 开源库（MIT License），共 254 个角色，覆盖 18 个业务领域。

### 10.1 分类体系

| 分类 | 数量 | 典型角色 |
|------|------|---------|
| engineering | 33 | Frontend Developer, Backend Architect, DevOps Automator, Code Reviewer, Software Architect |
| marketing | 36 | SEO Specialist, Content Creator, Xiaohongshu Specialist, TikTok Strategist, Growth Hacker |
| specialized | 53 | Business Strategist, Customer Service, Cultural Intelligence, Language Translator |
| strategy | 16 | Business Strategist, Innovation Strategist, Market Analyst, Digital Transformation |
| game-development | 20 | Game Designer, Level Designer, Unity Developer, Narrative Designer |
| gis | 13 | GIS Analyst, Cartographer, Remote Sensing, Spatial Database |
| security | 10 | Security Architect, Penetration Tester, Compliance Auditor, Incident Responder |
| design | 9 | UI Designer, UX Researcher, UX Architect, Brand Guardian, Whimsy Injector |
| sales | 9 | Outbound Strategist, Sales Engineer, Deal Strategist, Account Strategist |
| testing | 8 | QA Engineer, Reality Checker, Performance Tester, Accessibility Tester |
| project-management | 7 | Senior Project Manager, Scrum Master, Agile Coach, Program Manager |
| paid-media | 7 | PPC Strategist, Paid Social Strategist, Programmatic Buyer, Creative Strategist |
| finance | 5 | Financial Analyst, Investment Advisor, Tax Consultant, Risk Manager |
| academic | 5 | Research Assistant, Literature Reviewer, Data Analyst, Paper Editor |
| product | 5 | Product Manager, Product Designer, Product Strategist, Growth PM |
| examples | 5 | Starter templates for custom agent creation |
| spatial-computing | 6 | AR/VR Designer, 3D Developer, Spatial UX Specialist |
| support | 6 | Customer Support, Technical Support, Community Manager |
| integrations | 1 | Integration Specialist |

### 10.2 Agent 文件格式

每个 Agent 是一个 Markdown 文件，包含 YAML frontmatter + Markdown 正文：

```yaml
---
name: Senior Project Manager
description: Converts specs to tasks with realistic scope
color: blue
emoji: 📝
vibe: Detail-oriented, organized, client-focused
---

# Project Manager Agent Personality
You are **SeniorProjectManager**, a senior PM specialist...
```

### 10.3 导入流程

```
1. pnpm db:seed 扫描 agency-agents/ 全部 .md 文件
2. 解析 YAML frontmatter → name, description, emoji, category
3. 提取 Markdown 正文 → systemPrompt
4. 按分类推断 capabilities 标签
5. 默认设置：adapter=custom, modelProvider=deepseek, supportsVision=true
6. 工具集按分类预分配（工程类有 fs_read/fs_write/bash，营销类有 write_artifact）
7. 批量写入 agents 表（is_builtin=true）
```

### 10.4 运行时不全部加载

- 启动时只加载 Agent 元数据索引（id, name, emoji, category, description）
- Agent 完整 systemPrompt 按需从 DB 加载（用户选中或 @mention 时）
- 前端按分类 Tab 浏览，支持关键词搜索

---

*本文档与 `CLAUDE.md`、`docs/architecture/`、`docs/specs/` 配套。冲突时以本文档为准，直到 Phase 2 拆分出独立 spec。*
