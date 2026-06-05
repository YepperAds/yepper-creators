'use client';

import Link from 'next/link';

// ── OAuth buttons ──────────────────────────────────────────────
// The Google button securely redirects to the backend.
// Facebook and Apple are currently UX stubs for display only.
// ────────────────────────────────────────────────────────────────

export default function LoginForm() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';

  return (
    <div className="flex flex-col gap-6">

      <div className="flex flex-col gap-3">
        {/* Google Auth Button (Active) */}
        <button
          id="btn-google-login"
          type="button"
          className="w-full flex items-center justify-center gap-3 rounded-lg border border-zinc-800
            bg-zinc-900 hover:bg-zinc-800 hover:border-zinc-700 text-white text-sm font-medium
            py-2.5 px-4 transition-all duration-200"
          onClick={() => { window.location.href = `${apiUrl}/auth/google`; }}>
          <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Continue with Google
        </button>

        {/* Facebook Auth Button (UI Stub) */}
        <button
          type="button"
          className="w-full flex items-center justify-center gap-3 rounded-lg border border-zinc-800
            bg-zinc-900 hover:bg-zinc-800 hover:border-zinc-700 text-white text-sm font-medium
            py-2.5 px-4 transition-all duration-200 opacity-90 hover:opacity-100"
          onClick={() => { console.log('Facebook auth stub'); }}>
          <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" aria-hidden="true" fill="#1877F2">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            <path fill="#fff" d="M16.671 15.542l.532-3.469h-3.328V9.823c0-.949.465-1.874 1.956-1.874h1.514V5.002s-1.374-.235-2.686-.235c-2.741 0-4.533 1.662-4.533 4.669v2.637H7.078v3.469h3.047v8.385a12.09 12.09 0 003.75 0v-8.385h2.796z"/>
          </svg>
          Continue with Facebook
        </button>

        {/* Apple Auth Button (UI Stub) */}
        <button
          type="button"
          className="w-full flex items-center justify-center gap-3 rounded-lg border border-zinc-800
            bg-zinc-900 hover:bg-zinc-800 hover:border-zinc-700 text-white text-sm font-medium
            py-2.5 px-4 transition-all duration-200 opacity-90 hover:opacity-100"
          onClick={() => { console.log('Apple auth stub'); }}>
          <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" aria-hidden="true" fill="#FFFFFF">
            <path d="M16.5 12.3c0-2.3 1.9-3.4 2-3.4-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.8-3.5.8-.8 0-1.9-.8-3.1-.8-1.6 0-3.1.9-3.9 2.4-1.7 2.9-.4 7.2 1.2 9.5.8 1.1 1.7 2.4 2.9 2.3 1.1-.1 1.6-.8 3-.8 1.4 0 1.9.8 3 .8 1.2.1 2-.1 2.9-1.2h.1c.8-1.2 1.1-2.3 1.1-2.4-.1-.1-2.3-.9-2.3-3.6zM15 4.8c.6-.7 1-1.7 1-2.8 0-.1 0-.2 0-.2-1 .1-2.1.6-2.8 1.4-.6.6-1 1.6-1 2.7 0 .1 0 .2 0 .2 1-.1 2.1-.6 2.8-1.3z" />
          </svg>
          Continue with Apple
        </button>
      </div>

      <p className="text-center text-xs" style={{ color: '#444' }}>
        By continuing, you agree to Yepper&apos;s{' '}
        <Link href="/terms" className="text-zinc-400 hover:text-white underline underline-offset-2 transition-colors">
          Terms of Service
        </Link>{' '}and{' '}
        <Link href="/privacy" className="text-zinc-400 hover:text-white underline underline-offset-2 transition-colors">
          Privacy Policy
        </Link>
      </p>

    </div>
  );
}
