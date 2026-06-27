# Load Testing (k6)

Uses [Grafana k6](https://k6.io) for load testing critical AgentHub API paths.

## Prerequisites

```bash
# macOS
brew install k6

# Linux (Debian/Ubuntu)
sudo apt-get install k6

# Or via Docker
docker pull grafana/k6
```

## Running

Start the full stack first:

```bash
docker compose -f docker/docker-compose.yml up -d
```

### Health Check

```bash
# Against API Gateway (default)
k6 run tests/load/health-check.js

# Against Core Engine directly
k6 run tests/load/health-check.js -e BASE_URL=http://localhost:3001
```

### Agent Listing

```bash
# With API key (api-key auth mode)
k6 run tests/load/agent-listing.js -e API_KEY=your-key-here

# Without auth (noop auth mode)
k6 run tests/load/agent-listing.js
```

### Message Send + SSE Streaming

```bash
k6 run tests/load/message-send-sse.js -e API_KEY=your-key-here
```

## Expected Baseline Performance

| Endpoint | p95 Latency | Error Rate | Notes |
|----------|------------|------------|-------|
| GET /health | < 200ms | < 1% | Should remain fast even under load |
| GET /api/agents | < 500ms | < 5% | DB query, cached after first hit |
| POST /api/conversations/:id/messages (SSE) | < 3s setup | < 10% | SSE is connection-heavy; fewer concurrent users |

## Customizing

Edit the `stages` array in each script to change the load profile:

```javascript
export const options = {
  stages: [
    { duration: '30s', target: 50 },  // ramp up
    { duration: '1m', target: 100 },  // stress test
    { duration: '30s', target: 0 },   // ramp down
  ],
};
```

## Docker

```bash
docker run --rm -i \
  --network agenthub-net \
  -v $(pwd)/tests/load:/scripts \
  grafana/k6 run /scripts/health-check.js \
  -e BASE_URL=http://api-gateway:3000
```
