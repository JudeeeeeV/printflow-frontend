// src/services/authService.ts
import { supabase } from '../lib/supabaseClient';
import { apiClient, setAuthTokens } from './apiClient';

export interface RegisterPayload {
 firstName: string;
 lastName: string;
 email: string;
 passwordHash: string; 
 role: 'Student' | 'Print Shop';
 shopName?: string;
}

export interface LoginPayload {
 email: string;
 passwordHash: string;
}

export interface AuthResponse {
 user: {
   id: string;
   email: string;
   roleTag: string;
 };
 token?: string;
 refreshToken?: string;
}

export const authService = {
 getProfile(): Promise<{ firstName: string; lastName: string }> {
   return apiClient('/auth/profile');
 },

 updateProfile(firstName: string, lastName: string): Promise<{ firstName: string; lastName: string }> {
   return apiClient('/auth/profile', {
     method: 'PATCH', body: JSON.stringify({ firstName, lastName }),
   });
 },
 async register(payload: RegisterPayload): Promise<{ requiresEmailVerification: boolean; email: string }> {
   const firstName = payload.firstName.trim().replace(/\s+/g, ' ');
   const lastName = payload.lastName.trim().replace(/\s+/g, ' ');
   if (!firstName || !lastName || firstName.length > 100 || lastName.length > 100) {
     throw new Error('Please enter your first and last name (up to 100 characters each).');
   }
   const { error } = await supabase.auth.signUp({
     email: payload.email,
     password: payload.passwordHash,
     options: {
       data: {
         first_name: firstName,
         last_name: lastName,
         role: payload.role === 'Print Shop' ? 'CLERK' : 'STUDENT',
         shop_name: payload.shopName
       }
     }
   });
   
   if (error) throw new Error(error.message);
   return { requiresEmailVerification: true, email: payload.email };
 },

 async verifyEmail(payload: RegisterPayload, code: string): Promise<{ verified: boolean }> {
   const { error } = await supabase.auth.verifyOtp({
     email: payload.email,
     token: code,
     type: 'signup'
   });
   
   if (error) throw new Error(error.message);
   return { verified: true };
 },

 async resendCode(email: string): Promise<{ message: string }> {
   const { error } = await supabase.auth.resend({
     type: 'signup',
     email,
   });
   
   if (error) throw new Error(error.message);
   return { message: 'A new verification code has been sent.' };
 },

 async login(payload: LoginPayload): Promise<AuthResponse> {
   const response = await apiClient<AuthResponse>('/auth/login', {
     method: 'POST',
     body: JSON.stringify({ email: payload.email, password: payload.passwordHash }),
   });
   if (response.token || response.refreshToken) {
     setAuthTokens(response.token, response.refreshToken);
   }
   return response;
 },

 async sendPasswordReset(email: string): Promise<{ message: string }> {
   const { error } = await supabase.auth.resetPasswordForEmail(email);
   // Don't throw if it fails, just return success so we don't leak existing emails
   if (error) console.error("Password reset failed", error);
   return { message: 'If an account exists, a reset code has been sent.' };
 },

 async resetPassword(payload: { email: string; code: string; passwordHash: string }): Promise<{ success: boolean }> {
   // 1. First verify the OTP to log them in
   const { error } = await supabase.auth.verifyOtp({
     email: payload.email,
     token: payload.code,
     type: 'recovery'
   });
   
   if (error) throw new Error(error.message);
   
   // 2. Update their password
   const { error: updateError } = await supabase.auth.updateUser({
     password: payload.passwordHash
   });
   
   if (updateError) throw new Error(updateError.message);
   
   // 3. Sign them out so they have to sign back in
   await supabase.auth.signOut();
   
   return { success: true };
 },

 async changePassword(currentPassword: string, newPassword: string): Promise<{ success: boolean, message: string }> {
   if (currentPassword === newPassword) {
     throw new Error('Your new password cannot be the same as your old password.');
   }
   
   return apiClient('/auth/change-password', {
     method: 'POST',
     body: JSON.stringify({ currentPassword, newPassword }),
   });
 }
};
