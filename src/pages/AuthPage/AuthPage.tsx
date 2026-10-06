import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { RegistrationForm } from '../../components/auth/RegistrationForm/RegistrationForm';
import { LoginForm } from '../../components/auth/LoginForm/LoginForm';
import { ForgotPasswordForm } from '../../components/auth/ForgotPasswordForm/ForgotPasswordForm';
import printflowLogo from '../../assets/printflow-logo-dark.png';
import styles from './AuthPage.module.css';

type AuthView = 'login' | 'register' | 'forgot-password';

export const AuthPage: React.FC = () => {
    const [activeView, setActiveView] = useState<AuthView>('login');
    const navigate = useNavigate();

    useEffect(() => {
        const role = localStorage.getItem('user_role');
        if (role) {
            if (role === 'Print Shop') {
                navigate('/shop-dashboard');
            } else {
                navigate('/new-order');
            }
        }
    }, [navigate]);

    return (
        <div className={`bg-carbon-gray-10 font-sans text-carbon-gray-100 lg:grid lg:grid-cols-[minmax(340px,0.9fr)_minmax(520px,1.1fr)] ${activeView === 'register'
            ? `${styles.registrationPage} fixed inset-0 grid h-dvh grid-rows-[auto_minmax(0,1fr)] overflow-hidden lg:grid-rows-[minmax(0,1fr)]`
            : activeView === 'login'
                ? `${styles.loginPage} fixed inset-0 grid h-dvh grid-rows-[auto_minmax(0,1fr)] overflow-hidden lg:grid-rows-[minmax(0,1fr)]`
                : 'relative min-h-screen overflow-x-clip lg:h-screen lg:overflow-hidden'}`}>
            <aside className={styles.brandPanel}>
                <div className="flex items-center justify-between gap-4">
                    <img src={printflowLogo} alt="PrintFlow Logo" className="h-9 pl-3" />
                    <span className="text-xs tracking-[0.16em] text-gray-400">FROM PIXEL TO PAPER</span>
                </div>

                <div className={styles.specimen} aria-hidden="true">
                    <svg className={styles.registrationMarks} viewBox="0 0 440 420" fill="none">
                        <path d="M70 30H370M70 390H370" stroke="currentColor" strokeDasharray="2 7" />
                    </svg>
                    <div className={styles.backSheet} />
                    <div className={styles.frontSheet}>
                        <div className="flex items-center justify-between border-b border-carbon-gray-100/20 pb-3 text-xs font-medium uppercase tracking-[0.12em]">
                            <span>PrintFlow Studio</span><span>01 / A4</span>
                        </div>
                        <div className={styles.printGraphic}>
                            <svg viewBox="0 0 240 210" className="h-full w-full" fill="none">
                                <path d="M-20 186C20 186 20 24 100 24S160 186 260 186M-20 162C20 162 20 0 100 0S160 162 260 162M-20 138C20 138 20-24 100-24S160 138 260 138M-20 114C20 114 20-48 100-48S160 114 260 114M-20 210C20 210 20 48 100 48S160 210 260 210M-20 234C20 234 20 72 100 72S160 234 260 234"
                                    stroke="currentColor" strokeWidth="11" />
                            </svg>
                            <span className={styles.printWord}>Make<br />an<br />impression.</span>
                        </div>
                        <div className="flex items-end justify-between gap-3 pt-3">
                            <span className="text-xs leading-relaxed">Your next idea.<br />In good print.</span>
                            <div className="flex gap-1">
                                <span className="h-4 w-4 bg-carbon-gray-100" />
                                <span className="h-4 w-4 bg-carbon-blue-60" />
                                <span className="h-4 w-4 border border-carbon-gray-100/20" />
                            </div>
                        </div>
                    </div>
                </div>

                <div className={`${styles.brandCopy} hidden lg:block`}>
                    <h2 className={styles.headline}>Good ideas.<br /><span className="text-gray-400">Great prints.</span></h2>
                    <p className="mt-4 max-w-sm text-base leading-relaxed text-gray-300">
                        The late-night thesis. The first portfolio.<br className="hidden xl:block" /> Whatever you make, bring it to paper.
                    </p>
                </div>
            </aside>

            <main className={`${styles.authMain} relative flex min-w-0 items-start justify-center bg-[#F4F4F4] px-4 sm:px-8 lg:px-12 xl:px-16 ${activeView !== 'forgot-password' ? 'py-3 sm:py-4 min-h-0 overflow-hidden' : 'py-6 sm:py-10 lg:py-10 min-h-[calc(100vh-13rem)] lg:h-screen lg:min-h-0 lg:overflow-y-auto'}`}>
                <div className={`relative z-10 min-w-0 w-full max-w-[500px] ${activeView !== 'forgot-password' ? 'my-auto grid h-[36rem] max-h-full min-h-0 grid-rows-[minmax(0,1fr)]' : ''}`}>
                    <div className={`border border-gray-200 border-t-4 border-t-carbon-blue-60 bg-white shadow-[0_16px_40px_rgba(22,22,22,0.10)] ${activeView !== 'forgot-password' ? 'min-h-0 overflow-hidden' : ''}`}>
                        <div
                            className={`${styles.authCardContent} px-5 sm:px-8 ${activeView !== 'forgot-password' ? 'py-4 sm:py-5 h-full min-h-0 overflow-y-auto overscroll-contain' : 'py-7 sm:py-9 lg:px-10 lg:py-10'}`}
                            tabIndex={activeView !== 'forgot-password' ? 0 : undefined}
                            role={activeView !== 'forgot-password' ? 'region' : undefined}
                            aria-label={activeView === 'register' ? 'Account registration' : activeView === 'login' ? 'Account sign in' : undefined}
                        >
                            {activeView !== 'forgot-password' && (
                                <div className="mb-3 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
                                    <h2 className="mt-1 text-2xl font-black tracking-tight text-carbon-gray-100">
                                        {activeView === 'login' ? 'Welcome back' : 'Create your account'}
                                    </h2>
                                    <p className="mt-1 text-sm leading-5 text-gray-500">
                                        {activeView === 'login' ? 'Sign in to continue managing your print orders.' : 'Set up your workspace in a few secure steps.'}
                                    </p>
                                </div>
                            )}

                            {activeView !== 'forgot-password' && (
                                <div className="relative mb-3 flex border border-gray-200 bg-carbon-gray-10 p-1 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
                                    <button
                                        type="button"
                                        aria-pressed={activeView === 'login'}
                                        className={`relative z-10 min-h-11 flex-1 px-3 text-sm font-bold transition-colors duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-carbon-gray-100 ${activeView === 'login' ? 'text-white' : 'text-gray-500 hover:text-carbon-gray-100'}`}
                                        onClick={() => setActiveView('login')}
                                    >
                                        Sign In
                                    </button>
                                    <button
                                        type="button"
                                        aria-pressed={activeView === 'register'}
                                        className={`relative z-10 min-h-11 flex-1 px-3 text-sm font-bold transition-colors duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-carbon-gray-100 ${activeView === 'register' ? 'text-white' : 'text-gray-500 hover:text-carbon-gray-100'}`}
                                        onClick={() => setActiveView('register')}
                                    >
                                        Create Account
                                    </button>

                                    <div
                                        aria-hidden="true"
                                        className="pointer-events-none absolute bottom-1 left-1 top-1 w-[calc(50%-0.25rem)] bg-carbon-blue-60 transition-transform duration-300 ease-out"
                                        style={{ transform: activeView === 'login' ? 'translateX(0%)' : 'translateX(100%)' }}
                                    />
                                </div>
                            )}

                            <div className="animate-fade-in-up" style={{ animationDelay: '300ms' }}>
                                <div key={activeView} className="animate-fade-in-up" style={{ animationDuration: '400ms', animationDelay: '0ms' }}>
                                    {activeView === 'login' ? (
                                        <LoginForm onForgotPassword={() => setActiveView('forgot-password')} />
                                    ) : activeView === 'forgot-password' ? (
                                        <ForgotPasswordForm onBackToLogin={() => setActiveView('login')} />
                                    ) : (
                                        <RegistrationForm onSignIn={() => setActiveView('login')} />
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};
