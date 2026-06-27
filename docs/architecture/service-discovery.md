# 服务发现 (Service Discovery)

## 当前状态

AgentHub 使用两种策略进行服务间地址解析，由 `SERVICE_DISCOVERY` 环境变量控制。

## 策略

### 策略 1: `env`（默认）

从静态环境变量读取每个服务的 URL：

| 环境变量 | 默认值 |
|----------|--------|
| `CORE_ENGINE_URL` | `http://localhost:3001` |
| `MCP_GATEWAY_URL` | `http://localhost:8080` |
| `SKILL_REGISTRY_URL` | `http://localhost:3002` |
| `KNOWLEDGE_BASE_URL` | `http://localhost:3003` |
| `OBSERVABILITY_URL` | `http://localhost:3004` |

适用场景：本地开发、CI/CD、无 Docker DNS 的环境。

### 策略 2: `dns`

通过 Docker Compose 服务名 + 固定端口解析 URL：

```
模板: http://{service-name}:{port}

core-engine   → http://core-engine:3001
mcp-gateway   → http://mcp-gateway:8080
...
```

适用场景：Docker Compose 部署。Docker 内置 DNS 自动解析同一 `agenthub-net` 网络上的服务名。

## 使用

```typescript
import { resolveServiceUrl } from '@agenthub/shared/constants';

const coreUrl = resolveServiceUrl('core-engine');
// env 模式 → 'http://localhost:3001'
// dns 模式 → 'http://core-engine:3001'
```

```typescript
import { resolvedServiceUrls } from '@agenthub/shared/constants';

const urls = resolvedServiceUrls();
console.log(urls);
// { 'core-engine': 'http://...', 'mcp-gateway': 'http://...', ... }
```

## Docker Compose 网络

所有服务部署在 `agenthub-net` bridge 网络上：

```yaml
# docker/docker-compose.yml
networks:
  agenthub-net:
    driver: bridge

services:
  core-engine:
    networks:
      - agenthub-net
  mcp-gateway:
    networks:
      - agenthub-net
  # ...
```

在 Docker 网络中，服务名作为 DNS 名称自动注册。将 `SERVICE_DISCOVERY=dns` 设置后，`http://core-engine:3001` 会被 Docker DNS 自动解析到 Core Engine 容器的 IP。

## 设计决策

**为什么不引入 Consul/etcd/服务网格？**

- AgentHub 当前是无状态服务集群，所有服务实例静态已知
- Docker Compose 提供的内置 DNS 对于单机部署已足够
- 额外引入服务网格增加了运维复杂度，收益有限
- 策略模式使未来升级到完整服务发现方案（Consul、K8s Service、DNS-SD）时不需修改调用方代码

**未来 Kubernetes 迁移路径：**

```
SERVICE_DISCOVERY=dns
CORE_ENGINE_URL=http://core-engine.agenthub.svc.cluster.local:3001
```

在 K8s 中，将 `SERVICE_DISCOVERY=dns` 设置，并使用 K8s Service FQDN 作为 `*_URL` 值（覆盖 `env` 策略默认值）。或新增 `k8s` 策略利用 K8s Downward API 自动发现。

## 相关

- `.env.example` — 服务发现环境变量
- `packages/shared/src/constants/service-urls.ts` — URL 解析实现
- `docker/docker-compose.yml` — 网络拓扑
