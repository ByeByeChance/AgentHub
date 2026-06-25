import { describe, it, expect, beforeEach, vi } from 'vitest';
import { apiClient, ApiError } from '@/lib/api-client';

// Ensure fetch uses a valid base URL in jsdom
const BASE = 'http://localhost:3000';

describe('apiClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('get', () => {
    it('should make a GET request and return parsed JSON', async () => {
      const mockData = [{ id: '1', name: 'Test Agent' }];
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify(mockData), { status: 200 }),
      );

      const result = await apiClient.get<typeof mockData>(`${BASE}/api/agents`);
      expect(result).toEqual(mockData);
      expect(fetch).toHaveBeenCalledWith(`${BASE}/api/agents`, expect.objectContaining({ method: 'GET' }));
    });

    it('should throw ApiError on non-2xx response', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response('Not Found', { status: 404 }),
      );

      await expect(apiClient.get(`${BASE}/api/agents/missing`)).rejects.toThrow('API Error 404');
    });
  });

  describe('post', () => {
    it('should POST JSON body and return parsed response', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'new', ok: true }), { status: 201 }),
      );

      const result = await apiClient.post(`${BASE}/api/conversations`, { title: 'Test' });
      expect(result).toEqual({ id: 'new', ok: true });
      expect(fetch).toHaveBeenCalledWith(`${BASE}/api/conversations`, expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ title: 'Test' }),
      }));
    });

    it('should throw ApiError on validation failure', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Validation failed' }), { status: 400 }),
      );

      await expect(apiClient.post(`${BASE}/api/conversations`, {})).rejects.toThrow(ApiError);
    });
  });

  describe('streamPost', () => {
    it('should return a readable stream on success', async () => {
      const mockBody = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('data: test\n\n'));
          controller.close();
        },
      });

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(mockBody, { status: 200 }),
      );

      const stream = await apiClient.streamPost(`${BASE}/api/conversations/1/messages`, { content: 'hi' });
      expect(stream).toBeInstanceOf(ReadableStream);
    });

    it('should throw when response body is null', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(null, { status: 200 }),
      );

      await expect(
        apiClient.streamPost(`${BASE}/api/conversations/1/messages`, { content: 'hi' }),
      ).rejects.toThrow('Response body is not readable');
    });

    it('should throw ApiError on non-2xx', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response('Not Found', { status: 404 }),
      );

      await expect(
        apiClient.streamPost(`${BASE}/api/conversations/missing/messages`, { content: 'hi' }),
      ).rejects.toThrow(ApiError);
    });
  });
});
