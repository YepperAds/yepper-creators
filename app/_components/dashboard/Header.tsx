'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import Image from 'next/image';
import Link from 'next/link';
import { MoonIcon, SunIcon, UserIcon } from '@heroicons/react/24/outline';

export default function Header() {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [avatar, setAvatar] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
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
        {mounted && (
          <button
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            className="p-2 rounded-full hover:bg-background text-subtle hover:text-white transition-colors"
            title="Toggle theme"
          >
            {resolvedTheme === 'dark' ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
          </button>
        )}
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
