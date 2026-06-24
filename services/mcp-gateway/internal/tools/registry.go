package tools

import (
	"context"
	"fmt"
	"sync"

	"agenthub/mcp-gateway/internal/mcp"
)

// Handler is a function that executes a tool and returns results
type Handler func(ctx context.Context, args map[string]interface{}) (*mcp.ToolsCallResult, error)

// Entry bundles a tool definition with its handler
type Entry struct {
	Definition mcp.ToolDefinition
	Handler    Handler
}

// Registry is a thread-safe registry of MCP tools
type Registry struct {
	tools map[string]Entry
	mu    sync.RWMutex
}

// NewRegistry creates a new tool registry
func NewRegistry() *Registry {
	return &Registry{
		tools: make(map[string]Entry),
	}
}

// Register adds a tool to the registry
func (r *Registry) Register(entry Entry) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.tools[entry.Definition.Name] = entry
}

// List returns all registered tool definitions
func (r *Registry) List() []mcp.ToolDefinition {
	r.mu.RLock()
	defer r.mu.RUnlock()
	defs := make([]mcp.ToolDefinition, 0, len(r.tools))
	for _, entry := range r.tools {
		defs = append(defs, entry.Definition)
	}
	return defs
}

// Call executes a tool by name with the given arguments
func (r *Registry) Call(ctx context.Context, name string, args map[string]interface{}) (*mcp.ToolsCallResult, error) {
	r.mu.RLock()
	entry, ok := r.tools[name]
	r.mu.RUnlock()

	if !ok {
		return nil, fmt.Errorf("tool not found: %s", name)
	}

	return entry.Handler(ctx, args)
}
