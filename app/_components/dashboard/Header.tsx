'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { UserIcon } from '@heroicons/react/24/outline';

// Just the account avatar, top-right. The logo now lives in the sidebar
// (LeftRail), so this no longer needs to be a full-width bar.
export default function Header() {
  const [avatar, setAvatar] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const showHomeTitle = !searchParams.get('panel');

  useEffect(() => {
    fetch('/api/auth/session', { credentials: 'include', cache: 'no-store' })
      .then((r) => r.json())
      .then((json) => setAvatar(json?.data?.user?.avatar ?? null))
      .catch(() => {});
  }, []);

  return (
    <div className="flex items-center gap-3 px-6 pt-5">
      <div className="flex-1 min-w-0 text-center">
        {showHomeTitle && (
          <p className="text-sm sm:text-base font-semibold text-white truncate">
            Explore Hot Deals, Websites &amp; Broadcast Media
          </p>
        )}
      </div>
      <Link href="/?panel=profile" scroll={false} className="w-9 h-9 rounded-full bg-surface-2 border border-border flex items-center justify-center overflow-hidden shrink-0">
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} alt="" className="w-full h-full object-cover" />
        ) : (
          <UserIcon className="w-4 h-4 text-subtle" />
        )}
      </Link>
    </div>
  );
}
