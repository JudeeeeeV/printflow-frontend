import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { RegistrationForm } from '../../components/auth/RegistrationForm/RegistrationForm';
import { LoginForm } from '../../components/auth/LoginForm/LoginForm';

type AuthView = 'login' | 'register';

export const AuthPage: React.FC = () => {
 const [activeView, setActiveView] = useState<AuthView>('login');
 const navigate = useNavigate();

 useEffect(() => {
 const token = localStorage.getItem('jwt_token');
 const role = localStorage.getItem('user_role');
 if (token) {
 if (role === 'Print Shop') {
 navigate('/shop-dashboard');
 } else {
 navigate('/new-order');
 }
 }
 }, [navigate]);

 return (
 <div className="min-h-screen flex justify-center items-center bg-white relative overflow-hidden font-sans">

 <div className="w-full max-w-[440px] bg-white p-6 sm:p-10 z-10 sm:min-h-0 min-h-screen sm:flex-none flex flex-col justify-center">
 <div className="text-center mb-8 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
 <h1 className="text-4xl font-extrabold text-carbon-gray-100 tracking-tight mb-2">PrintFlow</h1>
 <p className="text-sm text-gray-500 font-medium">Manage your print operations seamlessly.</p>
 </div>

 <div className="flex mb-8 border-b-2 border-[#e0e0e0] animate-fade-in-up relative" style={{ animationDelay: '200ms' }}>
 <button
 className={`flex-1 py-3 bg-transparent border-none text-base font-bold cursor-pointer transition-colors ${
 activeView === 'login' ? 'text-carbon-gray-100' : 'text-gray-400 hover:text-carbon-gray-100'
 }`}
 onClick={() => setActiveView('login')}
 >
 Sign In
 </button>
 <button
 className={`flex-1 py-3 bg-transparent border-none text-base font-bold cursor-pointer transition-colors ${
 activeView === 'register' ? 'text-carbon-gray-100' : 'text-gray-400 hover:text-carbon-gray-100'
 }`}
 onClick={() => setActiveView('register')}
 >
 Create Account
 </button>

 {/* Animated Tab Indicator */}
 <div
 className="absolute -bottom-[2px] w-1/2 h-1 bg-carbon-blue-60 hover:bg-carbon-blue-70 transition-transform duration-300 ease-out"
 style={{ transform: activeView === 'login' ? 'translateX(0%)' : 'translateX(100%)' }}
 />
 </div>

 <div className="animate-fade-in-up overflow-hidden" style={{ animationDelay: '300ms' }}>
 <div key={activeView} className="animate-fade-in-up" style={{ animationDuration: '400ms', animationDelay: '0ms' }}>
 {activeView === 'login' ? (
 <LoginForm />
 ) : (
 <RegistrationForm />
 )}
 </div>
 </div>
 </div>
 </div>
 );
};
