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
  // Email/password removed — Google-only auth

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

  async function handleSubmit(_ev: FormEvent) {
    // No-op — email/password login removed
    return;
  }

  function handleGoogleLogin() {
    setGoogleLoading(true);
    // Initiates the Google OAuth flow via backend API (frontend points to backend)
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

      {/* Email/password removed — only Google OAuth is available */}

      {/* Manual sign up removed — users sign up via Google on this page */}

      <p className="text-center text-xs text-zinc-600">
        By continuing you agree to Yepper&apos;s{' '}
        <Link href="/terms" className="text-zinc-500 hover:text-white underline underline-offset-2">Terms</Link>
        {' '}and{' '}
        <Link href="/privacy" className="text-zinc-500 hover:text-white underline underline-offset-2">Privacy Policy</Link>
      </p>
    </div>
  );
}