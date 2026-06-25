# 数据库 Schema 规格

**定义位置**: `packages/shared/src/db/schema.ts` + 各服务自有 schema
**数据库**: PostgreSQL 17 + pgvector extension
**ORM**: Drizzle ORM 0.42+
**迁移工具**: Drizzle Kit

---

## 1. 概述

AgentHub 使用 PostgreSQL 17 作为唯一持久化数据库（元数据 + 向量存储一体化）。Schema 分为两层：

- **共享层** (`packages/shared/src/db/schema.ts`): 5 张核心表，所有服务可见
- **服务层** (各服务 `src/schema.ts`): 服务自有表，仅该服务操作

全部 9 张表。

**命名约定**:
- 表名: `snake_case`，如 `agent_records`（Drizzle 自动复数）、`skill_versions`
- 列名: `snake_case`，如 `created_at`、`conversation_id`
- 主键: 统一使用 `text` 类型存储 UUID v4
- 时间戳: `timestamp` 类型，`defaultNow()`
- 外键: Drizzle 关系定义，不使用数据库级 CASCADE（应用层管理）

---

## 2. 共享层（5 张表）

### 2.1 `agents`

Agent 定义表。Core Engine 拥有。

| # | 列 | Drizzle 类型 | 约束 | 说明 |
|---|------|-------------|------|------|
| 1 | `id` | `text` | PRIMARY KEY | UUID v4 |
| 2 | `name` | `text` | NOT NULL | Agent 名称 |
| 3 | `emoji` | `text` | NOT NULL | 图标 emoji |
| 4 | `description` | `text` | NOT NULL | 功能描述 |
| 5 | `category` | `text` | NOT NULL | 分类（如 `engineering`, `marketing`, `creative`） |
| 6 | `system_prompt` | `text` | NOT NULL | 系统提示词 |
| 7 | `adapter_name` | `text` | NOT NULL | LLM Adapter 名，默认 `'deepseek'` |
| 8 | `model_id` | `text` | NOT NULL | 模型 ID，默认 `'deepseek-v4-pro'` |
| 9 | `tool_names` | `jsonb` | NOT NULL, DEFAULT `'[]'` | 可用工具名列表 |
| 10 | `is_builtin` | `boolean` | NOT NULL, DEFAULT `false` | 是否内置 Agent |
| 11 | `is_orchestrator` | `boolean` | NOT NULL, DEFAULT `false` | 是否为 Orchestrator Agent |
| 12 | `created_at` | `timestamp` | NOT NULL, DEFAULT `now()` | |
| 13 | `updated_at` | `timestamp` | NOT NULL, DEFAULT `now()` | |

**索引**: 主键 `id`。应用层按 `category` 过滤 (`listByCategory`)。

---

### 2.2 `conversations`

会话表。Core Engine 拥有。

| # | 列 | Drizzle 类型 | 约束 | 说明 |
|---|------|-------------|------|------|
| 1 | `id` | `text` | PRIMARY KEY | UUID v4 |
| 2 | `title` | `text` | NOT NULL, DEFAULT `'New Conversation'` | 会话标题 |
| 3 | `mode` | `text` | NOT NULL, DEFAULT `'single'` | 模式: `'single'` \| `'group'` |
| 4 | `agent_ids` | `jsonb` | NOT NULL, DEFAULT `'[]'` | 参与 Agent ID 列表 |
| 5 | `pinned_at` | `timestamp` | nullable | 置顶时间 |
| 6 | `created_at` | `timestamp` | NOT NULL, DEFAULT `now()` | |

**关系**:
- `messages.conversation_id` → `conversations.id` (一对多)
- `artifacts.conversation_id` → `conversations.id` (一对多)

---

### 2.3 `messages`

消息表。Core Engine 拥有。

| # | 列 | Drizzle 类型 | 约束 | 说明 |
|---|------|-------------|------|------|
| 1 | `id` | `text` | PRIMARY KEY | UUID v4 |
| 2 | `conversation_id` | `text` | NOT NULL | FK → `conversations.id` |
| 3 | `role` | `text` | NOT NULL | 角色: `'user'` \| `'assistant'` \| `'system'` |
| 4 | `parts` | `jsonb` | NOT NULL, DEFAULT `'[]'` | `MessagePart[]` 数组 |
| 5 | `status` | `text` | NOT NULL, DEFAULT `'streaming'` | 状态: `'streaming'` \| `'complete'` \| `'aborted'` \| `'failed'` |
| 6 | `created_at` | `timestamp` | NOT NULL, DEFAULT `now()` | |

**`MessagePart` 类型** (存储在 `parts` JSONB 列):
```typescript
type MessagePart =
  | { type: 'text'; content: string }
  | { type: 'thinking'; content: string }
  | { type: 'tool_use'; toolCallId: string; toolName: string; toolInput?: Record<string, unknown> }
  | { type: 'tool_result'; toolCallId: string; toolName: string; toolResult: unknown; isError: boolean }
  | { type: 'artifact_ref'; artifactId: string };
```

**流式更新策略**: 
- 创建时 `parts = []`，`status = 'streaming'`
- 每个 SSE chunk 到达时调用 `appendPart(messageId, part)`，text/thinking 类型合并相邻同类型 part
- 流完成后 `status = 'complete'`
- 流中断后 `status = 'aborted'`
- 异常后 `status = 'failed'`

---

### 2.4 `artifacts`

产物表。Core Engine 拥有。

| # | 列 | Drizzle 类型 | 约束 | 说明 |
|---|------|-------------|------|------|
| 1 | `id` | `text` | PRIMARY KEY | UUID v4 |
| 2 | `conversation_id` | `text` | NOT NULL | FK → `conversations.id` |
| 3 | `type` | `text` | NOT NULL | 类型: `'web_app'` \| `'document'` \| `'code'` \| `'image'` |
| 4 | `title` | `text` | NOT NULL | 产物标题 |
| 5 | `content` | `jsonb` | NOT NULL | 产物内容 |
| 6 | `version` | `integer` | NOT NULL, DEFAULT `1` | 版本号 |
| 7 | `parent_artifact_id` | `text` | nullable | 父产物 ID（版本链） |
| 8 | `created_at` | `timestamp` | NOT NULL, DEFAULT `now()` | |

**版本链**: `parent_artifact_id` 指向上一个版本的 `id`，形成单向链表。

---

### 2.5 `documents`

文档/向量表。Knowledge Base 使用（共享层定义）。

| # | 列 | Drizzle 类型 | 约束 | 说明 |
|---|------|-------------|------|------|
| 1 | `id` | `text` | PRIMARY KEY | UUID v4 |
| 2 | `content` | `text` | NOT NULL | 文档/分块文本 |
| 3 | `embedding` | `vector(1536)` | nullable | pgvector 向量 |
| 4 | `metadata` | `jsonb` | NOT NULL, DEFAULT `'{}'` | 元数据（含 `memoryType`, `conversationId` 等） |
| 5 | `source` | `text` | nullable | 文档来源标识 |
| 6 | `created_at` | `timestamp` | NOT NULL, DEFAULT `now()` | |

**pgvector 自定义类型**: Drizzle 通过 `customType` 将 TypeScript `number[]` 序列化为 pgvector 的 `vector(1536)` 格式。

**向量索引**: 使用 pgvector `IVFFlat` 索引，`<=>` 操作为余弦相似度。

**查询示例**:
```sql
SELECT *, 1 - (embedding <=> $1) AS score
FROM documents
WHERE 1 - (embedding <=> $1) >= $2
ORDER BY embedding <=> $1
LIMIT $3;
```

---

## 3. 服务层（4 张表）

### 3.1 `skills` — Skill Registry

| # | 列 | Drizzle 类型 | 约束 | 说明 |
|---|------|-------------|------|------|
| 1 | `id` | `text` | PRIMARY KEY | UUID v4 |
| 2 | `name` | `text` | NOT NULL, UNIQUE | Skill 名称 |
| 3 | `description` | `text` | NOT NULL | 功能描述 |
| 4 | `current_version` | `text` | NOT NULL | 当前 semver 版本 |
| 5 | `tool_set` | `jsonb` | NOT NULL, DEFAULT `'[]'` | 所需工具列表 |
| 6 | `created_at` | `timestamp` | NOT NULL, DEFAULT `now()` | |
| 7 | `updated_at` | `timestamp` | NOT NULL, DEFAULT `now()` | |

### 3.2 `skill_versions` — Skill Registry

| # | 列 | Drizzle 类型 | 约束 | 说明 |
|---|------|-------------|------|------|
| 1 | `id` | `text` | PRIMARY KEY | UUID v4 |
| 2 | `skill_id` | `text` | NOT NULL | FK → `skills.id` |
| 3 | `version` | `text` | NOT NULL | Semver 版本号 |
| 4 | `prompt_template` | `text` | NOT NULL | Prompt 模板字符串 |
| 5 | `tool_set` | `jsonb` | NOT NULL, DEFAULT `'[]'` | 工具列表 |
| 6 | `parameter_schema` | `jsonb` | NOT NULL, DEFAULT `'{}'` | 参数 JSON Schema |
| 7 | `created_at` | `timestamp` | NOT NULL, DEFAULT `now()` | |

**版本约束**: 新版本的 `version` 必须 > `skills.current_version`（应用层 semver 比较）。

### 3.3 `token_records` — Observability

| # | 列 | Drizzle 类型 | 约束 | 说明 |
|---|------|-------------|------|------|
| 1 | `id` | `text` | PRIMARY KEY | UUID v4 |
| 2 | `model` | `text` | NOT NULL | 模型 ID |
| 3 | `tokens_in` | `integer` | NOT NULL | 输入 token 数 |
| 4 | `tokens_out` | `integer` | NOT NULL | 输出 token 数 |
| 5 | `cost` | `numeric(12,6)` | NOT NULL | 计算成本 ($) |
| 6 | `conversation_id` | `text` | nullable | 关联会话 |
| 7 | `agent_id` | `text` | nullable | 关联 Agent |
| 8 | `created_at` | `timestamp` | NOT NULL, DEFAULT `now()` | |

### 3.4 `audit_log` — Observability

| # | 列 | Drizzle 类型 | 约束 | 说明 |
|---|------|-------------|------|------|
| 1 | `id` | `text` | PRIMARY KEY | UUID v4 |
| 2 | `entry_type` | `text` | NOT NULL | 审计条目类型 |
| 3 | `payload` | `jsonb` | NOT NULL, DEFAULT `'{}'` | 审计数据 |
| 4 | `previous_hash` | `text` | nullable | 前一条 SHA-256 |
| 5 | `current_hash` | `text` | NOT NULL | 本条 SHA-256 |
| 6 | `timestamp` | `timestamp` | NOT NULL | 条目录入时间 |

**链完整性**: `previous_hash` 串联所有条目。第一条 `previous_hash = NULL`。每条 `currentHash = SHA-256(id + entryType + JSON(payload) + previousHash + timestamp)`。

---

## 4. Repository 模式

### 4.1 Repository 接口

定义在 `packages/shared/src/db/repository.interface.ts`：

```typescript
interface Database {
  agents: AgentRepository;
  conversations: ConversationRepository;
  messages: MessageRepository;
  artifacts: ArtifactRepository;
  documents: DocumentRepository;
}

interface AgentRepository {
  insert(record: AgentRecord): Promise<void>;
  findById(id: string): Promise<AgentRecord | null>;
  listAll(): Promise<AgentRecord[]>;
  listByCategory(category: string): Promise<AgentRecord[]>;
  search(query: string): Promise<AgentRecord[]>;
  count(): Promise<number>;
}

interface ConversationRepository {
  insert(record: ConversationRecord): Promise<void>;
  findById(id: string): Promise<ConversationRecord | null>;
  listAll(): Promise<ConversationRecord[]>;
}

interface MessageRepository {
  insert(record: MessageRecord): Promise<void>;
  findById(id: string): Promise<MessageRecord | null>;
  listByConversation(conversationId: string, limit?: number, offset?: number): Promise<MessageRecord[]>;
  update(id: string, changes: Partial<Pick<MessageRecord, 'parts' | 'status'>>): Promise<void>;
}

interface ArtifactRepository {
  insert(record: ArtifactRecord): Promise<void>;
  findById(id: string): Promise<ArtifactRecord | null>;
  listByConversation(conversationId: string): Promise<ArtifactRecord[]>;
}

interface DocumentRepository {
  insert(record: DocumentRecord): Promise<void>;
  findById(id: string): Promise<DocumentRecord | null>;
  delete(id: string): Promise<void>;
  searchByVector(embedding: number[], options: SearchOptions): Promise<SearchResult[]>;
}
```

### 4.2 实现

| 实现 | 用途 | 数据源 |
|------|------|--------|
| `DrizzleDB` | 生产 | PostgreSQL (`DATABASE_URL`) |
| `InMemoryDB` | 测试 | 进程内 `Map` |

`createDB()` 工厂：检测 `DATABASE_URL` → 有则创建 `DrizzleDB`（`drizzle-orm/node-postgres`），否则创建 `InMemoryDB`。

---

## 5. 关系总览

```
agents ─────────────────────────────────────────────┐
  │ (JSONB agent_ids 引用)                            │
  ▼                                                   │
conversations ──┐                                    │
  │              │                                    │
  ├── messages (FK conversation_id)                  │
  │     └── parts (JSONB MessagePart[])               │
  │                                                   │
  └── artifacts (FK conversation_id)                  │
       └── parent_artifact_id (自引用)                │
                                                      │
documents (独立，Knowledge Base 使用)                  │
  └── embedding (pgvector, 余弦相似度索引)             │
                                                      │
skills ─── skill_versions (FK skill_id)               │
                                                      │
token_records (独立，Observability 使用)               │
audit_log (独立，SHA-256 链式关联)                     │
```

---

## 6. 迁移策略

- **工具**: Drizzle Kit (`drizzle-kit generate` + `drizzle-kit migrate`)
- **Schema 文件**: `packages/shared/src/db/schema.ts` + 各服务 `src/schema.ts`
- **迁移输出**: 各包 `drizzle/` 目录
- **Seed 数据**:
  - Core Engine: `seed.ts` — 254 个内置 Agent（gray-matter YAML 解析），幂等导入
  - Skill Registry: 启动时自动 seed `code-reviewer` skill
- **测试环境**: 自动使用内存 SQLite（`better-sqlite3`），无需 Docker

---

*关联文档: [Core Engine 规格](./01-core-engine.md) · [Skill Registry 规格](./03-skill-registry.md) · [Knowledge Base 规格](./04-knowledge-base.md) · [Observability 规格](./05-observability.md)*
