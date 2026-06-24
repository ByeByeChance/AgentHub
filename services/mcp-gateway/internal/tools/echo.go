package tools

import (
	"context"
	"fmt"
	"time"

	"agenthub/mcp-gateway/internal/mcp"
)

// NewEchoTool creates the built-in Echo tool entry
func NewEchoTool() Entry {
	return Entry{
		Definition: mcp.ToolDefinition{
			Name:        "echo",
			Description: "Echoes back the message with a timestamp. Useful for testing connectivity of the MCP Gateway.",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"message": map[string]interface{}{
						"type":        "string",
						"description": "The message to echo back",
					},
				},
				"required": []string{"message"},
			},
		},
		Handler: echoHandler,
	}
}

func echoHandler(ctx context.Context, args map[string]interface{}) (*mcp.ToolsCallResult, error) {
	message, ok := args["message"].(string)
	if !ok {
		return &mcp.ToolsCallResult{
			Content: []mcp.ToolContent{
				{Type: "text", Text: "Error: missing required parameter 'message'"},
			},
			IsError: true,
		}, nil
	}

	content := fmt.Sprintf("Echo [%s]: %s", time.Now().UTC().Format(time.RFC3339), message)
	return &mcp.ToolsCallResult{
		Content: []mcp.ToolContent{
			{Type: "text", Text: content},
		},
	}, nil
}
