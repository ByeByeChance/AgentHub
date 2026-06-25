package ratelimit

import (
	"os"
	"strconv"
	"sync"
	"time"
)

// TokenBucketStrategy implements a token bucket rate limiter.
//
// Each key gets its own bucket. Tokens refill at a steady rate up to a burst
// capacity. When a request arrives, one token is consumed. If no tokens are
// available the request is denied.
//
// Configuration via env vars:
//
//	MCP_RATE_LIMIT_RATE  — tokens per second (default 10)
//	MCP_RATE_LIMIT_BURST — max bucket size    (default 20)
type TokenBucketStrategy struct {
	rate  float64 // tokens per second
	burst int     // max tokens

	mu      sync.Mutex
	buckets map[string]*bucket
}

type bucket struct {
	tokens   float64
	lastFill time.Time
}

// NewTokenBucketStrategy creates a strategy from env vars.
func NewTokenBucketStrategy() *TokenBucketStrategy {
	rate := 10.0
	burst := 20

	if v := os.Getenv("MCP_RATE_LIMIT_RATE"); v != "" {
		if parsed, err := strconv.ParseFloat(v, 64); err == nil && parsed > 0 {
			rate = parsed
		}
	}
	if v := os.Getenv("MCP_RATE_LIMIT_BURST"); v != "" {
		if parsed, err := strconv.Atoi(v); err == nil && parsed > 0 {
			burst = parsed
		}
	}

	return &TokenBucketStrategy{
		rate:    rate,
		burst:   burst,
		buckets: make(map[string]*bucket),
	}
}

// NewTokenBucketStrategyWithConfig creates a strategy with explicit config (for testing).
func NewTokenBucketStrategyWithConfig(rate float64, burst int) *TokenBucketStrategy {
	return &TokenBucketStrategy{
		rate:    rate,
		burst:   burst,
		buckets: make(map[string]*bucket),
	}
}

// Allow checks if a request identified by key should proceed.
func (t *TokenBucketStrategy) Allow(key string) bool {
	t.mu.Lock()
	defer t.mu.Unlock()

	b, exists := t.buckets[key]
	now := time.Now()

	if !exists {
		// New bucket starts full
		b = &bucket{tokens: float64(t.burst), lastFill: now}
		t.buckets[key] = b
	} else {
		// Refill tokens based on elapsed time
		elapsed := now.Sub(b.lastFill).Seconds()
		b.tokens += elapsed * t.rate
		if b.tokens > float64(t.burst) {
			b.tokens = float64(t.burst)
		}
		b.lastFill = now
	}

	if b.tokens >= 1.0 {
		b.tokens -= 1.0
		return true
	}

	return false
}
