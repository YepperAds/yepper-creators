'use client';

import { useState } from 'react';
import Link from 'next/link';

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

export default function LoginForm() {
  const [googleLoading, setGoogleLoading] = useState(false);

  function handleGoogleLogin() {
    setGoogleLoading(true);
    window.location.href = '/api/auth/google';
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="text-center">
        <h1 className="text-xl font-bold text-white font-(--font-display)">Welcome to Yepper</h1>
        <p className="mt-1 text-sm text-subtle">Log in to manage your websites and ads.</p>
      </div>

      <button
        type="button"
        onClick={handleGoogleLogin}
        disabled={googleLoading}
        className="w-full flex items-center justify-center gap-3 rounded-full border border-border
          bg-background hover:bg-surface-3 text-white text-sm font-medium
          py-2.5 px-4 transition-colors disabled:opacity-60"
      >
        {googleLoading
          ? <span className="w-4 h-4 border-2 border-border border-t-coral rounded-full animate-spin" />
          : <GoogleIcon />}
        Continue with Google
      </button>

      {/* DEV-ONLY: local testing bypass, delete this block + app/api/auth/dev-login before shipping */}
      {process.env.NODE_ENV !== 'production' && (
        <a
          href="/api/auth/dev-login"
          className="w-full flex items-center justify-center gap-2 rounded-full border border-dashed border-amber-300
            bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-medium
            py-2.5 px-4 transition-colors"
        >
          Continue as Local Dev (testing only)
        </a>
      )}

      <p className="text-center text-xs text-muted">
        By continuing you agree to Yepper&apos;s{' '}
        <Link href="/terms" className="text-subtle hover:text-white underline underline-offset-2">Terms</Link>
        {' '}and{' '}
        <Link href="/privacy" className="text-subtle hover:text-white underline underline-offset-2">Privacy Policy</Link>
      </p>
    </div>
  );
}
