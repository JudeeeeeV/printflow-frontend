// src/services/authService.ts
import { apiClient } from './apiClient';

export interface RegisterPayload {
 email: string;
 passwordHash: string; // The SDD implies password handled cleanly; we'll send it securely
 role: 'Student' | 'Print Shop';
 shopName?: string;
}

export interface LoginPayload {
 email: string;
 passwordHash: string;
}

export interface AuthResponse {
 token: string;
 user: {
 id: string;
 email: string;
 roleTag: string;
 };
}

export const authService = {
 /**
 * Registers a new user via the NestJS /auth/register endpoint.
 * Based on the SDD Sequence Diagram for User Registration.
 */
 async register(payload: RegisterPayload): Promise<AuthResponse> {
 // Note: the SDD mentions password is sent in the payload.
 // Ensure the backend uses HTTPS in production.
 return apiClient<AuthResponse>('/auth/register', {
 method: 'POST',
 body: JSON.stringify({
 email: payload.email,
 password: payload.passwordHash,
 accountType: payload.role,
 shopName: payload.shopName,
 }),
 });
 },

 /**
 * Authenticates an existing user via the NestJS /auth/login endpoint.
 */
 async login(payload: LoginPayload): Promise<AuthResponse> {
 return apiClient<AuthResponse>('/auth/login', {
 method: 'POST',
 body: JSON.stringify({
 email: payload.email,
 password: payload.passwordHash,
 }),
 });
 }
};
