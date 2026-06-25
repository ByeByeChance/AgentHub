# Skill Registry 服务接口规格

**服务**: `@agenthub/skill-registry`
**端口**: 3002 (可配置 `SKILL_REGISTRY_PORT`)
**语言**: TypeScript (Fastify 5.x)
**状态**: M4 完成 — Skill 模板 CRUD + semver 版本管理 + 内置 seed

---

## 1. 服务概述

Skill Registry 是 AgentHub 的 Skill 模板存储与版本管理中心，负责：
- Skill 模板 CRUD（名称、描述、prompt 模板、工具集、参数 schema）
- Semver 版本管理（自动补丁递增 + 手动指定版本）
- Skill 文本检索
- 内置 seed（`code-reviewer` skill）

---

## 2. API 契约

### 2.1 `GET /health`

健康检查端点。

**Response** `200`:
```json
{
  "status": "ok",
  "service": "skill-registry",
  "timestamp": "2026-06-25T10:00:00.000Z"
}
```

---

### 2.2 `GET /api/skills`

列出所有 Skill，支持可选的文本搜索。

**Query Parameters**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `search` | string | 否 | 按 name + description 搜索 |

**Response** `200`:
```json
[
  {
    "id": "uuid",
    "name": "code-reviewer",
    "description": "Review code changes and provide feedback",
    "currentVersion": "1.0.0",
    "toolSet": ["fs_read", "bash"],
    "createdAt": "2026-06-25T10:00:00.000Z",
    "updatedAt": "2026-06-25T10:00:00.000Z"
  }
]
```

**实现**: `skillRepo.listAll()` 或 `skillRepo.search(query)`

---

### 2.3 `GET /api/skills/:id`

获取单个 Skill 的完整信息（含所有版本记录）。

**Path Parameters**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | string (UUID) | 是 | Skill ID |

**Response** `200`:
```json
{
  "id": "uuid",
  "name": "code-reviewer",
  "description": "Review code changes and provide feedback",
  "currentVersion": "1.0.0",
  "toolSet": ["fs_read", "bash"],
  "createdAt": "2026-06-25T10:00:00.000Z",
  "updatedAt": "2026-06-25T10:00:00.000Z",
  "versions": [
    {
      "id": "version-uuid",
      "skillId": "skill-uuid",
      "version": "1.0.0",
      "promptTemplate": "You are a code reviewer...",
      "toolSet": ["fs_read", "bash"],
      "parameterSchema": {
        "diff": { "type": "string", "description": "The git diff to review" },
        "language": { "type": "string", "description": "Programming language" }
      },
      "createdAt": "2026-06-25T10:00:00.000Z"
    }
  ]
}
```

**Errors**:
| 状态码 | 响应 |
|--------|------|
| `404` | `{ "error": "Skill not found" }` |

---

### 2.4 `GET /api/skills/:id/versions`

列出 Skill 的所有版本。

**Path Parameters**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | string (UUID) | 是 | Skill ID |

**Response** `200`:
```json
[
  {
    "id": "version-uuid",
    "skillId": "skill-uuid",
    "version": "1.0.0",
    "promptTemplate": "You are a code reviewer...",
    "toolSet": ["fs_read", "bash"],
    "parameterSchema": {
      "diff": { "type": "string" },
      "language": { "type": "string" }
    },
    "createdAt": "2026-06-25T10:00:00.000Z"
  }
]
```

**Errors**:
| 状态码 | 响应 |
|--------|------|
| `404` | `{ "error": "Skill not found" }` |

---

### 2.5 `GET /api/skills/:id/versions/:version`

获取 Skill 的特定版本。

**Path Parameters**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | string (UUID) | 是 | Skill ID |
| `version` | string (semver) | 是 | 版本号，如 `1.0.0` |

**Response** `200`: 单个 `SkillVersionRecord`

**Errors**:
| 状态码 | 响应 |
|--------|------|
| `404` | `{ "error": "Skill not found" }` 或版本不存在 |

---

### 2.6 `POST /api/skills`

创建新 Skill。

**Request Body** (Zod: `CreateSkillInput`):
```typescript
{
  name: string               // 1-128 字符
  description: string         // min 1
  toolSet?: string[]          // 默认 []
  promptTemplate: string      // min 1
  parameterSchema?: Record<string, unknown>  // 默认 {}
}
```

**Response** `201`:
```json
{
  "id": "uuid",
  "name": "my-skill",
  "description": "My custom skill",
  "currentVersion": "0.0.1",
  "toolSet": ["bash"],
  "createdAt": "2026-06-25T10:00:00.000Z",
  "updatedAt": "2026-06-25T10:00:00.000Z"
}
```

**Errors**:
| 状态码 | 响应 |
|--------|------|
| `400` | `{ "error": "Validation failed", "details": [...] }` |
| `409` | `{ "error": "Skill 'my-skill' already exists" }` (`SkillAlreadyExistsError`) |

---

### 2.7 `POST /api/skills/:id/versions`

为已有 Skill 发布新版本。

**Path Parameters**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | string (UUID) | 是 | Skill ID |

**Request Body** (Zod: `PublishVersionInput`):
```typescript
{
  promptTemplate: string           // min 1
  toolSet?: string[]               // 默认 []
  parameterSchema?: Record<string, unknown>  // 默认 {}
  version?: string                 // semver，不指定则自动递增 patch
}
```

**Response** `201`:
```json
{
  "id": "version-uuid",
  "skillId": "skill-uuid",
  "version": "1.0.1",
  "promptTemplate": "Updated template...",
  "toolSet": ["bash"],
  "parameterSchema": {},
  "createdAt": "2026-06-25T10:00:00.000Z"
}
```

**Errors**:
| 状态码 | 响应 |
|--------|------|
| `400` | `{ "error": "Validation failed" }` 或 `{ "error": "New version must be greater than current version" }` (`InvalidVersionError`) |
| `404` | `{ "error": "Skill not found" }` (`SkillNotFoundError`) |

**自动版本递增**: 如果未指定 `version`，自动将 `currentVersion` 的 patch +1（`1.0.0` → `1.0.1`）。

---

## 3. 自定义错误

| 错误类 | HTTP 状态码 | 说明 |
|--------|------------|------|
| `SkillAlreadyExistsError` | 409 | 同名 Skill 已存在 |
| `SkillNotFoundError` | 404 | Skill ID 不存在 |
| `InvalidVersionError` | 400 | 版本号不大于当前版本 |

---

## 4. 事件

### 4.1 产生的事件

`skill.invoke` — Skill 模板被调用时通过 EventBus 产生。M6 计划扩展为通过 RabbitMQ 发布。

### 4.2 消费的事件

当前无。M6 计划：从 RabbitMQ 订阅 `skill.invoke` 事件，由 Core Engine 触发。

---

## 5. 数据库表

Skill Registry 拥有以下自有表（定义在 `services/skill-registry/src/schema.ts`）：

### 5.1 `skills`

| 列 | 类型 | 约束 |
|------|------|------|
| `id` | text | PRIMARY KEY (UUID) |
| `name` | text | NOT NULL, UNIQUE |
| `description` | text | NOT NULL |
| `current_version` | text | NOT NULL |
| `tool_set` | jsonb (string[]) | NOT NULL, DEFAULT `[]` |
| `created_at` | timestamp | NOT NULL |
| `updated_at` | timestamp | NOT NULL |

### 5.2 `skill_versions`

| 列 | 类型 | 约束 |
|------|------|------|
| `id` | text | PRIMARY KEY (UUID) |
| `skill_id` | text | NOT NULL, FK → `skills.id` |
| `version` | text | NOT NULL |
| `prompt_template` | text | NOT NULL |
| `tool_set` | jsonb (string[]) | NOT NULL, DEFAULT `[]` |
| `parameter_schema` | jsonb | NOT NULL, DEFAULT `{}` |
| `created_at` | timestamp | NOT NULL |

---

## 6. 内置 Seed

启动时自动执行幂等导入：

**`code-reviewer` Skill**:
```json
{
  "name": "code-reviewer",
  "description": "Review code changes and provide structured feedback",
  "toolSet": ["fs_read", "bash"],
  "promptTemplate": "You are an expert code reviewer...",
  "parameterSchema": {
    "diff": { "type": "string", "description": "The git diff to review" },
    "language": { "type": "string", "description": "Programming language used" }
  }
}
```

---

## 7. 依赖关系

### 上游依赖

| 包/服务 | 用途 |
|---------|------|
| `@agenthub/shared/db` | `Database` 接口 + Repository |
| `@agenthub/shared/server` | `createHealthServer` Fastify 启动器 |
| `@agenthub/shared/logging` | 结构化 Logger |
| `@agenthub/contracts` | `EventEnvelope` + `skill.invoke` 事件类型 |

### 下游消费方

| 服务 | 消费方式 | 状态 |
|------|---------|------|
| Core Engine | `GET /api/skills/:id/versions/:version` → 获取 Skill 模板渲染 Prompt | 🔜 M6 |
| Frontend | `GET /api/skills` → Skill 列表 | 🔜 前端 Skill 面板 |

---

*关联文档: [Core Engine 规格](./01-core-engine.md) · [数据库 Schema](./07-database-schema.md)*
