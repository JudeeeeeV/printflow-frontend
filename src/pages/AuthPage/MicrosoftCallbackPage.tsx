import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { apiClient, setAuthTokens } from '../../services/apiClient';

const messages: Record<string, string> = {
  not_configured: 'Microsoft sign-in is not configured yet. Please use email and password for now.',
  expired: 'Your Microsoft sign-in expired or was opened in another browser. Please try again.',
  cit_only: 'Please use your verified @cit.edu Microsoft account. If you already did, contact PrintFlow support to check the school login configuration.',
  cancelled: 'Microsoft sign-in was cancelled. You can try again when you are ready.',
  failed: 'Microsoft sign-in could not be completed. Please try again.',
};

export function MicrosoftCallbackPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const providerError = params.get('error');
  const [sessionError, setSessionError] = useState<string | null>(null);
  const error = providerError ? messages[providerError] || messages.failed : sessionError;

  useEffect(() => {
    localStorage.removeItem('user_role');
    if (providerError) return;
    let active = true;
    apiClient<{ user: { role: string }; token?: string }>('/auth/me')
      .then(({ user, token }) => {
        if (!active) return;
        if (token) setAuthTokens(token);
        if (!['STUDENT', 'CLERK', 'MANAGER'].includes(user.role)) {
          throw new Error('Unsupported account role');
        }
        const shop = user.role === 'CLERK' || user.role === 'MANAGER';
        localStorage.setItem('user_role', shop ? 'Print Shop' : 'Student');
        navigate(shop ? '/shop-dashboard' : '/new-order', { replace: true });
      })
      .catch(() => {
        if (active) setSessionError('We could not open your session. Please allow cookies for PrintFlow and try signing in again.');
      });
    return () => { active = false; };
  }, [navigate, providerError]);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-carbon-gray-10 px-4 py-10 text-carbon-gray-100">
      <div className="w-full max-w-md border border-gray-200 border-t-4 border-t-carbon-blue-60 bg-white p-8 shadow-lg">
        <h1 className="text-2xl font-bold">Microsoft sign-in</h1>
        <p className="mt-4 text-sm leading-relaxed" role={error ? 'alert' : 'status'}>
          {error || 'Signing you in to PrintFlow…'}
        </p>
        <Link className="mt-6 inline-flex min-h-11 items-center font-semibold text-carbon-blue-60 underline" to="/auth" replace>
          Back to sign in
        </Link>
      </div>
    </main>
  );
}
