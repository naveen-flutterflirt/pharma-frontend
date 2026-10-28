"use client";

import React, { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Lock, Mail, ArrowRight, Loader2, CheckCircle2, ShieldCheck, AlertCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

// Email validation regex (standard RFC 5322 compliant)
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get("redirect") || "/";

  const { login } = useAuth();

  // No auto-fill: initialized completely clean
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // Validation errors state
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Validate fields strictly before any submission
  const validateForm = (): boolean => {
    const errors: { email?: string; password?: string } = {};

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      errors.email = "Email address is required.";
    } else if (!EMAIL_REGEX.test(cleanEmail.toLowerCase())) {
      errors.email = "Please enter a valid email address (e.g., name@pharma.com).";
    }

    if (!password) {
      errors.password = "Password is required.";
    } else if (password.length < 6) {
      errors.password = "Password must be at least 6 characters long.";
    } else if (password.length > 128) {
      errors.password = "Password cannot exceed 128 characters.";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    if (fieldErrors.email) {
      setFieldErrors((prev) => ({ ...prev, email: undefined }));
    }
    if (generalError) setGeneralError(null);
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    if (fieldErrors.password) {
      setFieldErrors((prev) => ({ ...prev, password: undefined }));
    }
    if (generalError) setGeneralError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);

    // 1. Validate firstly before making any network request
    const isValid = validateForm();
    if (!isValid) {
      return;
    }

    setIsLoading(true);

    try {
      await login(email.trim(), password);
      setIsSuccess(true);
      setTimeout(() => {
        router.push(redirectPath);
      }, 400);
    } catch (err: any) {
      setGeneralError(err.message || "Failed to authenticate. Please check your credentials.");
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 min-h-screen w-full flex items-center justify-center bg-[#f4f7f6] p-4 sm:p-6 overflow-y-auto">
      {/* Background subtle ambient pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(#178582_1px,transparent_1px)] [background-size:24px_24px] opacity-[0.07] pointer-events-none" />

      {/* Main Secure Login Box */}
      <div className="relative w-full max-w-[420px] bg-white rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 p-8 sm:p-10 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Brand Header */}
        <div className="text-center mb-7">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#0c2427] text-white shadow-md shadow-[#0c2427]/20 mb-3.5">
            <span className="text-2xl font-bold text-[#178582]">+</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            Sign in to DMS
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Pharma Distribution Management System • Staff Portal
          </p>
        </div>

        {/* General Error Banner */}
        {generalError && (
          <div className="mb-5 p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 font-medium flex items-start gap-2.5 leading-relaxed animate-in fade-in duration-150">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span>{generalError}</span>
          </div>
        )}

        {/* Success Banner */}
        {isSuccess && (
          <div className="mb-5 p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 font-medium flex items-center gap-2 animate-in fade-in duration-150">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Identity verified! Redirecting to workspace...</span>
          </div>
        )}

        {/* Protected Login Form */}
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          
          {/* Email Input with Field Validation */}
          <div>
            <label htmlFor="staff-email" className="block text-xs font-semibold text-gray-700 mb-1.5">
              Staff Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-3 pointer-events-none" />
              <input
                id="staff-email"
                type="email"
                autoComplete="off"
                value={email}
                onChange={handleEmailChange}
                placeholder="name@company.com"
                className={`w-full pl-10 pr-3.5 py-2.5 bg-white rounded-lg border text-sm text-gray-900 placeholder:text-gray-400 transition-colors shadow-2xs focus:outline-none focus:ring-2 ${
                  fieldErrors.email
                    ? "border-red-400 focus:border-red-500 focus:ring-red-100"
                    : "border-gray-300 focus:border-[#178582] focus:ring-[#178582]/20"
                }`}
              />
            </div>
            {fieldErrors.email && (
              <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1 font-medium">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{fieldErrors.email}</span>
              </p>
            )}
          </div>

          {/* Password Input with Field Validation & Toggle */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="staff-password" className="block text-xs font-semibold text-gray-700">
                Password
              </label>
              <button
                type="button"
                onClick={() => alert("Please contact your central depot administrator to reset your staff credentials.")}
                className="text-xs font-medium text-[#178582] hover:underline cursor-pointer"
              >
                Forgot password?
              </button>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-3 pointer-events-none" />
              <input
                id="staff-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                onChange={handlePasswordChange}
                placeholder="••••••••"
                className={`w-full pl-10 pr-10 py-2.5 bg-white rounded-lg border text-sm text-gray-900 placeholder:text-gray-400 transition-colors shadow-2xs focus:outline-none focus:ring-2 ${
                  fieldErrors.password
                    ? "border-red-400 focus:border-red-500 focus:ring-red-100"
                    : "border-gray-300 focus:border-[#178582] focus:ring-[#178582]/20"
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-3 text-gray-400 hover:text-gray-600 cursor-pointer"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {fieldErrors.password && (
              <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1 font-medium">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{fieldErrors.password}</span>
              </p>
            )}
          </div>

          {/* Security Features & Session Status */}
          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded text-[#178582] focus:ring-[#178582] border-gray-300 cursor-pointer"
              />
              <span className="text-xs text-gray-600 font-medium">Remember me</span>
            </label>
            <div className="flex items-center gap-1 text-[11px] text-gray-400 font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>TLS / Rate Protected</span>
            </div>
          </div>

          {/* Submit Action */}
          <button
            type="submit"
            disabled={isLoading || isSuccess}
            className="w-full py-2.5 px-4 mt-2 rounded-lg bg-[#178582] hover:bg-[#136e6b] active:bg-[#0f5956] text-white text-sm font-semibold shadow-sm shadow-[#178582]/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Authenticating credentials...</span>
              </>
            ) : (
              <>
                <span>Sign in to Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Security Notice */}
        <div className="mt-6 pt-5 border-t border-gray-100 text-center">
          <p className="text-[11px] text-gray-400 leading-normal">
            Authorized pharmaceutical personnel only. All access attempts are timestamped and logged for statutory audit.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="fixed inset-0 flex items-center justify-center bg-[#f4f7f6]">
        <Loader2 className="w-8 h-8 animate-spin text-[#178582]" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
