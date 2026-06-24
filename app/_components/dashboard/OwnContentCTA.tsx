'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { VideoCameraIcon, PlusIcon } from '@heroicons/react/24/outline';

// Defaults to "everything connected" so this never flashes on screen for
// users who actually have a website/YouTube linked — it only appears once
// we've confirmed something is actually missing.
export default function OwnContentCTA() {
  const [hasWebsite, setHasWebsite] = useState(true);
  const [hasYoutube, setHasYoutube] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const sessRes = await fetch('/api/auth/session', { credentials: 'include', cache: 'no-store' });
        const sessJson = await sessRes.json().catch(() => ({}));
        const userId = sessJson?.data?.user?.id ?? sessJson?.data?.user?._id;
        if (!userId || cancelled) return;

        const [wRes, sRes] = await Promise.all([
          fetch(`/api/proxy/api/websites/${userId}`, { credentials: 'include', cache: 'no-store' }),
          fetch(`/api/social/stats?user_uuid=${userId}`, { credentials: 'include', cache: 'no-store' }),
        ]);
        if (cancelled) return;

        const wJson = await wRes.json().catch(() => ({}));
        const ownWebsites = Array.isArray(wJson) ? wJson : (wJson?.data ?? []);

        const sJson = await sRes.json().catch(() => ({}));
        const accounts = Array.isArray(sJson?.data) ? sJson.data : [];

        if (!cancelled) {
          setHasWebsite(ownWebsites.length > 0);
          setHasYoutube(accounts.some((a: { provider: string }) => a.provider === 'youtube'));
        }
      } catch {
        // leave defaults — fails quiet, not worth surfacing a CTA over a network blip
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  if (hasWebsite && hasYoutube) return null;

  return (
    <div className="mb-5 rounded-2xl border border-coral/20 bg-coral/5 p-4 flex flex-wrap items-center gap-3">
      <p className="text-sm font-semibold text-white flex-1 min-w-[220px]">
        Get your own website or channel showing up here on Yepper.
      </p>
      <div className="flex gap-2">
        {!hasWebsite && (
          <Link
            href="/?panel=add-website"
            scroll={false}
            className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-full bg-coral text-white hover:bg-coral-dark transition-colors"
          >
            <PlusIcon className="w-3.5 h-3.5" /> Add your website
          </Link>
        )}
        {!hasYoutube && (
          <Link
            href="/?panel=connect-accounts"
            scroll={false}
            className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-full bg-blue text-white hover:bg-blue-dark transition-colors"
          >
            <VideoCameraIcon className="w-3.5 h-3.5" /> Connect YouTube
          </Link>
        )}
      </div>
    </div>
  );
}
