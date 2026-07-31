'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, AUTH_ENDPOINTS } from '@/app/_lib/api';
import type { AuthResponse } from '@/app/_types/auth';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    async function check() {
      try {
        const result = await api.get<AuthResponse>(AUTH_ENDPOINTS.checkSession);

        if (result.ok && result.data?.success && result.data.data?.user) {
          router.replace('/');
        } else {
          // Covers 401, 503, network errors: just show the login form
          setChecked(true);
        }
      } catch {
        setChecked(true);
      }
    }
    check();
  }, [router]);

  if (!checked) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-border border-t-coral rounded-full animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}