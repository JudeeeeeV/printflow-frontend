

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { View, ViewOff } from '@carbon/icons-react';
import { EmailInput } from '../EmailInput/EmailInput';
import { SubmitButton } from '../SubmitButton/SubmitButton';
import { authService, type LoginPayload } from '../../../services/authService';

interface LoginFormProps {
  onForgotPassword?: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onForgotPassword }) => {
 const navigate = useNavigate(); // Initialize the router navigation hook

 const [email, setEmail] = useState('');
 const [isEmailValid, setIsEmailValid] = useState(false);

 const [password, setPassword] = useState('');
 const [showPassword, setShowPassword] = useState(false);

 const [isSubmitting, setIsSubmitting] = useState(false);
 const [error, setError] = useState<string | null>(null);

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 setError(null);

 if (!isEmailValid || !password) {
 setError('Please provide a valid email and password.');
 return;
 }

 setIsSubmitting(true);

 try {
 const payload: LoginPayload = {
 email,
 passwordHash: password,
 };

 const response = await authService.login(payload);
 localStorage.setItem('jwt_token', response.token);
 localStorage.setItem('user_role', response.user.roleTag);
 
 if (response.user.roleTag === 'Print Shop') {
 navigate('/shop-dashboard');
 } else {
 navigate('/new-order');
 }

 } catch (err: unknown) {
 if (err instanceof Error) {
 setError(err.message || 'Invalid email or password.');
 } else {
 setError('Login failed. Please try again.');
 }
 } finally {
 setIsSubmitting(false);
 }
 };

 return (
 <form className="flex flex-col w-full" onSubmit={handleSubmit}>
 <div className="mb-5">
 <EmailInput value={email} onChange={(val, valid) => {
 setEmail(val);
 setIsEmailValid(valid);
 }} />
 </div>

 <div className="mb-6">
 <label className={`block text-sm mb-2 ${error ? 'font-bold text-carbon-gray-100' : 'font-semibold text-carbon-gray-100'}`} htmlFor="login-password">Password</label>
 <div className="relative flex items-center">
 <input
 id="login-password"
 type={showPassword ? 'text' : 'password'}
 className={`w-full pl-4 pr-12 py-3 text-base text-carbon-gray-100 bg-white outline-none transition-all duration-200 ease-out ring-inset ${error ? 'ring-4 ring-black font-bold animate-shake' : 'ring-1 ring-gray-300 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-carbon-blue-60'
 }`}
 placeholder="Enter your password"
 value={password}
 onChange={(e) => setPassword(e.target.value)}
 />
 <button
 type="button"
 className="absolute right-3 bg-transparent border-none text-carbon-gray-100 cursor-pointer flex items-center justify-center p-1 transition-transform hover:scale-110 active:scale-95"
 onClick={() => setShowPassword(!showPassword)}
 aria-label={showPassword ? 'Hide password' : 'Show password'}
 >
 {showPassword ? <ViewOff size={20} strokeWidth={2.5} /> : <View size={20} strokeWidth={2.5} />}
 </button>
 </div>
 {onForgotPassword && (
 <div className="mt-2 flex justify-start">
 <button type="button" onClick={onForgotPassword} className="text-sm font-semibold text-carbon-blue-60 hover:text-carbon-blue-70 transition-colors">
 Forgot password?
 </button>
 </div>
 )}
 </div>

 {error && (
 <div className="mb-4 p-4 bg-white ring-4 ring-black text-carbon-gray-100 font-bold text-sm animate-shake">
 {error}
 </div>
 )}

 <div className="mt-2">
 <SubmitButton
 label="Sign In"
 isLoading={isSubmitting}
 disabled={!email || !password || !isEmailValid}
 />
 </div>
 </form>
 );
};
