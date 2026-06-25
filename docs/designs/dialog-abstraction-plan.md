# 弹窗公共组件抽取方案

**日期**：2026-06-26  
**状态**：设计中

---

## 1. 问题分析

当前项目有 3 个弹窗组件，存在大量重复：

| 弹窗 | 行数 | 职责 |
|------|------|------|
| `agent-create-dialog.tsx` | 158 | 创建 Agent 表单 |
| `conversation-create-dialog.tsx` | 233 | 创建会话（选模式 + 选 Agent） |
| `orchestrator-dialog.tsx` | 266 | 编排执行（填目标 + 选模式 + 选 Agent） |

### 1.1 重复模式统计

```
模式1: Dialog Shell（open/close + 标题 + 底部按钮）
  重复次数: 3/3
  重复行数: ~25 行 × 3 = 75 行

模式2: Select 弹层保护（onInteractOutside + onPointerDownOutside + selectOpen 状态）
  重复次数: 2/3
  重复行数: ~10 行 × 2 = 20 行

模式3: Agent 选择器（复选框列表 + 已选 Badge + toggleAgent 逻辑）
  重复次数: 2/3
  重复行数: ~60 行 × 2 = 120 行

模式4: FOCUS_CLASS 常量
  重复次数: 2/3
  重复行数: 2 行 × 2 = 4 行

模式5: 表单字段布局（Label + Input/Select/Textarea + spacing）
  重复次数: 3/3（每个弹窗 3-5 个字段）
  重复行数: ~8 行 × 10 个字段 = 80 行
```

**总计可消除重复：~300 行。**

---

## 2. 抽取方案

### 2.1 `FormDialog` — 通用表单弹窗壳

```
components/ui/form-dialog.tsx         (~50 行)
```

封装：
- Dialog open/close 状态管理
- DialogHeader + DialogTitle
- Select-in-dialog 保护（自动处理 `onInteractOutside`）
- 底部取消/提交按钮（可选配置）
- Loading 状态支持
- 统一的 className 风格

**使用示例**：

```tsx
// agent-create-dialog.tsx → 重构后 ~110 行
<FormDialog
  open={open}
  onOpenChange={setOpen}
  title={t('createCustomAgent')}
  cancelLabel={t('cancel')}
  submitLabel={t('createAgentButton')}
  onSubmit={handleCreate}
  submitDisabled={!isValid}
>
  {/* 表单字段直接作为 children */}
  <DialogFormField label={t('name')}>
    <Input ... />
  </DialogFormField>
  <DialogFormField label={t('category')}>
    <Select ...>...</Select>
  </DialogFormField>
  <DialogFormField label={t('systemPrompt')}>
    <Textarea ... />
  </DialogFormField>
</FormDialog>
```

**接口定义**：

```typescript
interface FormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  
  // 底部按钮（可选）
  cancelLabel?: string;
  submitLabel?: string | ReactNode;
  onSubmit?: () => void | Promise<void>;
  submitDisabled?: boolean;
  submitLoading?: boolean;
  submitClassName?: string;
  
  // Dialog 配置
  className?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
  
  // 触发按钮（可选，不传则外部控制 open）
  trigger?: ReactNode;
}
```

### 2.2 `DialogFormField` — 表单字段布局

```
components/ui/dialog-form-field.tsx   (~25 行)
```

封装：`Label` + spacing + 统一 `text-xs` label 样式。

```typescript
interface DialogFormFieldProps {
  label: string;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}
```

### 2.3 `AgentSelector` — Agent 复选框列表

```
components/shared/agent-selector.tsx  (~90 行)
```

封装：
- Agent 列表渲染（带复选框交互）
- 已选 Agent Badge 展示
- `selectedAgentIds` 状态管理（可选：受控/非受控模式）
- 统一搜索高亮样式
- 统一 ScrollArea 容器

**使用示例**：

```tsx
// conversation-create-dialog 和 orchestrator-dialog 共用
<AgentSelector
  agents={agents}
  selectedIds={selectedAgentIds}
  onToggle={handleToggleAgent}
  mode={mode} // 'single' | 'group'
/>
```

**接口定义**：

```typescript
interface AgentSelectorProps {
  agents: AgentMetadata[];
  selectedIds: string[];
  onToggle: (agentId: string) => void;
  mode?: 'single' | 'multiple';
  searchQuery?: string;
  maxHeight?: string;  // 默认 'h-56'
  showCategory?: boolean;
}
```

### 2.4 `FOCUS_CLASS` → 全局常量

```
lib/style-constants.ts  (~10 行)
```

```typescript
export const FOCUS_CLASS =
  'focus-visible:ring-0 focus-visible:border-primary/50 focus-visible:shadow-[0_0_0_1px_hsl(var(--primary)/0.15)] transition-[border-color,box-shadow]';
```

---

## 3. 重构前后对比

### 3.1 agent-create-dialog.tsx

```
重构前: 158 行
重构后: ~110 行
消除: Dialog shell（~25 行）+ 字段布局（~25 行）
```

### 3.2 conversation-create-dialog.tsx

```
重构前: 233 行
重构后: ~120 行
消除: Dialog shell（~25 行）+ Agent 选择器（~60 行）+ 字段布局（~15 行）+ FOCUS_CLASS
```

### 3.3 orchestrator-dialog.tsx

```
重构前: 266 行
重构后: ~140 行
消除: Dialog shell（~25 行）+ Agent 选择器（~60 行）+ 字段布局（~15 行）+ FOCUS_CLASS + Loading 状态处理
```

### 3.4 总体

```
重构前: 158 + 233 + 266 = 657 行
重构后: 110 + 120 + 140 + 50 + 25 + 90 + 10 = 545 行
净减少: ~112 行（17%）

但更重要的是：
- 3 个弹窗的 Dialog shell 逻辑改为 1 个 FormDialog 组件维护
- 2 处 Agent 选择器改为 1 个 AgentSelector 组件维护
- 10+ 处表单字段布局改为 1 个 DialogFormField 组件维护
- FOCUS_CLASS 改为单点维护
```

---

## 4. 文件变更清单

```
新增:
  frontend/src/components/ui/form-dialog.tsx
  frontend/src/components/ui/dialog-form-field.tsx
  frontend/src/components/shared/agent-selector.tsx
  frontend/src/lib/style-constants.ts

修改:
  frontend/src/components/agent/agent-create-dialog.tsx       (使用 FormDialog + DialogFormField)
  frontend/src/components/conversation/conversation-create-dialog.tsx  (全部四个抽象)
  frontend/src/components/orchestrator/orchestrator-dialog.tsx  (全部四个抽象)
```

---

## 5. FormDialog 完整实现草图

```typescript
'use client';

import { useState, useCallback, type ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface FormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;

  cancelLabel?: string;
  submitLabel?: string | ReactNode;
  onSubmit?: () => void | Promise<void>;
  submitDisabled?: boolean;
  submitLoading?: boolean;

  trigger?: ReactNode;
  className?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
}

const MAX_WIDTH_CLASS: Record<string, string> = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg',
  xl: 'sm:max-w-xl',
};

/**
 * Reusable form-in-dialog shell.
 *
 * Features:
 * - Auto-protects Select dropdown from closing the dialog
 * - Consistent header + title styling
 * - Optional cancel/submit footer buttons
 * - Supports async onSubmit with loading state
 */
export function FormDialog({
  open,
  onOpenChange,
  title,
  children,
  cancelLabel,
  submitLabel,
  onSubmit,
  submitDisabled = false,
  submitLoading = false,
  trigger,
  className,
  maxWidth = 'lg',
}: FormDialogProps) {
  const [selectOpen, setSelectOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isBusy = submitting || submitLoading;

  const handleSubmit = useCallback(async () => {
    if (!onSubmit) return;
    setSubmitting(true);
    try {
      await onSubmit();
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }, [onSubmit, onOpenChange]);

  const hasFooter = cancelLabel || submitLabel;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}

      <DialogContent
        className={`${MAX_WIDTH_CLASS[maxWidth] ?? 'sm:max-w-lg'} overflow-hidden p-5 gap-3 ${className ?? ''}`}
        onInteractOutside={(e) => {
          if (selectOpen) e.preventDefault();
        }}
        onPointerDownOutside={(e) => {
          if (selectOpen) e.preventDefault();
        }}
      >
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-base">{title}</DialogTitle>
        </DialogHeader>

        {/* Form body — consumer provides field content */}
        <div className="space-y-4 min-w-0">{children}</div>

        {/* Footer actions */}
        {hasFooter && (
          <div className="flex justify-end gap-2 pt-1">
            {cancelLabel && (
              <Button
                variant="outline"
                className="rounded-lg h-9 text-sm"
                onClick={() => onOpenChange(false)}
                disabled={isBusy}
              >
                {cancelLabel}
              </Button>
            )}
            {submitLabel && (
              <Button
                className="rounded-lg h-9 text-sm bg-accent hover:bg-accent/90 text-accent-foreground"
                onClick={handleSubmit}
                disabled={submitDisabled || isBusy}
              >
                {isBusy ? '...' : submitLabel}
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

---

## 6. 实施步骤

### Step 1: 创建基础抽象（不修改现有代码）
1. 创建 `lib/style-constants.ts` — 提取 `FOCUS_CLASS`
2. 创建 `components/ui/dialog-form-field.tsx`
3. 创建 `components/ui/form-dialog.tsx`
4. 创建 `components/shared/agent-selector.tsx`
5. 为以上 4 个文件各写单元测试

### Step 2: 逐个迁移弹窗
1. 先迁移最简单的 `agent-create-dialog.tsx` → 验证 FormDialog + DialogFormField 可用
2. 再迁移 `conversation-create-dialog.tsx` → 验证 AgentSelector 可用
3. 最后迁移 `orchestrator-dialog.tsx` → 验证 Loading 状态和复杂交互

### Step 3: 验证 + 清理
1. `pnpm typecheck` + `pnpm lint` + `pnpm test`
2. 手动验证三个弹窗的所有交互（打开/关闭/Select/提交/Loading）
3. 删除旧代码中的重复定义

---

## 7. 不抽取的边界

以下保留在各弹窗内，不强制抽取：
- **表单验证逻辑**：每个弹窗的校验条件不同（如 Agent 需要 6 个字段、Conversation 只需要 Agent 选择），属于业务逻辑
- **特定字段的 onChange**：emoji 只取前 2 字符、category 联动 newCategory 等
- **触发按钮样式**：OrchestratorDialog 的触发按钮有自己的图标+文字布局

原则：**抽模板（shell/layout），不抽业务（validation/specific logic）。**
