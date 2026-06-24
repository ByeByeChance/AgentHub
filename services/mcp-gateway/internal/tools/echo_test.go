package tools

import (
	"context"
	"testing"
)

func TestEchoTool_Success(t *testing.T) {
	entry := NewEchoTool()
	result, err := entry.Handler(context.Background(), map[string]interface{}{
		"message": "hello world",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.IsError {
		t.Fatal("expected IsError=false")
	}
	if len(result.Content) != 1 {
		t.Fatalf("expected 1 content, got %d", len(result.Content))
	}
	text := result.Content[0].Text
	if text == "" {
		t.Fatal("expected non-empty echo response")
	}
}

func TestEchoTool_MissingMessage(t *testing.T) {
	entry := NewEchoTool()
	result, err := entry.Handler(context.Background(), map[string]interface{}{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !result.IsError {
		t.Fatal("expected IsError=true when message is missing")
	}
}

func TestEchoTool_EmptyMessage(t *testing.T) {
	entry := NewEchoTool()
	result, err := entry.Handler(context.Background(), map[string]interface{}{
		"message": "",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.IsError {
		t.Fatal("empty message should not be an error")
	}
}
