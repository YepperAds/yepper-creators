'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

export default function CompleteProfilePage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [whatTheyDo, setWhatTheyDo] = useState('Content Creator');
  const [fullName, setFullName] = useState<string | null>(null);
  const [usernameStatus, setUsernameStatus] = useState<'idle'|'checking'|'available'|'taken'>('idle');
  const [usernameReason, setUsernameReason] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!username.trim()) return setError('Username is required');
    if (!whatTheyDo) return setError('Occupation is required');
    if (usernameStatus === 'taken') return setError('Username is already taken');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/complete-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), what_they_do: whatTheyDo }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        setError(json.message ?? 'Failed to save profile');
        setLoading(false);
        return;
      }
      router.replace('/choose-role');
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';

  const checkUsername = useCallback(async (rawVal: string) => {
    const raw = String(rawVal ?? '').trim().toLowerCase();
    if (!raw) {
      setUsernameStatus('idle');
      setUsernameReason('');
      return;
    }
    setUsernameStatus('checking');
    try {
      const res = await fetch(`${apiBaseUrl}/auth/creator/check-username?username=${encodeURIComponent(raw)}`);
      const data = await res.json().catch(() => ({}));
      if (data && typeof data.available === 'boolean') {
        setUsernameStatus(data.available ? 'available' : 'taken');
        setUsernameReason(data.reason || (data.available ? '' : 'Taken'));
      } else {
        setUsernameStatus('idle');
      }
    } catch (err) {
      setUsernameStatus('idle');
    }
  }, [apiBaseUrl]);

  const handleUsernameChange = (val: string) => {
    const cleaned = val.replace(/[^a-z0-9_\.]/gi, '').toLowerCase();
    setUsername(cleaned);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => checkUsername(cleaned), 500);
  };

  useEffect(() => {
    // fetch session to prefill full name / username if available
    let mounted = true;
    (async () => {
      try {
        const res = await fetch('/api/auth/session');
        const json = await res.json().catch(() => ({}));
        const user = json?.data?.user;
        if (!mounted) return;
        if (user) {
          setFullName(user.name ?? user.fullName ?? user.full_name ?? null);
          if (user.username) {
            setUsername(user.username);
            checkUsername(user.username);
          }
        }
      } catch {}
    })();
    return () => { mounted = false; };
  }, [checkUsername]);

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-2">Complete your profile</h1>
      {fullName && <p className="text-sm text-(--color-muted) mb-2">Signed in as <strong>{fullName}</strong></p>}
      <p className="text-sm mb-4">Choose a public username (handler) and occupation.</p>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Username</label>
          <input value={username} onChange={(e) => handleUsernameChange(e.target.value)} className="w-full p-2 border rounded" />
          <div className="mt-1 text-xs">
            {usernameStatus === 'checking' && <span className="text-(--color-muted)">Checking…</span>}
            {usernameStatus === 'available' && <span className="text-green-500">Username available</span>}
            {usernameStatus === 'taken' && <span className="text-red-500">{usernameReason || 'Taken'}</span>}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Occupation</label>
          <select value={whatTheyDo} onChange={(e) => setWhatTheyDo(e.target.value)} className="w-full p-2 border rounded">
            <option>Content Creator</option>
            <option>Web Developer</option>
          </select>
        </div>
        {error && <div className="text-red-500">{error}</div>}
        <button type="submit" disabled={loading || usernameStatus === 'checking' || usernameStatus === 'taken'} className="px-4 py-2 bg-black text-white rounded">
          {loading ? 'Saving…' : 'Save and continue'}
        </button>
      </form>
    </div>
  );
}
