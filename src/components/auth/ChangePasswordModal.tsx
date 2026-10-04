import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { View, ViewOff, Close, Checkmark } from '@carbon/icons-react';
import { SubmitButton } from './SubmitButton/SubmitButton';
import { authService } from '../../services/authService';
import { ProfileNameForm } from './ProfileNameForm';
import { AccountSettingsSkeleton } from './AccountSettingsSkeleton';

interface ChangePasswordModalProps {
  onClose: () => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ onClose }) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const controls = () => Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled])') || []).filter(control => control.getClientRects().length > 0);
    controls()[0]?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onCloseRef.current(); }
      if (event.key !== 'Tab') return;
      const items = controls();
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialogRef.current?.contains(document.activeElement))) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialogRef.current?.contains(document.activeElement))) {
        event.preventDefault(); first?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
      if (previousFocus?.isConnected && !previousFocus.closest('[inert]')) previousFocus.focus();
    };
  }, []);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [profileReady, setProfileReady] = useState(false);
  const handleProfileReady = useCallback(() => setProfileReady(true), []);
  const settingsLoading = !profileReady;

  const hasLength = newPassword.length >= 8;
  const hasUpper = /[A-Z]/.test(newPassword);
  const hasLower = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const hasSymbol = /[^A-Za-z0-9\s]/.test(newPassword);
  
  const isPasswordStrong = hasLength && hasUpper && hasLower && hasNumber && hasSymbol;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!currentPassword) {
      setError('Current password is required.');
      return;
    }

    if (!isPasswordStrong) {
      setError('Please meet all the new password requirements.');
      return;
    }

    setIsSubmitting(true);
    try {
      await authService.changePassword(currentPassword, newPassword);
      setSuccess(true);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || 'Failed to change password.');
      } else {
        setError('An unexpected error occurred.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        ref={dialogRef}
        className="relative flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden bg-white shadow-xl animate-fade-in-up"
        style={{ animationDuration: '300ms' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="change-password-title"
      >
        
        <div className="flex shrink-0 items-center justify-between border-b border-[#e0e0e0] bg-white px-6 py-4">
          <h3 id="change-password-title" className="text-xl font-bold text-carbon-gray-100">Account Settings</h3>
          <button type="button" aria-label="Close account settings" onClick={onClose} className="flex h-11 w-11 shrink-0 items-center justify-center text-gray-400 transition-colors hover:text-carbon-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-carbon-blue-60">
            <Close className="w-6 h-6" />
          </button>
        </div>
        {success ? (
          <div className="flex min-h-0 flex-col overflow-y-auto px-6 py-12 text-center">
            <svg className="w-14 h-14 mx-auto mb-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h2 className="text-2xl font-bold text-carbon-gray-100 mb-2">Password changed!</h2>
            <p className="text-sm text-gray-600 mb-8">
              Your password has been successfully updated.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-4 bg-carbon-gray-100 hover:bg-black text-white font-bold transition-all active:scale-95"
            >
              Done
            </button>
          </div>
        ) : (
            <div aria-busy={settingsLoading} className="min-h-0 flex-1 overflow-y-auto p-6">
            {settingsLoading && <AccountSettingsSkeleton />}
            <div hidden={settingsLoading}>
            <ProfileNameForm onReady={handleProfileReady} />
            <h4 className="mb-4 font-bold text-carbon-gray-100">Change password</h4>
            <form onSubmit={handleSubmit} className="flex flex-col w-full">
              
              <div className="mb-5">
                <label className="block text-sm mb-2 font-semibold text-carbon-gray-100" htmlFor="current-password">Current Password</label>
                <div className="relative flex items-center">
                  <input
                    id="current-password"
                    type={showCurrent ? 'text' : 'password'}
                    className="w-full pl-4 pr-12 py-3 text-base text-carbon-gray-100 bg-white border border-[#8d8d8d] outline-hidden transition-all duration-200 ease-out focus:outline-2 focus:-outline-offset-2 focus:outline-carbon-blue-60"
                    placeholder="Enter current password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="absolute right-3 bg-transparent border-none text-carbon-gray-100 cursor-pointer flex items-center justify-center p-1 transition-transform hover:scale-110 active:scale-95"
                    onClick={() => setShowCurrent(!showCurrent)}
                  >
                    {showCurrent ? <ViewOff size={20} strokeWidth={2.5} /> : <View size={20} strokeWidth={2.5} />}
                  </button>
                </div>
              </div>

              <div className="mb-5">
                <label className="block text-sm mb-2 font-semibold text-carbon-gray-100" htmlFor="new-password">New Password</label>
                <div className="relative flex items-center">
                  <input
                    id="new-password"
                    type={showNew ? 'text' : 'password'}
                    className="w-full pl-4 pr-12 py-3 text-base text-carbon-gray-100 bg-white border border-[#8d8d8d] outline-hidden transition-all duration-200 ease-out focus:outline-2 focus:-outline-offset-2 focus:outline-carbon-blue-60"
                    placeholder="Create a new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="absolute right-3 bg-transparent border-none text-carbon-gray-100 cursor-pointer flex items-center justify-center p-1 transition-transform hover:scale-110 active:scale-95"
                    onClick={() => setShowNew(!showNew)}
                  >
                    {showNew ? <ViewOff size={20} strokeWidth={2.5} /> : <View size={20} strokeWidth={2.5} />}
                  </button>
                </div>
                
                {/* Password Strength Checker */}
                <div className="mt-3 bg-gray-50 p-3 text-sm space-y-1.5 border border-gray-100">
                  <p className="font-semibold text-gray-700 mb-2 text-xs uppercase tracking-wider">Password Requirements:</p>
                  <div className={`flex items-center space-x-2 ${hasLength ? 'text-green-600 font-medium' : 'text-gray-500'}`}>
                     <Checkmark size={16} className={hasLength ? 'opacity-100' : 'opacity-30'} />
                     <span>At least 8 characters long</span>
                  </div>
                  <div className={`flex items-center space-x-2 ${hasUpper ? 'text-green-600 font-medium' : 'text-gray-500'}`}>
                     <Checkmark size={16} className={hasUpper ? 'opacity-100' : 'opacity-30'} />
                     <span>Contains an uppercase letter</span>
                  </div>
                  <div className={`flex items-center space-x-2 ${hasLower ? 'text-green-600 font-medium' : 'text-gray-500'}`}>
                     <Checkmark size={16} className={hasLower ? 'opacity-100' : 'opacity-30'} />
                     <span>Contains a lowercase letter</span>
                  </div>
                  <div className={`flex items-center space-x-2 ${hasNumber ? 'text-green-600 font-medium' : 'text-gray-500'}`}>
                     <Checkmark size={16} className={hasNumber ? 'opacity-100' : 'opacity-30'} />
                     <span>Contains a number</span>
                  </div>
                  <div className={`flex items-center space-x-2 ${hasSymbol ? 'text-green-600 font-medium' : 'text-gray-500'}`}>
                     <Checkmark size={16} className={hasSymbol ? 'opacity-100' : 'opacity-30'} />
                     <span>Contains a special character</span>
                  </div>
                </div>
              </div>

              {error && (
                <div className="mb-4 p-4 bg-white ring-4 ring-black text-carbon-gray-100 font-bold text-sm animate-shake">
                  {error}
                </div>
              )}

              <div className="mt-4 flex flex-col gap-3">
                <SubmitButton
                  label="Change Password"
                  isLoading={isSubmitting}
                  disabled={!currentPassword || !isPasswordStrong}
                />
              </div>
            </form>
            </div>
            </div>
        )}
      </div>
    </div>,
    document.body
  );
};
