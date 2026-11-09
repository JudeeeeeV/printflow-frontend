// src/services/apiClient.ts

/**
 * Base API client configuration for connecting to the local NestJS backend.
 */
import { API_URL as BASE_URL } from '../config/runtime';

type RefreshOutcome = 'refreshed' | 'rejected' | 'unavailable';

let refreshPromise: Promise<RefreshOutcome> | null = null;
const GET_CACHE_TTL_MS = 10_000;
const SESSION_REFRESH_TIMEOUT_MS = 30_000;
const TOKEN_EXPIRY_MARGIN_MS = 30_000;
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
  // Requests started by the previous account must not repopulate the cache.
  invalidateApiCache();
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

export type ApiErrorKind =
  | 'http'
  | 'offline'
  | 'connection'
  | 'timeout'
  | 'aborted'
  | 'rate_limited'
  | 'invalid_response';

export class ApiError extends Error {
  status: number;
  data: unknown;
  kind: ApiErrorKind;
  retryAfterMs?: number;

  constructor(
    message: string,
    status: number,
    data?: unknown,
    kind: ApiErrorKind = 'http',
    retryAfterMs?: number,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
    this.kind = kind;
    this.retryAfterMs = retryAfterMs;
  }
}

export interface ApiRequestOptions extends RequestInit {
  /** Abort after this long, including the time spent reading the response. */
  timeoutMs?: number;
}

async function withDeadline<T>(
  timeoutMs: number | undefined,
  callerSignal: AbortSignal | null | undefined,
  run: (signal: AbortSignal | null | undefined) => Promise<T>,
): Promise<T> {
  if (!timeoutMs) return run(callerSignal);
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const abort = () => controller.abort();
  if (callerSignal?.aborted) abort();
  else callerSignal?.addEventListener('abort', abort, { once: true });
  try {
    return await run(controller.signal);
  } catch (error) {
    if (timedOut) {
      throw new ApiError('The server took too long to respond. Please try again.', 0, error, 'timeout');
    }
    throw error;
  } finally {
    clearTimeout(timer);
    callerSignal?.removeEventListener('abort', abort);
  }
}

function transportError(error: unknown): ApiError {
  if ((error as { name?: string } | null)?.name === 'AbortError') {
    return new ApiError('The request was cancelled.', 0, error, 'aborted');
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return new ApiError('You appear to be offline. Check your connection and try again.', 0, error, 'offline');
  }
  return new ApiError("We couldn't reach PrintFlow. Check your connection and try again.", 0, error, 'connection');
}

function retryAfterMs(response: Response): number | undefined {
  const seconds = Number(response.headers.get('Retry-After'));
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : undefined;
}

async function readBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) return response.text();
  try {
    return await response.json();
  } catch (error) {
    // A connection dropped mid-body is a transport failure, not a bad payload.
    if ((error as { name?: string } | null)?.name !== 'SyntaxError') throw error;
    if (response.ok) {
      throw new ApiError('The server sent an unreadable response.', response.status, error, 'invalid_response');
    }
    return undefined;
  }
}

function refreshSession(): Promise<RefreshOutcome> {
  if (!refreshPromise) {
    const refreshToken = getRefreshToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (refreshToken) {
      headers['Authorization'] = `Bearer ${refreshToken}`;
    }
    refreshPromise = withDeadline<RefreshOutcome>(SESSION_REFRESH_TIMEOUT_MS, undefined, async (signal) => {
      const response = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ refreshToken }),
        credentials: 'include',
        signal,
      });
      // Only a refused token ends the session. Outages and 429s are temporary.
      if (response.status === 401 || response.status === 403) return 'rejected';
      if (!response.ok) return 'unavailable';
      try {
        const data = await response.json();
        if (data && typeof data === 'object') {
          if (data.token || data.refreshToken) {
            setAuthTokens(data.token, data.refreshToken);
          }
        }
      } catch {}
      return 'refreshed';
    })
      .catch((): RefreshOutcome => 'unavailable')
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

function accessTokenExpiresSoon(): boolean {
  const token = getAccessToken();
  if (!token) return true;
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const { exp } = JSON.parse(atob(payload)) as { exp?: unknown };
    return typeof exp !== 'number' || exp * 1000 - Date.now() < TOKEN_EXPIRY_MARGIN_MS;
  } catch {
    return true;
  }
}

/** Renews an expiring token for connections that cannot replay through apiClient. */
export async function ensureFreshSession(): Promise<RefreshOutcome> {
  return accessTokenExpiresSoon() ? refreshSession() : 'refreshed';
}

export async function apiClient<T>(
  endpoint: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;
  const { timeoutMs, ...requestOptions } = options;
  const method = (requestOptions.method || 'GET').toUpperCase();
  const requestGeneration = cacheGeneration;
  // cache: 'no-store' is for live views that must never reuse a response.
  const usesCache = method === 'GET' && requestOptions.cache !== 'no-store';
  if (usesCache) {
    const cached = responseCache.get(endpoint);
    if (cached && cached.expiresAt > Date.now()) return cached.value as T;
    if (cached) responseCache.delete(endpoint);
    const pending = pendingGets.get(endpoint);
    if (pending) return pending as Promise<T>;
  }

  // Setup default headers
  const headers = new Headers(requestOptions.headers || {});
  if (requestOptions.body != null && !headers.has('Content-Type') && !(requestOptions.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const token = getAccessToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const config: RequestInit = {
    ...requestOptions,
    headers,
    credentials: 'include',
  };

  // Each attempt gets its own deadline, so an auth replay starts fresh.
  const send = (attemptHeaders: Headers) =>
    withDeadline(timeoutMs, requestOptions.signal, async (signal) => {
      const response = await fetch(url, { ...config, headers: attemptHeaders, signal });
      return { response, data: await readBody(response) };
    });

  const request = (async () => {
    try {
      let { response, data } = await send(headers);

      if (response.status === 401 && (!endpoint.startsWith('/auth') || endpoint === '/auth/profile')) {
        const refresh = await refreshSession();
        if (refresh === 'refreshed') {
          const retryHeaders = new Headers(config.headers || {});
          const refreshedToken = getAccessToken();
          if (refreshedToken) {
            retryHeaders.set('Authorization', `Bearer ${refreshedToken}`);
          }
          ({ response, data } = await send(retryHeaders));
        } else if (refresh === 'rejected') {
          clearAuthTokens();
          if (typeof localStorage !== 'undefined') localStorage.removeItem('user_role');
          if (typeof window !== 'undefined' && window.location) window.location.href = '/auth';
        } else {
          throw new ApiError("We couldn't confirm your session right now. Please try again shortly.", 0, undefined, 'connection');
        }
      }

      if (response.status === 429) {
        throw new ApiError('Too many requests right now. Please wait a moment and try again.', 429, data, 'rate_limited', retryAfterMs(response));
      }

      if (!response.ok) {
        throw new ApiError(
          (data as { message?: string } | undefined)?.message || 'An error occurred during the request.',
          response.status,
          data
        );
      }

      if (usesCache) {
        // A response that started before an invalidation may already be stale.
        if (requestGeneration === cacheGeneration) {
          responseCache.set(endpoint, {
            expiresAt: Date.now() + GET_CACHE_TTL_MS,
            value: data,
          });
        }
      } else if (method !== 'GET') {
        invalidateApiCache();
      }
      return data as T;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      // Handle network errors (e.g. server down)
      throw transportError(error);
    }
  })();

  if (usesCache) {
    pendingGets.set(endpoint, request);
    request.finally(() => {
      if (pendingGets.get(endpoint) === request) pendingGets.delete(endpoint);
    }).catch(() => undefined);
  }
  return request;
}
