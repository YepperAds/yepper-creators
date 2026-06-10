'use client';

// ─────────────────────────────────────────────────────────────────────────────
// RegisterForm — converted from clientZip/src/pages/Register.js
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
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errors, setErrors] = useState({ name: '', email: '', password: '' });
  const [serverError, setServerError] = useState('');
  const [success, setSuccess] = useState<{ maskedEmail: string } | null>(null);

  function validate() {
    const e = { name: '', email: '', password: '' };
    if (!formData.name.trim()) e.name = 'Full name is required';
    else if (formData.name.trim().length < 2) e.name = 'Name must be at least 2 characters';
    if (!formData.email.trim()) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) e.email = 'Enter a valid email';
    if (!formData.password) e.password = 'Password is required';
    else if (formData.password.length < 6) e.password = 'Password must be at least 6 characters';
    setErrors(e);
    return !e.name && !e.email && !e.password;
  }

  async function handleSubmit(ev: FormEvent) {
    ev.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setServerError('');

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: formData.name.trim(), email: formData.email.trim(), password: formData.password }),
      });

      const data = (await res.json()) as RegisterResponse;

      if (!res.ok || !data.success) {
        setServerError(data.message ?? 'Registration failed. Please try again.');
        return;
      }

      setSuccess({ maskedEmail: data.maskedEmail ?? formData.email });
    } catch {
      setServerError('Could not reach the server. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function change(field: keyof typeof formData, value: string) {
    setFormData(p => ({ ...p, [field]: value }));
    setErrors(p => ({ ...p, [field]: '' }));
    setServerError('');
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

      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-zinc-800" />
        <span className="text-xs text-zinc-600">or</span>
        <div className="flex-1 h-px bg-zinc-800" />
      </div>

      {!showEmailForm ? (
        <button
          type="button"
          onClick={() => setShowEmailForm(true)}
          className="w-full py-2.5 px-4 rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-medium transition-colors"
        >
          Sign up with Email
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Full Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={e => change('name', e.target.value)}
              className={`w-full bg-zinc-900 border rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors ${errors.name ? 'border-red-500' : 'border-zinc-800'}`}
              placeholder="Jane Doe"
              autoFocus
            />
            {errors.name && <p className="mt-1 text-xs text-red-400">{errors.name}</p>}
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={e => change('email', e.target.value)}
              className={`w-full bg-zinc-900 border rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors ${errors.email ? 'border-red-500' : 'border-zinc-800'}`}
              placeholder="you@example.com"
              autoComplete="email"
            />
            {errors.email && <p className="mt-1 text-xs text-red-400">{errors.email}</p>}
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={e => change('password', e.target.value)}
                className={`w-full bg-zinc-900 border rounded-lg px-3 py-2 pr-10 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors ${errors.password ? 'border-red-500' : 'border-zinc-800'}`}
                placeholder="Minimum 6 characters"
                autoComplete="new-password"
              />
              <button type="button" onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 text-xs">
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            {errors.password && <p className="mt-1 text-xs text-red-400">{errors.password}</p>}
          </div>

          {serverError && (
            <p className="text-xs text-red-400 bg-red-950/40 border border-red-900 rounded-lg px-3 py-2">{serverError}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-white text-black text-sm font-semibold hover:bg-zinc-100 transition-colors disabled:opacity-60"
          >
            {loading ? <span className="inline-block w-4 h-4 border-2 border-zinc-400 border-t-black rounded-full animate-spin" /> : 'Create Account'}
          </button>
        </form>
      )}

      <p className="text-center text-xs text-zinc-500">
        Already have an account?{' '}
        <Link href="/login" className="text-zinc-300 hover:text-white underline underline-offset-2 transition-colors">Sign in</Link>
      </p>
    </div>
  );
}
