import React from 'react';
import { useNavigate } from 'react-router-dom';

export const UnauthorizedPage: React.FC = () => {
 const navigate = useNavigate();

 return (
 <div className="min-h-screen bg-carbon-gray-10 flex items-center justify-center font-sans px-4">
 <div className="max-w-md w-full bg-white p-8 border border-[#e0e0e0] text-center ">
 <div className="text-carbon-gray-100 mb-6">
 <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
 </svg>
 </div>
 <h1 className="text-2xl font-black text-carbon-gray-100 mb-4">Access Denied</h1>
 <p className="text-gray-600 mb-8 font-medium">
 You do not have the required permissions to view this page. Please return to the dashboard.
 </p>
 <button
 onClick={() => {
 const role = localStorage.getItem('user_role');
 if (role === 'Print Shop') {
 navigate('/shop-dashboard');
 } else if (role === 'Student') {
 navigate('/new-order');
 } else {
 localStorage.removeItem('user_role');
 navigate('/auth');
 }
 }}
 className="w-full py-3 bg-carbon-blue-60 hover:bg-carbon-blue-70 text-white font-bold transition-colors"
 >
 Return to Dashboard
 </button>
 </div>
 </div>
 );
};
