package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"agenthub/mcp-gateway/internal/auth"
	"agenthub/mcp-gateway/internal/jsonrpc"
	"agenthub/mcp-gateway/internal/mcp"
	"agenthub/mcp-gateway/internal/ratelimit"
	"agenthub/mcp-gateway/internal/tools"
)

func main() {
	port := os.Getenv("MCP_GATEWAY_PORT")
	if port == "" {
		port = "8080"
	}

	// Initialize components
	jsonrpcHandler := jsonrpc.NewHandler()
	toolRegistry := tools.NewRegistry()
	authStrategy := &auth.NoopAuth{}
	rateLimiter := &ratelimit.NoopStrategy{}

	// Register Echo tool
	toolRegistry.Register(tools.NewEchoTool())

	// Register MCP methods
	jsonrpcHandler.RegisterMethod(mcp.MethodInitialize, func(ctx context.Context, params json.RawMessage) (interface{}, error) {
		return mcp.InitializeResult{
			ProtocolVersion: "2024-11-05",
			ServerInfo: mcp.ServerInfo{
				Name:    "agenthub-mcp-gateway",
				Version: "0.1.0",
			},
			Capabilities: mcp.ServerCapabilities{
				Tools: &mcp.ToolsCapability{ListChanged: true},
			},
		}, nil
	})

	jsonrpcHandler.RegisterMethod(mcp.MethodToolsList, func(ctx context.Context, params json.RawMessage) (interface{}, error) {
		return mcp.ToolsListResult{
			Tools: toolRegistry.List(),
		}, nil
	})

	jsonrpcHandler.RegisterMethod(mcp.MethodToolsCall, func(ctx context.Context, params json.RawMessage) (interface{}, error) {
		var req mcp.ToolsCallRequest
		if err := json.Unmarshal(params, &req); err != nil {
			return nil, &jsonrpc.Error{
				Code:    jsonrpc.ErrInvalidParams,
				Message: "Invalid tool call parameters: " + err.Error(),
			}
		}
		return toolRegistry.Call(ctx, req.Name, req.Arguments)
	})

	jsonrpcHandler.RegisterMethod(mcp.MethodPing, func(ctx context.Context, params json.RawMessage) (interface{}, error) {
		return mcp.PingResult{Status: "ok"}, nil
	})

	// Auth middleware wrapper
	mux := http.NewServeMux()

	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{
			"status":    "ok",
			"service":   "mcp-gateway",
			"timestamp": time.Now().UTC().Format(time.RFC3339),
		})
	})

	mux.HandleFunc("/jsonrpc", func(w http.ResponseWriter, r *http.Request) {
		// Auth check
		authenticated, err := authStrategy.Authenticate(r)
		if err != nil || !authenticated {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnauthorized)
			json.NewEncoder(w).Encode(map[string]string{"error": "Unauthorized"})
			return
		}

		// Rate limit check
		clientKey := r.RemoteAddr
		if !rateLimiter.Allow(clientKey) {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusTooManyRequests)
			json.NewEncoder(w).Encode(map[string]string{"error": "Rate limit exceeded"})
			return
		}

		jsonrpcHandler.ServeHTTP(w, r)
	})

	server := &http.Server{
		Addr:    ":" + port,
		Handler: mux,
	}

	// Graceful shutdown
	go func() {
		sigCh := make(chan os.Signal, 1)
		signal.Notify(sigCh, syscall.SIGTERM, syscall.SIGINT)
		<-sigCh
		log.Println("Shutting down mcp-gateway...")
		server.Close()
	}()

	log.Printf("mcp-gateway listening on :%s", port)
	if err := server.ListenAndServe(); err != http.ErrServerClosed {
		log.Fatalf("server error: %v", err)
	}
}
