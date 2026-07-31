'use client';

// ─────────────────────────────────────────────────────────────────────────────
// RegisterForm: converted from clientZip/src/pages/Register.js
// ─────────────────────────────────────────────────────────────────────────────
// CHANGES FROM ORIGINAL:
//   [1] react-router-dom → Next.js useRouter + Link
//   [2] useAuth/signup context → direct fetch to /api/auth/register (proxy)
//   [3] After success, shows a "check your email" screen (same UX as original)
//   [4] Google OAuth via /api/auth/google (Next.js route → adsense backend)
// ─────────────────────────────────────────────────────────────────────────────

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import type { RegisterResponse } from '@/app/_types/auth';

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

export default function RegisterForm() {
  // Manual email registration removed: Google-only signup
  const [googleLoading, setGoogleLoading] = useState(false);
  const [serverError, setServerError] = useState('');
  const [success, setSuccess] = useState<{ maskedEmail: string } | null>(null);

  async function handleSubmit(_ev?: FormEvent) {
    // No-op; manual registration removed
    return;
  }

  if (success) {
    return (
      <div className="text-center space-y-4">
        <div className="w-12 h-12 mx-auto rounded-full bg-green-900/40 border border-green-800 flex items-center justify-center text-2xl">✉️</div>
        <h3 className="font-semibold text-white">Check your email</h3>
        <p className="text-sm text-zinc-400">
          We sent a verification link to <span className="text-white">{success.maskedEmail}</span>. Click it to activate your account.
        </p>
        <Link href="/login" className="text-xs text-zinc-400 hover:text-white underline underline-offset-2">Back to login</Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => { setGoogleLoading(true); window.location.href = '/api/auth/google'; }}
          disabled={googleLoading}
          className="w-full flex items-center justify-center gap-3 rounded-lg border border-zinc-800
            bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-medium py-2.5 px-4 transition-colors disabled:opacity-60"
        >
          {googleLoading
            ? <span className="w-4 h-4 border-2 border-zinc-600 border-t-white rounded-full animate-spin" />
            : <GoogleIcon />}
          Sign up with Google
        </button>
      </div>

      {/* Manual email sign-up removed, only Google signup is supported */}

      <p className="text-center text-xs text-zinc-500">Manual registration is disabled. Use Sign up with Google above.</p>
    </div>
  );
}
