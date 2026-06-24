'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { GlobeAltIcon, FilmIcon, PlusIcon } from '@heroicons/react/24/outline';

interface OwnWebsite { id: string | number; websiteName: string; imageUrl: string | null }
interface OwnAdPost { id: number; title: string; thumbnail_url: string | null }

function Box({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-surface-1 p-4">
      <h3 className="text-xs font-bold uppercase tracking-wide text-muted mb-3">{title}</h3>
      {children}
    </div>
  );
}

export default function RightRail() {
  const [websites, setWebsites]         = useState<OwnWebsite[]>([]);
  const [adPosts, setAdPosts]           = useState<OwnAdPost[]>([]);
  const [youtubeConnected, setYoutubeConnected] = useState(false);
  const [loading, setLoading]           = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const sessRes  = await fetch('/api/auth/session', { credentials: 'include', cache: 'no-store' });
        const sessJson = await sessRes.json().catch(() => ({}));
        const userId   = sessJson?.data?.user?.id ?? sessJson?.data?.user?._id;
        if (!userId || cancelled) return;

        const [wRes, aRes, sRes] = await Promise.all([
          fetch(`/api/proxy/api/websites/${userId}`, { credentials: 'include', cache: 'no-store' }),
          fetch(`/api/social/ad-posts?user_uuid=${userId}`, { credentials: 'include', cache: 'no-store' }),
          fetch(`/api/social/stats?user_uuid=${userId}`, { credentials: 'include', cache: 'no-store' }),
        ]);

        if (cancelled) return;

        const wJson = await wRes.json().catch(() => ({}));
        setWebsites(Array.isArray(wJson) ? wJson : (wJson?.data ?? []));

        const aJson = await aRes.json().catch(() => ({}));
        setAdPosts(Array.isArray(aJson?.data) ? aJson.data : []);

        const sJson = await sRes.json().catch(() => ({}));
        const accounts = Array.isArray(sJson?.data) ? sJson.data : [];
        setYoutubeConnected(accounts.some((a: { provider: string }) => a.provider === 'youtube'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  return (
    <aside className="w-72 shrink-0 self-start sticky top-4 space-y-4 p-4">
      <Box title="Your websites">
        {loading ? (
          <div className="h-16 rounded-lg bg-background animate-pulse" />
        ) : (
          <>
            <p className="text-sm text-white mb-2">{websites.length} connected</p>
            <div className="space-y-2 mb-3">
              {websites.slice(0, 3).map((w) => (
                <div key={w.id} className="flex items-center gap-2 text-sm text-subtle truncate">
                  {w.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={w.imageUrl} alt="" className="w-5 h-5 rounded object-cover shrink-0" />
                  ) : (
                    <GlobeAltIcon className="w-4 h-4 shrink-0" />
                  )}
                  <span className="truncate">{w.websiteName}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/?panel=add-website"
                scroll={false}
                className="flex-1 inline-flex items-center justify-center gap-1 text-xs font-bold px-3 py-2 rounded-full bg-coral text-white hover:bg-coral-dark transition-colors"
              >
                <PlusIcon className="w-3.5 h-3.5" /> Add website
              </Link>
              <Link href="/?panel=websites" scroll={false} className="text-xs font-medium text-subtle hover:text-white">
                View all
              </Link>
            </div>
          </>
        )}
      </Box>

      <Box title="Your YouTube ads">
        {loading ? (
          <div className="h-16 rounded-lg bg-background animate-pulse" />
        ) : (
          <>
            <p className="text-sm text-white mb-2">{adPosts.length} posted</p>
            <div className="space-y-2 mb-3">
              {adPosts.slice(0, 3).map((p) => (
                <div key={p.id} className="flex items-center gap-2 text-sm text-subtle truncate">
                  <FilmIcon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{p.title}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2">
              {youtubeConnected ? (
                <Link
                  href="/?panel=add-ad"
                  scroll={false}
                  className="flex-1 inline-flex items-center justify-center gap-1 text-xs font-bold px-3 py-2 rounded-full bg-blue text-white hover:bg-blue-dark transition-colors"
                >
                  <PlusIcon className="w-3.5 h-3.5" /> Add ad
                </Link>
              ) : (
                <Link
                  href="/?panel=connect-accounts"
                  scroll={false}
                  className="flex-1 inline-flex items-center justify-center gap-1 text-xs font-bold px-3 py-2 rounded-full bg-background border border-border text-subtle hover:text-white transition-colors"
                >
                  Connect YouTube
                </Link>
              )}
              <Link href="/?panel=ad-posts" scroll={false} className="text-xs font-medium text-subtle hover:text-white">
                View all
              </Link>
            </div>
          </>
        )}
      </Box>
    </aside>
  );
}
