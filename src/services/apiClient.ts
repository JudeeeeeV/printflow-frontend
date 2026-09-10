// src/services/apiClient.ts

/**
 * Base API client configuration for connecting to the local NestJS backend.
 */
const BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.VITE_API_URL || (import.meta.env.VITE_API_URL || ('https://printflow-backend-wen3.onrender.com')));

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;
  
  // Setup default headers
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  // Retrieve token from storage and attach to headers for protected routes
  const token = localStorage.getItem('jwt_token');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const config: RequestInit = {
    ...options,
    headers,
  };

  try {
    const response = await fetch(url, config);

    // Attempt to parse JSON response
    let data;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      if (response.status === 401 && !endpoint.startsWith('/auth')) {
        localStorage.removeItem('jwt_token');
        window.location.href = '/auth';
      }
      throw new ApiError(
        data?.message || 'An error occurred during the request.',
        response.status,
        data
      );
    }

    return data as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    // Handle network errors (e.g. server down)
    throw new ApiError('Network error. Is the backend running?', 0, error);
  }
}
