// src/services/authService.ts
import { supabase } from '../lib/supabaseClient';

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
 token: string;
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
   const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
     email: payload.email,
     password: payload.passwordHash,
   });
   
   if (authError) throw new Error(authError.message);
   
   if (!authData.session) {
     throw new Error('Verify your email before signing in.');
   }
   
   // Fetch user's role from the public.users table
   const { data: userProfile, error: profileError } = await supabase
     .from('users')
     .select('role')
     .eq('id', authData.user.id)
     .single();
     
   if (profileError || !userProfile) {
     // Trigger might still be running or hasn't finished provisioning
     // Or they didn't get their profile created properly
     throw new Error('User profile not found. Please try logging in again in a few seconds.');
   }
   
   const roleTag = userProfile.role === 'CLERK' || userProfile.role === 'MANAGER' ? 'Print Shop' : 'Student';
   
   return {
     token: authData.session.access_token,
     user: {
       id: authData.user.id,
       email: authData.user.email || '',
       roleTag
     }
   };
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
   
   const { data: { user } } = await supabase.auth.getUser();
   if (!user?.email) throw new Error("User not found");
   
   // Verify current password by signing in again
   const { error: signInError } = await supabase.auth.signInWithPassword({
     email: user.email,
     password: currentPassword
   });
   
   if (signInError) throw new Error('Incorrect current password.');
   
   // Update to new password
   const { error: updateError } = await supabase.auth.updateUser({
     password: newPassword
   });
   
   if (updateError) throw new Error('Failed to update password.');
   
   return { success: true, message: 'Password updated successfully.' };
 }
};
