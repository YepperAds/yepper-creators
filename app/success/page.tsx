'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

function SuccessContent() {
  const search = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = search.get('token');
    if (!token) {
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
      } catch {
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

export default function SuccessPage() {
  return (
    <Suspense fallback={<div className="p-6">Signing you in…</div>}>
      <SuccessContent />
    </Suspense>
  );
}
