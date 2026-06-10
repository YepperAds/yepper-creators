'use client';

// ─────────────────────────────────────────────────────────────────────────────
// Unified Login Form
// ─────────────────────────────────────────────────────────────────────────────
// MIGRATION from yepper-creators original (Google-only) and
// clientZip Login.js (email/password + Google via react-router):
//
//   [MERGED]  Email/password form from clientZip/src/pages/Login.js
//   [MERGED]  Google OAuth button from both originals
//   [CHANGED] Form submission hits /api/auth/login (Next.js proxy) which
//             stores the JWT as an HTTP-only cookie — no localStorage
//   [CHANGED] On success, router.replace('/') — Next.js navigation
//   [REMOVED] react-router-dom, useAuth context, axios
//   [ADDED]   Register link to /register page
// ─────────────────────────────────────────────────────────────────────────────

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { LoginResponse } from '@/app/_types/auth';

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

export default function LoginForm() {
  const router = useRouter();

  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);

  // UI state
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({ email: '', password: '' });

  // Verification state (when user needs to verify email)
  const [needsVerification, setNeedsVerification] = useState(false);
  const [maskedEmail, setMaskedEmail] = useState('');

  function validate() {
    const e = { email: '', password: '' };
    if (!email.trim()) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Enter a valid email address';
    if (!password) e.password = 'Password is required';
    setFieldErrors(e);
    return !e.email && !e.password;
  }

  async function handleSubmit(ev: FormEvent) {
    ev.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = (await res.json()) as LoginResponse;

      if (!res.ok || !data.success) {
        if (data.requiresVerification) {
          setNeedsVerification(true);
          setMaskedEmail(data.maskedEmail ?? email);
        } else {
          setError(data.message ?? 'Invalid email or password.');
        }
        return;
      }

      // Cookie is set by the API route — go to role selection
      router.replace((data as { redirectTo?: string }).redirectTo ?? '/choose-role');
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleGoogleLogin() {
    setGoogleLoading(true);
    // Initiates the Google OAuth flow via Next.js /api/auth/google
    window.location.href = '/api/auth/google';
  }

  // ── Needs email verification ────────────────────────────────────────────────
  if (needsVerification) {
    return (
      <div className="space-y-4 text-center">
        <div className="w-12 h-12 mx-auto rounded-full bg-yellow-100 flex items-center justify-center text-2xl">✉️</div>
        <h3 className="font-semibold text-white">Check your email</h3>
        <p className="text-sm text-zinc-400">
          We sent a verification link to <span className="text-white">{maskedEmail}</span>. Click it to verify your account.
        </p>
        <button
          onClick={() => { setNeedsVerification(false); setError(''); }}
          className="text-xs text-zinc-500 underline"
        >
          Back to login
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">

      {/* ── OAuth buttons ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={googleLoading}
          className="w-full flex items-center justify-center gap-3 rounded-lg border border-zinc-800
            bg-zinc-900 hover:bg-zinc-800 hover:border-zinc-700 text-white text-sm font-medium
            py-2.5 px-4 transition-all duration-200 disabled:opacity-60"
        >
          {googleLoading
            ? <span className="w-4 h-4 border-2 border-zinc-600 border-t-white rounded-full animate-spin" />
            : <GoogleIcon />}
          Continue with Google
        </button>
      </div>

      {/* ── Divider ───────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-zinc-800" />
        <span className="text-xs text-zinc-600">or</span>
        <div className="flex-1 h-px bg-zinc-800" />
      </div>

      {/* ── Email/password toggle ─────────────────────────────────── */}
      {!showEmailForm ? (
        <button
          type="button"
          onClick={() => setShowEmailForm(true)}
          className="w-full py-2.5 px-4 rounded-lg border border-zinc-800 bg-zinc-900
            hover:bg-zinc-800 text-white text-sm font-medium transition-colors"
        >
          Continue with Email
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Email */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setFieldErrors(p => ({ ...p, email: '' })); setError(''); }}
              className={`w-full bg-zinc-900 border rounded-lg px-3 py-2 text-sm text-white
                placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors
                ${fieldErrors.email ? 'border-red-500' : 'border-zinc-800'}`}
              placeholder="you@example.com"
              autoComplete="email"
              autoFocus
            />
            {fieldErrors.email && <p className="mt-1 text-xs text-red-400">{fieldErrors.email}</p>}
          </div>

          {/* Password */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-zinc-400">Password</label>
              <Link href="/forgot-password" className="text-xs text-zinc-500 hover:text-white transition-colors">
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => { setPassword(e.target.value); setFieldErrors(p => ({ ...p, password: '' })); setError(''); }}
                className={`w-full bg-zinc-900 border rounded-lg px-3 py-2 pr-10 text-sm text-white
                  placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors
                  ${fieldErrors.password ? 'border-red-500' : 'border-zinc-800'}`}
                placeholder="••••••••"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 text-xs"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            {fieldErrors.password && <p className="mt-1 text-xs text-red-400">{fieldErrors.password}</p>}
          </div>

          {/* General error */}
          {error && (
            <p className="text-xs text-red-400 bg-red-950/40 border border-red-900 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-white text-black text-sm font-semibold
              hover:bg-zinc-100 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading
              ? <span className="inline-block w-4 h-4 border-2 border-zinc-400 border-t-black rounded-full animate-spin" />
              : 'Sign In'}
          </button>
        </form>
      )}

      {/* ── Register link ─────────────────────────────────────────── */}
      <p className="text-center text-xs text-zinc-500">
        Don&apos;t have an account?{' '}
        <Link href="/register" className="text-zinc-300 hover:text-white underline underline-offset-2 transition-colors">
          Sign up
        </Link>
      </p>

      <p className="text-center text-xs text-zinc-600">
        By continuing you agree to Yepper&apos;s{' '}
        <Link href="/terms" className="text-zinc-500 hover:text-white underline underline-offset-2">Terms</Link>
        {' '}and{' '}
        <Link href="/privacy" className="text-zinc-500 hover:text-white underline underline-offset-2">Privacy Policy</Link>
      </p>
    </div>
  );
}