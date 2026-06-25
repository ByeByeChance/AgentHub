# AgentHub 代码规范化实施计划

**日期**：2026-06-26  
**状态**：待审批  
**前提文档**：
- `docs/code-review-2026-06-26.md`（审查报告）
- `docs/industry-standards-gap-analysis-2026-06-26.md`（规范对照）
- `docs/designs/dialog-abstraction-plan.md`（弹窗抽取方案）

---

## 总览

| Phase | 名称 | 文件变更 | 预估时间 | 风险 |
|-------|------|---------|---------|------|
| **P0** | 紧急修复 | 3 文件 | 0.5h | 低 |
| **P1** | 弹窗组件抽取 | 4 新 + 3 改 | 2h | 低 |
| **P2** | Store 切片拆分 | 6 新 + 1 改 | 3h | 中 |
| **P3** | 前端组件拆分 | 8 新 + 6 改 | 4h | 中 |
| **P4** | 后端结构优化 | 5 新 + 4 改 | 3h | 中 |
| **P5** | 规范基础设施 | 3 文件 | 1h | 低 |
| **总计** | | ~45 文件 | **13.5h** | |

---

## Phase 0 — 紧急修复（🔴 必须立即修）

**风险**：低 | **时间**：0.5h

### 0.1 恢复 i18n 文案

**文件**：`frontend/src/components/chat/message-bubble.tsx`

```diff
- <DropdownMenuItem onClick={handleEditStart}>
-   <Pencil className="w-3.5 h-3.5 mr-2" /> Edit
+ <DropdownMenuItem onClick={handleEditStart}>
+   <Pencil className="w-3.5 h-3.5 mr-2" />
+   {t('edit')}

- {isUser ? 'Resend' : 'Retry'}
+ {isUser ? t('resend') : t('retry')}

- <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
+ <Trash2 className="w-3.5 h-3.5 mr-2" />
+ {t('delete')}
```

加回 `const t = useTranslations('message');`。

**文件**：`frontend/src/components/chat/assistant-message.tsx`

```diff
- <span className="text-xs text-muted-foreground">Thinking...</span>
+ <span className="text-xs text-muted-foreground">{t('thinking')}</span>

- Failed
+ {t('generationFailed')}

- Aborted
+ {t('generationAborted')}
```

添加 `import { useTranslations } from 'next-intl';` 和 `const t = useTranslations('message');`。

### 0.2 修复格式问题

**文件**：`frontend/src/components/chat/message-bubble.tsx` L294

```diff
- const userText= message.parts...
+ const userText = message.parts...
```

### 0.3 验证 next-env.d.ts

```bash
pnpm typecheck  # 确认 .next/dev/types/routes.d.ts 路径在 CI 中可用
```

**验证标准**：`pnpm typecheck` 通过 + `pnpm lint` 通过。

---

## Phase 1 — 弹窗组件抽取（🟡 设计和方案已完成）

**风险**：低 | **时间**：2h

### 1.1 创建基础文件（4 个新文件）

| # | 文件 | 行数 | 内容 |
|---|------|------|------|
| 1 | `frontend/src/lib/style-constants.ts` | ~10 | `FOCUS_CLASS` 常量 |
| 2 | `frontend/src/components/ui/dialog-form-field.tsx` | ~25 | Label + spacing 布局 |
| 3 | `frontend/src/components/ui/form-dialog.tsx` | ~50 | 弹窗壳组件 |
| 4 | `frontend/src/components/shared/agent-selector.tsx` | ~90 | Agent 复选框列表 |

### 1.2 迁移弹窗（3 个修改文件）

| # | 文件 | 重构前 | 重构后 | 使用的新组件 |
|---|------|--------|--------|-------------|
| 5 | `agent-create-dialog.tsx` | 158 | ~110 | FormDialog + DialogFormField |
| 6 | `conversation-create-dialog.tsx` | 233 | ~120 | FormDialog + DialogFormField + AgentSelector |
| 7 | `orchestrator-dialog.tsx` | 266 | ~140 | FormDialog + DialogFormField + AgentSelector |

### 1.3 写测试（4 个测试文件）

| # | 测试文件 |
|---|---------|
| 8 | `__tests__/components/ui/form-dialog.test.tsx` |
| 9 | `__tests__/components/shared/agent-selector.test.tsx` |
| 10 | 更新 `agent-create-dialog` 测试 |
| 11 | 更新 `conversation-create-dialog` 测试 |

**验证标准**：三个弹窗所有交互正常（打开/关闭/Select 不误关/提交/取消/Loading），`pnpm test` 通过。

---

## Phase 2 — Store 切片拆分（🔴 架构级改动）

**风险**：中（改全局状态管理，需全量回归） | **时间**：3h

### 2.1 创建 Slices（5 个新文件）

```
frontend/src/store/
├── index.ts                        # 修改：组合 slices（~20 行）
├── initial-state.ts                # 新增：提取初始状态常量（~30 行）
├── slices/
│   ├── conversation-slice.ts       # 新增：fetch/create/pin/archive（~60 行）
│   ├── message-slice.ts            # 新增：sendMessage/delete/resend + SSE 流解析（~120 行）
│   ├── agent-slice.ts              # 新增：fetch/fetchDetail/create（~60 行）
│   ├── ui-slice.ts                 # 新增：15 个 UI setter（~80 行）
│   └── settings-slice.ts           # 新增：apiKey + theme（~40 行）
└── interfaces/                     # 保持不变
```

### 2.2 提取 SSE 流解析

```
frontend/src/lib/stream-parser.ts   # 新增：纯函数（~40 行）
```

从 `message-slice.ts` 的 `sendMessage` 方法中提取 `parseSSEStream()`。

### 2.3 关键约束

- Slice 之间通过 `get()` 跨切片读状态
- 保持 `immer` middleware 不变
- 每个 slice 签名：`StateCreator<AgentHubStore, [['zustand/immer', never]], [], SliceType>`
- 组件层导入路径不变（仍从 `@/store/index` import `useStore`）

**验证标准**：
- `pnpm typecheck` 通过
- `pnpm test` 全部通过（现有 store reducer 测试 + selector 测试）
- 手动验证：创建会话 → 发消息 → Agent 回复 → 流式停止 → 切换 Agent

---

## Phase 3 — 前端组件拆分（🟡）

**风险**：中 | **时间**：4h

### 3.1 text-part.tsx Markdown 渲染器提取

```
frontend/src/components/message-parts/
├── text-part.tsx                   # 修改：~30 行，调用 MarkdownRenderer
└── markdown/
    ├── index.ts                    # barrel
    ├── markdown-renderer.tsx       # 新增：Components 对象组装（~30 行）
    ├── code-block.tsx              # 新增：Fenced code（~30 行）
    ├── heading.tsx                 # 新增：h1-h4（~30 行）
    ├── table.tsx                   # 新增：table/thead/th/td（~35 行）
    ├── blockquote.tsx              # 新增（~10 行）
    └── list.tsx                    # 新增：ul/ol/li（~20 行）
```

### 3.2 chat-header.tsx 子组件提取

```
frontend/src/components/chat/
├── chat-header.tsx                 # 修改：~50 行
└── chat-header/
    ├── index.ts                    # barrel
    ├── agent-switcher.tsx          # 新增：Agent 切换下拉（~40 行）
    ├── message-search-bar.tsx      # 新增：搜索输入 + escape 关闭（~35 行）
    └── header-actions.tsx          # 新增：Pin + Archive + DetailPanel 按钮（~30 行）
```

### 3.3 message-bubble.tsx HoverActionMenu 提取

```
frontend/src/components/chat/
├── message-bubble.tsx              # 修改：~80 行
└── message-bubble/
    └── hover-action-menu.tsx       # 新增：hover 延迟 + DropdownMenu（~60 行）
```

### 3.4 detail-panel.tsx Tab 内容分离

```
frontend/src/components/layout/
├── detail-panel.tsx                # 修改：~40 行
└── detail-panel/
    ├── agent-detail-tab.tsx        # 新增（~90 行）
    └── artifact-list-tab.tsx       # 新增（~20 行）
```

### 3.5 api-key-manager.tsx 表单/列表分离

```
frontend/src/components/settings/
├── api-key-manager.tsx             # 修改：~40 行
└── api-key-manager/
    ├── api-key-form.tsx            # 新增（~60 行）
    └── api-key-list.tsx            # 新增（~70 行）
```

### 3.6 补齐 Barrel Exports

| 目录 | 文件 |
|------|------|
| `components/layout/` | `index.ts` ← AppShell, Sidebar, DetailPanel |
| `components/message-parts/` | `index.ts` ← TextPart, ThinkingPart, ToolUsePart, ToolResultPart, ArtifactRefPart, MessagePartRenderer |
| `store/selectors/` | `index.ts` ← 所有 selector |
| `store/reducers/` | `index.ts` ← stream-reducer |

**验证标准**：`pnpm typecheck` + `pnpm lint` + `pnpm test` 全部通过。每个拆分后的子组件有独立测试。

---

## Phase 4 — 后端结构优化（🟡）

**风险**：中 | **时间**：3h

### 4.1 orchestrator.ts 三阶段分解

```
services/core-engine/src/orchestrator/
├── index.ts                        # Orchestrator 类（~20 行）
├── orchestrator.ts                 # 修改：~30 行（调用 stage-1 → 2 → 3）
├── prompts.ts                      # 新增：PLAN + AGGREGATE 提示词常量（~40 行）
├── stage-1-create-plan.ts          # 新增（~50 行）
├── stage-2-execute-plan.ts         # 新增（~80 行）
├── stage-3-aggregate.ts            # 新增（~50 行）
├── plan-parser.ts                  # 保持不变
└── __tests__/
    ├── stage-1-create-plan.test.ts
    ├── stage-2-execute-plan.test.ts
    └── stage-3-aggregate.test.ts
```

### 4.2 agent-runner.ts 提取 stream-dispatcher

```
services/core-engine/src/services/
├── agent-runner.ts                 # 修改：~80 行（主循环骨架）
├── stream-dispatcher.ts            # 新增：chunk → EventEnvelope + DB append（~80 行）
└── tool-loop.ts                    # 新增：单轮 tool execution（~80 行）
```

### 4.3 core-engine index.ts 分解

```
services/core-engine/src/
├── index.ts                        # 修改：~10 行（createApp + listen）
├── app.ts                          # 新增：createApp() 组装插件（~30 行）
├── plugins/
│   ├── cors.ts                     # 新增
│   ├── auth.ts                     # 新增
│   ├── routes.ts                   # 新增：registerAllRoutes()
│   └── database.ts                 # 新增：DB 连接插件
├── config/
│   └── env.ts                      # 新增：环境变量 Zod 校验
```

### 4.4 cross-review.ts 分解

```
services/core-engine/src/reliability/
├── cross-review.ts                 # 修改：~50 行（主入口）
└── cross-review/
    ├── review-prompt.ts            # 新增
    ├── single-reviewer.ts          # 新增
    └── review-aggregator.ts        # 新增
```

**验证标准**：`pnpm test:coverage` 覆盖率 ≥ 之前水平。现有集成测试全部通过。

---

## Phase 5 — 规范基础设施（🟢）

**风险**：低 | **时间**：1h

### 5.1 ESLint 规则补充

**文件**：`frontend/.eslintrc.json`（或 `eslint.config.mjs`）

```json
{
  "rules": {
    "max-lines": ["warn", { "max": 300, "skipBlankLines": true, "skipComments": true }],
    "max-lines-per-function": ["warn", { "max": 80 }],
    "import/no-cycle": "error",
    "react/no-array-index-key": "error",
    "@typescript-eslint/no-explicit-any": "error"
  },
  "overrides": [
    {
      "files": ["**/*.tsx"],
      "rules": {
        "max-lines": ["warn", { "max": 200, "skipBlankLines": true, "skipComments": true }]
      }
    },
    {
      "files": ["**/__tests__/**"],
      "rules": {
        "max-lines": "off",
        "max-lines-per-function": "off"
      }
    }
  ]
}
```

### 5.2 删除 .env.example 中的废弃变量（如有）

核对 `DEEPSEEK_MODEL_ID`、`AGENT_ADAPTER` 等变量是否仍在使用。

### 5.3 `pnpm lint --fix` 全量扫描

修复所有 auto-fixable 的 lint 问题。

**验证标准**：`pnpm lint` 0 error 0 warn。

---

## 执行顺序依赖

```
Phase 0 (紧急修复)
  └→ Phase 1 (弹窗抽取)
       └→ Phase 3 (组件拆分)
            └→ Phase 5 (ESLint)

Phase 2 (Store 切片) ← 独立，可并行
Phase 4 (后端优化)   ← 独立，可并行
```

---

## 回滚策略

- 每个 Phase 在独立分支上进行
- Phase 完成后 `pnpm typecheck && pnpm lint && pnpm test` 全部通过才合并
- 如 Phase 2 出问题，可独立回滚而不影响 Phase 1/3/4

---

## 完成标准

- [ ] `pnpm typecheck` 0 error
- [ ] `pnpm lint` 0 error 0 warn
- [ ] `pnpm test` 全部通过
- [ ] `pnpm test:coverage` 覆盖率 ≥ 之前水平
- [ ] 前端所有弹窗交互手动验证通过
- [ ] 前端 SSE 流式消息正常收发
- [ ] 后端所有 API 端点正常响应
- [ ] `store/index.ts` < 30 行
- [ ] 0 个组件超过 200 行
- [ ] 0 个文件超过 300 行
