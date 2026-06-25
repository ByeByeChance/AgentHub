package ratelimit

import (
	"testing"
	"time"
)

func TestTokenBucket_AllowsUpToBurst(t *testing.T) {
	s := NewTokenBucketStrategyWithConfig(1.0, 5) // 1 token/s, burst 5

	for i := 0; i < 5; i++ {
		if !s.Allow("client-1") {
			t.Errorf("request %d should be allowed (within burst)", i+1)
		}
	}

	// 6th request should be denied (bucket empty, refill rate too slow)
	if s.Allow("client-1") {
		t.Error("6th request should be denied (bucket exhausted)")
	}
}

func TestTokenBucket_RefillsOverTime(t *testing.T) {
	s := NewTokenBucketStrategyWithConfig(10.0, 2) // 10 tokens/s = 1 token per 100ms, burst 2

	// Exhaust the bucket
	if !s.Allow("client-2") {
		t.Fatal("first request should be allowed")
	}
	if !s.Allow("client-2") {
		t.Fatal("second request should be allowed")
	}
	if s.Allow("client-2") {
		t.Fatal("third request should be denied (bucket empty)")
	}

	// Wait for refill
	time.Sleep(150 * time.Millisecond)

	// Should have at least 1 token now
	if !s.Allow("client-2") {
		t.Error("request after refill should be allowed")
	}
}

func TestTokenBucket_IndependentPerKey(t *testing.T) {
	s := NewTokenBucketStrategyWithConfig(1.0, 1)

	// Client A uses its token
	if !s.Allow("client-a") {
		t.Fatal("client-a first request should be allowed")
	}
	if s.Allow("client-a") {
		t.Fatal("client-a second request should be denied")
	}

	// Client B still has its token
	if !s.Allow("client-b") {
		t.Error("client-b should still have its token")
	}
}

func TestTokenBucket_NoopAllowsAll(t *testing.T) {
	s := &NoopStrategy{}
	for i := 0; i < 1000; i++ {
		if !s.Allow("any-key") {
			t.Errorf("noop should allow all requests (denied at %d)", i)
		}
	}
}

func TestNoopAuth_AllowsAll(t *testing.T) {
	// Cross-package logic test
	type Strategy interface {
		Allow(key string) bool
	}
	// Just verifying the pattern works
	s := &NoopStrategy{}
	for i := 0; i < 100; i++ {
		if !s.Allow("") {
			t.Error("noop should always allow")
		}
	}
}
