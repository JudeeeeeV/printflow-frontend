// src/services/authService.ts
import { supabase } from '../lib/supabaseClient';
import { apiClient } from './apiClient';

export interface RegisterPayload {
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
}

export const authService = {
 async register(payload: RegisterPayload): Promise<{ requiresEmailVerification: boolean; email: string }> {
   const { error } = await supabase.auth.signUp({
     email: payload.email,
     password: payload.passwordHash,
     options: {
       data: {
         role: payload.role === 'Print Shop' ? 'CLERK' : 'STUDENT',
         shopName: payload.shopName
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
   return apiClient<AuthResponse>('/auth/login', {
     method: 'POST',
     body: JSON.stringify({ email: payload.email, password: payload.passwordHash }),
   });
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
