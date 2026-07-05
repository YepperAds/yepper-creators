'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { UserIcon } from '@heroicons/react/24/outline';

export default function Header() {
  const [avatar, setAvatar] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/auth/session', { credentials: 'include', cache: 'no-store' })
      .then((r) => r.json())
      .then((json) => setAvatar(json?.data?.user?.avatar ?? null))
      .catch(() => {});
  }, []);

  return (
    <header className="h-16 shrink-0 border-b border-border bg-surface-1/80 backdrop-blur-md flex items-center justify-between px-4 sticky top-0 z-20">
      <Link href="/" className="flex items-center gap-2">
        <Image src="/logos/yepper-logo.png" alt="Yepper" width={100} height={28} className="h-7 w-auto object-contain" priority />
      </Link>

      <div className="flex items-center gap-3">
        <Link href="/?panel=profile" scroll={false} className="w-9 h-9 rounded-full bg-background border border-border flex items-center justify-center overflow-hidden">
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} alt="" className="w-full h-full object-cover" />
          ) : (
            <UserIcon className="w-4 h-4 text-subtle" />
          )}
        </Link>
      </div>
    </header>
  );
}
