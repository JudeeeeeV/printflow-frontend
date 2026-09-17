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
                        <path d="M28 60H52M40 48V72M388 60H412M400 48V72M28 360H52M40 348V372M388 360H412M400 348V372"
                            stroke="currentColor" strokeWidth="1" />
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
                            <span className={styles.printWord}>Make<br />an impression.</span>
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

            <main className={`${styles.authMain} relative flex min-w-0 items-start justify-center px-4 py-6 sm:px-8 sm:py-10 lg:px-12 lg:py-10 xl:px-16 ${activeView === 'register'
                ? 'min-h-0 overflow-hidden'
                : activeView === 'login'
                    ? 'min-h-0 overflow-y-auto'
                    : 'min-h-[calc(100vh-13rem)] lg:h-screen lg:min-h-0 lg:overflow-y-auto'} ${activeView === 'login' ? 'lg:items-center' : ''}`}>
                <div aria-hidden="true" className="pointer-events-none absolute right-0 top-0 hidden h-24 w-24 border-b border-l border-gray-300 lg:block" />

                <div className={`relative z-10 min-w-0 w-full ${activeView === 'register' ? 'grid h-full min-h-0 max-w-[560px] grid-rows-[minmax(0,1fr)_auto]' : 'max-w-[500px]'}`}>
                    <div className={`border border-gray-200 border-t-4 border-t-carbon-blue-60 bg-white shadow-[0_16px_40px_rgba(22,22,22,0.10)] ${activeView === 'register' ? 'min-h-0 overflow-hidden' : ''}`}>
                        <div
                            className={`${styles.authCardContent} px-5 py-7 sm:px-8 sm:py-9 lg:px-10 lg:py-10 ${activeView === 'register' ? 'h-full min-h-0 overflow-y-auto overscroll-contain' : ''}`}
                            tabIndex={activeView === 'register' ? 0 : undefined}
                            role={activeView === 'register' ? 'region' : undefined}
                            aria-label={activeView === 'register' ? 'Account registration' : undefined}
                        >
                            {activeView !== 'forgot-password' && (
                                <div className="mb-7 animate-fade-in-up pl-4" style={{ animationDelay: '100ms' }}>
                                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-carbon-blue-60">Account access</p>
                                    <h2 className="mt-1 text-3xl font-black tracking-tight text-carbon-gray-100">
                                        {activeView === 'login' ? 'Welcome back' : 'Create your account'}
                                    </h2>
                                    <p className="mt-2 text-sm leading-relaxed text-gray-500">
                                        {activeView === 'login' ? 'Sign in to continue managing your print orders.' : 'Set up your workspace in a few secure steps.'}
                                    </p>
                                </div>
                            )}

                            {activeView !== 'forgot-password' && (
                                <div className="relative mb-8 flex border border-gray-200 bg-carbon-gray-10 p-1 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
                                    <button
                                        type="button"
                                        aria-pressed={activeView === 'login'}
                                        className={`relative z-10 min-h-12 flex-1 px-3 text-sm font-bold transition-colors duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-carbon-gray-100 sm:text-base ${activeView === 'login' ? 'text-white' : 'text-gray-500 hover:text-carbon-gray-100'}`}
                                        onClick={() => setActiveView('login')}
                                    >
                                        Sign In
                                    </button>
                                    <button
                                        type="button"
                                        aria-pressed={activeView === 'register'}
                                        className={`relative z-10 min-h-12 flex-1 px-3 text-sm font-bold transition-colors duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-carbon-gray-100 sm:text-base ${activeView === 'register' ? 'text-white' : 'text-gray-500 hover:text-carbon-gray-100'}`}
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

                    <p className="mt-5 shrink-0 text-center text-xs font-medium text-gray-500">
                        Secure access for PrintFlow students and print partners.
                    </p>
                </div>
            </main>
        </div>
    );
};
