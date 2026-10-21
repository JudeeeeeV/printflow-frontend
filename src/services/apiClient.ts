// src/services/apiClient.ts

/**
 * Base API client configuration for connecting to the local NestJS backend.
 */
import { API_URL as BASE_URL } from '../config/runtime';

let refreshPromise: Promise<boolean> | null = null;
const GET_CACHE_TTL_MS = 10_000;
const responseCache = new Map<string, { expiresAt: number; value: unknown }>();
const pendingGets = new Map<string, Promise<unknown>>();
let cacheGeneration = 0;

const ACCESS_TOKEN_KEY = 'pf_access_token';
const REFRESH_TOKEN_KEY = 'pf_refresh_token';

export function getAccessToken(): string | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getRefreshToken(): string | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAuthTokens(
  accessToken?: string | null,
  refreshToken?: string | null,
): void {
  try {
    if (typeof localStorage === 'undefined') return;
    if (accessToken) localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    else if (accessToken === null) localStorage.removeItem(ACCESS_TOKEN_KEY);

    if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    else if (refreshToken === null) localStorage.removeItem(REFRESH_TOKEN_KEY);
  } catch {}
}

export function clearAuthTokens(): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  } catch {}
}

export function invalidateApiCache(): void {
  cacheGeneration++;
  responseCache.clear();
  pendingGets.clear();
}

function refreshSession(): Promise<boolean> {
  if (!refreshPromise) {
    const refreshToken = getRefreshToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (refreshToken) {
      headers['Authorization'] = `Bearer ${refreshToken}`;
    }
    refreshPromise = fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ refreshToken }),
      credentials: 'include',
    })
      .then(async (response) => {
        if (!response.ok) return false;
        try {
          const data = await response.json();
          if (data && typeof data === 'object') {
            if (data.token || data.refreshToken) {
              setAuthTokens(data.token, data.refreshToken);
            }
          }
        } catch {}
        return true;
      })
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

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
  const method = (options.method || 'GET').toUpperCase();
  const requestGeneration = cacheGeneration;
  if (method === 'GET' && requestGeneration === cacheGeneration) {
    const cached = responseCache.get(endpoint);
    if (cached && cached.expiresAt > Date.now()) return cached.value as T;
    if (cached) responseCache.delete(endpoint);
    const pending = pendingGets.get(endpoint);
    if (pending) return pending as Promise<T>;
  }
  
  // Setup default headers
  const headers = new Headers(options.headers || {});
  if (options.body != null && !headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const token = getAccessToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const config: RequestInit = {
    ...options,
    headers,
    credentials: 'include',
  };

  const request = (async () => {
    try {
      let response = await fetch(url, config);

      if (response.status === 401 && (!endpoint.startsWith('/auth') || endpoint === '/auth/profile')) {
        if (await refreshSession()) {
          const retryHeaders = new Headers(config.headers || {});
          const refreshedToken = getAccessToken();
          if (refreshedToken) {
            retryHeaders.set('Authorization', `Bearer ${refreshedToken}`);
          }
          response = await fetch(url, { ...config, headers: retryHeaders });
        } else {
          invalidateApiCache();
          clearAuthTokens();
          if (typeof localStorage !== 'undefined') localStorage.removeItem('user_role');
          if (typeof window !== 'undefined' && window.location) window.location.href = '/auth';
        }
      }

      // Attempt to parse JSON response
      let data;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      if (!response.ok) {
        throw new ApiError(
          data?.message || 'An error occurred during the request.',
          response.status,
          data
        );
      }

      if (method === 'GET') {
        responseCache.set(endpoint, {
          expiresAt: Date.now() + GET_CACHE_TTL_MS,
          value: data,
        });
      } else {
        invalidateApiCache();
      }
      return data as T;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      // Handle network errors (e.g. server down)
      throw new ApiError('Network error. Is the backend running?', 0, error);
    }
  })();

  if (method === 'GET') {
    pendingGets.set(endpoint, request);
    request.finally(() => {
      if (pendingGets.get(endpoint) === request) pendingGets.delete(endpoint);
    }).catch(() => undefined);
  }
  return request;
}
