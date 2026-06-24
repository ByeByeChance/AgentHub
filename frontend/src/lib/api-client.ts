import { logger } from './logger';

class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(`API Error ${status}: ${message}`);
    this.name = 'ApiError';
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const url = `${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const options: RequestInit = {
    method,
    headers,
  };

  if (body !== undefined) {
    options.body = JSON.stringify(body);
  }

  logger.debug('API request', { method, path });

  const response = await fetch(url, options);

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('API request failed', {
      method,
      path,
      status: response.status,
      error: errorText,
    });
    throw new ApiError(response.status, errorText);
  }

  const data = (await response.json()) as T;
  return data;
}

async function streamPost(
  path: string,
  body: unknown,
): Promise<ReadableStream<Uint8Array>> {
  const url = `${path}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('Stream request failed', {
      path,
      status: response.status,
      error: errorText,
    });
    throw new ApiError(response.status, errorText);
  }

  const reader = response.body;
  if (!reader) {
    throw new Error('Response body is not readable');
  }
  return reader;
}

export const apiClient = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  streamPost: (path: string, body: unknown) => streamPost(path, body),
};

export { ApiError };
