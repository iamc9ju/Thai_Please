import type { ApiErrorResponse } from '../features/auth/auth.types';

const BASE_URL = import.meta.env.VITE_API_URL ?? '';

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;
  let response: Response;
  const headers = new Headers(options.headers);

  if (options.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  try {
    response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include',
    });
  } catch (err) {
    // Cancellation is lifecycle control, not a connectivity failure.
    if (
      options.signal?.aborted ||
      (err instanceof DOMException && err.name === 'AbortError')
    ) {
      throw err;
    }
    console.error(`Network error requesting ${url}:`, err);
    throw new Error('ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง');
  }

  if (!response.ok) {
    let errorMessage = 'เกิดข้อผิดพลาดในการทำรายการ';
    try {
      const errorData = (await response.json()) as ApiErrorResponse;
      if (Array.isArray(errorData.message)) {
        errorMessage = errorData.message[0] ?? errorMessage;
      } else if (typeof errorData.message === 'string') {
        errorMessage = errorData.message;
      }
    } catch {
      // response might not be JSON
    }
    throw new ApiError(response.status, errorMessage);
  }

  return (await response.json()) as T;
}

export const apiClient = {
  get: <T>(endpoint: string, options?: RequestInit) =>
    request<T>(endpoint, { ...options, method: 'GET' }),

  post: <T>(endpoint: string, body?: unknown, options?: RequestInit) => {
    const init: RequestInit = {
      ...options,
      method: 'POST',
    };
    if (body !== undefined) {
      init.body = JSON.stringify(body);
    }
    return request<T>(endpoint, init);
  },

  put: <T>(endpoint: string, body?: unknown, options?: RequestInit) => {
    const init: RequestInit = {
      ...options,
      method: 'PUT',
    };
    if (body !== undefined) {
      init.body = JSON.stringify(body);
    }
    return request<T>(endpoint, init);
  },

  patch: <T>(endpoint: string, body?: unknown, options?: RequestInit) => {
    const init: RequestInit = {
      ...options,
      method: 'PATCH',
    };
    if (body !== undefined) {
      init.body = JSON.stringify(body);
    }
    return request<T>(endpoint, init);
  },

  delete: <T>(endpoint: string, options?: RequestInit) =>
    request<T>(endpoint, { ...options, method: 'DELETE' }),
};
