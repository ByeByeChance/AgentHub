package jsonrpc

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
)

// MethodHandler is a function that handles a JSON-RPC method call
type MethodHandler func(ctx context.Context, params json.RawMessage) (interface{}, error)

// Handler dispatches JSON-RPC 2.0 requests to registered method handlers
type Handler struct {
	methods map[string]MethodHandler
}

// NewHandler creates a new JSON-RPC handler
func NewHandler() *Handler {
	return &Handler{
		methods: make(map[string]MethodHandler),
	}
}

// RegisterMethod registers a handler for a given method name
func (h *Handler) RegisterMethod(method string, handler MethodHandler) {
	h.methods[method] = handler
}

// ServeHTTP handles HTTP requests for the JSON-RPC endpoint
func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, nil, ErrInvalidRequest, "Only POST method is accepted")
		return
	}

	// Parse the raw JSON
	var raw json.RawMessage
	if err := json.NewDecoder(r.Body).Decode(&raw); err != nil {
		writeError(w, nil, ErrParse, "Failed to parse JSON body")
		return
	}

	// Check if this is a batch request (array) or single request (object)
	switch raw[0] {
	case '[':
		h.handleBatchRequest(w, r, raw)
	case '{':
		h.handleSingleRequest(w, r, raw)
	default:
		writeError(w, nil, ErrInvalidRequest, "Request must be a JSON object or array")
	}
}

func (h *Handler) handleSingleRequest(w http.ResponseWriter, r *http.Request, raw json.RawMessage) {
	var req Request
	if err := json.Unmarshal(raw, &req); err != nil {
		writeError(w, nil, ErrParse, "Invalid JSON-RPC request: "+err.Error())
		return
	}

	if req.JSONRPC != "2.0" {
		writeError(w, req.ID, ErrInvalidRequest, "jsonrpc must be '2.0'")
		return
	}

	result, err := h.dispatch(r.Context(), req.Method, req.Params)
	if req.IsNotification() {
		// Notifications get no response
		return
	}

	if err != nil {
		writeRPCError(w, req.ID, err)
		return
	}

	writeRPCResponse(w, req.ID, result)
}

func (h *Handler) handleBatchRequest(w http.ResponseWriter, r *http.Request, raw json.RawMessage) {
	var requests []Request
	if err := json.Unmarshal(raw, &requests); err != nil {
		writeError(w, nil, ErrParse, "Invalid JSON-RPC batch request: "+err.Error())
		return
	}

	if len(requests) == 0 {
		writeError(w, nil, ErrInvalidRequest, "Batch request must not be empty")
		return
	}

	responses := make([]*Response, 0, len(requests))
	for _, req := range requests {
		if req.IsNotification() {
			go h.dispatch(r.Context(), req.Method, req.Params)
			continue
		}

		resp := &Response{JSONRPC: "2.0", ID: req.ID}
		result, err := h.dispatch(r.Context(), req.Method, req.Params)
		if err != nil {
			if rpcErr, ok := err.(*rpcError); ok {
				resp.Error = &Error{Code: rpcErr.code, Message: rpcErr.message, Data: rpcErr.data}
			} else {
				resp.Error = NewError(ErrInternal, err.Error(), nil)
			}
		} else {
			resp.Result = result
		}
		responses = append(responses, resp)
	}

	// All notifications, no responses needed
	if len(responses) == 0 {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	if err := json.NewEncoder(w).Encode(responses); err != nil {
		log.Printf("jsonrpc: failed to encode batch response: %v", err)
	}
}

func (h *Handler) dispatch(ctx context.Context, method string, params json.RawMessage) (interface{}, error) {
	handler, ok := h.methods[method]
	if !ok {
		return nil, &rpcError{
			code:    ErrMethodNotFound,
			message: fmt.Sprintf("Method not found: %s", method),
		}
	}

	return handler(ctx, params)
}

// rpcError is a typed error that carries JSON-RPC error fields
type rpcError struct {
	code    int
	message string
	data    interface{}
}

func (e *rpcError) Error() string {
	return e.message
}

func newRPCError(code int, message string, data interface{}) *rpcError {
	return &rpcError{code: code, message: message, data: data}
}

func writeRPCResponse(w http.ResponseWriter, id interface{}, result interface{}) {
	resp := &Response{
		JSONRPC: "2.0",
		ID:      id,
		Result:  result,
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	if err := json.NewEncoder(w).Encode(resp); err != nil {
		log.Printf("jsonrpc: failed to encode response: %v", err)
	}
}

func writeRPCError(w http.ResponseWriter, id interface{}, err error) {
	rpcErr, ok := err.(*rpcError)
	if !ok {
		rpcErr = newRPCError(ErrInternal, err.Error(), nil)
	}

	resp := &Response{
		JSONRPC: "2.0",
		ID:      id,
		Error:   &Error{Code: rpcErr.code, Message: rpcErr.message, Data: rpcErr.data},
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	if err := json.NewEncoder(w).Encode(resp); err != nil {
		log.Printf("jsonrpc: failed to encode error response: %v", err)
	}
}

func writeError(w http.ResponseWriter, id interface{}, code int, message string) {
	resp := &Response{
		JSONRPC: "2.0",
		ID:      id,
		Error:   NewError(code, message, nil),
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	if err := json.NewEncoder(w).Encode(resp); err != nil {
		log.Printf("jsonrpc: failed to encode error response: %v", err)
	}
}
