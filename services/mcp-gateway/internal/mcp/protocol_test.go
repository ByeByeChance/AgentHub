package mcp

import (
	"encoding/json"
	"testing"
)

func TestInitializeRequest(t *testing.T) {
	body := `{"protocolVersion":"2024-11-05","clientInfo":{"name":"test-client","version":"1.0"},"capabilities":{}}`
	var req InitializeRequest
	if err := json.Unmarshal([]byte(body), &req); err != nil {
		t.Fatalf("failed to parse InitializeRequest: %v", err)
	}
	if req.ProtocolVersion != "2024-11-05" {
		t.Errorf("expected protocol version 2024-11-05, got %s", req.ProtocolVersion)
	}
	if req.ClientInfo.Name != "test-client" {
		t.Errorf("expected client name test-client, got %s", req.ClientInfo.Name)
	}
}

func TestInitializeResult(t *testing.T) {
	result := InitializeResult{
		ProtocolVersion: "2024-11-05",
		ServerInfo: ServerInfo{
			Name:    "agenthub-mcp-gateway",
			Version: "0.1.0",
		},
		Capabilities: ServerCapabilities{
			Tools: &ToolsCapability{ListChanged: true},
		},
	}
	data, err := json.Marshal(result)
	if err != nil {
		t.Fatalf("failed to marshal InitializeResult: %v", err)
	}
	var parsed map[string]interface{}
	if err := json.Unmarshal(data, &parsed); err != nil {
		t.Fatalf("failed to unmarshal: %v", err)
	}
	serverInfo := parsed["serverInfo"].(map[string]interface{})
	if serverInfo["name"] != "agenthub-mcp-gateway" {
		t.Errorf("expected server name agenthub-mcp-gateway")
	}
}

func TestToolsListResult(t *testing.T) {
	result := ToolsListResult{
		Tools: []ToolDefinition{
			{
				Name:        "echo",
				Description: "Echoes back input",
				InputSchema: map[string]interface{}{
					"type": "object",
					"properties": map[string]interface{}{
						"message": map[string]interface{}{
							"type": "string",
						},
					},
				},
			},
		},
	}
	data, _ := json.Marshal(result)
	var parsed ToolsListResult
	if err := json.Unmarshal(data, &parsed); err != nil {
		t.Fatalf("failed to unmarshal ToolsListResult: %v", err)
	}
	if len(parsed.Tools) != 1 {
		t.Errorf("expected 1 tool, got %d", len(parsed.Tools))
	}
	if parsed.Tools[0].Name != "echo" {
		t.Errorf("expected tool name 'echo', got '%s'", parsed.Tools[0].Name)
	}
}

func TestToolsCallResult(t *testing.T) {
	result := ToolsCallResult{
		Content: []ToolContent{
			{Type: "text", Text: "Echo: hello"},
		},
	}
	data, _ := json.Marshal(result)
	var parsed map[string]interface{}
	if err := json.Unmarshal(data, &parsed); err != nil {
		t.Fatalf("failed to unmarshal: %v", err)
	}
	content := parsed["content"].([]interface{})
	item := content[0].(map[string]interface{})
	if item["type"] != "text" {
		t.Errorf("expected content type 'text'")
	}
}
