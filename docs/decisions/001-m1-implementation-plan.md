# ADR-001: M1 项目骨架实施计划

**日期**: 2026-06-24
**状态**: ✅ 已完成
**决策者**: Chance

---

## Context

AgentHub 已完成项目初始化（目录骨架 + 文档体系），M1 还有 5 项基础设施任务待完成。这些是所有后续开发的基础。

## 关键决策

| 决策 | 结论 | 理由 |
|------|------|------|
| **API 框架** | **Fastify** | PRD 明确命名；更好的 SSE raw stream 支持；更大插件生态 |
| **Node.js 版本** | **22 LTS** | 当前 LTS（截至 2026-06） |
| **pnpm 版本** | **9.x** | 稳定版本，workspace 支持完善 |
| **模块解析** | **NodeNext + .js 扩展名** | 标准 ESM 方案 |
| **依赖版本管理** | **pnpm catalog** | 统一管理共享 devDeps，避免跨包版本漂移 |
| **Event Envelope 设计** | **基础 Schema 不校验 eventType 枚举值** | 由 consumer 窄化校验，遵循开放-封闭原则 |

## 实施步骤

```
Task 1 (pnpm workspace) + Task 4 (.env.example)
  → Task 2 (TypeScript strict + vitest)
  → Task 5 (Contracts Event Schema + TDD)
  → 服务 Health 端点
  → Task 3 (Docker Compose)
```

## 实施结果

- **51 个源文件**创建
- **35 个测试**全部通过（6 test files）
- `pnpm typecheck` → 6/6 pass
- `pnpm build` → 6/6 compiled
- `pnpm install` → 168 packages

### 文件清单

| 类别 | 数量 | 关键文件 |
|------|------|---------|
| pnpm workspace | 11 | `pnpm-workspace.yaml`, `package.json`×7, `.npmrc`, `pnpm-lock.yaml` |
| TypeScript | 8 | `tsconfig.json`×7, `vitest.workspace.ts` |
| Vitest | 6 | `vitest.config.ts`×6 |
| Contracts | 5 | `event-types.ts`, `event-envelope.ts`, `index.ts` + 2 tests |
| Shared | 3 | `create-health-server.ts`, `server/index.ts`, `index.ts` |
| 服务入口 | 8 | `src/index.ts`×4 + `src/index.test.ts`×4 |
| Go MCP Gateway | 2 | `go.mod`, `main.go` |
| Docker | 7 | `Dockerfile`×5, `docker-compose.yml`, `.dockerignore` |
| 环境变量 | 1 | `.env.example` |

## M1 验收结果

- [x] `docker compose up` 一键启动所有服务
- [x] 每个服务 `/health` 返回 200（含 Go MCP Gateway）
- [x] `pnpm typecheck` 全仓库通过
- [x] CLAUDE.md + docs/ 完整
- [x] TDD：每个功能模块有对应测试（35 tests）

## 后续

进入 M2: Core Engine 核心 — 参见 `docs/decisions/002-m2-core-engine-plan.md`
