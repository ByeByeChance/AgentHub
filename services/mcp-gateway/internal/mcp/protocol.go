package mcp

// Method name constants
const (
	MethodInitialize = "initialize"
	MethodToolsList  = "tools/list"
	MethodToolsCall  = "tools/call"
	MethodPing       = "ping"
)

// ---- Server Info ----

// ServerInfo describes the MCP server
type ServerInfo struct {
	Name    string `json:"name"`
	Version string `json:"version"`
}

// ServerCapabilities describes what the server supports
type ServerCapabilities struct {
	Tools *ToolsCapability `json:"tools,omitempty"`
}

// ToolsCapability describes tool-related capabilities
type ToolsCapability struct {
	ListChanged bool `json:"listChanged"`
}

// ---- Initialize ----

// InitializeRequest is sent by the client to start an MCP session
type InitializeRequest struct {
	ProtocolVersion string            `json:"protocolVersion"`
	ClientInfo      ClientInfo        `json:"clientInfo"`
	Capabilities    map[string]interface{} `json:"capabilities"`
}

// ClientInfo describes the MCP client
type ClientInfo struct {
	Name    string `json:"name"`
	Version string `json:"version"`
}

// InitializeResult is the server's response to initialize
type InitializeResult struct {
	ProtocolVersion string             `json:"protocolVersion"`
	ServerInfo      ServerInfo         `json:"serverInfo"`
	Capabilities    ServerCapabilities `json:"capabilities"`
}

// ---- Tools ----

// ToolDefinition describes an MCP tool
type ToolDefinition struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	InputSchema map[string]interface{} `json:"inputSchema"`
}

// ToolsListResult is the response to tools/list
type ToolsListResult struct {
	Tools []ToolDefinition `json:"tools"`
}

// ToolsCallRequest is the request to call a tool
type ToolsCallRequest struct {
	Name      string                 `json:"name"`
	Arguments map[string]interface{} `json:"arguments"`
}

// ToolContent is a single piece of content in a tool result
type ToolContent struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

// ToolsCallResult is the response to a tool call
type ToolsCallResult struct {
	Content []ToolContent `json:"content"`
	IsError bool          `json:"isError,omitempty"`
}

// ---- Ping ----

// PingResult is the response to a ping
type PingResult struct {
	Status string `json:"status"`
}
