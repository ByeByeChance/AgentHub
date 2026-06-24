package jsonrpc

import (
	"encoding/json"
	"testing"
)

func TestRequestParsing(t *testing.T) {
	body := `{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}`
	var req Request
	if err := json.Unmarshal([]byte(body), &req); err != nil {
		t.Fatalf("failed to parse request: %v", err)
	}
	if req.JSONRPC != "2.0" {
		t.Errorf("expected jsonrpc 2.0, got %s", req.JSONRPC)
	}
	if req.Method != "tools/list" {
		t.Errorf("expected method tools/list, got %s", req.Method)
	}
}

func TestRequestIsNotification(t *testing.T) {
	req := &Request{JSONRPC: "2.0", Method: "ping"}
	if !req.IsNotification() {
		t.Error("expected IsNotification=true when ID is nil")
	}

	req.ID = 1
	if req.IsNotification() {
		t.Error("expected IsNotification=false when ID is set")
	}
}

func TestErrorResponse(t *testing.T) {
	err := NewError(ErrMethodNotFound, "Method not found", nil)
	if err.Code != ErrMethodNotFound {
		t.Errorf("expected code %d, got %d", ErrMethodNotFound, err.Code)
	}
	if err.Message != "Method not found" {
		t.Errorf("expected message 'Method not found', got '%s'", err.Message)
	}
}

func TestResponseSerialization(t *testing.T) {
	resp := &Response{
		JSONRPC: "2.0",
		ID:      1,
		Result:  map[string]string{"status": "ok"},
	}
	data, err := json.Marshal(resp)
	if err != nil {
		t.Fatalf("failed to marshal response: %v", err)
	}
	var parsed map[string]interface{}
	if err := json.Unmarshal(data, &parsed); err != nil {
		t.Fatalf("failed to unmarshal response: %v", err)
	}
	if parsed["jsonrpc"] != "2.0" {
		t.Errorf("expected jsonrpc 2.0")
	}
}

func TestErrorResponseSerialization(t *testing.T) {
	resp := &Response{
		JSONRPC: "2.0",
		ID:      1,
		Error:   NewError(ErrInvalidParams, "Invalid params", "missing name"),
	}
	data, err := json.Marshal(resp)
	if err != nil {
		t.Fatalf("failed to marshal error response: %v", err)
	}
	var parsed map[string]interface{}
	if err := json.Unmarshal(data, &parsed); err != nil {
		t.Fatalf("failed to unmarshal error response: %v", err)
	}
	errObj := parsed["error"].(map[string]interface{})
	if int(errObj["code"].(float64)) != ErrInvalidParams {
		t.Errorf("expected error code %d", ErrInvalidParams)
	}
}
