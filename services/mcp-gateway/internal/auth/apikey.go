package auth

import (
	"net/http"
	"os"
	"strings"
)

// APIKeyAuth validates requests using pre-configured API keys.
// Keys can be passed via:
//   - Authorization: Bearer <key>
//   - X-API-Key: <key>
//
// Valid keys are loaded from the MCP_GATEWAY_API_KEYS env var (comma-separated).
type APIKeyAuth struct {
	keys map[string]struct{}
}

// NewAPIKeyAuth creates an APIKeyAuth with keys from MCP_GATEWAY_API_KEYS.
// Example: MCP_GATEWAY_API_KEYS=key1,key2,key3
func NewAPIKeyAuth() *APIKeyAuth {
	a := &APIKeyAuth{keys: make(map[string]struct{})}
	raw := os.Getenv("MCP_GATEWAY_API_KEYS")
	if raw == "" {
		return a
	}
	for _, key := range strings.Split(raw, ",") {
		trimmed := strings.TrimSpace(key)
		if trimmed != "" {
			a.keys[trimmed] = struct{}{}
		}
	}
	return a
}

// NewAPIKeyAuthFromKeys creates an APIKeyAuth from a given key list (for testing).
func NewAPIKeyAuthFromKeys(keys []string) *APIKeyAuth {
	a := &APIKeyAuth{keys: make(map[string]struct{})}
	for _, k := range keys {
		if k != "" {
			a.keys[k] = struct{}{}
		}
	}
	return a
}

// Authenticate checks the request for a valid API key.
func (a *APIKeyAuth) Authenticate(r *http.Request) (bool, error) {
	// No keys configured — deny all (secure by default)
	if len(a.keys) == 0 {
		return false, nil
	}

	// Check X-API-Key header first
	key := r.Header.Get("X-API-Key")
	if key != "" {
		_, ok := a.keys[key]
		return ok, nil
	}

	// Check Authorization: Bearer <key>
	authHeader := r.Header.Get("Authorization")
	if strings.HasPrefix(authHeader, "Bearer ") {
		key = strings.TrimPrefix(authHeader, "Bearer ")
		_, ok := a.keys[key]
		return ok, nil
	}

	return false, nil
}
