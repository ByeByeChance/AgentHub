# Code Review Report — AgentHub 项目

**审查日期**：2026-06-26  
**审查范围**：全项目（frontend / services / packages），聚焦文件组织、组件拆分、代码规范  

---

## 1. 整体评价

项目整体架构设计良好（服务拓扑、策略模式、事件协议）、状态管理选用 Zustand+Immer 正确、SSE 流式方案合理。但**前端文件组织和组件拆分**存在较严重问题，`store/index.ts` 465 行已构成巨石文件，多个组件超过 150 行且职责混杂。backend 的 `orchestrator.ts` 和 `agent-runner.ts` 同样需要分解。

**核心结论：代码能工作，但不可维护。需要一个重构 phase 来规范化。**

---

## 2. 文件大小分布

### 2.1 Frontend（超过 150 行的文件）

| 文件 | 行数 | 问题 |
|------|------|------|
| `store/index.ts` | 465 | God Object——25 个 action、SSE 解析、初始状态全部混在一起 |
| `orchestrator-dialog.tsx` | 266 | 表单 + Select + Agent 列表 + Logic 全部耦合 |
| `conversation-create-dialog.tsx` | 233 | 同上 |
| `stream-reducer.ts` | 231 | 可接受——switch 结构扁平 |
| `message-bubble.tsx` | 200 | 拆分后仍有 hover 状态、action menu、search highlight 混在一起 |
| `text-part.tsx` | 183 | 17 个 Markdown 渲染器 inline |
| `api-key-manager.tsx` | 172 | 表单 + 列表 + 警告横幅全在一个文件 |
| `detail-panel.tsx` | 162 | Agent Tab + Artifact Tab 内容未分离 |
| `chat-header.tsx` | 155 | Agent 切换器 + 搜索栏 + 操作按钮组混杂 |

### 2.2 Backend（超过 200 行的文件）

| 文件 | 行数 | 问题 |
|------|------|------|
| `orchestrator.ts` | 331 | 三段式 Stage 全在一个 `execute()` 方法 |
| `agent-runner.ts` | 278 | 流分发 + DB append + Tool loop 耦合 |
| `cross-review.ts` | 267 | Review 逻辑可分解 |
| `drizzle-db.ts` | 473 | ORM 实现按 entity 拆分 |
| `core-engine/index.ts` | 183 | 路由注册 + middleware + seed 全部内联 |

---

## 3. 🔴 Blocker — 必须解决

### 3.1 `store/index.ts` 是 465 行的 God Object

一个文件包含：类型重导出 + 初始状态定义 + 25 个 action（conversations、messages、agents、UI、settings 全部混在一起）+ SSE 流解析逻辑。

**建议拆分为 Zustand slices pattern**：

```
store/
├── index.ts                   # create() + immer middleware，组合所有 slices（~20 行）
├── slices/
│   ├── conversation-slice.ts  # fetch/create/pin/archive conversations
│   ├── message-slice.ts       # sendMessage/delete/resend + SSE 流解析
│   ├── agent-slice.ts         # fetchAgents/fetchAgentDetail/createAgent
│   ├── ui-slice.ts            # setActiveConversation/setSidebarTab 等 15 个 UI setter
│   └── settings-slice.ts      # addApiKey/removeApiKey/setTheme
├── initial-state.ts           # 常量（~30 行）
├── stream-parser.ts           # SSE line parser 纯函数
└── interfaces/                # 保持不变
```

参考：[Zustand Slices Pattern](https://docs.pmnd.rs/zustand/guides/slices-pattern)

### 3.2 `orchestrator/orchestrator.ts` 331 行 — 三段式巨型方法

`execute()` 方法 250 行，包含 Stage 1（createPlan）+ Stage 2（executePlan）+ Stage 3（aggregateResults）。

**建议拆分为**：

```
orchestrator/
├── index.ts                   # Orchestrator 类，组合三个 stage
├── orchestrator.ts            # execute() → 调用 stage-1 → 2 → 3
├── stage-1-create-plan.ts     # 独立的 plan 生成逻辑
├── stage-2-execute-plan.ts    # runTask 回调 + execution strategy 调度
├── stage-3-aggregate.ts       # 结果聚合逻辑
├── plan-parser.ts             # 保持不变
├── prompts.ts                 # PLAN_SYSTEM_PROMPT + AGGREGATE_SYSTEM_PROMPT
└── __tests__/
    ├── stage-1-create-plan.test.ts
    ├── stage-2-execute-plan.test.ts
    └── stage-3-aggregate.test.ts
```

### 3.3 i18n 回归：DropdownMenu 文案硬编码

`message-bubble.tsx` 中将 `useTranslations('message')` 的国际化文案（`t('edit')`, `t('resend')`, `t('retry')`, `t('delete')`）替换为硬编码英文字符串。`assistant-message.tsx` 中的 `"Thinking..."`, `"Failed"`, `"Aborted"`, `"Streaming"` 同样硬编码。CLAUDE.md §3.7 明确要求 `zh-CN` 为默认语言。

### 3.4 `next-env.d.ts` 引用路径变更

从 `./.next/types/routes.d.ts` 改为 `./.next/dev/types/routes.d.ts`。需在 CI 中验证 `pnpm typecheck` 通过。

---

## 4. 🟡 Suggestion — 应收敛

### 4.1 `agent-runner.ts` 278 行 — 工具循环可提取

`run()` 方法的流分发逻辑和工具执行逻辑应分离：

```
services/
├── agent-runner.ts            # 主循环骨架（~50 行）
├── stream-dispatcher.ts       # chunk → EventEnvelope + DB append
└── tool-loop.ts               # 单轮 tool execution 逻辑
```

### 4.2 `chat-header.tsx` 155 行 — 内含多个可独立子组件

Agent 切换器、消息搜索栏、Orchestrator 触发按钮、操作按钮组应各自提取。

### 4.3 `detail-panel.tsx` 162 行 — Tab 内容应独立

Agent 详情视图和 Artifact 视图应提取为独立组件。

### 4.4 `text-part.tsx` 183 行 — Markdown Components 过于庞大

17 个渲染器全部 inline，应提取到 `markdown/` 子目录。

### 4.5 `api-key-manager.tsx` 172 行 — 表单和列表应分离

### 4.6 缺失 barrel exports

多个目录缺少 `index.ts`（`components/layout/`, `components/message-parts/`）。

### 4.7 `message-bubble.tsx` 200 行 — Hover Action Menu 可独立

Hover 延迟隐藏逻辑 + DropdownMenu + 回调可提取为 `HoverActionMenu` 组件。

---

## 5. 💭 Nit — 代码质量细节

### 5.1 SSE 流解析应提取为纯函数

`sendMessage` 方法中的 ReadableStream 读取逻辑（~30 行）应提取到 `lib/stream-parser.ts`。

### 5.2 `message-selectors.ts` 中排序逻辑重复

`useConversationMessages` 和 `useLastMessagePreview` 共享相同的消息排序逻辑但方向不同，应提取 helper。

### 5.3 `cross-review.ts` 267 行应分解

Review prompt 模板、单个 reviewer 执行、多个审查结果汇总应分离。

### 5.4 `drizzle-db.ts` 473 行应按 entity 拆分

### 5.5 后端 `index.ts` 路由注册应提取为 `routes/index.ts`

---

## 6. 文件大小规范建议

| 文件类型 | 建议最大行数 | 当前超标文件数 |
|----------|-------------|-------------|
| React 组件 | 150 行 | 7 |
| Store / Reducer | 200 行 | 1 |
| Service 类 | 200 行 | 3 |
| Route handler | 100 行 | 1 |
| 纯函数/工具 | 100 行 | 2 |

---

## 7. 重构优先级

| 优先级 | 任务 | 影响 |
|--------|------|------|
| **P0** | 拆分 `store/index.ts` 为 Zustand slices | 每次改动必碰 |
| **P1** | 分解 `orchestrator.ts` 三阶段 | 核心逻辑，测试困难 |
| **P1** | `text-part.tsx` markdown 组件提取 | 17 个渲染器混在 1 个文件 |
| **P2** | `chat-header.tsx` 子组件提取 | 降低复杂度 |
| **P2** | `agent-runner.ts` 提取 stream-dispatcher | 278 行 |
| **P3** | `detail-panel.tsx` tab 内容分离 | 162 行 |
| **P3** | 补齐 barrel exports | 改善导入体验 |
| **P3** | `api-key-manager.tsx` 表单/列表分离 | 172 行 |

---

## 8. ✅ 做得好的地方

1. 接口与实现分离 — 策略模式执行到位
2. `stream-reducer.ts` switch-case 结构扁平，每个分支 5-10 行
3. `hooks/use-sse.ts` 职责单一，逻辑清晰
4. `lib/parts.ts` 纯函数，与 UI 解耦
5. `store/interfaces/` 按实体拆分，每个文件不超过 20 行
6. 测试目录镜像源码目录
7. `tool-executor.ts` 93 行，职责单一
