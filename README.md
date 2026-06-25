# AgentHub

把多 Agent 协作做成 IM 群聊体验。

Agent 是「联系人」，对话是「工作空间」，Orchestrator 是「群里的项目经理」——在不可靠的 LLM 基座上建造可靠的 Agent 系统。

## 快速开始

```bash
pnpm install
cp .env.example .env.local   # 填入 DEEPSEEK_API_KEY
pnpm dev                      # 打开 http://localhost:3000
```

> 开发模式无需 Docker，服务自动降级到内存实现。

## 特性

- **IM 风格多 Agent 协作** — 单 Agent 对话 / 群组 Orchestrator DAG 编排
- **六层可靠性栈** — 从 LLM 认知到系统安全网，层层递进
- **策略插拔** — Adapter、Embedding、Queue、Auth 等 12 个接口可运行时替换
- **SSE 流式传输** — 思考过程、工具调用、产物生成全程可见
- **国际化** — 默认中文，英文备选，URL 自动带 locale 前缀
- **Docker 一键部署** — PostgreSQL + pgvector + Redis + RabbitMQ

## 技术栈

Next.js 16 · React 19 · Fastify 5 · TypeScript (strict) · Go · Drizzle · PostgreSQL + pgvector · Redis · RabbitMQ · Zustand

## 项目结构

```
agenthub/
├── frontend/           # Next.js 16 三栏 IM UI + next-intl i18n
├── packages/
│   ├── contracts/      # Event Envelope 协议（语言无关 JSON Schema）
│   └── shared/         # 策略接口 + 可靠性组件
├── services/
│   ├── core-engine/    # Agent 生命周期 + Orchestrator + EventBus
│   ├── mcp-gateway/    # Go · MCP 工具网关（发现/路由/鉴权/限流）
│   ├── skill-registry/ # Skill 模板 CRUD + 版本管理
│   ├── knowledge-base/ # Embedding + pgvector 检索 + 三层记忆
│   └── observability/  # Token 追踪 + 成本聚合 + 审计链
└── docs/               # 架构文档 / 接口规格 / ADR 决策
```

## 常用命令

```bash
pnpm dev           # 启动开发环境（frontend :3000 + core-engine :3001）
pnpm build         # 构建全部
pnpm test          # 运行全部测试
pnpm typecheck     # TypeScript 类型检查
pnpm lint          # ESLint
pnpm e2e           # Playwright E2E
```

## 文档

| 文档 | 说明 |
|------|------|
| [CLAUDE.md](./CLAUDE.md) | AI 协作规则 · 代码风格 · TDD 约束 |
| [架构全景图](./docs/architecture/overview.md) | 服务拓扑 · 策略矩阵 · 数据流 |
| [接口规格](./docs/specs/) | 各服务 API 契约 |
| [ADR](./docs/decisions/) | 架构决策记录 |
| [PRD](./docs/superpowers/specs/2026-06-24-agenthub-prd.md) | 产品需求文档 |

## License

MIT
