package auth

import (
	"net/http"
	"testing"
)

func TestAPIKeyAuth_NoKeysConfigured(t *testing.T) {
	a := NewAPIKeyAuthFromKeys([]string{})
	req, _ := http.NewRequest("POST", "/jsonrpc", nil)
	req.Header.Set("X-API-Key", "some-key")

	ok, err := a.Authenticate(req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ok {
		t.Error("expected deny when no keys are configured")
	}
}

func TestAPIKeyAuth_XAPIKeyHeader(t *testing.T) {
	a := NewAPIKeyAuthFromKeys([]string{"secret-1", "secret-2"})

	req, _ := http.NewRequest("POST", "/jsonrpc", nil)
	req.Header.Set("X-API-Key", "secret-1")
	ok, err := a.Authenticate(req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !ok {
		t.Error("expected allow for valid X-API-Key")
	}
}

func TestAPIKeyAuth_BearerHeader(t *testing.T) {
	a := NewAPIKeyAuthFromKeys([]string{"bearer-token"})

	req, _ := http.NewRequest("POST", "/jsonrpc", nil)
	req.Header.Set("Authorization", "Bearer bearer-token")
	ok, err := a.Authenticate(req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !ok {
		t.Error("expected allow for valid Bearer token")
	}
}

func TestAPIKeyAuth_InvalidKey(t *testing.T) {
	a := NewAPIKeyAuthFromKeys([]string{"valid"})

	req, _ := http.NewRequest("POST", "/jsonrpc", nil)
	req.Header.Set("X-API-Key", "wrong-key")
	ok, err := a.Authenticate(req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ok {
		t.Error("expected deny for invalid key")
	}
}

func TestAPIKeyAuth_NoHeader(t *testing.T) {
	a := NewAPIKeyAuthFromKeys([]string{"valid"})

	req, _ := http.NewRequest("POST", "/jsonrpc", nil)
	ok, err := a.Authenticate(req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ok {
		t.Error("expected deny when no auth header is present")
	}
}

func TestAPIKeyAuth_XAPIKeyTakesPrecedence(t *testing.T) {
	a := NewAPIKeyAuthFromKeys([]string{"header-key"})

	req, _ := http.NewRequest("POST", "/jsonrpc", nil)
	req.Header.Set("X-API-Key", "header-key")
	req.Header.Set("Authorization", "Bearer different-key")
	ok, err := a.Authenticate(req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !ok {
		t.Error("expected allow — X-API-Key should take precedence")
	}
}
