# Knowledge Base 服务接口规格

**服务**: `@agenthub/knowledge-base`
**端口**: 3003 (可配置 `KNOWLEDGE_BASE_PORT`)
**语言**: TypeScript (Fastify 5.x)
**状态**: M4 完成 — 文档嵌入 + pgvector 检索 + 三层记忆

---

## 1. 服务概述

Knowledge Base 是 AgentHub 的知识库服务，负责：
- 文档摄入管道（分块 → 嵌入 → 存储）
- 向量相似度检索（pgvector `<=>` 余弦相似度）
- 三层记忆管理（工作记忆 L1 / 短期记忆 L2 / 长期记忆 L3）
- 策略可插拔：Embedding / Chunking / VectorStore 均可替换

---

## 2. API 契约

### 2.1 `GET /health`

健康检查端点。

**Response** `200`:
```json
{
  "status": "ok",
  "service": "knowledge-base",
  "timestamp": "2026-06-25T10:00:00.000Z"
}
```

---

### 2.2 文档 CRUD

#### `POST /api/knowledge/documents`

添加文档（分块 → 嵌入 → 存储 pipeline）。

**Request Body** (Zod: `addDocumentSchema`):
```typescript
{
  text: string                    // min 1
  metadata?: Record<string, unknown>  // 默认 {}
  source?: string                 // 文档来源标识
  parentDocumentId?: string       // 父文档 ID（关联 chunk）
}
```

**Response** `201`:
```json
{
  "documentIds": ["chunk-uuid-1", "chunk-uuid-2", "chunk-uuid-3"],
  "chunkCount": 3
}
```

**Pipeline**:
```
text → ChunkingStrategy.chunk(text, options)
     → chunks: [{ text, index, metadata }]
     → EmbeddingStrategy.embedBatch(chunkTexts)
     → embeddings: [number[]]
     → VectorStoreBackend.store({ id, content, embedding, metadata, source })
     → { documentIds, chunkCount }
```

**Errors**:
| 状态码 | 响应 |
|--------|------|
| `400` | `{ "error": "Validation failed", "details": [...] }` |

---

#### `POST /api/knowledge/search`

向量相似度检索。

**Request Body** (Zod: `searchQuerySchema`):
```typescript
{
  query: string           // min 1
  topK?: number           // 默认 10
  threshold?: number      // 0-1，默认 0.0（返回所有结果）
  filters?: Record<string, unknown>  // 元数据过滤
}
```

**Response** `200`:
```json
[
  {
    "id": "chunk-uuid",
    "content": "匹配到的文本内容...",
    "embedding": [0.123, -0.456, ...],
    "metadata": { "source": "conversation-123" },
    "source": "user-upload",
    "createdAt": "2026-06-25T10:00:00.000Z",
    "score": 0.92
  }
]
```

**Pipeline**:
```
query → EmbeddingStrategy.embed(query)
      → queryEmbedding: number[]
      → VectorStoreBackend.search(queryEmbedding, { topK, threshold, filters })
      → SearchResult[] (按 score 降序)
```

---

#### `DELETE /api/knowledge/documents/:id`

删除文档。

**Path Parameters**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | string (UUID) | 是 | 文档 ID |

**Response** `204` (无 body)

---

### 2.3 三层记忆

#### 工作记忆 (L1) — 进程内，每会话 TTL

**`POST /api/knowledge/memory/working`**

设置工作记忆。

**Request Body**:
```typescript
{
  conversationId: string
  entries: [
    {
      key: string
      value: unknown
      ttl?: number  // TTL 毫秒，不指定则永不过期（会话期间）
    }
  ]
}
```

**Response** `200`:
```json
{ "ok": true }
```

---

**`GET /api/knowledge/memory/working/:convId`**

获取工作记忆。

**Path Parameters**: `convId` — 会话 ID

**Response** `200`:
```json
[
  { "key": "current_task", "value": "building a React form", "ttl": 300000 },
  { "key": "user_preference", "value": { "language": "TypeScript" }, "ttl": null }
]
```

---

**`DELETE /api/knowledge/memory/working/:convId`**

清除工作记忆。

**Response** `204`

**实现**: 进程内 `Map<conversationId, Map<key, { value, expiresAt }>>`。定期清理过期条目。

---

#### 短期记忆 (L2) — pgvector，会话作用域

**`POST /api/knowledge/memory/short-term`**

存储短期记忆。

**Request Body**:
```typescript
{
  conversationId: string
  messages: [
    {
      role: 'user' | 'assistant' | 'system'
      content: string
      timestamp: string  // ISO 8601
    }
  ]
}
```

**Response** `201`:
```json
{ "ok": true }
```

**实现**: 将消息嵌入后存储到 `documents` 表，metadata 标记 `{ memoryType: "short-term", conversationId }`。

---

**`GET /api/knowledge/memory/short-term/:convId`**

回忆短期记忆。

**Response** `200`: `SearchResult[]`（按相似度排序的关联记忆）

**实现**: 将最近的用户消息作为 query 嵌入，在标记为 `memoryType: "short-term"` 且匹配 `conversationId` 的文档中检索。

---

#### 长期记忆 (L3) — pgvector，跨会话

**`POST /api/knowledge/memory/long-term`**

存储长期记忆。

**Request Body**:
```typescript
{
  content: string
  metadata?: Record<string, unknown>
  conversationId?: string  // 可选，关联来源会话
}
```

**Response** `201`:
```json
{
  "documentIds": ["doc-uuid"],
  "chunkCount": 1
}
```

**实现**: 通过 `KnowledgeService.addDocument()` 存储，metadata 标记 `{ memoryType: "long-term" }`。

---

**`POST /api/knowledge/memory/long-term/recall`**

回忆长期记忆。

**Request Body**:
```typescript
{
  query: string
  topK?: number        // 默认 10
  threshold?: number   // 默认 0.0
}
```

**Response** `200`: `SearchResult[]`

**实现**: 嵌入 query，在标记为 `memoryType: "long-term"` 的文档中检索。

---

## 3. 事件

### 3.1 产生的事件

| 事件类型 | 触发时机 | Payload |
|----------|---------|---------|
| `knowledge.write` | 文档写入成功 | `{ documentIds, chunkCount, source, conversationId? }` |
| `knowledge.query` | 检索执行 | `{ query, topK, resultCount }` |

**当前状态**: 通过进程内 EventBus 产生。M6 计划通过 RabbitMQ 跨服务发布。

### 3.2 消费的事件

| 事件类型 | 来源 | 触发动作 | 状态 |
|----------|------|---------|------|
| `knowledge.write` | Core Engine | `addDocument(event.payload)` | 🔜 M6 (RabbitMQ) |

---

## 4. 策略接口

### 4.1 EmbeddingStrategy

**定义位置**: `services/knowledge-base/src/strategies/interfaces/embedding-strategy.interface.ts`

```typescript
interface EmbeddingStrategy {
  readonly name: string;
  readonly dimensions: number;
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
}
```

**默认实现**: `DeepSeekEmbeddingStrategy` — 1536 维，调用 DeepSeek Embedding API
**Mock 实现**: `MockEmbeddingStrategy` — 确定性哈希，用于测试
**环境变量**: `EMBEDDING_STRATEGY=deepseek` | `openai` | `local-bge` | `mock`

### 4.2 ChunkingStrategy

**定义位置**: `services/knowledge-base/src/strategies/interfaces/chunking-strategy.interface.ts`

```typescript
interface ChunkingStrategy {
  readonly name: string;
  chunk(text: string, options?: ChunkOptions): Promise<Chunk[]>;
}

interface Chunk {
  text: string;
  index: number;
  metadata?: Record<string, unknown>;
}

interface ChunkOptions {
  maxChunkSize?: number;  // 默认 512
  overlap?: number;        // 默认 50
  separator?: string;      // 默认递归分隔符
}
```

**默认实现**: `RecursiveChunker` — 递归按 `\n\n` → `\n` → `.` → `。` → ` ` 分离，保证 chunk 不超过 `maxChunkSize`，overlap 保证上下文连续
**Mock 实现**: `MockChunker` — 按句子分割
**环境变量**: `CHUNKING_STRATEGY=recursive` | `semantic` | `code` | `mock`

### 4.3 VectorStoreBackend

**定义位置**: `services/knowledge-base/src/strategies/interfaces/vector-store.interface.ts`

```typescript
interface VectorStoreBackend {
  readonly name: string;
  store(document: DocumentRecord): Promise<void>;
  search(query: number[], options?: SearchOptions): Promise<SearchResult[]>;
  delete(id: string): Promise<void>;
}

interface SearchOptions {
  topK?: number;
  threshold?: number;
  filters?: Record<string, unknown>;
}
```

**默认实现**: `PgVectorStore` — 通过共享 `Database.documents` 操作 PostgreSQL pgvector
**Mock 实现**: `InMemoryVectorStore` — 内存余弦相似度计算
**环境变量**: `VECTOR_BACKEND=pgvector` | `faiss` | `chroma` | `inmemory`

---

## 5. 服务类

### 5.1 KnowledgeService

- `addDocument(input)` → 分块 → 嵌入 → 存储 → 返回 `{ documentIds, chunkCount }`
- `search(input)` → 嵌入查询 → 向量检索 → 返回 `SearchResult[]`
- `deleteDocument(id)` → 委托 `VectorStoreBackend.delete()`

### 5.2 MemoryService

三层记忆，统一接口：

| 层 | 存储 | 作用域 | TTL | 用途 |
|------|------|------|------|------|
| L1 工作记忆 | 进程内 Map | 每会话 | 可选 | 当前任务上下文、用户偏好 |
| L2 短期记忆 | pgvector | 每会话 | 持久 | 当前会话历史、工具结果 |
| L3 长期记忆 | pgvector | 跨会话 | 持久 | 跨会话知识、用户画像 |

---

## 6. 数据库表

使用共享 `documents` 表（定义在 `packages/shared/src/db/schema.ts`）：

| 列 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | text | PRIMARY KEY | UUID |
| `content` | text | NOT NULL | 分块文本 |
| `embedding` | vector(1536) | nullable | pgvector 向量 |
| `metadata` | jsonb | NOT NULL, DEFAULT `{}` | 记忆类型标记、会话 ID 等 |
| `source` | text | nullable | 文档来源 |
| `created_at` | timestamp | NOT NULL | |

**向量索引**: pgvector `IVFFlat` 余弦相似度索引 (`<=>` 操作符)。

---

## 7. 依赖关系

### 上游依赖

| 包/服务 | 用途 |
|---------|------|
| `@agenthub/shared/db` | `Database.documents` Vector Repository |
| `@agenthub/shared/server` | `createHealthServer` Fastify 启动器 |
| `@agenthub/shared/logging` | 结构化 Logger |
| `@agenthub/shared/constants` | 嵌入维度、服务端口默认值 |
| `@agenthub/contracts` | `knowledge.write` / `knowledge.query` 事件类型 |
| `openai` SDK | DeepSeek Embedding API 调用 |

### 下游消费方

| 服务 | 消费方式 | 状态 |
|------|---------|------|
| Core Engine | `POST /api/knowledge/search` (RAG 检索) + `POST /api/knowledge/documents` (知识写入) | 🔜 M6 |
| Core Engine | `POST /api/knowledge/memory/*` (三层记忆读取) | 🔜 M6 |

---

*关联文档: [Core Engine 规格](./01-core-engine.md) · [Event Envelope 协议](./06-event-envelope.md) · [数据库 Schema](./07-database-schema.md)*
