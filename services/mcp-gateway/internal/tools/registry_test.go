package tools

import (
	"context"
	"testing"

	"agenthub/mcp-gateway/internal/mcp"
)

func TestRegistry_RegisterAndList(t *testing.T) {
	r := NewRegistry()
	r.Register(Entry{
		Definition: mcp.ToolDefinition{
			Name:        "echo",
			Description: "Echo tool",
			InputSchema: map[string]interface{}{"type": "object"},
		},
		Handler: nil,
	})

	tools := r.List()
	if len(tools) != 1 {
		t.Errorf("expected 1 tool, got %d", len(tools))
	}
	if tools[0].Name != "echo" {
		t.Errorf("expected tool name 'echo', got '%s'", tools[0].Name)
	}
}

func TestRegistry_Call(t *testing.T) {
	r := NewRegistry()
	r.Register(Entry{
		Definition: mcp.ToolDefinition{
			Name:        "add",
			Description: "Adds two numbers",
			InputSchema: map[string]interface{}{"type": "object"},
		},
		Handler: func(ctx context.Context, args map[string]interface{}) (*mcp.ToolsCallResult, error) {
			return &mcp.ToolsCallResult{
				Content: []mcp.ToolContent{{Type: "text", Text: "result: 42"}},
			}, nil
		},
	})

	result, err := r.Call(context.Background(), "add", nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result.Content) != 1 {
		t.Errorf("expected 1 content item, got %d", len(result.Content))
	}
	if result.Content[0].Text != "result: 42" {
		t.Errorf("expected 'result: 42', got '%s'", result.Content[0].Text)
	}
}

func TestRegistry_CallUnknownTool(t *testing.T) {
	r := NewRegistry()
	_, err := r.Call(context.Background(), "nonexistent", nil)
	if err == nil {
		t.Fatal("expected error for unknown tool")
	}
}
