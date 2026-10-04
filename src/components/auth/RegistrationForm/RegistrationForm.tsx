// src/components/auth/RegistrationForm/RegistrationForm.tsx
import {
  getRetrySeconds,
  useRetryCountdown,
} from "../../../hooks/useRetryCountdown";
import { EmailVerification } from "./EmailVerification";
import React, { useState } from "react";
import { View, ViewOff } from "@carbon/icons-react";
import { AuthErrorMessage } from "../AuthErrorMessage/AuthErrorMessage";
import { EmailInput } from "../EmailInput/EmailInput";
import {
  AccountTypeSelector,
  type AccountRole,
} from "../AccountTypeSelector/AccountTypeSelector";
import { SubmitButton } from "../SubmitButton/SubmitButton";
import {
  authService,
  type RegisterPayload,
} from "../../../services/authService";

export const RegistrationForm: React.FC<{ onSignIn: () => void }> = ({
  onSignIn,
}) => {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [isEmailValid, setIsEmailValid] = useState(false);

  const [pendingRegistration, setPendingRegistration] =
    useState<RegisterPayload | null>(null);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [password, setPassword] = useState("");
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [confirmTouched, setConfirmTouched] = useState(false);
  const passwordValid =
    password.length >= 8 &&
    password.length <= 128 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9\s]/.test(password);
  // Show progress before every registration requirement is met.
  // Strength is an estimate based on length and character variety;
  // passwordValid separately controls whether registration is allowed.
  const characterTypes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9\s]/].filter(
    (pattern) => pattern.test(password),
  ).length;
  const strength =
    passwordValid && password.length >= 12
      ? 3
      : password.length >= 8 && characterTypes >= 2
        ? 2
        : 1;
  const strengthLabel = ["Weak", "Medium", "Strong"][strength - 1];
  const strengthColor = ["bg-red-500", "bg-amber-500", "bg-green-600"][
    strength - 1
  ];
  const passwordError =
    passwordTouched && !passwordValid
      ? "Use 8 or more characters with uppercase, lowercase, a number and a symbol."
      : null;
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [accountType, setAccountType] = useState<AccountRole>("Student");
  const [shopName, setShopName] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const retry = useRetryCountdown();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPasswordTouched(true);
    setConfirmTouched(true);
    if (isSubmitting || retry.seconds > 0) return;

    if (!isEmailValid) {
      setError("Please provide a valid email address.");
      return;
    }

    if (!passwordValid) {
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (accountType === "Print Shop") {
      if (!shopName.trim()) {
        setError("Shop name is required for Print Shops.");
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const payload: RegisterPayload = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        passwordHash: password,
        role: accountType,
        shopName: accountType === "Print Shop" ? shopName : undefined,
      };

      const result = await authService.register(payload);

      setPassword("");
      setConfirmPassword("");
      setPendingRegistration({ ...payload, email: result.email });
    } catch (err: unknown) {
      const wait = getRetrySeconds(err);
      if (wait !== null) {
        retry.start(wait);
      } else if (err instanceof Error) {
        setError(err.message || "Registration failed. Please try again.");
      } else {
        setError("Registration failed. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (pendingRegistration)
    return (
      <EmailVerification
        registration={pendingRegistration}
        onVerified={() =>
          setPendingRegistration((current) =>
            current ? { ...current, passwordHash: "" } : null,
          )
        }
        onBack={() => {
          setPendingRegistration(null);
          setPasswordTouched(false);
          setConfirmTouched(false);
        }}
        onSignIn={onSignIn}
      />
    );

  return (
    <form className="flex flex-col w-full" onSubmit={handleSubmit}>
      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="first-name"
            className="block text-sm mb-2 font-semibold text-carbon-gray-100"
          >
            First name
          </label>
          <input
            id="first-name"
            type="text"
            autoComplete="given-name"
            required
            maxLength={100}
            placeholder="First Name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="w-full px-4 py-3 text-base text-carbon-gray-100 bg-white outline-none ring-1 ring-inset ring-gray-300 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-carbon-blue-60"
          />
        </div>
        <div>
          <label
            htmlFor="last-name"
            className="block text-sm mb-2 font-semibold text-carbon-gray-100"
          >
            Last name
          </label>
          <input
            id="last-name"
            type="text"
            autoComplete="family-name"
            required
            maxLength={100}
            placeholder="Last Name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="w-full px-4 py-3 text-base text-carbon-gray-100 bg-white outline-none ring-1 ring-inset ring-gray-300 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-carbon-blue-60"
          />
        </div>
      </div>
      <div className="mb-5">
        <EmailInput
          value={email}
          onChange={(val, valid) => {
            setEmail(val);
            setIsEmailValid(valid);
          }}
        />
      </div>

      <div className="mb-5">
        <label
          className={`block text-sm mb-2 ${passwordError ? "font-bold text-carbon-gray-100" : "font-semibold text-carbon-gray-100"}`}
          htmlFor="password"
        >
          Password
        </label>
        <div className="relative flex items-center">
          <input
            required
            minLength={8}
            maxLength={128}
            autoComplete="new-password"
            aria-describedby={
              password
                ? "password-strength password-feedback"
                : "password-feedback"
            }
            aria-invalid={Boolean(passwordError)}
            onBlur={() => setPasswordTouched(true)}
            id="password"
            type={showPassword ? "text" : "password"}
            className={`w-full pl-4 pr-12 py-3 text-base text-carbon-gray-100 bg-white outline-none transition-all duration-200 ease-out ring-inset ${
              passwordError
                ? "ring-4 ring-black font-bold animate-shake"
                : "ring-1 ring-gray-300 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-carbon-blue-60"
            }`}
            placeholder="Create a password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="button"
            className="absolute right-3 bg-transparent border-none text-carbon-gray-100 cursor-pointer flex items-center justify-center p-1 transition-transform hover:scale-110 active:scale-95"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-controls="password"
          >
            {showPassword ? (
              <ViewOff size={20} strokeWidth={2.5} />
            ) : (
              <View size={20} strokeWidth={2.5} />
            )}
          </button>
        </div>
      </div>

      {password && (
        <div
          id="password-strength"
          className="-mt-2 mb-3"
          role="status"
          aria-live="polite"
        >
          <div className="flex gap-1 mb-2" aria-hidden="true">
            {[1, 2, 3].map((segment) => (
              <span
                key={segment}
                className={`h-1 flex-1 rounded-full ${segment <= strength ? strengthColor : "bg-gray-200"}`}
              />
            ))}
          </div>
          <p className="text-xs text-gray-500">
            Password strength:{" "}
            <span className="font-semibold">{strengthLabel}</span>
          </p>
        </div>
      )}
      <div id="password-feedback">
        {passwordError && (
          <p className="mb-4 text-xs text-red-600" role="alert">
            {passwordError}
          </p>
        )}
      </div>
      <div className="mb-5">
        <label
          htmlFor="confirm-password"
          className="block text-sm mb-2 font-semibold"
        >
          Confirm password
        </label>
        <div className="relative flex items-center">
          <input
            id="confirm-password"
            type={showConfirmPassword ? "text" : "password"}
            autoComplete="new-password"
            required
            maxLength={128}
            placeholder="Re-enter your password"
            onBlur={() => setConfirmTouched(true)}
            aria-invalid={confirmTouched && confirmPassword !== password}
            aria-describedby="confirm-feedback"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full pl-4 pr-12 py-3 text-base text-carbon-gray-100 bg-white outline-none ring-1 ring-inset ring-gray-300 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-carbon-blue-60"
          />
          <button
            type="button"
            className="absolute right-3 bg-transparent border-none text-carbon-gray-100 cursor-pointer flex items-center justify-center p-1 transition-transform hover:scale-110 active:scale-95"
            onClick={() => setShowConfirmPassword((visible) => !visible)}
            aria-label={
              showConfirmPassword
                ? "Hide confirm password"
                : "Show confirm password"
            }
            aria-controls="confirm-password"
          >
            {showConfirmPassword ? (
              <ViewOff size={20} strokeWidth={2.5} />
            ) : (
              <View size={20} strokeWidth={2.5} />
            )}
          </button>
        </div>
        <div id="confirm-feedback">
          {confirmTouched && confirmPassword !== password && (
            <p className="mt-2 text-xs text-red-600" role="status">
              Passwords do not match.
            </p>
          )}
        </div>
      </div>
      <AccountTypeSelector
        selectedType={accountType}
        onChange={setAccountType}
      />

      {accountType === "Print Shop" && (
        <div className="mb-5 border border-[#e0e0e0] p-4 bg-carbon-gray-10 mt-4">
          <h3 className="font-bold mb-4">Print Shop Details</h3>
          <div className="mb-4">
            <label
              className="block text-sm mb-2 font-semibold text-carbon-gray-100"
              htmlFor="shopName"
            >
              Shop Name
            </label>
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

      {retry.seconds > 0 && (
        <p role="timer" className="mb-4 text-sm text-gray-500">
          For security purposes, you can request another code in {retry.seconds}{" "}
          {retry.seconds === 1 ? "second" : "seconds"}.
        </p>
      )}
      <AuthErrorMessage message={error} />

      <div className="mt-2">
        <SubmitButton
          label={
            retry.seconds > 0
              ? `Try again in ${retry.seconds}s`
              : "Continue to verification"
          }
          isLoading={isSubmitting}
          disabled={isSubmitting || retry.seconds > 0}
        />
      </div>
    </form>
  );
};
