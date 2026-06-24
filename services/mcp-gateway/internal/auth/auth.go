package auth

import "net/http"

// Strategy defines the interface for authentication strategies
type Strategy interface {
	// Authenticate checks if a request is authenticated.
	// Returns true if authenticated, false otherwise.
	Authenticate(r *http.Request) (bool, error)
}

// NoopAuth is a pass-through strategy that allows all requests.
// Used as the default in M4; will be replaced by APIKey/OAuth2/mTLS in M6.
type NoopAuth struct{}

func (n *NoopAuth) Authenticate(r *http.Request) (bool, error) {
	return true, nil
}
