package ratelimit

// Strategy defines the interface for rate limiting strategies
type Strategy interface {
	// Allow checks if a request identified by key should be allowed.
	// Returns true if allowed, false if rate limited.
	Allow(key string) bool
}

// NoopStrategy is a pass-through limiter that allows all requests.
// Used as the default in M4; will be replaced in M6.
type NoopStrategy struct{}

func (n *NoopStrategy) Allow(key string) bool {
	return true
}
