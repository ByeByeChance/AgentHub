# 业界规范对照分析与优化建议 — AgentHub

**日期**：2026-06-26  
**前提**：先阅读 `docs/code-review-2026-06-26.md`（审查报告），本文是其规范对照补充。

---

## 1. 研究方法

对照以下业界权威规范逐一审查项目：

| 规范来源 | 适用领域 |
|----------|---------|
| [Airbnb React/JSX Style Guide](https://github.com/airbnb/javascript) | 组件结构、命名、Props 规范 |
| [Google TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html) | 文件组织、SRP、导出规范 |
| [Bulletproof React](https://github.com/alan2207/bulletproof-react) (~12.7k⭐) | 项目结构、Feature 组织、状态分层 |
| [Next.js Official Best Practices](https://nextjs.org/docs) | App Router、Server/Client Component 分离 |
| [Zustand Official Docs](https://zustand.docs.pmnd.rs) | Store 切片模式、Selector 模式 |
| [Fastify Best Practices](https://github.com/goldbergyoni/nodejs-testing-best-practices) | 后端分层、测试金字塔 |
| [Node.js Testing Best Practices](https://github.com/goldbergyoni/nodejs-testing-best-practices) (~3.3k⭐) | 测试结构、集成测试模式 |
| Tailwind CSS v4 + React 社区模式 | 变体管理、主题架构 |

---

## 2. 项目结构对照：Bulletproof React

### 2.1 当前结构 vs 推荐结构

**当前 AgentHub `frontend/src/`**：

```
src/
├── app/              # ✅ 正确 — Next.js App Router
├── components/       # ⚠️ 混合了共享组件和 feature 组件
│   ├── ui/           # ✅ 设计系统基础组件
│   ├── agent/        # ❌ 应移入 features/agent/
│   ├── artifact/     # ❌ 应移入 features/artifact/
│   ├── chat/         # ❌ 应移入 features/chat/
│   ├── conversation/ # ❌ 应移入 features/conversation/
│   ├── orchestrator/ # ❌ 应移入 features/orchestrator/
│   ├── layout/       # ✅ 布局组件保留
│   ├── message-parts/# ⚠️ 可归入 features/chat/
│   ├── providers/    # ✅ 全局 Provider
│   └── settings/     # ❌ 应移入 features/settings/
├── store/            # ⚠️ 无 features/ 层
├── hooks/            # ✅ 全局 hooks
├── lib/              # ✅ 工具函数
└── i18n/             # ✅ 国际化
```

**Bulletproof React 推荐结构**：

```
src/
├── app/              # 路由、布局、App 入口
├── components/       # 仅共享组件（ui/、layout/）
├── features/         # 🆕 按业务领域组织
│   ├── chat/
│   │   ├── components/   # ChatPanel, MessageList, MessageInput
│   │   ├── hooks/        # useSSE (从全局 hooks/ 移入)
│   │   └── store/        # chat 相关 state（如果独立）
│   ├── agents/
│   ├── conversations/
│   ├── orchestrator/
│   ├── artifacts/
│   └── settings/
├── hooks/            # 全局共享 hooks（如 useTheme）
├── lib/              # 第三方库的 re-export + 工具
├── stores/           # 🆕 全局 Zustand stores（改名，与 features/store/ 区分）
├── types/            # 🆕 全局共享类型
├── config/           # 🆕 环境变量、常量
└── testing/          # 🆕 测试工具、mock server
```

### 2.2 Feature 模块规范

每个 Feature 应是自包含模块，按需包含子目录：

```
features/<name>/
├── components/   # Feature 专用组件
├── hooks/        # Feature 专用 hooks
├── api/          # Feature 专用 API 调用
├── types/        # Feature 专用类型
├── utils/        # Feature 专用工具函数
└── index.ts      # 公共 API barrel export
```

**AgentHub 改造示例**：

```
# 当前
components/chat/message-bubble.tsx (200 行)
components/chat/user-message.tsx
components/chat/assistant-message.tsx
components/chat/chat-header.tsx (155 行)
components/chat/message-input.tsx
components/chat/message-list.tsx
components/chat/streaming-indicator.tsx

# 改造后
features/chat/
├── components/
│   ├── message-bubble.tsx         # ~80 行（提取 HoverActionMenu）
│   ├── message-bubble/
│   │   └── hover-action-menu.tsx  # 🆕 独立 hover 菜单组件
│   ├── user-message.tsx
│   ├── assistant-message.tsx      # ~102 行
│   ├── chat-header.tsx            # ~50 行
│   ├── chat-header/
│   │   ├── agent-switcher.tsx     # 🆕
│   │   ├── message-search-bar.tsx # 🆕
│   │   └── header-actions.tsx     # 🆕
│   ├── message-input.tsx
│   ├── message-list.tsx
│   └── streaming-indicator.tsx
├── hooks/
│   └── use-sse.ts                 # 从全局 hooks/ 移入
├── api/
│   └── chat-api.ts               # 🆕 sendMessage, stopStreaming API 封装
└── index.ts                       # 公共导出
```

### 2.3 Feature 隔离规则（ESLint 强制）

Bulletproof React 的核心约束，建议 AgentHub 采纳：

```typescript
// .eslintrc.js — no-restricted-imports
{
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [
        {
          group: ['@/features/*/*'],
          message: 'Features must only import from their own barrel index.ts. Use @/features/<name> instead.',
        },
      ],
    }],
    'import/no-cycle': 'error',  // 禁止循环依赖
  },
}
```

规则：Feature A 不直接 import Feature B → 跨 Feature 通信通过 `app/` 层的组合或全局 store 进行。

---

## 3. Zustand Store 对照规范

### 3.1 当前状态 vs 推荐模式

**当前**：`store/index.ts` 465 行，所有 action 在单个 StateCreator 中。

**Zustand 官方推荐**：[Slices Pattern](https://zustand.docs.pmnd.rs/learn/guides/flux-inspired-practice)

```typescript
// ✅ 推荐：StateCreator 切片模式
// stores/slices/conversation-slice.ts
export const createConversationSlice: StateCreator<
  AgentHubStore,           // 组合后的完整 store 类型
  [['zustand/immer', never]],  // middleware
  [],                      // 无额外依赖
  ConversationSlice        // 本切片返回类型
> = (set, get) => ({
  conversations: {},
  fetchConversations: async () => { /* ... */ },
  createConversation: async (input) => { /* ... */ },
  pinConversation: (id) => { /* ... */ },
  archiveConversation: (id) => { /* ... */ },
});
```

```typescript
// stores/index.ts — 组合所有切片（~20 行）
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { createConversationSlice } from './slices/conversation-slice';
import { createMessageSlice } from './slices/message-slice';
import { createAgentSlice } from './slices/agent-slice';
import { createUISlice } from './slices/ui-slice';
import { createSettingsSlice } from './slices/settings-slice';

export const useStore = create<AgentHubStore>()(
  immer((...args) => ({
    ...createConversationSlice(...args),
    ...createMessageSlice(...args),
    ...createAgentSlice(...args),
    ...createUISlice(...args),
    ...createSettingsSlice(...args),
  })),
);
```

### 3.2 Selector 最佳实践

**当前问题**：多处组件直接从 store 解构多个字段，可能触发不必要的 re-render。

```typescript
// ❌ 当前 — 每个 useStore 调用订阅整个 store
const isStreaming = useStore((s) => s.ui.isStreaming);
const activeId = useStore((s) => s.ui.activeConversationId);
const setActive = useStore((s) => s.setActiveConversation);
// ... 15+ 个独立 selector

// ✅ 推荐 — 使用 shallow 合并多个 primitive selector
import { useShallow } from 'zustand/react/shallow';

const { isStreaming, activeConversationId, isDetailPanelOpen } = useStore(
  useShallow((s) => ({
    isStreaming: s.ui.isStreaming,
    activeConversationId: s.ui.activeConversationId,
    isDetailPanelOpen: s.ui.isDetailPanelOpen,
  })),
);
```

### 3.3 Zustand Middleware 栈

当前使用了 `immer`，建议加上 `devtools`：

```typescript
import { devtools } from 'zustand/middleware';

export const useStore = create<AgentHubStore>()(
  devtools(
    immer((...args) => ({ /* slices */ })),
    { name: 'AgentHubStore' },
  ),
);
```

---

## 4. Tailwind CSS v4 组件设计模式对照

### 4.1 当前问题

1. **className 重复和内联样式值过多**：多处组件有相似的 `rounded-lg`, `text-sm`, `h-9` 等组合，形成隐式的"变体"但未提取。

2. **缺少 CVA（class-variance-authority）**：项目中按钮有 `variant="ghost"` `size="icon"` 但未用 CVA 统一管理 variant → className 的映射。

3. **主题切换**：当前 theme 通过 `settings.theme` 在 store 中管理。Tailwind v4 更推荐 CSS 变量 + `data-theme` 属性驱动，但当前已有 `ThemeInitScript` 和 `theme-toggle.tsx`，保持了基本可用性。

### 4.2 建议：引入 CVA 管理变体

```typescript
// components/ui/button-variants.ts
import { cva, type VariantProps } from 'class-variance-authority';

export const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-lg font-medium interactive press-scale',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-muted/50',
        outline: 'border border-border hover:bg-muted/50',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
      },
      size: {
        icon: 'w-8 h-8',
        sm: 'h-7 px-2 text-xs',
        md: 'h-9 px-3 text-sm',
        lg: 'h-10 px-4 text-base',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export type ButtonVariants = VariantProps<typeof buttonVariants>;
```

### 4.3 建议：提取共享的 FOCUS_CLASS 常量

当前 `conversation-create-dialog.tsx` 和 `orchestrator-dialog.tsx` 中重复定义了 `FOCUS_CLASS`。应提取到：

```typescript
// lib/style-constants.ts
export const FOCUS_CLASS =
  'focus-visible:ring-0 focus-visible:border-primary/50 focus-visible:shadow-[0_0_0_1px_hsl(var(--primary)/0.15)] transition-[border-color,box-shadow]';
```

---

## 5. Airbnb React Style Guide 对照

### 5.1 已遵守 ✓

- ✅ 每个文件一个主要组件
- ✅ PascalCase 文件名
- ✅ Props 解构
- ✅ `camelCase` prop 名
- ✅ `alt` 属性在 `<img>` 标签上（`text-part.tsx` L959）
- ✅ 不用的 prop 不传 `true` 值

### 5.2 需要改进 ✗

| Airbnb 规则 | 当前违反 | 位置 |
|-------------|---------|------|
| **禁止 array index 作为 key** | `key={\`part-${i}\`}` | `assistant-message.tsx` L44 |
| **一个文件一个组件** | `text-part.tsx` 内联 17 个子渲染器 | `text-part.tsx` |
| **方法命名：handle* 前缀** | 部分 handler 命名不一致 | `message-bubble.tsx` `handleEdit`→ 已修复为 `handleEditStart` ✓ |
| **defaultProps 对所有非必填 prop** | 缺少 TypeScript 默认值 | 部分组件 |
| **禁止在 JSX 中使用 bind/arrow 函数** | `onClick={() => void handleSaveEdit()}` | 多处 |

关于最后一条——在 React 18+ 中，`useCallback` 已大幅减少了对 inline arrow function 的担忧（自动批处理），但 Airbnb 规范仍然推荐提取 handler。

### 5.3 Airbnb 组件排序规范

对于 Class Component（当前项目用 Function Component，但规范思路可借鉴）：

```typescript
// 推荐的 Function Component 内部排序
function MyComponent({ prop1, prop2 }: Props) {
  // 1. Hooks（useState → useEffect → useCallback → useMemo → useRef → 自定义 hooks）
  // 2. Derived state / computed values
  // 3. Event handlers
  // 4. Side effects
  // 5. Render helpers（子组件或条件渲染函数）
  // 6. Return JSX
}
```

当前 `message-bubble.tsx` 基本遵守了此顺序 ✓。

---

## 6. Google TypeScript Style Guide 对照

### 6.1 文件组织

Google 规定每个文件依次：License → `@fileoverview` JSDoc → imports → implementation。AgentHub 缺少文件级 JSDoc 注释（尤其是 `lib/` 和 `store/` 下的工具函数）。

**建议**：对关键工具文件添加 `@fileoverview`：

```typescript
/**
 * @fileoverview SSE 流解析器 — 将 ReadableStream<Uint8Array> 按 SSE 协议
 * 切分为 EventEnvelope 对象，通过回调分发。
 *
 * 使用方式：在 Zustand action 或独立 hook 中调用 parseSSEStream(stream, onEvent)。
 */
```

### 6.2 Barrel Export 规范

Google 推荐用 `index.ts` 做 barrel export 简化导入路径。当前缺失 barrel 的目录：

| 目录 | 状态 |
|------|------|
| `components/ui/` | ✅ 有 `index.ts`（部分，shadcn 默认不提供） |
| `components/layout/` | ❌ 缺失 |
| `components/message-parts/` | ❌ 缺失 |
| `store/selectors/` | ❌ 缺失 |
| `store/reducers/` | ❌ 缺失 |

### 6.3 Named Export 优先

Google 推荐 named export 而非 default export。当前项目使用 named export ✅。

---

## 7. Next.js 最佳实践对照

### 7.1 Server/Client Component 边界

| 当前状况 | 建议 |
|---------|------|
| `app/[locale]/layout.tsx` 是 Server Component ✅ | 保持 |
| `app/[locale]/chat/layout.tsx` 是 Client Component（因为 SSEProvider）| ⚠️ 可考虑将 SSEProvider 下沉到 page 层 |
| `LocaleClientWrapper` 作为 Client Boundary ✅ | 模式正确 |
| 大部分组件都有 `'use client'` 指令 | ⚠️ 评估哪些可以转为 Server Component |

### 7.2 `src/` 目录

Next.js 官方推荐使用 `src/` 目录。项目已使用 ✅。

### 7.3 Private Folder

Next.js 支持 `_` 前缀文件夹来隐藏实现细节。建议：

```
app/
├── [locale]/
│   └── chat/
│       └── [conversationId]/
│           └── page.tsx
└── _components/    # 🆕 不被路由但可被 page 引用的组件（可选）
```

### 7.4 路由组件瘦身

当前 `app/[locale]/chat/[conversationId]/page.tsx` 97 行，包含初始化逻辑、消息列表、输入框。建议将核心逻辑提取到 `features/chat/`，page 文件仅做 data fetching 和组件组合：

```typescript
// app/[locale]/chat/[conversationId]/page.tsx → ~30 行
export default async function ChatPage({ params }: PageProps) {
  const { conversationId } = await params;
  return <ChatFeature conversationId={conversationId} />;
}
```

---

## 8. 后端规范对照

### 8.1 Fastify 分层架构

**当前** `services/core-engine/src/`：

```
src/
├── routes/           # ✅ HTTP 层
├── services/         # ⚠️ 混合了业务逻辑和框架无关服务
├── adapters/         # ✅ 策略实现
├── orchestrator/     # ⚠️ 较独立但目录平级
├── execution/        # ✅ 策略实现
├── reliability/      # ✅ 可靠性组件
├── transport/        # ✅ 策略实现
├── observability/    # ✅
├── auth/             # ✅
└── db/               # ⚠️ seed 数据混在这里
```

**Fastify 社区推荐**：

```
src/
├── routes/           # Thin — 仅 req 解析 + 调 service + res
├── middleware/        # 🆕 auth, CORS, rate-limit 等 Fastify 中间件
├── services/         # 业务逻辑（不依赖 Fastify 类型）
├── repositories/     # 🆕 数据访问层（DB 查询）
├── schemas/          # 🆕 Zod/TypeBox schema 集中管理
├── plugins/          # 🆕 Fastify plugin 注册（如 DB 连接、Auth 装饰器）
├── adapters/         # 保持
├── config/           # 🆕 环境变量校验 + 常量
└── app.ts            # 🆕 服务器启动（替代 index.ts 的部分职责）
```

### 8.2 当前违反的原则

| 原则 | 违反处 | 影响 |
|------|--------|------|
| Routes 不应含业务逻辑 | `conversations.ts` (174 行) 包含 SSE streaming 编排逻辑、message 创建、agent 校验 | 测试困难 |
| 后端 `index.ts` 职责过重 | 183 行：路由注册、中间件、CORS、seed 全部内联 | 无法独立测试各组件的启动行为 |
| 缺少 Repository 层 | 当前 Service 直接操作 DB | 数据访问逻辑不可替换测试 |
| 缺少集中 schema 管理 | Zod schema 分散在各 route 文件中 | 跨路由复用困难 |

### 8.3 建议的 index.ts 拆分

```
# 当前
services/core-engine/src/index.ts (183 行 — 全在)

# 建议
services/core-engine/src/
├── app.ts              # ~30 行 — createApp() 组合所有 plugin
├── plugins/
│   ├── cors.ts         # CORS 配置
│   ├── auth.ts         # Auth middleware 注册
│   ├── routes.ts       # 路由注册函数
│   └── database.ts     # DB 连接插件
├── config/
│   └── env.ts          # 环境变量 Zod 校验（Fastify 推荐启动时 fail-fast）
└── index.ts            # ~10 行 — 调 createApp() + listen()
```

### 8.4 `orchestrator.ts` 拆分细化

```
services/core-engine/src/orchestrator/
├── index.ts                    # Orchestrator 类（~20 行）
├── prompts/
│   ├── plan-system-prompt.ts   # PLAN_SYSTEM_PROMPT 模板
│   └── aggregate-prompt.ts     # AGGREGATE_SYSTEM_PROMPT 模板
├── stage-1-create-plan.ts      # ~50 行
├── stage-2-execute-plan.ts     # ~80 行
├── stage-3-aggregate.ts        # ~50 行
├── plan-parser.ts              # 保持不变
└── __tests__/
    ├── stage-1-create-plan.test.ts
    ├── stage-2-execute-plan.test.ts
    └── stage-3-aggregate.test.ts
```

---

## 9. 测试规范对照

### 9.1 Node.js Testing Best Practices 对照

项目已遵守 ✅：
- 测试目录镜像源码目录
- 使用 Vitest（正确选型）
- 集成测试放在 `__tests__/api/` 下

需要改进 ✗：

| 规范 | 当前不足 |
|------|---------|
| **Component Test（集成测试）优先** | 当前单元测试占主导，缺少通过 HTTP API 测试完整服务链路的集成测试 |
| **5 个 Exit Door 断言** | 测试多只断言 response body，缺少 DB 状态验证和外部调用验证 |
| **生产 Migration 构建 Schema** | Drizzle 的 migration 机制是否在测试中使用需确认 |
| **测试数据隔离** | 需确认每个测试是否操作独立数据 |

### 9.2 Frontend 测试规范

建议补充的测试类型：

| 测试类型 | 工具 | 当前状态 |
|---------|------|---------|
| 组件单元测试 | Vitest + Testing Library | ⚠️ 覆盖不足（仅 store reducer 有测试） |
| Hook 测试 | `@testing-library/react-hooks` | ❌ 缺失 |
| 集成测试（组件交互） | Vitest + Testing Library | ❌ 缺失 |
| E2E | Playwright | ✅ `e2e/smoke.spec.ts` 存在 |

---

## 10. 优先级行动清单

### 🔴 立即执行（本周）

| # | 任务 | 依据 |
|---|------|------|
| 1 | 拆分 `store/index.ts` 为 Zustand slices | Zustand 官方 + Bulletproof React |
| 2 | 恢复 i18n 文案（`t('edit')` 等） | 项目自身 CLAUDE.md §3.7 |
| 3 | 修复 `next-env.d.ts` 路径，验证 `pnpm typecheck` | Google TS Guide — 构建稳定性 |
| 4 | 添加 `eslint-plugin-import` 的 `no-restricted-imports` 规则 | Bulletproof React Feature 隔离 |

### 🟡 本月执行

| # | 任务 | 依据 |
|---|------|------|
| 5 | 创建 `features/` 目录结构，迁移 chat/conversation/agent/orchestrator/settings | Bulletproof React |
| 6 | 分解 `orchestrator.ts` 三个 Stage | SRP + 可测试性 |
| 7 | `text-part.tsx` markdown 渲染器提取到 `markdown/` 子目录 | Airbnb 单文件单组件 |
| 8 | `chat-header.tsx` 子组件提取 | 150 行上限 |
| 9 | 后端 `index.ts` 提取 middleware + routes + plugins | Fastify 最佳实践 |
| 10 | 补齐所有 barrel exports | Google TS Style Guide |

### 🟢 本季度执行

| # | 任务 | 依据 |
|---|------|------|
| 11 | 重构目录结构：`components/` → `features/` + 全局 `components/` 分离 | Bulletproof React |
| 12 | 引入 CVA 管理 UI 变体 | Tailwind + shadcn/ui 社区规范 |
| 13 | 后端引入 Repository 层 | Fastify 分层架构 |
| 14 | 补全组件集成测试 + Hook 测试 | Testing Diamond |
| 15 | 集成测试增加 DB 状态验证 | Node.js Testing Best Practices |
| 16 | ESLint `max-lines` 规则（组件 200 行，其他 300 行） | 业界共识 |

---

## 11. 建议的 ESLint 规则补充

```json
{
  "rules": {
    // 文件大小
    "max-lines": ["warn", {
      "max": 300,
      "skipBlankLines": true,
      "skipComments": true
    }],
    "max-lines-per-function": ["warn", { "max": 80 }],

    // 导入规范
    "import/no-cycle": "error",
    "no-restricted-imports": ["error", {
      "patterns": [{
        "group": ["@/features/*/components/*"],
        "message": "Use barrel export from @/features/<name> instead."
      }]
    }],

    // 代码质量
    "react/jsx-no-bind": "warn",
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

---

## 12. 参考文献

1. [Airbnb JavaScript Style Guide — React](https://github.com/airbnb/javascript/tree/master/react)
2. [Google TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html)
3. [Bulletproof React — alan2207](https://github.com/alan2207/bulletproof-react)
4. [Zustand Official — Slices Pattern](https://zustand.docs.pmnd.rs/learn/guides/flux-inspired-practice)
5. [Next.js Official Docs — Project Structure](https://nextjs.org/docs/app/building-your-application/routing)
6. [Node.js Testing Best Practices — Yoni Goldberg](https://github.com/goldbergyoni/nodejs-testing-best-practices)
7. [Fastify Official — Plugins Guide](https://fastify.dev/docs/latest/Reference/Plugins/)
8. [Tailwind CSS v4 — Dark Mode & Theming](https://tailwindcss.com/docs/dark-mode)
