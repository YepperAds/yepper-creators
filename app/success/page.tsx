'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

export default function SuccessPage() {
  const search = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = search.get('token');
    if (!token) {
      // No token — go back to login silently
      router.replace('/login');
      return;
    }

    async function exchange() {
      try {
        const res = await fetch('/api/auth/exchange-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.success) {
          // Silent failure: redirect to login rather than exposing errors
          router.replace('/login');
          return;
        }

        const user = json.data?.user ?? json.user ?? null;
        const needsProfile = user && (!user.username || (!user.whatTheyDo && !user.what_they_do));
        if (needsProfile) {
          router.replace('/choose-role');
        } else {
          router.replace('/explore');
        }
      } catch (err) {
        // Network error — redirect to login
        router.replace('/login');
      } finally {
        setLoading(false);
      }
    }

    exchange();
  }, [search, router]);

  if (loading) return <div className="p-6">Signing you in…</div>;
  if (error) return <div className="p-6 text-red-500">{error}</div>;
  return null;
}
