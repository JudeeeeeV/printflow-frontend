// src/components/auth/RegistrationForm/RegistrationForm.tsx
import React, { useState } from 'react';
import { View, ViewOff } from '@carbon/icons-react';
import { EmailInput } from '../EmailInput/EmailInput';
import { AccountTypeSelector, type AccountRole } from '../AccountTypeSelector/AccountTypeSelector';
import { SubmitButton } from '../SubmitButton/SubmitButton';
import { authService, type RegisterPayload } from '../../../services/authService';

export const RegistrationForm: React.FC = () => {
 const [email, setEmail] = useState('');
 const [isEmailValid, setIsEmailValid] = useState(false);

 const [password, setPassword] = useState('');
 const [showPassword, setShowPassword] = useState(false);

 const [accountType, setAccountType] = useState<AccountRole>('Student');
 const [shopName, setShopName] = useState('');

 const [isSubmitting, setIsSubmitting] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const [success, setSuccess] = useState<string | null>(null);

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 setError(null);
 setSuccess(null);

 if (!isEmailValid) {
 setError('Please provide a valid email address.');
 return;
 }

 if (password.length < 8) {
 setError('Password must be at least 8 characters long.');
 return;
 }

 if (accountType === 'Print Shop') {
 if (!shopName) {
 setError('Shop name is required for Print Shops.');
 return;
 }
 }

 setIsSubmitting(true);

 try {
 const payload: RegisterPayload = {
 email,
 passwordHash: password, // The backend handles bcrypt hashing
 role: accountType,
 shopName: accountType === 'Print Shop' ? shopName : undefined,
 };

 await authService.register(payload);

 setSuccess('Account created successfully! You can now log in.');

 // Optional: Store token and redirect
 // localStorage.setItem('jwt_token', response.token);
 // window.location.href = '/dashboard';

 } catch (err: unknown) {
 if (err instanceof Error) {
 setError(err.message || 'Registration failed. Please try again.');
 } else {
 setError('Registration failed. Please try again.');
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

 <div className="mb-5">
 <label className={`block text-sm mb-2 ${error && password.length < 8 ? 'font-bold text-carbon-gray-100' : 'font-semibold text-carbon-gray-100'}`} htmlFor="password">Password</label>
 <div className="relative flex items-center">
 <input
 id="password"
 type={showPassword ? 'text' : 'password'}
 className={`w-full pl-4 pr-12 py-3 text-base text-carbon-gray-100 bg-white outline-none transition-all duration-200 ease-out ring-inset ${
 error && password.length < 8 ? 'ring-4 ring-black font-bold animate-shake' : 'ring-1 ring-gray-300 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-carbon-blue-60'
 }`}
 placeholder="Strong Password"
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
 </div>

 <AccountTypeSelector
 selectedType={accountType}
 onChange={setAccountType}
 />

 {accountType === 'Print Shop' && (
 <div className="mb-5 border border-[#e0e0e0] p-4 bg-carbon-gray-10 mt-4">
 <h3 className="font-bold mb-4">Print Shop Details</h3>
 <div className="mb-4">
 <label className="block text-sm mb-2 font-semibold text-carbon-gray-100" htmlFor="shopName">Shop Name</label>
 <input
 id="shopName"
 type="text"
 className="w-full pl-4 pr-4 py-3 text-base text-carbon-gray-100 bg-white outline-none transition-all duration-200 ease-out ring-1 ring-gray-300 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-carbon-blue-60"
 placeholder="e.g. TLBH Print Co."
 value={shopName}
 onChange={(e) => setShopName(e.target.value)}
 />
 </div>
 </div>
 )}

 {error && (
 <div className="mb-4 p-4 bg-white ring-4 ring-black text-carbon-gray-100 font-bold text-sm animate-shake">
 {error}
 </div>
 )}

 {success && (
 <div className="mb-4 p-4 bg-carbon-blue-60 hover:bg-carbon-blue-70 text-white font-bold text-sm">
 {success}
 </div>
 )}



 <div className="mt-2">
 <SubmitButton
 label="Register Account"
 isLoading={isSubmitting}
 disabled={!email || !password || !isEmailValid}
 />
 </div>
 </form>
 );
};
