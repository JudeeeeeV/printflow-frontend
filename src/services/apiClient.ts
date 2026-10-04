// src/services/apiClient.ts

/**
 * Base API client configuration for connecting to the local NestJS backend.
 */
import { API_URL as BASE_URL } from '../config/runtime';

let refreshPromise: Promise<boolean> | null = null;

function refreshSession(): Promise<boolean> {
 if (!refreshPromise) {
 refreshPromise = fetch(`${BASE_URL}/auth/refresh`, {
 method: 'POST',
 credentials: 'include',
 })
 .then(response => response.ok)
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
 
 // Setup default headers
 const headers = new Headers(options.headers || {});
 if (options.body != null && !headers.has('Content-Type') && !(options.body instanceof FormData)) {
 headers.set('Content-Type', 'application/json');
 }

 const config: RequestInit = {
 ...options,
 headers,
 credentials: 'include',
 };

 try {
 let response = await fetch(url, config);

 if (response.status === 401 && (!endpoint.startsWith('/auth') || endpoint === '/auth/profile')) {
 if (await refreshSession()) {
 response = await fetch(url, config);
 } else {
 localStorage.removeItem('user_role');
 window.location.href = '/auth';
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

 return data as T;
 } catch (error) {
 if (error instanceof ApiError) {
 throw error;
 }
 // Handle network errors (e.g. server down)
 throw new ApiError('Network error. Is the backend running?', 0, error);
 }
}
