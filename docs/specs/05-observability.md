# Observability 服务接口规格

**服务**: `@agenthub/observability`
**端口**: 3004 (可配置 `OBSERVABILITY_PORT`)
**语言**: TypeScript (Fastify 5.x)
**状态**: M4 完成 — Token 追踪 + 成本聚合 + SHA-256 链式审计日志

---

## 1. 服务概述

Observability 是 AgentHub 的可观测性服务，负责：
- Token 使用量记录与模型级成本计算
- 按时间周期（日/周/月）聚合成本报告
- SHA-256 链式审计日志（防篡改，可整链验证）

---

## 2. API 契约

### 2.1 `GET /health`

健康检查端点。

**Response** `200`:
```json
{
  "status": "ok",
  "service": "observability",
  "timestamp": "2026-06-25T10:00:00.000Z"
}
```

---

### 2.2 `POST /api/obs/tokens`

记录一次 LLM Token 使用。

**Request Body** (Zod: `recordTokenSchema`):
```typescript
{
  model: string           // min 1，模型 ID
  tokensIn: number        // integer >= 0
  tokensOut: number       // integer >= 0
  conversationId?: string // 可选，关联会话
  agentId?: string        // 可选，关联 Agent
}
```

**Response** `201`:
```json
{
  "id": "uuid",
  "model": "deepseek-v4-pro",
  "tokensIn": 1234,
  "tokensOut": 567,
  "cost": 0.000981,
  "conversationId": "conv-uuid",
  "agentId": "agent-uuid",
  "createdAt": "2026-06-25T10:00:00.000Z"
}
```

**成本计算**: `cost = (tokensIn / 1000 * inputPrice) + (tokensOut / 1000 * outputPrice)`

**Errors**:
| 状态码 | 响应 |
|--------|------|
| `400` | `{ "error": "Unknown model 'unknown-model'" }` (`UnknownModelError`) |

---

### 2.3 `GET /api/obs/costs`

按时间周期聚合成本。

**Query Parameters**:
| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `period` | `"daily"` \| `"weekly"` \| `"monthly"` | `"daily"` | 聚合周期 |

**Response** `200`:
```json
{
  "period": "daily",
  "totalTokensIn": 123400,
  "totalTokensOut": 56700,
  "totalCost": 0.0981,
  "breakdown": [
    {
      "model": "deepseek-v4-pro",
      "tokensIn": 100000,
      "tokensOut": 50000,
      "cost": 0.084
    },
    {
      "model": "claude-sonnet-4-20250514",
      "tokensIn": 23400,
      "tokensOut": 6700,
      "cost": 0.0141
    }
  ]
}
```

---

### 2.4 `POST /api/obs/audit`

创建审计日志条目。每次写入与前一条 SHA-256 链式关联。

**Request Body** (Zod: `createAuditEntrySchema`):
```typescript
{
  entryType: string                    // 1-128 字符
  payload?: Record<string, unknown>    // 默认 {}
}
```

**Response** `201`:
```json
{
  "id": "uuid",
  "entryType": "agent.run.failed",
  "payload": { "error": "LLM timeout", "agentId": "..." },
  "previousHash": "sha256-of-previous-entry",
  "currentHash": "sha256-of-this-entry",
  "timestamp": "2026-06-25T10:00:00.000Z"
}
```

**哈希计算**: `currentHash = SHA-256(id + entryType + JSON.stringify(payload) + previousHash + timestamp)`

---

### 2.5 `GET /api/obs/audit`

列出所有审计条目。

**Response** `200`:
```json
[
  {
    "id": "uuid-1",
    "entryType": "agent.run.start",
    "payload": { "agentId": "..." },
    "previousHash": null,
    "currentHash": "sha256-1",
    "timestamp": "2026-06-25T10:00:00.000Z"
  },
  {
    "id": "uuid-2",
    "entryType": "agent.run.complete",
    "payload": { "agentId": "..." },
    "previousHash": "sha256-1",
    "currentHash": "sha256-2",
    "timestamp": "2026-06-25T10:00:05.000Z"
  }
]
```

条目按 `timestamp` 升序排列。

---

### 2.6 `GET /api/obs/audit/verify`

验证整条审计链的完整性。

**Response** `200`:
```json
// 链完整:
{
  "valid": true,
  "brokenAt": null,
  "expectedHash": null,
  "actualHash": null
}

// 链断裂:
{
  "valid": false,
  "brokenAt": "uuid-3",
  "expectedHash": "sha256-expected",
  "actualHash": "sha256-actual"
}
```

**验证逻辑**: 从第一条开始，逐条验证 `currentHash === SHA-256(id + entryType + JSON(payload) + previousHash + timestamp)` 且 `previousHash` 指向前一条的 `currentHash`。

---

## 3. 事件

### 3.1 产生的事件

| 事件类型 | 触发时机 | Payload |
|----------|---------|---------|
| `audit.log` | 审计条目创建 | `{ entryType, payload, service }` |

**当前状态**: 通过进程内 EventBus 产生。M6 计划通过 RabbitMQ 跨服务发布。

### 3.2 消费的事件

| 事件类型 | 来源 | 触发动作 | 状态 |
|----------|------|---------|------|
| `audit.log` | 任意服务 | `auditLogger.log(event.payload)` | 🔜 M6 (RabbitMQ) |

---

## 4. 服务类

### 4.1 TokenRecorder

- `record(input: RecordTokenInput): Promise<TokenRecordData>` — 查找模型定价 → 计算成本 → 持久化
- `getCosts({ period }): Promise<CostReport>` — 按周期聚合

**自定义错误**: `UnknownModelError` — 模型不在定价表中

### 4.2 AuditLogger

- `log(input: CreateAuditEntryInput): Promise<AuditEntryData>` — 创建链式审计条目
- `listAll(): Promise<AuditEntryData[]>` — 列出所有条目
- `verifyChain(): Promise<ChainVerificationResult>` — 验证整链完整性

---

## 5. 模型定价表

定义在 `services/observability/src/constants/model-pricing.ts`：

| 模型 ID | 输入价格 ($/1K tokens) | 输出价格 ($/1K tokens) |
|---------|----------------------|------------------------|
| `deepseek-v4-flash` | $0.00014 | $0.00028 |
| `deepseek-v4-pro` | $0.00028 | $0.00112 |
| `claude-sonnet-4-20250514` | $0.003 | $0.015 |
| `claude-opus-4-8` | $0.015 | $0.075 |
| `gpt-4o` | $0.0025 | $0.01 |

**精度**: cost 使用 `numeric(12,6)`，即最多 6 位小数。

---

## 6. 数据库表

Observability 拥有以下自有表（定义在 `services/observability/src/schema.ts`）：

### 6.1 `token_records`

| 列 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | text | PRIMARY KEY | UUID |
| `model` | text | NOT NULL | 模型 ID |
| `tokens_in` | integer | NOT NULL | 输入 token 数 |
| `tokens_out` | integer | NOT NULL | 输出 token 数 |
| `cost` | numeric(12,6) | NOT NULL | 计算成本 |
| `conversation_id` | text | nullable | 关联会话 |
| `agent_id` | text | nullable | 关联 Agent |
| `created_at` | timestamp | NOT NULL | |

### 6.2 `audit_log`

| 列 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | text | PRIMARY KEY | UUID |
| `entry_type` | text | NOT NULL | 条目类型 |
| `payload` | jsonb | NOT NULL, DEFAULT `{}` | 审计数据 |
| `previous_hash` | text | nullable | 前一条 SHA-256 |
| `current_hash` | text | NOT NULL | 本条 SHA-256 |
| `timestamp` | timestamp | NOT NULL | |

**链完整性**: `previous_hash` 的 NULL → NOT NULL 链形成单向链表。`verifyChain()` 遍历验证所有 `currentHash` 计算结果一致性。

---

## 7. TokenRecorder / AuditLogger 接口（供其他服务注入）

在 Core Engine 中通过 `AgentRunInput` 注入：

```typescript
interface AgentRunInput {
  // ... 现有字段 ...
  tokenRecorder?: TokenRecorderLike;  // 可选，最佳努力
  auditLogger?: AuditLoggerLike;      // 可选，最佳努力
}

interface TokenRecorderLike {
  record(input: { model: string; tokensIn: number; tokensOut: number;
    conversationId?: string; agentId?: string }): Promise<void>;
}

interface AuditLoggerLike {
  log(input: { entryType: string; payload?: Record<string, unknown> }): Promise<void>;
}
```

**当前状态**: `core-engine/src/index.ts` 中存在 TODO stub，尚未创建实际实例传入。

---

## 8. 依赖关系

### 上游依赖

| 包/服务 | 用途 |
|---------|------|
| `@agenthub/shared/db` | `Database` 接口（自定义 Observability Repository 实现） |
| `@agenthub/shared/server` | `createHealthServer` Fastify 启动器 |
| `@agenthub/shared/logging` | 结构化 Logger |
| `@agenthub/contracts` | `audit.log` 事件类型 |
| Node.js `crypto` | SHA-256 哈希计算 |

### 下游消费方

| 服务 | 消费方式 | 状态 |
|------|---------|------|
| Core Engine | `TokenRecorder.record()` 直接调用（每次 AgentRun 完成时） | ⚠️ TODO stub，待 M6 接线 |
| Core Engine | `AuditLogger.log()` 直接调用（每次 AgentRun 失败时） | ⚠️ TODO stub，待 M6 接线 |
| Frontend | `GET /api/obs/costs` → 成本仪表盘 | 🔜 前端可观测面板 |

---

*关联文档: [Core Engine 规格](./01-core-engine.md) · [Event Envelope 协议](./06-event-envelope.md) · [数据库 Schema](./07-database-schema.md)*
